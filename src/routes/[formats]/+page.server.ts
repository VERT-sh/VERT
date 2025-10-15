import { converters } from "$lib/converters";
import type { EntryGenerator } from "./$types";

// only generate slugs for popular formats
// vert is static, so we can't generate all possible combinations
const VIDEO_FORMATS = [
	"mp4",
	"mkv",
	"avi",
	"mov",
	"webm",
	"flv",
	"wmv",
	"mpg",
	"3gp",
];

const AUDIO_FORMATS = [
	"mp3",
	"wav",
	"flac",
	"m4a",
	"ogg",
	"aiff",
	"wma",
	"opus",
];

const IMAGE_FORMATS = [
	"png",
	"jpg",
	"jpeg",
	"jfif",
	"webp",
	"jxl",
	"psd",
	"ico",
	"icns",
	"ppm",
	"gif",
	"svg",
	"bmp",
	"tiff",
	"heic",
	"heif",
	"avif",
];

const DOCUMENT_FORMATS = [
	"docx",
	"doc",
	"md",
	"rtf",
	"odt",
	"html",
	"csv",
	"tsv",
	"rst",
	"epub",
	"docbook",
];

const POPULAR_FORMATS = [
	...VIDEO_FORMATS,
	...AUDIO_FORMATS,
	...IMAGE_FORMATS,
	...DOCUMENT_FORMATS,
];

export const entries: EntryGenerator = () => {
	const seenPairs = new Set<string>();

	// this would be unnecessary, but certain formats can only be converted one-way (so avoid generating them)
	// e.g. heic -> jpg works, but not jpg -> heic
	const canConvert = (from: string, to: string): boolean => {
		const fromFormat = `.${from}`;
		const toFormat = `.${to}`;

		// check if any converter supports this conversion
		for (const converter of converters) {
			let from = false;
			let to = false;

			for (const f of converter.supportedFormats) {
				if (f.name === fromFormat && f.fromSupported) from = true;
				if (f.name === toFormat && f.toSupported) to = true;
			}

			if (from && to) return true;
		}

		return false;
	};

	// generate all combinations from the formats list
	for (const fromFormat of POPULAR_FORMATS) {
		for (const toFormat of POPULAR_FORMATS) {
			if (fromFormat === toFormat) continue;

			// exclude video <-> audio conversions
			const fromVideo = VIDEO_FORMATS.includes(fromFormat);
			const toVideo = VIDEO_FORMATS.includes(toFormat);
			const fromAudio = AUDIO_FORMATS.includes(fromFormat);
			const toAudio = AUDIO_FORMATS.includes(toFormat);

			if ((fromVideo && toAudio) || (fromAudio && toVideo)) continue;

			if (!canConvert(fromFormat, toFormat)) continue;

			const slug = `${fromFormat}-${toFormat}`;
			if (!seenPairs.has(slug)) seenPairs.add(slug);
		}
	}

	const result = Array.from(seenPairs).map((slug) => ({ formats: slug }));
	console.log(`[SEO] generating ${result.length} format conversion routes`);
	return result;
};

export const prerender = true;

export const load = ({ params }) => {
	const { formats } = params;

	// parse the slug (e.g. { from: "mkv", to: "mp4" })
	const parts = formats.split("-");

	if (parts.length !== 2) {
		return {
			fromFormat: null,
			toFormat: null,
			error: "Invalid format slug",
		};
	}

	const [from, to] = parts;
	const fromFormat = `.${from}`;
	const toFormat = `.${to}`;

	let fromValid = false;
	let toValid = false;

	for (const converter of converters) {
		for (const format of converter.supportedFormats) {
			if (format.name === fromFormat && format.fromSupported)
				fromValid = true;
			if (format.name === toFormat && format.toSupported) toValid = true;
		}
	}

	if (!fromValid || !toValid) {
		return {
			fromFormat: null,
			toFormat: null,
			error: "Invalid conversion pair",
		};
	}

	return {
		fromFormat,
		toFormat,
		error: null,
	};
};
