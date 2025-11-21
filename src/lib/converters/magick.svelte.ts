import { browser } from "$app/environment";
import { error, log } from "$lib/util/logger";
import { m } from "$lib/paraglide/messages";
import { VertFile, type WorkerMessage } from "$lib/types";
import MagickWorker from "$lib/workers/magick?worker&url";
import { Converter, FormatInfo } from "./converter.svelte";
import { imageFormats } from "./magick-automated";
import { Settings } from "$lib/sections/settings/index.svelte";
import magickWasm from "@imagemagick/magick-wasm/magick.wasm?url";
import { ToastManager } from "$lib/util/toast.svelte";

export class MagickConverter extends Converter {
	public name = "imagemagick";
	public ready = $state(false);
	public wasm: ArrayBuffer = null!;

	private activeConversions = new Map<string, Worker>();

	public supportedFormats = [
		// manually tested formats
		new FormatInfo("png", true, true),
		new FormatInfo("jpeg", true, true),
		new FormatInfo("jpg", true, true),
		new FormatInfo("webp", true, true),
		new FormatInfo("gif", true, true),
		new FormatInfo("svg", true, true),
		new FormatInfo("jxl", true, true),
		new FormatInfo("avif", true, true),
		new FormatInfo("heic", true, false), // seems to be unreliable? HEIC/HEIF is very weird if it will actually work
		new FormatInfo("heif", true, false),
		// TODO: .ico files can encode multiple images at various
		// sizes, bitdepths, etc. we should support that in future
		new FormatInfo("ico", true, true),
		new FormatInfo("bmp", true, true),
		new FormatInfo("cur", true, true),
		new FormatInfo("ani", true, false),
		new FormatInfo("icns", true, false),
		new FormatInfo("nef", true, false),
		new FormatInfo("cr2", true, false),
		new FormatInfo("hdr", true, true),
		new FormatInfo("jpe", true, true),
		new FormatInfo("mat", true, true),
		new FormatInfo("pbm", true, true),
		new FormatInfo("pfm", true, true),
		new FormatInfo("pgm", true, true),
		new FormatInfo("pnm", true, true),
		new FormatInfo("ppm", true, true),
		new FormatInfo("tiff", true, true),
		new FormatInfo("jfif", true, true),
		new FormatInfo("eps", false, true),
		new FormatInfo("psd", true, true),

		// raw camera formats
		new FormatInfo("arw", true, false),
		new FormatInfo("tif", true, true),
		new FormatInfo("dng", true, false),
		new FormatInfo("xcf", true, false),
		new FormatInfo("rw2", true, false),
		new FormatInfo("raf", true, false),
		new FormatInfo("orf", true, false),
		new FormatInfo("pef", true, false),
		new FormatInfo("mos", true, false),
		new FormatInfo("raw", true, false),
		new FormatInfo("dcr", true, false),
		new FormatInfo("crw", true, false),
		new FormatInfo("cr3", true, false),
		new FormatInfo("3fr", true, false),
		new FormatInfo("erf", true, false),
		new FormatInfo("mrw", true, false),
		new FormatInfo("mef", true, false),
		new FormatInfo("nrw", true, false),
		new FormatInfo("srw", true, false),
		new FormatInfo("sr2", true, false),
		new FormatInfo("srf", true, false),

		// formats added from maya's somewhat automated testing
		...imageFormats,
	];

	public readonly reportsProgress = false;

	constructor() {
		super();
		log(["converters", this.name], `created converter`);
		if (!browser) return;
		this.initializeWasm();
	}

