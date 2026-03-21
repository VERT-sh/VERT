import { byNative, converters } from "$lib/converters";
import type { Converter } from "$lib/converters/converter.svelte";
import { m } from "$lib/paraglide/messages";
import { ToastManager } from "$lib/util/toast.svelte";
import type { Component } from "svelte";
import { MAX_ARRAY_BUFFER_SIZE } from "$lib/store/index.svelte";
import FallbackToast from "$lib/components/functional/popups/FallbackToast.svelte";
import ServerUploadWarning from "$lib/components/functional/popups/ServerUploadWarning.svelte";
import type {
	ConversionSettings,
	SettingDefinition,
} from "./conversion-settings";
import { log } from "$lib/util/logger";
import { readSettings } from "$lib/util/settings";
import { formatFilename } from "$lib/util/file";

const LARGE_FILE = 2 * 1024 * 1024 * 1024; // 2GB

export class VertFile {
	public id: string = Math.random().toString(36).slice(2, 8);
	public readonly file: File;

	public get from() {
		return ("." + this.file.name.split(".").pop() || "").toLowerCase();
	}

	public get name() {
		return this.file.name;
	}

	public conversionSettings = $state<ConversionSettings>({}); // empty object / key = default
	public progress = $state(0);
	public result = $state<VertFile | null>(null);

	public to = $state("");

	public blobUrl = $state<string>();

	public processing = $state(false);

	public cancelled = $state(false);

	public converters: Converter[] = [];
	private fallbackToastId: number | null = null;
	private attemptedConverters = new Set<string>();
	private retryingFallback = false;
	private vertdWarningToastId: number | null = null;
	private postDownload: (() => Promise<void>) | null = null;

	public isZip = $state(() => this.from === ".zip");

	public setPostDownload(cleanup: (() => Promise<void>) | null) {
		this.postDownload = cleanup;
	}

	private async runPostDownload() {
		if (!this.postDownload) return;

		try {
			await this.postDownload();
		} catch (err) {
			log(["file", "cleanup"], `post-download function failed: ${err}`);
		} finally {
			this.postDownload = null;
		}
	}

	public getAvailableSettings(
		input: VertFile,
		converter: string | undefined = this.conversionSettings.converter,
	): Promise<SettingDefinition[]> {
		const converterInstance = this.converters.find(
			(c) => c.name === converter,
		);
		if (!converterInstance) return Promise.resolve([]);
		return converterInstance.getAvailableSettings(input);
	}

