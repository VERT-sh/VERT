import { createRequire } from "node:module";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import {
	initializeImageMagick,
	ImageMagick,
	MagickFormat,
	MagickReadSettings,
} from "@imagemagick/magick-wasm";
import yazl from "yazl";
import { parseAni } from "../util/parse-ani.js";
import { FormatInfo, type ConvertOptions, type ConvertResult, type NodeConverter } from "./types.js";

/** Maximum number of frames to extract from ICO/ANI files. */
const MAX_FRAMES = 256;

/** Conversion timeout in milliseconds. */
const CONVERSION_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Format lists
// ---------------------------------------------------------------------------

// Blocked formats that lack WASM delegates or are unsafe:
// svg, nef, cr2, arw, dng, rw2, raf, orf, pef, mos, raw, dcr, crw, cr3, 3fr,
// erf, mrw, mef, nrw, srw, sr2, srf, eps, icns, xcf
// ps, ps1, svgz, epdf, epi, eps2, eps3, epsf, epsi, ept, ept2, ept3

/** Manually tested image formats from VERT (magick.svelte.ts lines 19-78), blocked formats removed. */
const MANUAL_FORMATS: FormatInfo[] = [
	new FormatInfo("png", true, true),
	new FormatInfo("jpeg", true, true),
	new FormatInfo("jpg", true, true),
	new FormatInfo("webp", true, true),
	new FormatInfo("gif", true, true),
	// svg blocked (no WASM delegate)
	new FormatInfo("jxl", true, true),
	new FormatInfo("avif", true, true),
	new FormatInfo("heic", true, false),
	new FormatInfo("heif", true, false),
	new FormatInfo("ico", true, true),
	new FormatInfo("bmp", true, true),
	new FormatInfo("cur", true, true),
	new FormatInfo("ani", true, false),
	// icns blocked (needs vert-wasm)
	// nef blocked (needs libraw)
	// cr2 blocked (needs libraw)
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
	// eps blocked (needs Ghostscript)
	new FormatInfo("psd", true, true),
	new FormatInfo("svg", false, true),
	new FormatInfo("svgz", false, true),
	// arw blocked (needs libraw)
	new FormatInfo("tif", true, true),
	// dng blocked (needs libraw)
	// xcf blocked
	// rw2 blocked (needs libraw)
	// raf blocked (needs libraw)
	// orf blocked (needs libraw)
	// pef blocked (needs libraw)
	// mos blocked (needs libraw)
	// raw blocked (needs libraw)
	// dcr blocked (needs libraw)
	// crw blocked (needs libraw)
	// cr3 blocked (needs libraw)
	// 3fr blocked (needs libraw)
	// erf blocked (needs libraw)
	// mrw blocked (needs libraw)
	// mef blocked (needs libraw)
	// nrw blocked (needs libraw)
	// srw blocked (needs libraw)
	// sr2 blocked (needs libraw)
	// srf blocked (needs libraw)
];

