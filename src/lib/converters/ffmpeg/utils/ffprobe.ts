import type { FFmpeg } from "@ffmpeg/ffmpeg";

// captures the first numeric value emitted while executing ffprobe lol
export const ffprobeValue = async (
	ffmpeg: FFmpeg,
	targs: string[],
	parse?: (s: string) => number | null,
): Promise<number | null> => {
	let value: number | null = null;
	const listener = (event: { message: string }) => {
		if (value !== null) return;
		const parsed = parse
			? parse(event.message.trim())
			: parseInt(event.message.trim(), 10);
		if (!parsed && parsed !== 0) return;
		value = parsed as number;
	};

	ffmpeg.on("log", listener);
	try {
		await ffmpeg.ffprobe.call(ffmpeg, targs);
		return value;
	} catch {
		return null;
	} finally {
		ffmpeg.off("log", listener);
	}
};

export const detectAudioBitrate = async (
	ffmpeg: FFmpeg,
): Promise<number | null> => {
	const args = [
		"-v",
		"quiet",
		"-select_streams",
		"a:0",
		"-show_entries",
		"stream=bit_rate",
		"-of",
		"default=noprint_wrappers=1:nokey=1",
		"input",
	];

	return await ffprobeValue(ffmpeg, args, (s) => {
		const n = parseInt(s, 10);
		return Number.isFinite(n) ? Math.round(n / 1000) : null;
	});
};

export const detectAudioSampleRate = async (
	ffmpeg: FFmpeg,
): Promise<number | null> => {
	const args = [
		"-v",
		"quiet",
		"-select_streams",
		"a:0",
		"-show_entries",
		"stream=sample_rate",
		"-of",
		"default=noprint_wrappers=1:nokey=1",
		"input",
	];

	return await ffprobeValue(ffmpeg, args, (s) => {
		const n = parseInt(s, 10);
		return Number.isFinite(n) ? n : null;
	});
};
