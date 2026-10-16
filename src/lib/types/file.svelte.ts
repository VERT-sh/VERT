import { byNative, converters } from "$lib/converters";
import type { Converter } from "$lib/converters/converter.svelte";
import { m } from "$lib/paraglide/messages";
import { ToastManager } from "$lib/util/toast.svelte";
import { addDialog } from "$lib/store/DialogProvider";
import type { Component } from "svelte";
import { MAX_ARRAY_BUFFER_SIZE } from "$lib/store/index.svelte";
import FallbackToast from "$lib/components/functional/popups/FallbackToast.svelte";
import SlowConversionToast from "$lib/components/functional/popups/SlowConversionToast.svelte";
import ServerUploadWarning from "$lib/components/functional/popups/ServerUploadWarning.svelte";
import type {
	ConversionSettings,
	NormalizedSettings,
	SettingCategories,
} from "./conversion-settings";
import { error, log } from "$lib/util/logger.svelte";
import { readSettings } from "$lib/util/settings";
import { formatFilename } from "$lib/util/file";
import { conversionConcurrency } from "$lib/util/consts";
import { fileTypeFromBuffer } from "file-type";

const LARGE_FILE = 2 * 1024 * 1024 * 1024; // 2GB
const FILE_TYPE_HEADER_SIZE = 4100;

type ServerWarningRequest = {
	filename: string;
	resolve: (shouldProceed: boolean) => void;
};

const serverWarningQueue: ServerWarningRequest[] = [];
let serverWarningActive = false;

const processServerWarningQueue = () => {
	if (serverWarningActive) return;

	if (localStorage.getItem("acceptedExternalWarning") === "true") {
		while (serverWarningQueue.length)
			serverWarningQueue.shift()?.resolve(true);
		return;
	}

	const request = serverWarningQueue.shift();
	if (!request) return;

	serverWarningActive = true;
	let resolved = false;

	const finish = (shouldProceed: boolean, dontShowAgain = false) => {
		if (resolved) return;
		resolved = true;
		serverWarningActive = false;

		if (dontShowAgain) {
			localStorage.setItem("acceptedExternalWarning", "true");
			log(
				["file", "warning"],
				`external upload warning preference saved: ${localStorage.getItem("acceptedExternalWarning")}`,
			);
		}
		request.resolve(shouldProceed);

		if (dontShowAgain) {
			while (serverWarningQueue.length)
				serverWarningQueue.shift()?.resolve(true);
		}

		queueMicrotask(processServerWarningQueue);
	};

	let dontShowAgain = true;
	const additional = {
		filename: request.filename,
		onDontShowAgainChange: (value: boolean) => {
			dontShowAgain = value;
		},
	};

	addDialog(
		m["convert.external_warning.title"](),
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ServerUploadWarning as any,
		[
			{
				text: m["convert.external_warning.no"](),
				action: () => finish(false),
			},
			{
				text: m["convert.external_warning.yes"](),
				action: () => finish(true, dontShowAgain),
			},
		],
		"warning",
		additional,
	);
};

export type UnavailableReasons = "vertd-size-limit" | "other-reason"; // find more stuff to add

export class VertFile {
	public id: string = Math.random().toString(36).slice(2, 8);
	public readonly file: File;
	public readonly originalFrom: string;

	public from = $state("");
	public name = $state("");
	public to = $state("");
	public size = $state(0);
	public fileType = $state<Awaited<ReturnType<typeof fileTypeFromBuffer>>>();
	public isZip = $state(() => this.from === ".zip");

	public conversionSettings = $state<ConversionSettings>({}); // empty object / key = default
	public progress = $state(0);
	public result = $state<VertFile | null>(null);
	public blobUrl = $state<string>();
	public processing = $state(false);
	public cancelled = $state(false);
	public unavailableConverters = $state<Record<string, UnavailableReasons>>(
		{},
	);
	public vertdSizeWarningShown = false;

	public converters: Converter[] = [];
	public archiveFormats?: string[];
	private fallbackToastId: number | null = null;
	private slowConversionToastId: number | null = null;
	private attemptedConverters = new Set<string>();
	private retryingFallback = false;
	private postDownload: (() => Promise<void>) | null = null;
	private disposal: Promise<void> | null = null;
	private disposed = false;
	private activeConverterName: string | null = null;
	private fileTypeMismatchShown = false;
	private fileTypeCheck: Promise<void> | null = null;