/** Automated formats from VERT (magick-automated.ts), blocked formats removed. */
const AUTOMATED_FORMATS: FormatInfo[] = [
	new FormatInfo("a", false, true),
	new FormatInfo("aai", true, true),
	new FormatInfo("ai", false, true),
	new FormatInfo("art", false, true),
	new FormatInfo("avs", true, true),
	new FormatInfo("b", false, true),
	new FormatInfo("bgr", false, true),
	new FormatInfo("bgra", false, true),
	new FormatInfo("bgro", false, true),
	new FormatInfo("bmp2", true, true),
	new FormatInfo("bmp3", true, true),
	new FormatInfo("brf", false, true),
	new FormatInfo("cal", false, true),
	new FormatInfo("cals", false, true),
	new FormatInfo("cin", true, true),
	new FormatInfo("cip", false, true),
	new FormatInfo("cmyk", false, true),
	new FormatInfo("cmyka", false, true),
	new FormatInfo("dcx", true, true),
	new FormatInfo("dds", true, true),
	new FormatInfo("dpx", true, true),
	new FormatInfo("dxt1", true, true),
	new FormatInfo("dxt5", true, true),
	// epdf blocked
	// epi blocked
	// eps2 blocked
	// eps3 blocked
	// epsf blocked
	// epsi blocked
	// ept blocked
	// ept2 blocked
	// ept3 blocked
	new FormatInfo("exr", true, true),
	new FormatInfo("farbfeld", true, true),
	new FormatInfo("fax", true, true),
	new FormatInfo("ff", true, true),
	new FormatInfo("fit", true, true),
	new FormatInfo("fits", true, true),
	new FormatInfo("fl32", true, true),
	new FormatInfo("fts", true, true),
	new FormatInfo("ftxt", false, true),
	new FormatInfo("g", false, true),
	new FormatInfo("g3", true, true),
	new FormatInfo("g4", false, true),
	new FormatInfo("gif87", true, true),
	new FormatInfo("gray", false, true),
	new FormatInfo("graya", false, true),
	new FormatInfo("group4", false, true),
	new FormatInfo("hrz", true, true),
	new FormatInfo("icb", true, true),
	new FormatInfo("icon", true, true),
	new FormatInfo("info", false, true),
	new FormatInfo("ipl", true, true),
	new FormatInfo("isobrl", false, true),
	new FormatInfo("isobrl6", false, true),
	new FormatInfo("j2c", true, true),
	new FormatInfo("j2k", true, true),
	new FormatInfo("jng", true, true),
	new FormatInfo("jp2", true, true),
	new FormatInfo("jpc", true, true),
	new FormatInfo("jpm", true, true),
	new FormatInfo("jps", true, true),
	new FormatInfo("map", false, true),
	new FormatInfo("miff", true, true),
	new FormatInfo("mng", true, true),
	new FormatInfo("mono", false, true),
	new FormatInfo("mtv", true, true),
	new FormatInfo("o", false, true),
	new FormatInfo("otb", true, true),
	new FormatInfo("pal", false, true),
	new FormatInfo("palm", true, true),
	new FormatInfo("pam", true, true),
	new FormatInfo("pcd", true, true),
	new FormatInfo("pcds", true, true),
	new FormatInfo("pcl", false, true),
	new FormatInfo("pct", true, true),
	new FormatInfo("pcx", true, true),
	new FormatInfo("pdb", true, true),
	new FormatInfo("pgx", true, true),
	new FormatInfo("phm", true, true),
	new FormatInfo("picon", true, true),
	new FormatInfo("pict", true, true),
	new FormatInfo("pjpeg", true, true),
	new FormatInfo("png00", true, true),
	new FormatInfo("png24", true, true),
	new FormatInfo("png32", true, true),
	new FormatInfo("png48", true, true),
	new FormatInfo("png64", true, true),
	new FormatInfo("png8", true, true),
	// ps blocked
	// ps1 blocked
	new FormatInfo("ps2", false, true),
	new FormatInfo("ps3", false, true),
	new FormatInfo("psb", true, true),
	new FormatInfo("ptif", true, true),
	new FormatInfo("qoi", true, true),
	new FormatInfo("r", false, true),
	new FormatInfo("ras", true, true),
	new FormatInfo("rgb", false, true),
	new FormatInfo("rgba", false, true),
	new FormatInfo("rgbo", false, true),
	new FormatInfo("rgf", true, true),
	new FormatInfo("sgi", true, true),
	new FormatInfo("six", true, true),
	new FormatInfo("sixel", true, true),
	new FormatInfo("sparse-color", false, true),
	new FormatInfo("strimg", false, true),
	new FormatInfo("sun", true, true),
	// svgz blocked
	new FormatInfo("tga", true, true),
	new FormatInfo("tiff64", true, true),
	new FormatInfo("ubrl", false, true),
	new FormatInfo("ubrl6", false, true),
	new FormatInfo("uil", false, true),
	new FormatInfo("uyvy", false, true),
	new FormatInfo("vda", true, true),
	new FormatInfo("vicar", true, true),
	new FormatInfo("viff", true, true),
	new FormatInfo("vips", true, true),
	new FormatInfo("vst", true, true),
	new FormatInfo("wbmp", true, true),
	new FormatInfo("wpg", true, true),
	new FormatInfo("xbm", true, true),
	new FormatInfo("xpm", true, true),
	new FormatInfo("xv", true, true),
	new FormatInfo("ycbcr", false, true),
	new FormatInfo("ycbcra", false, true),
	new FormatInfo("yuv", false, true),
];

