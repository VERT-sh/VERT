import { stat, realpath, access, constants } from "node:fs/promises";
import path from "node:path";

/** Dangerous ImageMagick format names that could execute code or fetch URLs. */
const DANGEROUS_FORMATS = new Set([
	"mvg", "msl", "ephemeral", "url", "http", "https",
	"ftp", "text", "label", "caption",
]);

/** Formats that lack WASM delegates and will fail silently or produce garbage. */
const UNSUPPORTED_WASM_FORMATS = new Set([
	"pdf", "pdfa", "eps", "ps", "ps1", "ps2", "ps3",
	// SVG INPUT is unsupported (needs librsvg), but OUTPUT works via IM's internal writer.
	// Blocked at the converter level (fromSupported=false) instead of here.
	// RAW camera formats (need libraw)
	"cr2", "nef", "arw", "dng", "cr3", "orf", "rw2", "pef",
	"srf", "sr2", "raf", "mrw", "erf", "kdc", "dcr", "rwl",
	"iiq", "3fr", "crw", "mef", "nrw", "srw", "mos", "raw",
	// Old binary .doc (pandoc docx reader can't handle it)
	"doc",
]);

/**
 * Validate and resolve an input file path.
 * Returns the resolved absolute path.
 */
export async function validateInputPath(inputPath: string): Promise<string> {
	assertNoPathInjection(inputPath);

	const resolved = path.resolve(inputPath);
	const real = await realpath(resolved);

	const stats = await stat(real);
	if (!stats.isFile()) {
		throw new Error(`Input path is not a regular file: ${inputPath}`);
	}

	// 100 MB limit
	const MAX_SIZE = 100 * 1024 * 1024;
	if (stats.size > MAX_SIZE) {
		throw new Error(
			`Input file exceeds 100 MB limit: ${(stats.size / 1024 / 1024).toFixed(1)} MB`,
		);
	}

	return real;
}

/**
 * Validate and resolve an output file path.
 * Returns the resolved absolute path, ensuring it won't overwrite existing files.
 */
export async function validateOutputPath(
	outputPath: string,
	inputPath: string,
): Promise<string> {
	assertNoPathInjection(outputPath);

	const resolved = path.resolve(outputPath);

	// Verify output !== input after resolution
	if (resolved === inputPath) {
		throw new Error("Output path cannot be the same as input path");
	}

	// Verify parent directory exists and is writable
	const parentDir = path.dirname(resolved);
	try {
		await access(parentDir, constants.W_OK);
	} catch {
		throw new Error(`Output directory is not writable: ${parentDir}`);
	}

	// Don't overwrite existing files — auto-suffix
	return await findAvailablePath(resolved);
}

/**
 * Validate a format string against the allowlist.
 * Returns the normalized undotted format string.
 */
export function validateFormat(format: string, allowlist: Set<string>): string {
	// Strip leading dot if present
	const normalized = format.startsWith(".") ? format.slice(1) : format;
	const lower = normalized.toLowerCase();

	if (DANGEROUS_FORMATS.has(lower)) {
		throw new Error(`Blocked dangerous format: ${lower}`);
	}

	if (UNSUPPORTED_WASM_FORMATS.has(lower)) {
		throw new Error(
			`Unsupported format: ${lower} (requires system libraries not available in WASM)`,
		);
	}

	if (!allowlist.has(lower)) {
		throw new Error(`Unknown format: ${lower}`);
	}

	return lower;
}

/**
 * Validate audio bitrate parameter.
 */
export function validateAudioBitrate(bitrate: string): string {
	if (!/^\d+k$/.test(bitrate)) {
		throw new Error(
			`Invalid audio bitrate: ${bitrate}. Expected format like "128k" or "320k".`,
		);
	}
	return bitrate;
}

/**
 * Validate sample rate parameter.
 */
export function validateSampleRate(rate: number): number {
	if (!Number.isInteger(rate) || rate < 8000 || rate > 192000) {
		throw new Error(
			`Invalid sample rate: ${rate}. Must be an integer between 8000 and 192000.`,
		);
	}
	return rate;
}

/** Check for path injection attempts. */
function assertNoPathInjection(filePath: string): void {
	// Block null bytes
	if (filePath.includes("\0")) {
		throw new Error("Path contains null bytes");
	}

	// Block Windows UNC paths
	if (filePath.startsWith("\\\\")) {
		throw new Error("UNC paths are not allowed");
	}

	// Block NTFS alternate data streams (colons after drive prefix)
	// Allow the drive letter colon (e.g., C:\) but block file.txt:stream
	const withoutDrive = filePath.replace(/^[A-Za-z]:/, "");
	if (withoutDrive.includes(":")) {
		throw new Error("NTFS alternate data streams are not allowed");
	}
}

/** Find an available path by appending _1, _2, etc. if the file exists. */
async function findAvailablePath(filePath: string): Promise<string> {
	try {
		await stat(filePath);
	} catch {
		// File doesn't exist, path is available
		return filePath;
	}

	const ext = path.extname(filePath);
	const base = filePath.slice(0, -ext.length || undefined);

	for (let i = 1; i <= 1000; i++) {
		const candidate = `${base}_${i}${ext}`;
		try {
			await stat(candidate);
		} catch {
			return candidate;
		}
	}

	throw new Error("Could not find available output path after 1000 attempts");
}