	public findConverters(supportedFormats: string[] = [this.from]) {
		return this.converters
			.filter((converter) => {
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

	constructor(file: File, to: string, blobUrl?: string) {
		const ext = file.name.split(".").pop();
		const newFile = new File(
			[file],
			`${file.name.split(".").slice(0, -1).join(".")}.${ext?.toLowerCase()}`,
		);
		this.file = newFile;
		this.to = to.startsWith(".") ? to : `.${to}`;
		this.converters = converters.filter((c) =>
			c.formatStrings().includes(this.from),
		);
		this.convert = this.convert.bind(this);
		this.download = this.download.bind(this);
		this.blobUrl = blobUrl;

		log(
			["file", "init"],
			`findConverters: ${this.findConverters()
				.map((c) => c.name)
				.join(", ")}`,
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async convert(...args: any[]) {
		await this.runPostDownload();

		if (!this.retryingFallback) this.attemptedConverters.clear();

		if (!this.converters.length) throw new Error("No converters found");

		const customConverter = this.converters.find(
			(c) => c.name === this.conversionSettings.converter,
		);
		let converter = customConverter;

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
				// TODO: handle zip converter fallback explicitly if needed
				// TODO: provide a clearer error path for unsupported from/to pairs
			}
		} else {
			log(
				["file", "convert"],
				`using custom converter from settings: ${converter.name}`,
			);
		}

		if (!converter) throw new Error("No converter found");

		const canProceed = await this.confirmServerWarning(converter);
		if (!canProceed) {
			this.cancelled = true;
			return;
		}

		this.attemptedConverters.add(converter.name);
		log(["file", "convert"], `using converter: ${converter.name}`);

		this.result = null;
		this.progress = 0;
		this.processing = true;
		this.cancelled = false;
		let res;
		try {
			// for zips: extract > convert each > re-zip
			// else convert normally
			res = this.isZip()
				? await this.convertZip(converter)
				: await converter.convert(
						this,
						this.to,
						this.conversionSettings,
						...args,
					);
			this.result = res;
			if (this.fallbackToastId !== null) {
				ToastManager.remove(this.fallbackToastId);
				this.fallbackToastId = null;
			}
		} catch (err) {
			if (!this.cancelled) this.toastErr(err);

			const compatibleConverters = this.findConverters([
				this.from,
				this.to,
			]);
			const nextConverter = compatibleConverters.find(
				(c) => !this.attemptedConverters.has(c.name),
			);

			// TODO: clean up languages file, then migrate all languages to new structure

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

			this.result = null;
		}
		this.processing = false;
		return res;
	}

	private async confirmServerWarning(converter: Converter): Promise<boolean> {
		if (converter.name !== "vertd") return true;
		if (localStorage.getItem("acceptedExternalWarning") === "true")
			return true;

		return new Promise((resolve) => {
			let resolved = false;

			const finish = (shouldProceed: boolean) => {
				if (resolved) return;
				resolved = true;
				if (this.vertdWarningToastId !== null)
					ToastManager.remove(this.vertdWarningToastId);
				this.vertdWarningToastId = null;
				resolve(shouldProceed);
			};

			if (this.vertdWarningToastId !== null)
				ToastManager.remove(this.vertdWarningToastId);

			this.vertdWarningToastId = ToastManager.add({
				type: "warning",
				disappearing: false,
				message: ServerUploadWarning,
				additional: {
					filename: this.file.name,
					onProceed: () => {
						finish(true);
					},
					onCancel: () => {
						finish(false);
					},
					onDontShowAgain: () => {
						localStorage.setItem("acceptedExternalWarning", "true");
						finish(true);
					},
				},
			});
		});
	}

	private async convertZip(converter: Converter): Promise<VertFile> {
		const { extractZip, createZip } = await import("$lib/util/file");
		const { default: PQueue } = await import("p-queue");

		const entries = await extractZip(this.file);
		const totalFiles = entries.length;
		const fileProgress: number[] = new Array(totalFiles).fill(0);
		const convertedFiles: File[] = [];

		const queue = new PQueue({
			concurrency: navigator.hardwareConcurrency || 4,
		});

		const updateProgress = () => {
			const totalProgress = fileProgress.reduce((sum, p) => sum + p, 0);
			this.progress = Math.round(totalProgress / totalFiles);
		};

		// convert all files in the zip
		await queue.addAll(
			entries.map(({ filename, data }, index) => async () => {
				if (this.cancelled) {
					throw new Error("Conversion cancelled");
				}

				const file = new File([new Uint8Array(data)], filename, {
					type: "application/octet-stream",
				});
				const tempVFile = new VertFile(file, this.to);
				tempVFile.converters = [converter];

				if (converter.reportsProgress) {
					// track progress of individual files
					const progressInterval = setInterval(() => {
						fileProgress[index] = tempVFile.progress;
						updateProgress();
					}, 100);

					try {
						const converted = await converter.convert(
							tempVFile,
							this.to,
							this.conversionSettings,
						);

						let outputExt = this.to;
						if (!outputExt.startsWith("."))
							outputExt = `.${outputExt}`;

						convertedFiles[index] = new File(
							[await converted.file.arrayBuffer()],
							converted.name,
						);

						fileProgress[index] = 100;
						updateProgress();
					} finally {
						clearInterval(progressInterval);
					}
				} else {
					// else track progress via completions only
					const converted = await converter.convert(
						tempVFile,
						this.to,
						this.conversionSettings,
					);

					let outputExt = this.to;
					if (!outputExt.startsWith(".")) outputExt = `.${outputExt}`;

					convertedFiles[index] = new File(
						[await converted.file.arrayBuffer()],
						converted.name,
					);

					fileProgress[index] = 100;
					updateProgress();
				}
			}),
		);

		// return zip of converted files
		const resultArray = await createZip(convertedFiles);
		const outputFilename = this.file.name.replace(/\.[^/.]+$/, ".zip");
		const resultFile = new File(
			[new Uint8Array(resultArray)],
			outputFilename,
		);
		return new VertFile(resultFile, ".zip");
	}

	public async cancel() {
		if (!this.processing) return;
		const converter = this.converters.find(
			(c) => c.name === this.conversionSettings.converter,
		);
		if (!converter) throw new Error("No converter found");
		this.cancelled = true;
		try {
			await converter.cancel(this);
			this.processing = false;
			this.result = null;
		} catch (err) {
			this.toastErr(err);
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

		// fallback to blob URL download for smaller files or if the File System Access API isn't supported
		const blob = URL.createObjectURL(resultFile);

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
