import { byNative, converters } from "$lib/converters";
import type { Converter } from "$lib/converters/converter.svelte";
import { m } from "$lib/paraglide/messages";
import { ToastManager } from "$lib/util/toast.svelte";
import type { Component } from "svelte";
import { MAX_ARRAY_BUFFER_SIZE } from "$lib/store/index.svelte";

export class VertFile {
	public id: string = Math.random().toString(36).slice(2, 8);
	public readonly file: File;

	public get from() {
		return ("." + this.file.name.split(".").pop() || "").toLowerCase();
	}

	public get name() {
		return this.file.name;
	}

	public progress = $state(0);
	public result = $state<VertFile | null>(null);

	public to = $state("");

	public blobUrl = $state<string>();

	public processing = $state(false);

	public cancelled = $state(false);

	public converters: Converter[] = [];

	public isZip = $state(() => this.from === ".zip");

	public findConverters(supportedFormats: string[] = [this.from]) {
		const converter = this.converters
			.filter((converter) =>
				converter
					.formatStrings()
					.map((f) => supportedFormats.includes(f)),
			)
			.sort(byNative(this.from));
		return converter;
	}

	public findConverter() {
		// zip will always only be added if there's one converter that supports all files - handled in store's _handleZipFile()
		if (this.isZip()) return this.converters[0];

		const converter = this.converters.find((converter) => {
			if (
				!converter.formatStrings().includes(this.from) ||
				!converter.formatStrings().includes(this.to)
			) {
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
			return true;
		});
		return converter;
	}

	public isLarge(): boolean {
		return this.file.size > MAX_ARRAY_BUFFER_SIZE;
	}

	public supportsStreaming(): boolean {
		// only vertd (video/gif -> video/gif) supports streaming
		// rest of converters need entire file in memory, limited by ArrayBuffer limits
		const converter = this.findConverter();
		return converter?.name === "vertd";
	}

	constructor(file: File, to: string, blobUrl?: string) {
		const ext = file.name.split(".").pop();
		const newFile = new File(
			[file.slice(0, file.size, file.type)],
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
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async convert(...args: any[]) {
		if (!this.converters.length) throw new Error("No converters found");
		const converter = this.findConverter();
		if (!converter) throw new Error("No converter found");
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
				: await converter.convert(this, this.to, ...args);
			this.result = res;
			this.toastSuccess();
		} catch (err) {
			if (!this.cancelled) this.toastErr(err);
			this.result = null;
		}
		this.processing = false;
		return res;
	}
	// here
	private toastSuccess() {
		ToastManager.add({
			type: "success",
			message: `✅ ${this.file.name} converted to ${this.to.toUpperCase()} and ready to download`,
		});
	}


	private async convertZip(converter: Converter): Promise<VertFile> {
		const { extractZip, createZip } = await import("$lib/util/zip");
		const { default: PQueue } = await import("p-queue");

		const entries = await extractZip(this.file);
		const totalFiles = entries.length;
		const fileProgress: number[] = new Array(totalFiles).fill(0);
		const convertedFiles: File[] = [];

		const queue = new PQueue({ concurrency: navigator.hardwareConcurrency || 4 });

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
						);

						let outputExt = this.to;
						if (!outputExt.startsWith("."))
							outputExt = `.${outputExt}`;
						const baseName = filename.replace(/\.[^/.]+$/, "");
						const outputFilename = `${baseName}${outputExt}`;

						convertedFiles[index] = new File(
							[await converted.file.arrayBuffer()],
							outputFilename,
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
					);

					let outputExt = this.to;
					if (!outputExt.startsWith(".")) outputExt = `.${outputExt}`;
					const baseName = filename.replace(/\.[^/.]+$/, "");
					const outputFilename = `${baseName}${outputExt}`;

					convertedFiles[index] = new File(
						[await converted.file.arrayBuffer()],
						outputFilename,
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
		const converter = this.findConverter();
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

		const settings = JSON.parse(localStorage.getItem("settings") ?? "{}");
		const filenameFormat = settings.filenameFormat || "VERT_%name%";

		const format = (name: string) => {
			const date = new Date().toISOString();
			const baseName = this.file.name.replace(/\.[^/.]+$/, "");
			const originalExtension = this.file.name.split(".").pop()!;
			return name
				.replace(/%date%/g, date)
				.replace(/%name%/g, baseName)
				.replace(/%extension%/g, originalExtension);
		};

		const blob = URL.createObjectURL(
			new Blob([await this.result.file.arrayBuffer()], {
				// type: to.slice(1),
				type: "application/octet-stream", // use generic type to prevent browsers changing extension
			}),
		);
		const a = document.createElement("a");
		a.href = blob;
		a.download = `${format(filenameFormat)}${to}`;
		// force it to not open in a new tab
		a.target = "_blank";
		a.style.display = "none";
		a.click();
		URL.revokeObjectURL(blob);
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
