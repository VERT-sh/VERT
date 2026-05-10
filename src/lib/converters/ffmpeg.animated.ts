import { toArgs, animatedImageFormats } from "$lib/converters/ffmpeg.codecs";
import type { ConversionSettings } from "$lib/types/conversion-settings";
import { videoFormats } from "./vertd.svelte";

export function buildImageSequenceCommand(
	outputFormat: string,
	settings: ConversionSettings,
	isAlac: boolean,
): string[] {
	const to = `.${outputFormat}`;
	const codecArgs = toArgs(to, isAlac);
	const baseArgs = [
		"-f",
		"concat",
		"-safe",
		"0",
		"-i",
		"frames.txt",
		...codecArgs,
	];
	const scaleFilter = "scale=trunc(iw/2)*2:trunc(ih/2)*2";
	const isAnimatedImage = animatedImageFormats.includes(outputFormat);
	const enableTransparency = settings.imageSequenceTransparency ?? false;

	if (videoFormats.includes(outputFormat)) {
		const fpsFilter = `fps=${settings.imageSequenceFPS || 15}`;
		const blackCompositeFilter =
			`color=c=black,format=rgb24[bg];` +
			`[0:v]${fpsFilter},${scaleFilter},setsar=1[fg];` +
			`[bg][fg]scale2ref[bg2][fg2];` +
			`[bg2][fg2]overlay=format=auto:shortest=1,setsar=1`;

		if (outputFormat === "webm" && enableTransparency) {
			baseArgs.push(
				"-filter_complex",
				`[0:v]${fpsFilter},${scaleFilter},setsar=1`,
				"-pix_fmt",
				"yuva420p",
				"-auto-alt-ref",
				"0",
			);
		} else {
			baseArgs.push(
				"-filter_complex",
				blackCompositeFilter,
				"-pix_fmt",
				"yuv420p",
			);
		}
	} else if (outputFormat === "gif") {
		const paletteuse = enableTransparency
			? "[p]paletteuse=alpha_threshold=128"
			: "[p]paletteuse";
		baseArgs.push(
			"-filter_complex",
			`fps=${settings.imageSequenceFPS || 15},${scaleFilter},split[s0][s1];[s0]palettegen[p];[s1]${paletteuse}`,
		);
	} else if (isAnimatedImage) {
		baseArgs.push("-vf", scaleFilter);
		if (outputFormat === "apng") {
			baseArgs.push("-plays", "0");
			if (enableTransparency) baseArgs.push("-pix_fmt", "rgba");
		} else if (outputFormat === "webp") {
			if (enableTransparency) baseArgs.push("-pix_fmt", "rgba");
		}
	} else {
		const pixFmt = enableTransparency ? "yuva420p" : "yuv420p";
		baseArgs.push("-vf", scaleFilter, "-pix_fmt", pixFmt);
	}

	baseArgs.push("output" + to);
	return baseArgs;
}
