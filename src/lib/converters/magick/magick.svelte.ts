import { browser } from "$app/environment";
import { error, log } from "$lib/util/logger";
import { m } from "$lib/paraglide/messages";
import { VertFile, type WorkerMessage } from "$lib/types";
import MagickWorker from "$lib/workers/magick?worker&url";
import { Converter, FormatInfo } from "../converter.svelte";
import { imageFormats } from "./magick-automated";
import { Settings } from "$lib/sections/settings/index.svelte";
import magickWasm from "@imagemagick/magick-wasm/magick.wasm?url";
import { ToastManager } from "$lib/util/toast.svelte";
import type {
	SettingDefinition,
	ConversionSettings,
} from "$lib/types/conversion-settings";

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
	];

	public readonly reportsProgress = false;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private log: (...msg: any[]) => void = () => {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private error: (...msg: any[]) => void = () => {};

	constructor() {
		super();
		this.log = (msg) => log(["converters", this.name], msg);
		this.error = (msg) => error(["converters", this.name], msg);
		this.log(`created converter`);
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
			this.error(`Failed to load ImageMagick WASM: ${err}`);

			ToastManager.add({
				type: "error",
				message: m["workers.errors.magick"](),
			});
		}
	}

	public async getAvailableSettings(
		input: VertFile,
	): Promise<SettingDefinition[]> {
		// images - quality/compression/quantize/interlace/depth-DPI, resize, crop, rotate, flip/flop, autoOrient?, color space/bit depth, transparency settings
		const global = Settings.instance.settings;
		const settings: SettingDefinition[] = [];

		let supportsMetadata = true;
		let supportsTransparency = true;

		const toIcon = input.to === ".ico";

		// TODO: surely there's a better way to do this lol
		switch (input.from) {
			case ".jpg":
			case ".jpeg":
			case ".jfif":
				supportsTransparency = false;
				break;
		}

		switch (input.to) {
			case ".ico":
				supportsMetadata = false;
				break;

			case ".jpg":
			case ".jpeg":
			case ".jfif":
				supportsTransparency = false;
				break;
		}

		const toRes = (
			w: number,
			h?: number,
		): { value: string; label: string } => {
			if (w && h) {
				if (w < h)
					return { value: `${w}x${h}`, label: `${w}x${h} (V)` };
				if (w > h) return { value: `${w}x${h}`, label: `${w}x${h}` };
				return { value: `${w}x${h}`, label: `${w}x${h}` };
			}
			if (w) return { value: `${w}x${w}`, label: `${w}x${w}` };
			return { value: "", label: "" };
		};

		const quality: SettingDefinition = {
			key: "quality",
			label: m["convert.settings.image.quality"](),
			type: "number",
			default: global.magickQuality ?? 100,
			min: 0,
			max: 100,
		};
		settings.push(quality);

		// TODO: surely there's a better way to do this as well
		const iconResolutions = [
			toRes(16),
			toRes(32),
			toRes(48),
			toRes(64),
			toRes(128),
			toRes(256),
			toRes(512),
		];
		const commonResolutions = [
			{
				value: "custom",
				label: m["convert.settings.common.custom"](),
			},
			toRes(320, 240),
			toRes(426, 240),
			toRes(640, 360),
			toRes(854, 480),
			toRes(720, 1280),
			toRes(1280, 720),
			toRes(1080, 1920),
			toRes(1920, 1080),
			toRes(2160, 3840),
			toRes(3840, 2160),
		];
		const resolution: SettingDefinition = {
			key: "resolution",
			label: m["convert.settings.video.resolution.label"](),
			type: "select",
			default: "auto",
			options: [
				{ value: "auto", label: m["convert.settings.common.auto"]() },
				...(toIcon ? iconResolutions : commonResolutions),
			],
			hasCustomInput: true,
			customInputKey: "customResolution",
			placeholder: m["convert.settings.video.resolution.placeholder"](),
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
			label: m["convert.settings.image.depth"](),
			type: "select",
			default: "auto",
			options: [
				{ value: "auto", label: "Auto" },
				{ value: "custom", label: "Custom" },
				{ value: "8", label: "8-bit" },
				{ value: "16", label: "16-bit" },
				{ value: "32", label: "32-bit" },
			],
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

		return settings;
	}

	public async getDefaultSettings(
		input: VertFile,
	): Promise<ConversionSettings> {
		const defaults: ConversionSettings = {};
		const settings = await this.getAvailableSettings(input);
		settings.forEach((setting) => {
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
		this.log(`converting ${input.name} to ${to}`);

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
			const conversionSettings = JSON.stringify(
				Object.keys(settings).length > 4
					? settings // user-provided settings
					: Object.assign(
							settings,
							await this.getDefaultSettings(input),
						), // use defaults if not provided
			);
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
				this.log(`converted ${input.name} to ${to}`);
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
			this.error(`no active conversion found for file ${input.name}`);
			return;
		}

		this.log(`cancelling conversion for file ${input.name}`);

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

		// TODO: figure out a better way to process "custom" settings in general lol (see vertd.svelte.ts#processSettings)
		if (settings.resolution) {
			const resolution =
				settings.resolution === "custom"
					? settings.customResolution
					: settings.resolution;
			[width, height] = resolution
				.split("x")
				.map((dim: string) => parseInt(dim));
			this.log(
				`using custom dimensions from settings for SVG: ${width}x${height}`,
			);
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