// ---------------------------------------------------------------------------
// Format normalization helpers
// ---------------------------------------------------------------------------

/** Normalize input extension: .jfif->.jpeg, .fit->.fits (bidirectional). */
function normalizeInputExt(ext: string): string {
	const lower = ext.toLowerCase();
	if (lower === ".jfif") return ".jpeg";
	if (lower === ".fit") return ".fits";
	return lower;
}

/** Normalize output extension: .jfif->.jpeg, .fit->.fits (bidirectional). */
function normalizeOutputExt(ext: string): string {
	const lower = ext.toLowerCase();
	if (lower === ".jfif") return ".jpeg";
	if (lower === ".fit") return ".fits";
	return lower;
}

/** Convert an extension (without dot) to a MagickFormat enum value. */
function extToMagickFormat(ext: string): MagickFormat {
	return ext.toUpperCase() as unknown as MagickFormat;
}

// ---------------------------------------------------------------------------
// Serialization queue
// ---------------------------------------------------------------------------

/** Simple serialization queue — ensures one conversion at a time for the single WASM instance. */
class SerialQueue {
	private queue: Array<{ run: () => Promise<void>; }> = [];
	private running = false;

	enqueue<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.queue.push({
				run: async () => {
					try {
						resolve(await fn());
					} catch (err) {
						reject(err);
					}
				},
			});
			this.drain();
		});
	}

	private async drain(): Promise<void> {
		if (this.running) return;
		this.running = true;
		while (this.queue.length > 0) {
			const item = this.queue.shift()!;
			await item.run();
		}
		this.running = false;
	}
}

// ---------------------------------------------------------------------------
// ZIP helper using yazl
// ---------------------------------------------------------------------------

/** Create a ZIP buffer from an array of named buffers. */
function createZip(entries: Array<{ name: string; data: Buffer }>): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		const zipFile = new yazl.ZipFile();
		for (const entry of entries) {
			zipFile.addBuffer(entry.data, entry.name);
		}
		zipFile.end();

		const chunks: Buffer[] = [];
		zipFile.outputStream.on("data", (chunk: Buffer) => {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		});
		zipFile.outputStream.on("end", () => {
			resolve(Buffer.concat(chunks));
		});
		zipFile.outputStream.on("error", (err: Error) => {
			reject(err);
		});
	});
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`Conversion timed out after ${ms / 1000} seconds: ${label}`));
		}, ms);
		promise.then(
			(val) => { clearTimeout(timer); resolve(val); },
			(err) => { clearTimeout(timer); reject(err); },
		);
	});
}

// ---------------------------------------------------------------------------
// MagickNodeConverter
// ---------------------------------------------------------------------------

/**
 * ImageMagick WASM converter for Node.js.
 * Uses @imagemagick/magick-wasm with lazy initialization, serialized queue,
 * and callback-based auto-disposal.
 */
export class MagickNodeConverter implements NodeConverter {
	readonly name = "imagemagick";
	readonly supportedFormats: FormatInfo[] = [...MANUAL_FORMATS, ...AUTOMATED_FORMATS];

	private initialized = false;
	private initPromise: Promise<void> | null = null;
	private readonly queue = new SerialQueue();

