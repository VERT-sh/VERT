import type { FormatInfo } from "./converter.svelte";

export const DEFAULT_PRIORITY = 1;

export const PREFERRED_PRIORITY = 5;

const normalize = (format: string) =>
	(format.startsWith(".") ? format.slice(1) : format).toLowerCase();

export const FORMAT_ENGINES: Record<string, string[]> = {
	// images - prefer libvips for speed & memory efficiency, then ImageMagick
	png: ["libvips", "imagemagick"],
	jpg: ["libvips", "imagemagick"],
	jpeg: ["libvips", "imagemagick"],
	jpe: ["libvips", "imagemagick"],
	jfif: ["libvips", "imagemagick"],
	tif: ["libvips", "imagemagick"],
	tiff: ["libvips", "imagemagick"],
	avif: ["libvips", "imagemagick"],
	jxl: ["libvips", "imagemagick"],
	svg: ["libvips", "imagemagick"],
	heic: ["libvips", "imagemagick"],
	heif: ["libvips", "imagemagick"],
	ppm: ["libvips", "imagemagick"],
	pnm: ["libvips", "imagemagick"],

	// formats that are both image and video (animated formats) — image engines first, then video
	webp: ["libvips", "imagemagick", "vertd"],
	gif: ["libvips", "imagemagick", "vertd"],

	// video - local supported
	mp4: ["mediabunny", "vertd"],
	m4v: ["mediabunny", "vertd"],
	mkv: ["mediabunny", "vertd"],
	webm: ["mediabunny", "vertd"],
	mov: ["mediabunny", "vertd"],
	f4v: ["mediabunny", "vertd"],
	"3gp": ["mediabunny", "vertd"],
	"3g2": ["mediabunny", "vertd"],
	mts: ["mediabunny", "vertd"],
	m2ts: ["mediabunny", "vertd"],
	ts: ["mediabunny", "vertd"],
};

export function priorityFor(converter: string, format: string): number {
	const engines = FORMAT_ENGINES[normalize(format)];
	if (!engines) return DEFAULT_PRIORITY;

	const index = engines.indexOf(converter);
	if (index === -1) return DEFAULT_PRIORITY;

	return Math.max(DEFAULT_PRIORITY, PREFERRED_PRIORITY - index);
}

export function applyPriorities(
	converter: string,
	formats: FormatInfo[],
): FormatInfo[] {
	for (const format of formats) {
		if (FORMAT_ENGINES[normalize(format.name)])
			format.priority = priorityFor(converter, format.name);
	}
	return formats;
}
