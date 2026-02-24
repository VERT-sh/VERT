import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import which from "which";
import { FormatInfo } from "./types.js";
import type { ConvertOptions, ConvertResult, NodeConverter } from "./types.js";

/** Conversion timeout in milliseconds. */
const TIMEOUT_MS = 120_000;

/** Maximum number of concurrent ffmpeg processes. */
const MAX_CONCURRENT = 3;

// ── Audio format definitions (from VERT ffmpeg.svelte.ts lines 43-74) ──

const AUDIO_FORMATS: FormatInfo[] = [
	new FormatInfo("mp3"),
	new FormatInfo("wav"),
	new FormatInfo("flac"),
	new FormatInfo("ogg"),
	new FormatInfo("mogg", true, false),       // from only
	new FormatInfo("oga"),
	new FormatInfo("opus"),
	new FormatInfo("aac"),
	new FormatInfo("alac"),                     // output extension becomes .m4a
	new FormatInfo("m4a"),
	new FormatInfo("caf", true, false),         // from only
	new FormatInfo("wma"),
	new FormatInfo("amr"),
	new FormatInfo("ac3"),
	new FormatInfo("aiff"),
	new FormatInfo("aifc"),
	new FormatInfo("aif"),
	new FormatInfo("mp1", true, false),         // from only
	new FormatInfo("mp2"),
	new FormatInfo("mpc", true, false),         // from only
	new FormatInfo("dsd", true, false),         // from only
	new FormatInfo("dsf", true, false),         // from only
	new FormatInfo("dff", true, false),         // from only
	new FormatInfo("mqa", true, false),         // from only
	new FormatInfo("au"),
	new FormatInfo("m4b"),
	new FormatInfo("voc"),
	new FormatInfo("weba"),
];

// ── Video format definitions (input only for audio extraction) ──

const VIDEO_FORMATS: FormatInfo[] = [
	new FormatInfo("mkv", true, false, false),
	new FormatInfo("mp4", true, false, false),
	new FormatInfo("avi", true, false, false),
	new FormatInfo("mov", true, false, false),
	new FormatInfo("webm", true, false, false),
	new FormatInfo("ts", true, false, false),
	new FormatInfo("mts", true, false, false),
	new FormatInfo("m2ts", true, false, false),
	new FormatInfo("wmv", true, false, false),
	new FormatInfo("mpg", true, false, false),
	new FormatInfo("mpeg", true, false, false),
	new FormatInfo("flv", true, false, false),
	new FormatInfo("f4v", true, false, false),
	new FormatInfo("vob", true, false, false),
	new FormatInfo("m4v", true, false, false),
	new FormatInfo("3gp", true, false, false),
	new FormatInfo("3g2", true, false, false),
	new FormatInfo("mxf", true, false, false),
	new FormatInfo("ogv", true, false, false),
	new FormatInfo("rm", true, false, false),
	new FormatInfo("rmvb", true, false, false),
	new FormatInfo("divx", true, false, false),
];

/** Set of video extensions (undotted, lowercase) for detecting video input. */
const VIDEO_EXTENSIONS = new Set(
	VIDEO_FORMATS.map((f) => f.name.slice(1).toLowerCase()),
);

// ── Codec mappings (from VERT ffmpeg.svelte.ts lines 636-699 + additions) ──

/**
 * Get the FFmpeg codec string for a given output format extension.
 * Adapted from VERT's getCodecs() with additions for missing codecs.
 */
function getCodec(ext: string): string {
	switch (ext) {
		case "mp3":
			return "libmp3lame";
		case "wav":
			return "pcm_s16le";
		case "flac":
			return "flac";
		case "ogg":
		case "oga":
			return "libvorbis";
		case "opus":
			return "libopus";
		case "aac":
			return "aac";
		case "alac":
			return "alac";
		case "m4a":
			return "aac";
		case "m4b":
			return "aac";
		case "wma":
			return "wmav2";
		case "amr":
			return "libopencore_amrnb";
		case "ac3":
			return "ac3";
		case "aiff":
		case "aifc":
		case "aif":
			return "pcm_s16be";
		case "mp2":
			return "mp2";
		case "au":
			return "pcm_mulaw";
		case "voc":
			return "pcm_u8";
		case "weba":
			return "libopus";
		case "caf":
			return "pcm_s16le";
		default:
			return "copy";
	}
}

/**
 * Check if the given extension is a video format we recognize as input.
 */
function isVideoInput(ext: string): boolean {
	return VIDEO_EXTENSIONS.has(ext.toLowerCase());
}

// ── Concurrency limiter ──

let activeProcesses = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
	if (activeProcesses < MAX_CONCURRENT) {
		activeProcesses++;
		return Promise.resolve();
	}
	return new Promise<void>((resolve) => {
		waitQueue.push(() => {
			activeProcesses++;
			resolve();
		});
	});
}

function releaseSlot(): void {
	activeProcesses--;
	const next = waitQueue.shift();
	if (next) {
		next();
	}
}

// ── Helpers ──

/**
 * Run ffmpeg with the given arguments via execFile (no shell).
 * Returns a promise that resolves on success or rejects on failure.
 */