	/** Lazy-initialize the WASM module on first call. */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;
		if (this.initPromise) {
			await this.initPromise;
			return;
		}
		this.initPromise = (async () => {
			const require = createRequire(import.meta.url);
			const wasmPath = require.resolve("@imagemagick/magick-wasm/magick.wasm");
			const wasmBytes = readFileSync(wasmPath);
			await initializeImageMagick(wasmBytes);
			this.initialized = true;
		})();
		await this.initPromise;
	}

	/** ImageMagick WASM is always available (bundled). */
	async isAvailable(): Promise<boolean> {
		return true;
	}

	/** Convert an image file. */
	async convert(options: ConvertOptions): Promise<ConvertResult> {
		await this.ensureInitialized();

		return withTimeout(
			this.queue.enqueue(() => this.doConvert(options)),
			CONVERSION_TIMEOUT_MS,
			`${basename(options.inputPath)} -> ${options.outputFormat}`,
		);
	}

	/** Internal conversion dispatched inside the serialized queue. */
	private async doConvert(options: ConvertOptions): Promise<ConvertResult> {
		const { inputPath, outputPath, quality, keepMetadata = true } = options;
		const inputBytes = new Uint8Array(readFileSync(inputPath));

		const rawInputExt = extname(inputPath).toLowerCase();
		const from = normalizeInputExt(rawInputExt);

		let outputExt = options.outputFormat.startsWith(".")
			? options.outputFormat.toLowerCase()
			: `.${options.outputFormat.toLowerCase()}`;
		outputExt = normalizeOutputExt(outputExt);

		// -----------------------------------------------------------------
		// ICO input: extract individual frames → ZIP
		// -----------------------------------------------------------------
		if (from === ".ico") {
			return this.convertIco(inputBytes, outputExt, outputPath, keepMetadata, quality);
		}

		// -----------------------------------------------------------------
		// ANI input: parse frames → convert each → ZIP
		// -----------------------------------------------------------------
		if (from === ".ani") {
			return this.convertAni(inputBytes, outputExt, outputPath, keepMetadata, quality);
		}

		// -----------------------------------------------------------------
		// Animated GIF/WebP input → GIF/WebP output: use readCollection
		// -----------------------------------------------------------------
		if (
			(from === ".gif" || from === ".webp") &&
			(outputExt === ".gif" || outputExt === ".webp")
		) {
			return this.convertAnimated(inputBytes, from, outputExt, outputPath, keepMetadata, quality);
		}

		// -----------------------------------------------------------------
		// Standard single-image conversion
		// -----------------------------------------------------------------
		const outputFmt = extToMagickFormat(outputExt.slice(1));
		const inputFmt = extToMagickFormat(from.slice(1));

		const result = ImageMagick.read(inputBytes, new MagickReadSettings({ format: inputFmt }), (img) => {
			// ICO output: clamp to 256x256 max
			if (outputExt === ".ico") {
				this.clampForIco(img);
			}

			if (quality !== undefined) {
				img.quality = quality;
			}
			if (!keepMetadata) {
				img.strip();
			}

			let outputBuffer: Buffer = Buffer.alloc(0);
			img.write(outputFmt, (data) => {
				outputBuffer = Buffer.from(data);
			});
			return outputBuffer;
		});

		writeFileSync(outputPath, result);

		const stat = statSync(outputPath);
		return {
			outputPath,
			format: outputExt.slice(1),
			sizeBytes: stat.size,
		};
	}

	/** Convert ICO: read individual frames, convert each, ZIP output. */
	private async convertIco(
		inputBytes: Uint8Array,
		outputExt: string,
		outputPath: string,
		keepMetadata: boolean,
		quality?: number,
	): Promise<ConvertResult> {
		const outputFmt = extToMagickFormat(outputExt.slice(1));
		const entries: Array<{ name: string; data: Buffer }> = [];

		for (let i = 0; i < MAX_FRAMES; i++) {
			try {
				const frameBuffer = ImageMagick.read(
					inputBytes,
					new MagickReadSettings({
						format: MagickFormat.Ico,
						frameIndex: i,
					}),
					(img) => {
						if (outputExt === ".ico") {
							this.clampForIco(img);
						}
						if (quality !== undefined) {
							img.quality = quality;
						}
						if (!keepMetadata) {
							img.strip();
						}

						let buf: Buffer = Buffer.alloc(0);
						img.write(outputFmt, (data) => {
							buf = Buffer.from(data);
						});
						return buf;
					},
				);
				entries.push({
					name: `image${i}${outputExt}`,
					data: frameBuffer,
				});
			} catch {
				// No more frames
				break;
			}
		}

		if (entries.length === 0) {
			throw new Error("Failed to read ICO — no images found");
		}

		const zipPath = outputPath.replace(/\.[^.]+$/, ".zip");
		const zipBuffer = await createZip(entries);
		writeFileSync(zipPath, zipBuffer);

		const stat = statSync(zipPath);
		return {
			outputPath: zipPath,
			format: "zip",
			sizeBytes: stat.size,
		};
	}

	/** Convert ANI: parse with parseAni(), convert each frame, ZIP output. */
	private async convertAni(
		inputBytes: Uint8Array,
		outputExt: string,
		outputPath: string,
		keepMetadata: boolean,
		quality?: number,
	): Promise<ConvertResult> {
		let parsedAni;
		try {
			parsedAni = parseAni(inputBytes);
		} catch (err) {
			throw new Error(`Failed to parse ANI file: ${(err as Error).message}`);
		}

		const outputFmt = extToMagickFormat(outputExt.slice(1));
		const frames = parsedAni.images.slice(0, MAX_FRAMES);

		if (frames.length === 0) {
			throw new Error("Failed to parse ANI — no frames found");
		}

		const entries: Array<{ name: string; data: Buffer }> = [];

		for (let i = 0; i < frames.length; i++) {
			const frameData = frames[i];
			const frameBuffer = ImageMagick.read(
				frameData,
				new MagickReadSettings({ format: MagickFormat.Ico }),
				(img) => {
					if (outputExt === ".ico") {
						this.clampForIco(img);
					}
					if (quality !== undefined) {
						img.quality = quality;
					}
					if (!keepMetadata) {
						img.strip();
					}

					let buf: Buffer = Buffer.alloc(0);
					img.write(outputFmt, (data) => {
						buf = Buffer.from(data);
					});
					return buf;
				},
			);
			entries.push({
				name: `image${i}${outputExt}`,
				data: frameBuffer,
			});
		}

		const zipPath = outputPath.replace(/\.[^.]+$/, ".zip");
		const zipBuffer = await createZip(entries);
		writeFileSync(zipPath, zipBuffer);

		const stat = statSync(zipPath);
		return {
			outputPath: zipPath,
			format: "zip",
			sizeBytes: stat.size,
		};
	}

	/** Convert animated GIF/WebP → GIF/WebP using readCollection. */
	private async convertAnimated(
		inputBytes: Uint8Array,
		_from: string,
		outputExt: string,
		outputPath: string,
		keepMetadata: boolean,
		quality?: number,
	): Promise<ConvertResult> {
		const outputFmt = outputExt === ".gif" ? MagickFormat.Gif : MagickFormat.WebP;

		const result = ImageMagick.readCollection(inputBytes, (imgs) => {
			for (const img of imgs) {
				if (quality !== undefined) {
					img.quality = quality;
				}
				if (!keepMetadata) {
					img.strip();
				}
			}

			let outputBuffer: Buffer = Buffer.alloc(0);
			imgs.write(outputFmt, (data) => {
				outputBuffer = Buffer.from(data);
			});
			return outputBuffer;
		});

		writeFileSync(outputPath, result);

		const stat = statSync(outputPath);
		return {
			outputPath,
			format: outputExt.slice(1),
			sizeBytes: stat.size,
		};
	}

	/** Clamp image dimensions to 256x256 for ICO output. */
	private clampForIco(img: { width: number; height: number; resize: (w: number, h: number) => void }): void {
		const max = 256;
		const w = img.width;
		const h = img.height;
		if (w > max || h > max) {
			const scale = max / Math.max(w, h);
			const newW = Math.max(1, Math.round(w * scale));
			const newH = Math.max(1, Math.round(h * scale));
			img.resize(newW, newH);
		}
	}
}
