import { FFmpegConverter } from "./ffmpeg.svelte";
import { FontConverter } from "./font.svelte";
import { PandocConverter } from "./pandoc.svelte";
import { VertdConverter } from "./vertd.svelte";
import { VipsConverter } from "./vips.svelte";

export const converters = [
	new VipsConverter(),
	new FFmpegConverter(),
	new VertdConverter(),
	new PandocConverter(),
	new FontConverter(),
];
