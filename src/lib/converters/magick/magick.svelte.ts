import { m } from "#lib/paraglide/messages";
import { Settings } from "#lib/sections/settings/index.svelte";
import { VertFile, type WorkerMessage } from "#lib/types";
import type {
	ConversionSettings,
	SettingCategories,
	SettingDefinition,
} from "#lib/types/conversion-settings";
import { ToastManager } from "#lib/util/toast.svelte";
import MagickWorker from "#lib/workers/magick?worker&url";
import { browser } from "$app/env";
import magickWasm from "@imagemagick/magick-wasm/magick.wasm?url";
import magickWasmX64 from "@imagemagick/magick-wasm/x64/magick.wasm?url";
import { SvelteMap } from "svelte/reactivity";
import { Converter, FormatInfo, formatDuration } from "../converter.svelte";
import { EngineVariants, type MagickVariant } from "../engine-variants.svelte";
import { applyPriorities } from "../priority";
import { imageFormats } from "./magick-automated";
import {
	formatsWithoutMetadataRemoval,
	formatsWithoutTransparency,
} from "./magick-settings";

export class MagickConverter extends Converter {
	public name = "imagemagick";
	public ready = $state(false);
	public wasm: ArrayBuffer = null!;

	private loadedVariant: "x64" | "x86" | null = null;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	private wasmCache = new Map<string, ArrayBuffer>();
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	private workerCancellation = new Map<Worker, AbortController>();

	private activeConversions = new SvelteMap<string, Worker>();

	public supportedFormats = applyPriorities("imagemagick", [
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
		new FormatInfo("mpo", true, false),
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

		new FormatInfo("dcm", true, false),
		new FormatInfo("qoi", true, false),

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
	]);

	public readonly reportsProgress = false;

	constructor() {
		super();
		if (!browser) return;
		this.log(`created converter`);
	}

	public getVariantLabel(): string | null {
		const variants = EngineVariants.instance;
		const variant =
			variants.magick !== "auto"
				? variants.magick
				: variants.magickX64Supported === null
					? null
					: variants.magickActive;
		if (!variant) return null;
		return variant === "x64"
			? m["convert.settings.engines.magick_x64"]()
			: m["convert.settings.engines.magick_x86"]();
	}

	public getVariantOptions() {
		return [
			{ value: "auto", label: m["convert.settings.engines.auto"]() },
			{
				value: "x64",
				label: m["convert.settings.engines.magick_x64"](),
			},
			{
				value: "x86",
				label: m["convert.settings.engines.magick_x86"](),
			},
		];
	}

	public getVariantValue(): string {
		return EngineVariants.instance.magick;
	}

	public setVariant(value: string): void {
		EngineVariants.instance.setMagick(value as MagickVariant);
	}

	protected async download(): Promise<void> {
		try {
			const variants = EngineVariants.instance;
			await variants.resolve();

			// forced 64-bit on a browser without memory64 -> fall back to 32-bit
			if (
				variants.magick === "x64" &&
				variants.magickX64Supported === false
			) {
				this.log(
					"64-bit magick-wasm requested but memory64 is unsupported, using 32-bit",
				);
				ToastManager.add({
					type: "info",
					message: m["workers.info.magick_x64_unavailable"](),
				});
			}

			const useX64 = variants.magickActive === "x64";

			this.wasm = await this.fetchWasm(
				useX64 ? magickWasmX64 : magickWasm,
			);
			this.loadedVariant = useX64 ? "x64" : "x86";

			this.status = "ready";
			this.log(`using ${this.loadedVariant} magick-wasm`);
			return Promise.resolve();
		} catch (err) {
			ToastManager.add({
				type: "error",
				message: m["workers.errors.magick"](),
			});
			throw err;
		}
	}

