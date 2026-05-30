import type { FFmpeg } from "@ffmpeg/ffmpeg";

const tryExtractAlbumArt = async (
	ffmpeg: FFmpeg,
	command: string[],
): Promise<boolean> => {
	try {
		await ffmpeg.exec(command);
		const coverData = await ffmpeg.readFile("cover.jpg");
		return !!(coverData && (coverData as Uint8Array).length > 0);
	} catch {
		return false;
	}
};

export const extractAlbumArt = async (ffmpeg: FFmpeg): Promise<boolean> => {
	if (
		await tryExtractAlbumArt(ffmpeg, [
			"-i",
			"input",
			"-map",
			"0:1",
			"-c:v",
			"copy",
			"-update",
			"1",
			"cover.jpg",
		])
	) {
		return true;
	}

	if (
		await tryExtractAlbumArt(ffmpeg, [
			"-i",
			"input",
			"-an",
			"-c:v",
			"copy",
			"-update",
			"1",
			"cover.jpg",
		])
	) {
		return true;
	}

	return false;
};

// audo -> video with album art
export const avWithArt = (
	to: string,
	codecArgs: string[],
	metadataArgs: string[],
	audioBitrateArgs: string[],
	sampleRateArgs: string[],
	channelsArgs: string[],
	tracksArgs: string[],
): string[] => {
	return [
		"-loop",
		"1",
		"-i",
		"cover.jpg",
		"-i",
		"input",
		"-vf",
		"scale=trunc(iw/2)*2:trunc(ih/2)*2",
		"-shortest",
		"-pix_fmt",
		"yuv420p",
		"-r",
		"1",
		...codecArgs,
		...metadataArgs,
		...audioBitrateArgs,
		...sampleRateArgs,
		...channelsArgs,
		...tracksArgs,
		"output" + to,
	];
};

// audio -> video with solid color bg
export const avWithBg = (
	to: string,
	codecArgs: string[],
	metadataArgs: string[],
	audioBitrateArgs: string[],
	sampleRateArgs: string[],
	channelsArgs: string[],
	tracksArgs: string[],
): string[] => {
	return [
		"-f",
		"lavfi",
		"-i",
		"color=c=black:s=512x512:rate=1",
		"-i",
		"input",
		"-shortest",
		"-pix_fmt",
		"yuv420p",
		"-r",
		"1",
		...codecArgs,
		...metadataArgs,
		...audioBitrateArgs,
		...sampleRateArgs,
		...channelsArgs,
		...tracksArgs,
		"output" + to,
	];
};