function runFFmpeg(ffmpegPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		execFile(
			ffmpegPath,
			args,
			{
				timeout: TIMEOUT_MS,
				maxBuffer: 10 * 1024 * 1024,
				windowsHide: true,
			},
			(error, stdout, stderr) => {
				if (error) {
					reject(new Error(
						`ffmpeg failed: ${error.message}\n${stderr}`,
					));
				} else {
					resolve({ stdout, stderr });
				}
			},
		);
	});
}

/**
 * Build the FFmpeg conversion command arguments.
 * Adapted from VERT's buildConversionCommand() (ffmpeg.svelte.ts lines 315-527).
 */
function buildConversionArgs(options: ConvertOptions, inputExt: string): string[] {
	const {
		inputPath,
		outputPath,
		outputFormat,
		audioBitrate,
		sampleRate,
		keepMetadata,
	} = options;

	// Determine the actual output format and codec
	let actualOutputFormat = outputFormat.toLowerCase();
	let actualOutputPath = outputPath;

	// ALAC: output_format="alac" -> actual file ext .m4a, codec alac
	if (actualOutputFormat === "alac") {
		// The output path should already have .m4a extension (handled by caller),
		// but the codec is "alac"
		actualOutputFormat = "alac";
	}

	const codec = getCodec(actualOutputFormat);
	const isVideoSource = isVideoInput(inputExt);

	const args: string[] = [];

	// Security: restrict protocols to prevent SSRF
	args.push("-protocol_whitelist", "file,pipe");

	// Overwrite output without asking (we handle uniqueness ourselves)
	args.push("-y");

	// Input file
	// -i takes its argument directly; no -- between flag and value.
	args.push("-i", inputPath);

	// If extracting audio from video, map only the first audio stream
	if (isVideoSource) {
		args.push("-map", "0:a:0");
	}

	// Audio codec
	if (codec !== "copy") {
		args.push("-c:a", codec);
	}

	// Metadata handling
	if (keepMetadata === false) {
		args.push("-map_metadata", "-1");
		args.push("-map_chapters", "-1");
		if (!isVideoSource) {
			args.push("-map", "a");
		}
	}

	// Audio bitrate
	if (audioBitrate) {
		args.push("-b:a", audioBitrate);
	}

	// Sample rate handling
	if (sampleRate) {
		// Opus 44100 -> 48000 auto-adjustment
		if ((actualOutputFormat === "opus" || actualOutputFormat === "weba") && sampleRate === 44100) {
			args.push("-ar", "48000");
		} else {
			args.push("-ar", String(sampleRate));
		}
	} else {
		// If no sample rate specified and output is opus, default to 48000
		// (Opus doesn't support 44100Hz)
		if (actualOutputFormat === "opus" || actualOutputFormat === "weba") {
			args.push("-ar", "48000");
		}
	}

	// End of options separator, then output file path
	// -- prevents output paths starting with "-" from being interpreted as flags
	args.push("--", actualOutputPath);

	return args;
}

// ── FFmpeg Node Converter ──

/**
 * FFmpeg-based audio converter using the system ffmpeg binary.
 * Gracefully unavailable if ffmpeg is not installed.
 */
export class FFmpegNodeConverter implements NodeConverter {
	readonly name = "ffmpeg";
	readonly supportedFormats: FormatInfo[] = [...AUDIO_FORMATS, ...VIDEO_FORMATS];

	private ffmpegPath: string | null = null;
	private available: boolean | null = null;

	/**
	 * Check if ffmpeg is available on the system.
	 * Caches the result after the first check.
	 */
	async isAvailable(): Promise<boolean> {
		if (this.available !== null) {
			return this.available;
		}

		try {
			this.ffmpegPath = await which("ffmpeg");
			this.available = true;
		} catch {
			this.ffmpegPath = null;
			this.available = false;
		}

		return this.available;
	}

	/**
	 * Convert an audio file using system ffmpeg.
	 * Supports audio-to-audio conversion and video-to-audio extraction.
	 */
	async convert(options: ConvertOptions): Promise<ConvertResult> {
		if (!(await this.isAvailable()) || !this.ffmpegPath) {
			throw new Error("ffmpeg is not installed on this system");
		}

		const inputExt = path.extname(options.inputPath).slice(1).toLowerCase();

		// Determine actual output path (ALAC uses .m4a extension)
		let actualOutputPath = options.outputPath;
		if (options.outputFormat.toLowerCase() === "alac") {
			const dir = path.dirname(options.outputPath);
			const base = path.basename(options.outputPath, path.extname(options.outputPath));
			actualOutputPath = path.join(dir, `${base}.m4a`);
		}

		const effectiveOptions: ConvertOptions = {
			...options,
			outputPath: actualOutputPath,
		};

		const args = buildConversionArgs(effectiveOptions, inputExt);

		await acquireSlot();
		try {
			await runFFmpeg(this.ffmpegPath, args);
		} finally {
			releaseSlot();
		}

		// Verify output exists and get size
		const stats = await stat(actualOutputPath);

		return {
			outputPath: actualOutputPath,
			format: options.outputFormat.toLowerCase(),
			sizeBytes: stats.size,
		};
	}
}