	private async fetchWasm(url: string): Promise<ArrayBuffer> {
		const cached = this.wasmCache.get(url);
		if (cached) return cached;

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch WASM: ${response.status} ${response.statusText}`,
			);
		}

		const bytes = await response.arrayBuffer();
		this.wasmCache.set(url, bytes);
		return bytes;
	}

	public async getAvailableSettings(
		input: VertFile,
	): Promise<SettingCategories> {
		// images - quality/compression/quantize/interlace/depth-DPI, resize, crop, rotate, flip/flop, autoOrient?, color space/bit depth, transparency settings
		const global = Settings.instance.settings;
		const settings: SettingDefinition[] = [];

		const outputFormat = input.to.replace(/^\./, "").toLowerCase();
		const supportsMetadata =
			!formatsWithoutMetadataRemoval.has(outputFormat);
		const supportsTransparency =
			!formatsWithoutTransparency.has(outputFormat);

		const toIcon = input.to === ".ico";

		const quality: SettingDefinition = {
			key: "quality",
			label: m["convert.settings.image.quality.label"](),
			type: "number",
			min: 0,
			max: 100,
			placeholder: m["convert.settings.image.quality.placeholder"](),
		};
		settings.push(quality);

		const resolution: SettingDefinition = {
			key: "resolution",
			label: m["convert.settings.image.resolution.label"](),
			type: "text",
			default: "",
			placeholder: m["convert.settings.image.resolution.placeholder"](),
		};
		settings.push(resolution);

		const singleSize: SettingDefinition = {
			key: "singleSize",
			label: m["convert.settings.image.single_size"](),
			type: "boolean",
			default: false,
		};
		if (toIcon) settings.push(singleSize);

		const depth: SettingDefinition = {
			key: "depth",
			label: m["convert.settings.image.depth.label"](),
			type: "text",
			default: "",
			placeholder: m["convert.settings.image.depth.placeholder"](),
		};
		settings.push(depth);

		const colorSpace: SettingDefinition = {
			key: "colorSpace",
			label: m["convert.settings.image.color_space"](),
			type: "select",
			default: "auto",
			options: [
				// what are these even lmao
				{ value: "auto", label: "Auto" },
				{ value: "srgb", label: "sRGB" },
				{ value: "cmyk", label: "CMYK" },
				{ value: "adobe98", label: "Adobe RGB" },
				{ value: "prophoto", label: "ProPhoto RGB" },
				{ value: "displayp3", label: "Display P3" },
				{ value: "xyz", label: "CIEXYZ" },
				{ value: "lab", label: "CIELAB" },
				{ value: "gray", label: "Grayscale" },
			],
		};
		settings.push(colorSpace);

		const transparency: SettingDefinition = {
			key: "transparency",
			label: m["convert.settings.image.transparency"](),
			type: "boolean",
			default: true,
		};
		if (supportsTransparency) settings.push(transparency);

		const metadata: SettingDefinition = {
			key: "metadata",
			label: m["convert.settings.common.metadata"](),
			type: "boolean",
			default: global.metadata ?? true,
		};
		if (supportsMetadata) settings.push(metadata);

		// resize, crop, rotate - prob want a ui

		return {
			// put all boolean types (checkboxes) at end
			Image: settings
				.filter((setting) => setting.key !== "metadata")
				.sort(
					(a, b) =>
						Number(a.type === "boolean") -
						Number(b.type === "boolean"),
				),
			General: supportsMetadata ? [metadata] : [],
		};
	}

	public async getDefaultSettings(
		input: VertFile,
	): Promise<ConversionSettings> {
		const defaults: ConversionSettings = {};
		const categories = await this.getAvailableSettings(input);
		Object.values(categories)
			.flat()
			.forEach((setting) => {
				defaults[setting.key] = setting.default;
			});
		return defaults;
	}

	public async convert(
		input: VertFile,
		to: string,
		settings: ConversionSettings,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		...args: any[]
	): Promise<VertFile> {
		await this.init();

		await EngineVariants.instance.resolve();
		if (EngineVariants.instance.magickActive !== this.loadedVariant)
			await this.download();

		this.throwIfCancelled(input);

		this.trackConversion(input);
		this.log(`converting ${input.name} (${input.id}) to ${to}`);
		const startedAt = performance.now();

		// handle converting from SVG manually because magick-wasm doesn't support it
		if (input.from === ".svg") {
			try {
				const blob = await this.svgToImage(input);
				const pngFile = new VertFile(
					new File([blob], input.name.replace(/\.svg$/i, ".png")),
					input.to,
				);
				if (to === ".png") return pngFile; // if target is png, return it directly
				return await this.convert(pngFile, to, settings, ...args); // otherwise, recursively convert png to user's target format
			} catch (err) {
				this.error(`SVG conversion failed: ${err}`);
				throw err;
			}
		}

		const worker = new Worker(MagickWorker, {
			type: "module",
		});
		this.activeConversions.set(input.id, worker);
		const cancellation = new AbortController();
		this.workerCancellation.set(worker, cancellation);

		try {
			await this.waitForMessage(worker, "ready", 10000);
			cancellation.signal.throwIfAborted();

			const loadMsg: WorkerMessage = {
				type: "load",
				wasm: this.wasm,
				x64: this.loadedVariant === "x64",
				id: input.id,
			};
			worker.postMessage(loadMsg);

			await this.waitForMessage(worker, "loaded", 30000);

			// every other format handled by magick worker
			const conversionSettings = // vertd expects object not string json
				JSON.stringify(
					Object.keys(settings).length > 4
						? { ...settings } // user-provided settings
						: {
								...(await this.getDefaultSettings(input)),
								...settings,
							}, // use defaults if not provided
				);

			cancellation.signal.throwIfAborted();
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
				conversionSettings,
			};
			worker.postMessage(convertMsg);

			const res = await this.waitForMessage(worker);
			if (res.type === "finished") {
				this.log(
					`converted ${input.name} (${input.id}) to ${to} in ${formatDuration(performance.now() - startedAt)}`,
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
			cancellation.abort();
			this.workerCancellation.delete(worker);
			this.clearTrackedConversion(input);
			this.clearCancel(input);
			this.activeConversions.delete(input.id);
			worker.terminate();
		}
	}

	public async cancel(input: VertFile): Promise<void> {
		await super.cancel(input);

		const worker = this.activeConversions.get(input.id);
		if (!worker) return;

		this.workerCancellation.get(worker)?.abort();
		worker.terminate();
		this.activeConversions.delete(input.id);
	}

	private waitForMessage(
		worker: Worker,
		type?: string,
		timeout?: number,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	): Promise<any> {
		const signal = this.workerCancellation.get(worker)!.signal;
		return new Promise((resolve, reject) => {
			let timeoutId: ReturnType<typeof setTimeout> | undefined;
			const cleanup = () => {
				worker.removeEventListener("message", onMessage);
				worker.removeEventListener("error", onError);
				signal.removeEventListener("abort", onAbort);
				if (timeoutId !== undefined) clearTimeout(timeoutId);
			};
			const onAbort = () => {
				cleanup();
				reject(signal.reason);
			};
			const onMessage = (e: MessageEvent) => {
				if (type && e.data.type === type) {
					cleanup();
					resolve(e.data);
				} else if (!type) {
					cleanup();
					resolve(e.data);
				} else if (e.data.type === "error") {
					cleanup();
					reject(new Error(e.data.error));
				}
			};

			const onError = (e: ErrorEvent) => {
				cleanup();
				reject(new Error(`Worker error: ${e.message}`));
			};

			if (signal.aborted) {
				onAbort();
				return;
			}
			signal.addEventListener("abort", onAbort);
			worker.addEventListener("message", onMessage);
			worker.addEventListener("error", onError);
			if (timeout !== undefined)
				timeoutId = setTimeout(() => {
					cleanup();
					reject(
						new Error(
							`Magick worker ${type === "ready" ? "ready" : "initialization"} timeout after ${timeout / 1000} seconds`,
						),
					);
				}, timeout);
		});
	}

	private async svgToImage(input: VertFile): Promise<Blob> {
		this.log(`converting SVG to image (PNG)`);

		const settings = input.conversionSettings;

		const svgText = await input.file.text();
		const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
		const svgUrl = URL.createObjectURL(svgBlob);

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get canvas context");

		const img = new Image();

		// use resolution from settings if provided, otherwwise try to extract dimensions from SVG, and then fallback to 512x512
		const defaultSize = 512;
		let [width, height] = [defaultSize, defaultSize];

		if (settings.resolution) {
			[width, height] = settings.resolution
				.split("x")
				.map((dim: string) => parseInt(dim));
		} else {
			const widthMatch = svgText.match(/width=["'](\d+)["']/);
			const heightMatch = svgText.match(/height=["'](\d+)["']/);
			const viewBoxMatch = svgText.match(
				/viewBox=["'][^"']*\s+(\d+)\s+(\d+)["']/,
			);

			if (widthMatch && heightMatch) {
				width = parseInt(widthMatch[1]);
				height = parseInt(heightMatch[1]);
				this.log(
					`extracted dimensions from SVG width/height attributes for SVG: ${width}x${height}`,
				);
			} else if (viewBoxMatch) {
				width = parseInt(viewBoxMatch[1]);
				height = parseInt(viewBoxMatch[2]);
				this.log(
					`extracted dimensions from SVG viewBox for SVG: ${width}x${height}`,
				);
			}
		}

		return new Promise((resolve, reject) => {
			img.onload = () => {
				try {
					canvas.width = width;
					canvas.height = height;

					ctx.drawImage(img, 0, 0, width, height);

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