	constructor(file: File, to: string, blobUrl?: string) {
		const ext = file.name.split(".").pop();
		const newFile = new File(
			[file],
			`${file.name.split(".").slice(0, -1).join(".")}.${ext?.toLowerCase()}`,
		);
		this.file = newFile;
		this.name = newFile.name;
		this.from = ("." + ext || "").toLowerCase();
		this.originalFrom = this.from;
		this.to = to.startsWith(".") ? to : `.${to}`;
		this.converters = converters.filter((c) =>
			c.formatStrings().includes(this.from),
		);
		this.convert = this.convert.bind(this);
		this.download = this.download.bind(this);
		this.blobUrl = blobUrl;
		this.size = newFile.size;

		log(
			["file", "init"],
			`findConverters: ${this.findConverters()
				.map((c) => c.name)
				.join(", ")}`,
		);
	}

	public setPostDownload(cleanup: (() => Promise<void>) | null) {
		// Legacy name: cleanup runs on disposal, not download; OPFS backs repeated reads.
		this.postDownload = cleanup;
	}

	public dispose(): Promise<void> {
		this.disposed = true;
		return (this.disposal ??= (async () => {
			await this.result?.dispose();
			this.result = null;
			try {
				await this.postDownload?.();
				this.postDownload = null;
			} catch (err) {
				log(
					["file", "cleanup"],
					`resource cleanup failed for ${this.name}: ${err}`,
				);
			} finally {
				if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
				this.blobUrl = undefined;
			}
		})());
	}

	public getAvailableSettings(
		input: VertFile,
		converter: string | undefined = this.conversionSettings.converter,
	): Promise<SettingCategories> {
		const converterInstance = this.converters.find(
			(c) => c.name === converter,
		);
		if (!converterInstance) return Promise.resolve({});
		return converterInstance.getAvailableSettings(input);
	}

	public findConverters(
		supportedFormats: string[] = [this.from],
		unavailableConverters: Record<string, UnavailableReasons> = {},
	) {
		return this.converters
			.filter((converter) => {
				if (
					unavailableConverters[converter.name] ||
					!converter.isReady()
				)
					return false;
				if (
					!converter
						.formatStrings()
						.some((f) => supportedFormats.includes(f))
				) {
					return false;
				}

				if (
					supportedFormats.includes(this.from) &&
					supportedFormats.includes(this.to)
				) {
					if (!converter.formatStrings().includes(this.to)) {
						return false;
					}

					const theirFrom = converter.supportedFormats.find(
						(f) => f.name === this.from,
					);
					const theirTo = converter.supportedFormats.find(
						(f) => f.name === this.to,
					);
					if (!theirFrom || !theirTo) return false;
					if (!theirFrom.isNative && !theirTo.isNative) return false;
				}

				return true;
			})
			.sort(byNative(this.from))
			.sort((a, b) => {
				// sort by priority of format
				const aFrom = a.supportedFormats.find(
					(f) => f.name === this.from,
				);
				const bFrom = b.supportedFormats.find(
					(f) => f.name === this.from,
				);
				const aPriority = aFrom ? aFrom.priority : 1;
				const bPriority = bFrom ? bFrom.priority : 1;
				return bPriority - aPriority;
			});
	}

	// returns true if there is at least one converter that can convert from `from` to `to`
	public hasAvailableConverter(from: string, to: string): boolean {
		return this.converters.some((converter) => {
			if (
				this.unavailableConverters[converter.name] ||
				!converter.isReady()
			)
				return false;

			const fromInfo = converter.supportedFormats.find(
				(info) => info.name === from,
			);
			const toInfo = converter.supportedFormats.find(
				(info) => info.name === to,
			);
			return (
				!!fromInfo &&
				!!toInfo &&
				fromInfo.fromSupported &&
				toInfo.toSupported &&
				(fromInfo.isNative || toInfo.isNative)
			);
		});
	}

	public isLarge(): boolean {
		return this.file.size > MAX_ARRAY_BUFFER_SIZE;
	}

	public supportsStreaming(): boolean {
		// vertd supports server-side streaming; mediabunny can stream to OPFS if available
		const opfsSupported =
			typeof navigator !== "undefined" &&
			"storage" in navigator &&
			typeof navigator.storage.getDirectory === "function";

		const availableConverters = this.isZip()
			? this.converters
			: this.findConverters();
		return availableConverters.some(
			(converter) =>
				converter.name === "vertd" ||
				(converter.name === "mediabunny" && opfsSupported),
		);
	}

