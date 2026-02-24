import type { FormatInfo, NodeConverter } from "./types.js";
import { MIME_TYPES } from "./types.js";
import { MagickNodeConverter } from "./magick.js";
import { FFmpegNodeConverter } from "./ffmpeg.js";
import { PandocNodeConverter } from "./pandoc.js";

/** All converter instances, in priority order. */
const converters: NodeConverter[] = [
	new MagickNodeConverter(),
	new FFmpegNodeConverter(),
	new PandocNodeConverter(),
];

/** Category definitions. */
export type Category = "image" | "audio" | "doc";

/**
 * Build the format allowlist (undotted format names) from all converters.
 */
export function buildFormatAllowlist(): Set<string> {
	const allowlist = new Set<string>();
	for (const converter of converters) {
		for (const fmt of converter.supportedFormats) {
			// Store undotted names
			const name = fmt.name.startsWith(".") ? fmt.name.slice(1) : fmt.name;
			allowlist.add(name);
		}
	}
	return allowlist;
}

/**
 * Find the appropriate converter for a given input and output format.
 * Converter priority: magick -> ffmpeg -> pandoc (array order).
 */
export function getConverter(
	inputFormat: string,
	outputFormat: string,
): NodeConverter | null {
	const inputDotted = inputFormat.startsWith(".") ? inputFormat : `.${inputFormat}`;
	const outputDotted = outputFormat.startsWith(".") ? outputFormat : `.${outputFormat}`;

	for (const converter of converters) {
		const supportsInput = converter.supportedFormats.some(
			(f) => f.name === inputDotted && f.fromSupported,
		);
		const supportsOutput = converter.supportedFormats.some(
			(f) => f.name === outputDotted && f.toSupported,
		);
		if (supportsInput && supportsOutput) {
			return converter;
		}
	}

	// Fallback: find any converter that handles the output format
	// (e.g., video input with audio output — ffmpeg handles video input)
	for (const converter of converters) {
		const supportsInput = converter.supportedFormats.some(
			(f) => f.name === inputDotted && f.fromSupported,
		);
		if (supportsInput) {
			// Check if any other converter can handle the output
			for (const outConverter of converters) {
				const supportsOutput = outConverter.supportedFormats.some(
					(f) => f.name === outputDotted && f.toSupported,
				);
				if (supportsOutput && converter === outConverter) {
					return converter;
				}
			}
		}
	}

	return null;
}

/**
 * Get format info by extension (undotted).
 */
export function getFormatInfo(format: string): {
	name: string;
	fromSupported: boolean;
	toSupported: boolean;
	category: Category | null;
	mimeType: string | null;
	converter: string | null;
} | null {
	const dotted = format.startsWith(".") ? format : `.${format}`;
	const undotted = format.startsWith(".") ? format.slice(1) : format;

	for (const converter of converters) {
		const fmt = converter.supportedFormats.find((f) => f.name === dotted);
		if (fmt) {
			return {
				name: undotted,
				fromSupported: fmt.fromSupported,
				toSupported: fmt.toSupported,
				category: getCategory(converter.name),
				mimeType: MIME_TYPES[undotted] ?? null,
				converter: converter.name,
			};
		}
	}

	return null;
}

/**
 * List formats, optionally filtered by category.
 */
export function listFormats(category?: Category): {
	name: string;
	fromSupported: boolean;
	toSupported: boolean;
	category: Category;
	mimeType: string | null;
}[] {
	const results: {
		name: string;
		fromSupported: boolean;
		toSupported: boolean;
		category: Category;
		mimeType: string | null;
	}[] = [];

	const seen = new Set<string>();

	for (const converter of converters) {
		const cat = getCategory(converter.name);
		if (category && cat !== category) continue;

		for (const fmt of converter.supportedFormats) {
			// Skip video formats (input-only, not shown in list_formats)
			if (!fmt.isNative && !fmt.toSupported) continue;

			const undotted = fmt.name.startsWith(".") ? fmt.name.slice(1) : fmt.name;
			if (seen.has(undotted)) continue;
			seen.add(undotted);

			results.push({
				name: undotted,
				fromSupported: fmt.fromSupported,
				toSupported: fmt.toSupported,
				category: cat,
				mimeType: MIME_TYPES[undotted] ?? null,
			});
		}
	}

	return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check which converters are available on this system.
 */
export async function checkAvailability(): Promise<Record<string, boolean>> {
	const results: Record<string, boolean> = {};
	for (const converter of converters) {
		results[converter.name] = await converter.isAvailable();
	}
	return results;
}

/** Map converter name to category. */
function getCategory(converterName: string): Category {
	switch (converterName) {
		case "imagemagick":
			return "image";
		case "ffmpeg":
			return "audio";
		case "pandoc":
			return "doc";
		default:
			return "image";
	}
}
