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
	webp: ["libvips", "imagemagick", "vertd", "ffmpeg-video"],
	gif: ["libvips", "imagemagick", "vertd", "ffmpeg-video"],
	apng: ["vertd", "ffmpeg-video"],

	// video - local supported (ffmpeg-wasm is slow, even with multithreading, so it's last)
	mp4: ["mediabunny", "vertd", "ffmpeg-video"],
	m4v: ["mediabunny", "vertd", "ffmpeg-video"],
	mkv: ["mediabunny", "vertd", "ffmpeg-video"],
	webm: ["mediabunny", "vertd", "ffmpeg-video"],
	mov: ["mediabunny", "vertd", "ffmpeg-video"],
	f4v: ["mediabunny", "vertd", "ffmpeg-video"],
	"3gp": ["mediabunny", "vertd", "ffmpeg-video"],
	"3g2": ["mediabunny", "vertd", "ffmpeg-video"],
	mts: ["mediabunny", "vertd", "ffmpeg-video"],
	m2ts: ["mediabunny", "vertd", "ffmpeg-video"],
	ts: ["mediabunny", "vertd", "ffmpeg-video"],

	// video
	avi: ["vertd", "ffmpeg-video"],
	wmv: ["vertd", "ffmpeg-video"],
	mpg: ["vertd", "ffmpeg-video"],
	mpeg: ["vertd", "ffmpeg-video"],
	flv: ["vertd", "ffmpeg-video"],
	vob: ["vertd", "ffmpeg-video"],
	mxf: ["vertd", "ffmpeg-video"],
	ogv: ["vertd", "ffmpeg-video"],
	ogx: ["vertd", "ffmpeg-video"],
	gxf: ["vertd", "ffmpeg-video"],
	h264: ["vertd", "ffmpeg-video"],
	divx: ["vertd", "ffmpeg-video"],
	swf: ["vertd", "ffmpeg-video"],
	amv: ["vertd", "ffmpeg-video"],
	asf: ["vertd", "ffmpeg-video"],
	nut: ["vertd", "ffmpeg-video"],
	ivf: ["vertd", "ffmpeg-video"],
	y4m: ["vertd", "ffmpeg-video"],
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
