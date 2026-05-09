import { toArgs, animatedImageFormats } from "$lib/converters/ffmpeg.codecs";
import type { ConversionSettings } from "$lib/types/conversion-settings";

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

	if (
		outputFormat === "mp4" ||
		outputFormat === "mkv" ||
		outputFormat === "mov"
	) {
		baseArgs.push("-vf", scaleFilter, "-pix_fmt", "yuv420p");
	} else if (outputFormat === "webm") {
		baseArgs.push(
			"-vf",
			scaleFilter,
			"-pix_fmt",
			"yuva420p",
			"-auto-alt-ref",
			"0",
		);
	} else if (outputFormat === "gif") {
		baseArgs.push(
			"-filter_complex",
			`fps=${settings.imageSequenceFPS || 15},${scaleFilter},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
		);
	} else if (isAnimatedImage) {
		baseArgs.push("-vf", scaleFilter);
		if (outputFormat === "apng") baseArgs.push("-plays", "0");
	} else {
		baseArgs.push("-vf", scaleFilter, "-pix_fmt", "yuv420p");
	}

	baseArgs.push("output" + to);
	return baseArgs;
}
