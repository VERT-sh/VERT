import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import which from "which";
import { FormatInfo, type ConvertOptions, type ConvertResult, type NodeConverter } from "./types.js";

const execFileAsync = promisify(execFile);

/** Conversion timeout in milliseconds. */
const TIMEOUT_MS = 120_000;

/** Max concurrent pandoc processes. */
const MAX_CONCURRENT = 3;

/**
 * Map file extension (without dot) to pandoc reader name.
 */
function formatToReader(ext: string): string {
	switch (ext) {
		case "md":
		case "markdown":
			return "markdown";
		case "docx":
			return "docx";
		case "csv":
			return "csv";
		case "tsv":
			return "tsv";
		case "docbook":
			return "docbook";
		case "epub":
			return "epub";
		case "html":
			return "html";
		case "json":
			return "json";
		case "odt":
			return "odt";
		case "rtf":
			return "rtf";
		case "rst":
			return "rst";
		default:
			throw new Error(`Unsupported pandoc input format: ${ext}`);
	}
}

/**
 * Map file extension (without dot) to pandoc writer name.
 * Separate from reader because some writer names differ.
 */
function formatToWriter(ext: string): string {
	switch (ext) {
		case "md":
		case "markdown":
			return "markdown";
		case "docx":
			return "docx";
		case "csv":
			return "csv";
		case "tsv":
			return "tsv";
		case "docbook":
			return "docbook5";
		case "epub":
			return "epub3";
		case "html":
			return "html5";
		case "json":
			return "json";
		case "odt":
			return "odt";
		case "rst":
			return "rst";
		default:
			throw new Error(`Unsupported pandoc output format: ${ext}`);
	}
}

/**
 * Normalize format aliases to canonical extension names.
 */
function normalizeFormat(ext: string): string {
	if (ext === "markdown") return "md";
	return ext;
}

/**
 * Pandoc-based document converter.
 *
 * Uses system `pandoc` via `child_process.execFile`.
 * Gracefully unavailable if pandoc is not installed.
 */
export class PandocNodeConverter implements NodeConverter {
	readonly name = "pandoc";

	readonly supportedFormats: FormatInfo[] = [
		new FormatInfo("docx", true, true),
		// .doc is NOT supported — pandoc docx reader can't handle binary .doc
		new FormatInfo("md", true, true),
		new FormatInfo("html", true, true),
		new FormatInfo("rtf", true, false), // read only — RTF output is blocked
		new FormatInfo("csv", true, true),
		new FormatInfo("tsv", true, true),
		new FormatInfo("json", true, true), // pandoc-converted JSON only
		new FormatInfo("rst", true, true),
		new FormatInfo("epub", true, true),
		new FormatInfo("odt", true, true),
		new FormatInfo("docbook", true, true),
	];

	private pandocPath: string | null = null;
	private available: boolean | null = null;
	private activeCount = 0;

	/** Detect if pandoc is installed on the system. */
	async isAvailable(): Promise<boolean> {
		if (this.available !== null) return this.available;

		try {
			this.pandocPath = await which("pandoc");
			this.available = true;
		} catch {
			this.available = false;
			console.error("[pandoc] pandoc not found on system PATH");
		}

		return this.available;
	}

	/** Convert a document file using pandoc. */
	async convert(options: ConvertOptions): Promise<ConvertResult> {
		if (!(await this.isAvailable()) || !this.pandocPath) {
			throw new Error("pandoc is not available on this system");
		}

		if (this.activeCount >= MAX_CONCURRENT) {
			throw new Error(
				`Too many concurrent pandoc conversions (max ${MAX_CONCURRENT}). Try again later.`,
			);
		}

		const inputExt = path.extname(options.inputPath).slice(1).toLowerCase();
		const outputExt = normalizeFormat(options.outputFormat.toLowerCase());

		// Block RTF output
		if (outputExt === "rtf") {
			throw new Error("Converting to RTF is not supported.");
		}

		const reader = formatToReader(normalizeFormat(inputExt));
		const writer = formatToWriter(outputExt);

		// Create temp dir for --extract-media (cleaned in finally)
		const mediaTmpDir = await mkdtemp(path.join(tmpdir(), "pandoc-media-"));

		this.activeCount++;
		try {
			const args: string[] = [
				"--sandbox",
				"-f", reader,
				"-t", writer,
				"--extract-media", mediaTmpDir,
				"-o", options.outputPath,
				"--", options.inputPath,
			];

			await execFileAsync(this.pandocPath, args, {
				timeout: TIMEOUT_MS,
				maxBuffer: 50 * 1024 * 1024, // 50 MB stdout/stderr buffer
				windowsHide: true,
			});

			const outputStats = await stat(options.outputPath);

			return {
				outputPath: options.outputPath,
				format: outputExt,
				sizeBytes: outputStats.size,
			};
		} finally {
			this.activeCount--;
			// Clean up extracted media temp dir
			try {
				await rm(mediaTmpDir, { recursive: true, force: true });
			} catch {
				// Best-effort cleanup — don't throw from finally
				console.error(`[pandoc] Failed to clean up temp dir: ${mediaTmpDir}`);
			}
		}
	}
}
