import type { Categories } from "$lib/types";
import type { Converter } from "./converter.svelte";
import { FFmpegConverter } from "./ffmpeg.svelte";
import { PandocConverter } from "./pandoc.svelte";
import { VertdConverter } from "./vertd.svelte";
import { MagickConverter } from "./magick.svelte";
import { DISABLE_ALL_EXTERNAL_REQUESTS } from "$lib/util/consts";

const getConverters = (): Converter[] => {
	const converters: Converter[] = [
		new MagickConverter(),
		new FFmpegConverter(),
	];

	if (!DISABLE_ALL_EXTERNAL_REQUESTS) {
		converters.push(new VertdConverter());
	}

	converters.push(new PandocConverter());
	return converters;
};

export const converters = getConverters();

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

categories.audio.formats =
	converters
		.find((c) => c.name === "ffmpeg")
		?.supportedFormats.filter((f) => f.toSupported && f.isNative)
		.map((f) => f.name) || [];
categories.video.formats =
	converters
		.find((c) => c.name === "vertd")
		?.supportedFormats.filter((f) => f.toSupported && f.isNative)
		.map((f) => f.name) || [];
categories.image.formats =
	converters
		.find((c) => c.name === "imagemagick")
		?.formatStrings((f) => f.toSupported) || [];
categories.doc.formats =
	converters
		.find((c) => c.name === "pandoc")
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