	private async initializeWasm() {
		try {
			this.status = "downloading";
			const response = await fetch(magickWasm);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch WASM: ${response.status} ${response.statusText}`,
				);
			}

			this.wasm = await response.arrayBuffer();
			this.status = "ready";
		} catch (err) {
			this.status = "error";
			error(
				["converters", this.name],
				`Failed to load ImageMagick WASM: ${err}`,
			);

			ToastManager.add({
				type: "error",
				message: m["workers.errors.magick"](),
			});
		}
	}

	public async convert(
		input: VertFile,
		to: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		...args: any[]
	): Promise<VertFile> {
		let compression: number | undefined = args.at(0);
		if (!compression) {
			compression = Settings.instance.settings.magickQuality ?? 100;
			log(
				["converters", this.name],
				`using user setting for quality: ${compression}%`,
			);
		}
		log(["converters", this.name], `converting ${input.name} to ${to}`);

		// handle converting from SVG manually because magick-wasm doesn't support it
		if (input.from === ".svg") {
			try {
				const blob = await this.svgToImage(input);
				const pngFile = new VertFile(
					new File([blob], input.name.replace(/\.svg$/i, ".png")),
					input.to,
				);
				if (to === ".png") return pngFile; // if target is png, return it directly
				return await this.convert(pngFile, to, ...args); // otherwise, recursively convert png to user's target format
			} catch (err) {
				error(
					["converters", this.name],
					`SVG conversion failed: ${err}`,
				);
				throw err;
			}
		}

		const worker = new Worker(MagickWorker, {
			type: "module",
		});
		this.activeConversions.set(input.id, worker);

		try {
			await Promise.race([
				this.waitForMessage(worker, "ready"),
				new Promise((_, reject) =>
					setTimeout(
						() =>
							reject(
								new Error(
									"Magick worker ready timeout after 10 seconds",
								),
							),
						10000,
					),
				),
			]);

			const loadMsg: WorkerMessage = {
				type: "load",
				wasm: this.wasm,
				id: input.id,
			};
			worker.postMessage(loadMsg);

			await Promise.race([
				this.waitForMessage(worker, "loaded"),
				new Promise((_, reject) =>
					setTimeout(
						() =>
							reject(
								new Error(
									"Magick worker initialization timeout after 30 seconds",
								),
							),
						30000,
					),
				),
			]);

			// every other format handled by magick worker
			const keepMetadata: boolean =
				Settings.instance.settings.metadata ?? true;
			log(["converters", this.name], `keep metadata: ${keepMetadata}`);
			const convertMsg: WorkerMessage = {
				type: "convert",
				id: input.id,
				input: {
					file: input.file,
					name: input.name,
					from: input.from,
					to: input.to,
				},
				to,
				compression,
				keepMetadata,
			};
			worker.postMessage(convertMsg);

			const res = await this.waitForMessage(worker);
			if (res.type === "finished") {
				log(
					["converters", this.name],
					`converted ${input.name} to ${to}`,
				);
				return new VertFile(
					new File([res.output as unknown as BlobPart], input.name),
					res.zip ? ".zip" : to,
				);
			}

			if (res.type === "error") {
				throw new Error(res.error);
			}

			throw new Error("Unknown message type");
		} finally {
			this.activeConversions.delete(input.id);
			worker.terminate();
		}
	}

	public async cancel(input: VertFile): Promise<void> {
		const worker = this.activeConversions.get(input.id);
		if (!worker) {
			error(
				["converters", this.name],
				`no active conversion found for file ${input.name}`,
			);
			return;
		}

		log(
			["converters", this.name],
			`cancelling conversion for file ${input.name}`,
		);

		worker.terminate();
		this.activeConversions.delete(input.id);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private waitForMessage(worker: Worker, type?: string): Promise<any> {
		return new Promise((resolve, reject) => {
			const onMessage = (e: MessageEvent) => {
				if (type && e.data.type === type) {
					worker.removeEventListener("message", onMessage);
					worker.removeEventListener("error", onError);
					resolve(e.data);
				} else if (!type) {
					worker.removeEventListener("message", onMessage);
					worker.removeEventListener("error", onError);
					resolve(e.data);
				} else if (e.data.type === "error") {
					worker.removeEventListener("message", onMessage);
					worker.removeEventListener("error", onError);
					reject(new Error(e.data.error));
				}
			};

			const onError = (e: ErrorEvent) => {
				worker.removeEventListener("message", onMessage);
				worker.removeEventListener("error", onError);
				reject(new Error(`Worker error: ${e.message}`));
			};

			worker.addEventListener("message", onMessage);
			worker.addEventListener("error", onError);
		});
	}

	private async svgToImage(input: VertFile): Promise<Blob> {
		log(["converters", this.name], `converting SVG to image (PNG)`);

		const svgText = await input.file.text();
		const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
		const svgUrl = URL.createObjectURL(svgBlob);

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get canvas context");

		const img = new Image();

		// try to extract dimensions from SVG, and if not fallback to default
		let width = 512;
		let height = 512;
		const widthMatch = svgText.match(/width=["'](\d+)["']/);
		const heightMatch = svgText.match(/height=["'](\d+)["']/);
		const viewBoxMatch = svgText.match(
			/viewBox=["'][^"']*\s+(\d+)\s+(\d+)["']/,
		);

		if (widthMatch && heightMatch) {
			width = parseInt(widthMatch[1]);
			height = parseInt(heightMatch[1]);
		} else if (viewBoxMatch) {
			width = parseInt(viewBoxMatch[1]);
			height = parseInt(viewBoxMatch[2]);
		}

		return new Promise((resolve, reject) => {
			img.onload = () => {
				try {
					canvas.width = img.naturalWidth || width;
					canvas.height = img.naturalHeight || height;

					ctx.drawImage(img, 0, 0);

					canvas.toBlob((blob) => {
						URL.revokeObjectURL(svgUrl);
						if (blob) {
							resolve(blob);
						} else {
							reject(
								new Error("Failed to convert canvas to Blob"),
							);
						}
					}, "image/png");
				} catch (err) {
					URL.revokeObjectURL(svgUrl);
					reject(err);
				}
			};

			img.onerror = () => {
				URL.revokeObjectURL(svgUrl);
				reject(new Error("Failed to load SVG image"));
			};

			img.src = svgUrl;
		});
	}
}