	public checkFileType(): Promise<void> {
		return (this.fileTypeCheck ??= this.detectFileType());
	}

	private async detectFileType() {
		try {
			this.fileType = await fileTypeFromBuffer(
				await this.file.slice(0, FILE_TYPE_HEADER_SIZE).arrayBuffer(),
			);

			if (!this.fileType) return;

			const forceKeep = ["mpo"];
			const aliases: Record<string, string> = {
				// original: alias
				jpg: "jpeg",
				jfif: "jpeg",
				jpe: "jpeg",
				tif: "tiff",
				ogx: "ogv",
				wmv: "asf",
				wma: "asf",
				mpg: "mpeg",
				mpe: "mpeg",
				mpv: "mpeg",
			};
			const fileExtension = this.originalFrom.slice(1);
			const isPngContainer =
				this.fileType.ext === "png" || this.fileType.ext === "apng";
			// preserve file type for png and apng so they can convert
			// TODO: apng can't be converted with magick-wasm - use another library for it
			const detectedExtension = forceKeep.includes(fileExtension)
				? fileExtension
				: isPngContainer &&
					  (fileExtension === "png" || fileExtension === "apng")
					? fileExtension
					: (aliases[this.fileType.ext] ?? this.fileType.ext);
			const expectedExtension = aliases[fileExtension] ?? fileExtension;

			if (detectedExtension !== expectedExtension) {
				this.from = `.${detectedExtension}`;
				if (!this.fileTypeMismatchShown) {
					error(
						["file", "type"],
						`file type mismatched: expected ${expectedExtension}, detected ${detectedExtension}`,
					);
					ToastManager.add({
						type: "warning",
						disappearing: false,
						message: m["workers.warnings.file_type_mismatch"]({
							filename: this.file.name,
							expected: expectedExtension,
							actual: detectedExtension,
						}),
					});
					this.fileTypeMismatchShown = true;
				}
			} else {
				this.from = this.originalFrom;
			}

			this.converters = converters.filter((converter) =>
				converter.formatStrings().includes(this.from),
			);
		} catch (error) {
			log(
				["file", "type"],
				`failed to detect file type for ${this.file.name}: ${error}`,
			);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async convert(...args: any[]) {
		if (this.disposed) return;
		if (!this.retryingFallback) this.attemptedConverters.clear();
		this.cancelled = false;
		let res: VertFile | undefined;
		try {
			log(
				["file", "convert"],
				`Starting conversion for ${this.file.name} from ${this.from} to ${this.to}`,
			);
			if (!this.converters.length) throw new Error("No converters found");

			let converter: Converter | undefined;
			const isImageSequence =
				this.conversionSettings.imageSequence && this.isZip();

			// force ffmpeg for image sequences
			// TODO: should allow vertd as well probably(?) but maybe in the future
			if (isImageSequence) {
				converter = converters.find((c) => c.name === "ffmpeg");
				if (!converter) {
					throw new Error(
						"FFmpeg converter not found for image sequence conversion",
					);
				}
			} else {
				const customConverter = this.converters.find(
					(c) => c.name === this.conversionSettings.converter,
				);
				converter = customConverter;

				if (!converter) {
					const compatibleConverters = this.findConverters([
						this.from,
						this.to,
					]);
					if (compatibleConverters.length) {
						converter = compatibleConverters[0];
						log(
							["file", "convert"],
							`found compatible converter: ${converter.name}`,
						);
					} else {
						log(
							["file", "convert"],
							`no compatible converter found for ${this.from} to ${this.to}`,
						);
					}
				} else {
					log(
						["file", "convert"],
						`using custom converter from settings: ${converter.name}`,
					);
				}
			}

			if (!converter) throw new Error("No converter found");

			const canProceed = await this.confirmServerWarning(converter);
			if (!canProceed) {
				this.cancelled = true;
				return;
			}
			this.attemptedConverters.add(converter.name);
			this.activeConverterName = converter.name;

			const normalizedSettings: NormalizedSettings =
				await converter.normalizeSettings(this, this.to, {
					...(await converter.getDefaultSettings(this)),
					...Object.fromEntries(
						Object.entries(this.conversionSettings).filter(
							([, value]) => value !== undefined,
						),
					),
				});

			for (const change of normalizedSettings.changes) {
				log(
					["file", "settings"],
					`changed setting "${change.setting}" from "${change.oldValue}" to "${change.newValue}" for file ${change.file}`,
				);
				ToastManager.add({
					type: "warning",
					message: m["workers.warnings.settings_change"]({
						setting: change.setting,
						oldValue: change.oldValue,
						newValue: change.newValue,
						file: change.file,
						to: this.to,
					}),
				});
			}

			log(["file", "convert"], `using converter: ${converter.name}`);

			await this.result?.dispose();
			this.result = null;
			this.progress = 0;
			this.processing = true;
			this.cancelled = false;
			// for zips: extract > convert each > re-zip
			// else convert normally
			res =
				this.isZip() && !this.conversionSettings.imageSequence
					? await this.convertZip(
							converter,
							normalizedSettings.settings,
						)
					: await converter.convert(
							this,
							this.to,
							normalizedSettings.settings,
							...args,
						);
			if (this.disposed || this.cancelled) {
				await res.dispose();
				return;
			}
			this.result = res;
			if (this.fallbackToastId !== null) {
				ToastManager.remove(this.fallbackToastId);
				this.fallbackToastId = null;
			}
			if (this.slowConversionToastId !== null) {
				ToastManager.remove(this.slowConversionToastId);
				this.slowConversionToastId = null;
			}
		} catch (err) {
			if (this.disposed) return;
			if (!this.cancelled) this.toastErr(err);

			const compatibleConverters = this.findConverters([
				this.from,
				this.to,
			]);
			const nextConverter = compatibleConverters.find(
				(c) => !this.attemptedConverters.has(c.name),
			);

			// TODO: should figure out a cleaner way to do this
			if (!this.cancelled && nextConverter) {
				if (this.fallbackToastId !== null)
					ToastManager.remove(this.fallbackToastId);

				this.fallbackToastId = ToastManager.add({
					type: "warning",
					disappearing: false,
					message: FallbackToast,
					additional: {
						filename: this.file.name,
						nextConverter: nextConverter.name,
						onNext: async () => {
							if (this.fallbackToastId !== null)
								ToastManager.remove(this.fallbackToastId);
							this.fallbackToastId = null;

							log(
								["file", "convert"],
								`retrying ${this.name} with next compatible converter: ${nextConverter.name}`,
							);

							this.conversionSettings = {
								...this.conversionSettings,
								converter: nextConverter.name,
							};
							this.retryingFallback = true;
							try {
								await this.convert(...args);
							} finally {
								this.retryingFallback = false;
							}
						},
						onCancel: () => {
							if (this.fallbackToastId !== null)
								ToastManager.remove(this.fallbackToastId);
							this.fallbackToastId = null;
							this.cancelled = true;
						},
					},
				});
			} else if (!this.cancelled) {
				this.cancelled = true;
				ToastManager.add({
					type: "error",
					message: m["convert.errors.converter_fallback.all_failed"]({
						filename: this.file.name,
					}),
				});
			}

			await this.result?.dispose();
			this.result = null;
		} finally {
			this.processing = false;
			this.activeConverterName = null;
		}
		return res;
	}

	private async confirmServerWarning(converter: Converter): Promise<boolean> {
		if (converter.name !== "vertd") return true;
		if (localStorage.getItem("acceptedExternalWarning") === "true")
			return Promise.resolve(true);

		return new Promise((resolve) => {
			serverWarningQueue.push({ filename: this.file.name, resolve });
			processServerWarningQueue();
		});
	}

	private async convertZip(
		converter: Converter,
		settings: ConversionSettings,
	): Promise<VertFile> {
		const { extractZip, createZip } = await import("$lib/util/file");
		const { default: PQueue } = await import("p-queue");

		const entries = await extractZip(this.file);
		const totalFiles = entries.length;
		const fileProgress: number[] = new Array(totalFiles).fill(0);
		const convertedFiles: File[] = [];
		const convertedResults: VertFile[] = [];
		const failedFiles: string[] = [];
		const progressFiles = new Map<number, VertFile>();
		const progressInterval = setInterval(() => {
			for (const [index, file] of progressFiles)
				fileProgress[index] = file.progress;
			updateProgress();
		}, 100);

		const queue = new PQueue({
			concurrency: conversionConcurrency(),
		});

		const updateProgress = () => {
			const totalProgress = fileProgress.reduce((sum, p) => sum + p, 0);
			this.progress = totalFiles
				? Math.round(totalProgress / totalFiles)
				: 100;
		};

		try {
			// convert all files in the zip
			await Promise.allSettled(
				entries.map(({ filename, data }, index) =>
					queue.add(async () => {
						try {
							if (this.cancelled) {
								throw new Error("Conversion cancelled");
							}

							const tempVFile = new VertFile(
								new File([new Uint8Array(data)], filename, {
									type: "application/octet-stream",
								}),
								this.to,
							);
							tempVFile.from =
								this.archiveFormats?.[index] ?? tempVFile.from;
							tempVFile.converters = [converter];

							if (converter.reportsProgress) {
								progressFiles.set(index, tempVFile);
								try {
									const converted = await converter.convert(
										tempVFile,
										this.to,
										settings,
									);

									convertedResults.push(converted);
									convertedFiles[index] = converted.file;
									fileProgress[index] = 100;
									updateProgress();
								} finally {
									progressFiles.delete(index);
								}
							} else {
								// else track progress via completions only
								const converted = await converter.convert(
									tempVFile,
									this.to,
									settings,
								);

								convertedResults.push(converted);
								convertedFiles[index] = converted.file;

								fileProgress[index] = 100;
								updateProgress();
							}
						} catch (err) {
							if (!this.cancelled) {
								const message =
									err instanceof Error
										? err.message
										: String(err);
								failedFiles[index] = `${filename}: ${message}`;
								error(
									["file", "zip"],
									`failed to convert archive member ${filename}: ${message}`,
								);
							}
						} finally {
							progressFiles.delete(index);
							fileProgress[index] = 100;
							updateProgress();
						}
					}),
				),
			);
			// return zip of converted files
			if (this.cancelled) throw new Error("Conversion cancelled");
			const outputFiles = convertedFiles.filter(Boolean);
			const failures = failedFiles.filter(Boolean);
			let reportName = "failed-files.txt";
			if (failures.length) {
				for (
					let suffix = 1;
					outputFiles.some((file) => file.name === reportName);
					suffix++
				)
					reportName = `failed-files-${suffix}.txt`;
				outputFiles.push(
					new File(
						[
							`Failed conversions (${failures.length}):\n\n${failures.join("\n")}\n`,
						],
						reportName,
						{ type: "text/plain" },
					),
				);
			}
			const resultArray = await createZip(outputFiles);
			const outputFilename = this.file.name.replace(/\.[^/.]+$/, ".zip");
			const resultFile = new File(
				[new Uint8Array(resultArray)],
				outputFilename,
			);
			if (failures.length)
				ToastManager.add({
					type: "warning",
					message: m["convert.archive_file.conversion_failed"]({
						filename: outputFilename,
						count: failures.length,
						reportName,
					}),
				});
			return new VertFile(resultFile, ".zip");
		} finally {
			clearInterval(progressInterval);
			await Promise.all(
				convertedResults.map((result) => result.dispose()),
			);
		}
	}

	public slowConversionOffer(reason: "device" | "timeout") {
		if (
			!this.processing ||
			this.activeConverterName !== "mediabunny" ||
			this.slowConversionToastId !== null
		)
			return;

		const serverConverter = this.findConverters([this.from, this.to]).find(
			(converter) => converter.name === "vertd",
		);
		if (!serverConverter) return;

		const removeToast = () => {
			if (this.slowConversionToastId !== null)
				ToastManager.remove(this.slowConversionToastId);
			this.slowConversionToastId = null;
		};

		this.slowConversionToastId = ToastManager.add({
			type: "warning",
			disappearing: false,
			message: SlowConversionToast,
			additional: {
				filename: this.file.name,
				converter: serverConverter.name,
				reason,
				onContinue: removeToast,
				onSwitch: async () => {
					removeToast();
					await this.cancel();
					this.conversionSettings = {
						...this.conversionSettings,
						converter: serverConverter.name,
					};
					this.retryingFallback = true;
					try {
						await this.convert();
					} finally {
						this.retryingFallback = false;
					}
				},
			},
		});
	}

	public async cancel() {
		if (!this.processing) return;
		const selectedConverter = this.conversionSettings.converter;
		const converterName = selectedConverter || this.activeConverterName;
		const converter = this.converters.find((c) => c.name === converterName);
		this.cancelled = true;
		try {
			if (!converter) return;
			await converter.cancel(this);
		} catch (err) {
			this.toastErr(err);
		} finally {
			this.processing = false;
			this.result = null;
			this.activeConverterName = null;
		}
	}

	private toastErr(err: unknown) {
		type ToastMsg = {
			component: Component;
			additional: unknown;
		};

		const castedErr = err as Error | string | ToastMsg;
		let toastMsg: string | ToastMsg = "";
		if (typeof castedErr === "string") {
			toastMsg = castedErr;
		} else if (castedErr instanceof Error) {
			toastMsg = castedErr.message;
		} else {
			toastMsg = castedErr;
		}

		// ToastManager.add({
		// 	type: "error",
		// 	message:
		// 		typeof toastMsg === "string"
		// 			? m["workers.errors.general"]({
		// 					file: this.file.name,
		// 					message: toastMsg,
		// 				})
		// 			: toastMsg,
		// });

		if (typeof toastMsg === "string") {
			ToastManager.add({
				type: "error",
				message: m["workers.errors.general"]({
					file: this.file.name,
					message: toastMsg,
				}),
			});
		} else {
			ToastManager.add({
				type: "error",
				message: toastMsg.component,
				additional: toastMsg.additional,
			});
		}
	}

	public async download() {
		if (!this.result) throw new Error("No result found");

		// give the freedom to the converter to set the extension (ie. pandoc uses this to output zips)
		let to = this.result.to;
		if (!to.startsWith(".")) to = `.${to}`;

		const settings = readSettings<{ filenameFormat?: string }>();
		const filenameFormat = settings.filenameFormat || "VERT_%name%";

		const filename = `${formatFilename(filenameFormat, this.file)}${to}`;
		const resultFile = this.result.file;

		const filePicker = window as Window & {
			showSaveFilePicker?: (options?: {
				suggestedName?: string;
				types?: Array<{
					description?: string;
					accept: Record<string, string[]>;
				}>;
			}) => Promise<FileSystemFileHandle>;
		};

		const diskStreamSupported =
			typeof filePicker.showSaveFilePicker === "function";
		const shouldDiskStream =
			diskStreamSupported && resultFile.size >= LARGE_FILE;

		if (shouldDiskStream) {
			// use the File System Access API to directly stream to disk, so we can actually save larger files
			try {
				const ext = to.slice(1);
				const handle = await filePicker.showSaveFilePicker!({
					suggestedName: filename,
					types: [
						{
							description: "The VERT converted file",
							accept: { "application/octet-stream": [`.${ext}`] },
						},
					],
				});

				const writable = await handle.createWritable();
				await resultFile.stream().pipeTo(writable);
				this.blobUrl = undefined;
				return;
			} catch (err) {
				const casted = err as DOMException;
				if (casted?.name === "AbortError") return;
				log(
					["file", "download"],
					`disk-streaming download failed, falling back to blob URL: ${err}`,
				);
			}
		}

		// ensure it is a blob, so browsers don't change the filename
		const downloadBlob = new Blob([resultFile], {
			type: "application/octet-stream",
		});

		// fallback to blob URL download for smaller files or if the File System Access API isn't supported
		const blob = URL.createObjectURL(downloadBlob);

		// download
		const a = document.createElement("a");
		a.href = blob;
		a.download = filename;
		// force it to not open in a new tab
		a.target = "_blank";
		a.style.display = "none";
		a.click();
		setTimeout(() => {
			URL.revokeObjectURL(blob);
		}, 30000);
		a.remove();
	}

	public hash(): Promise<string> {
		const stream = this.file.stream();
		const hashes = new Set<string>();
		const reader = stream.getReader();
		return new Promise<string>((resolve, reject) => {
			function processChunk() {
				reader.read().then(({ done, value }) => {
					if (done) {
						const combinedHash = Array.from(hashes).sort().join("");
						resolve(combinedHash);
						return;
					}

					crypto.subtle
						.digest("SHA-256", value)
						.then((hashBuffer) => {
							const hashArray = Array.from(
								new Uint8Array(hashBuffer),
							);
							const hashHex = hashArray
								.map((b) => b.toString(16).padStart(2, "0"))
								.join("");
							hashes.add(hashHex);
							processChunk();
						})
						.catch((err) => {
							reject(err);
						});
				});
			}
			processChunk();
		});
	}
}

export interface Categories {
	[key: string]: {
		formats: string[];
		canConvertTo?: string[];
	};
}
