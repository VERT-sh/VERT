import { FormatInfo } from "../converter.svelte";

export const VECTORIZER_PRIORITY = 6;

export const vectorizerRasterFormats = [
	"png",
	"jpg",
	"jpeg",
	"jpe",
	"jfif",
	"webp",
	"gif",
	"bmp",
	"ico", // 32bpp RGBA only
	"tif",
	"tiff",
	"pnm", // P1-P7
	"pbm",
	"pgm",
	"ppm",
	"pam",
	"qoi",
	"hdr",
	"exr",
	"dds",
	"ff",
	"farbfeld",
] as const;

export const vectorizerFormats: FormatInfo[] = [
	...vectorizerRasterFormats.map(
		(format) =>
			new FormatInfo(format, true, false, true, VECTORIZER_PRIORITY),
	),
	new FormatInfo("svg", false, true, true, VECTORIZER_PRIORITY),
];
