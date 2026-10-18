import type { Categories } from "#lib/types";
import { DISABLE_ALL_EXTERNAL_REQUESTS } from "#lib/util/consts";
import type { Converter, WorkerStatus } from "./converter.svelte";
import { FFmpegConverter } from "./ffmpeg/audio/ffmpeg.audio.svelte";
import { FFmpegVideoConverter } from "./ffmpeg/video/ffmpeg.video.svelte";
import { MagickConverter } from "./magick/magick.svelte";
import { MediabunnyConverter } from "./mediabunny/mediabunny.svelte";
import { PandocConverter } from "./pandoc/pandoc.svelte";
import { SpessaSynthConverter } from "./spessasynth/spessasynth.svelte";
import { VectorizerConverter } from "./vectorizer/vectorizer.svelte";
import { VertdConverter } from "./vertd/vertd.svelte";
import { VipsConverter } from "./vips/vips.svelte";

// TODO: change this to include category with initialization to replace converterCategories and maybe categories as well
const getConverters = (): Converter[] => {
	const converters: Converter[] = [
		new MagickConverter(),
		new VipsConverter(),
		new VectorizerConverter(),
		new FFmpegConverter(),
		new SpessaSynthConverter("midi"),
		new SpessaSynthConverter("soundfont"),
		new PandocConverter(),
		new MediabunnyConverter(),
		new FFmpegVideoConverter(),
	];

	if (!DISABLE_ALL_EXTERNAL_REQUESTS) converters.push(new VertdConverter());

	return converters;
};

export const converters = getConverters();
export const converterCategories = {
	image: ["libvips", "imagemagick", "vectorizer"],
	video: ["mediabunny", "vertd", "ffmpeg-video"],
	audio: ["ffmpeg", "spessasynth-midi", "spessasynth-soundfont"],
	doc: ["pandoc"],
};

export type ConverterCategory =
	keyof typeof converterCategories | "archive" | "unknown";

export const categoryByConverter = Object.fromEntries(
	Object.entries(converterCategories).flatMap(([category, names]) =>
		names.map((name) => [name, category as ConverterCategory] as const),
	),
) as Record<string, ConverterCategory>;

export function getConverterByFormat(format: string) {
	for (const converter of converters) {
		if (converter.supportedFormats.some((f) => f.name === format)) {
			return converter;
		}
	}
	return null;
}

export const categories: Categories = {
	image: { formats: [""], canConvertTo: [] },
	video: { formats: [""], canConvertTo: ["audio"] },
	audio: { formats: [""], canConvertTo: ["video"] },
	doc: { formats: [""], canConvertTo: [] },
};

categories.audio.formats = [
	...new Set(
		converters
			.filter((c) => converterCategories.audio.includes(c.name))
			.flatMap((c) =>
				c.supportedFormats
					.filter((f) => f.toSupported && f.isNative)
					.map((f) => f.name),
			),
	),
];
categories.video.formats = [
	...new Set(
		converters
			.filter((c) => converterCategories.video.includes(c.name))
			.flatMap((c) =>
				c.supportedFormats
					.filter((f) => f.toSupported && f.isNative)
					.map((f) => f.name),
			),
	),
];
categories.image.formats = [
	...new Set(
		converters
			.filter((c) => converterCategories.image.includes(c.name))
			.flatMap((c) => c.formatStrings((f) => f.toSupported)),
	),
];
categories.doc.formats =
	converters
		.find((c) => converterCategories.doc.includes(c.name))
		?.supportedFormats.filter((f) => f.toSupported && f.isNative)
		.map((f) => f.name) || [];

export const byNative = (format: string) => {
	return (a: Converter, b: Converter) => {
		const aFormat = a.supportedFormats.find((f) => f.name === format);
		const bFormat = b.supportedFormats.find((f) => f.name === format);

		if (aFormat && bFormat) {
			return aFormat.isNative ? -1 : 1;
		}
		return 0;
	};
};

export function categoryStatus(category: ConverterCategory): WorkerStatus {
	const names =
		(converterCategories as Record<string, string[]>)[category] ?? [];
	const all = converters.filter((c) => names.includes(c.name));
	const available = all.filter((c) => c.isAvailable());
	const members = available.length ? available : all;

	if (!members.length) return "idle";

	const isReady = (s: WorkerStatus) =>
		s === "ready" || s === "partially-ready";
	const readyCount = members.filter((c) => isReady(c.status)).length;

	if (readyCount === members.length) return "ready";
	if (readyCount > 0) return "partially-ready";
	if (members.some((c) => c.status === "error")) return "error";
	if (
		members.some(
			(c) => c.status === "downloading" || c.status === "initializing",
		)
	)
		return "downloading";

	return "idle";
}
