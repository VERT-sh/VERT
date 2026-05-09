// prettier-ignore
export const CONVERSION_BITRATES = ["auto", "custom", 16, 32, 64, 96, 128, 160, 192, 256, 320] as const;

// prettier-ignore
export const SAMPLE_RATES = ["auto", "custom", 8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 96000,] as const;

// prettier-ignore
export const videoFormats = ["mkv", "mp4", "avi", "mov", "webm", "ts", "mts", "m2ts", "wmv", "mpg", "mpeg", "flv", "f4v", "vob", "m4v", "3gp", "3g2", "mxf", "ogv", "rm", "rmvb", "divx"];

// prettier-ignore
export const animatedImageFormats = ["gif", "webp", "apng"];

// prettier-ignore
export const lossless = ["flac", "m4a", "caf", "alac", "wav", "dsd", "dsf", "dff"];

export const getCodecs = (
	ext: string,
	isAlac: boolean = false,
): { video: string; audio: string } => {
	switch (ext) {
		// video <-> audio
		case ".mp4":
		case ".mkv":
		case ".mov":
		case ".mts":
		case ".ts":
		case ".m2ts":
		case ".flv":
		case ".f4v":
		case ".m4v":
		case ".3gp":
		case ".3g2":
			return { video: "libx264", audio: "aac" };
		case ".wmv":
			return { video: "wmv2", audio: "wmav2" };
		case ".webm":
		case ".ogv":
			return {
				video: ext === ".webm" ? "libvpx" : "libtheora",
				audio: "libvorbis",
			};
		case ".avi":
		case ".divx":
			return { video: "mpeg4", audio: "libmp3lame" };
		case ".mpg":
		case ".mpeg":
		case ".vob":
			return { video: "mpeg2video", audio: "mp2" };
		case ".mxf":
			return { video: "mpeg2video", audio: "pcm_s16le" };

		// audio
		case ".mp3":
			return { video: "libx264", audio: "libmp3lame" };
		case ".flac":
			return { video: "libx264", audio: "flac" };
		case ".wav":
			return { video: "libx264", audio: "pcm_s16le" };
		case ".ogg":
		case ".oga":
			return { video: "libx264", audio: "libvorbis" };
		case ".opus":
			return { video: "libx264", audio: "libopus" };
		case ".aac":
			return { video: "libx264", audio: "aac" };
		case ".m4a":
			return {
				video: "libx264",
				audio: isAlac ? "alac" : "aac",
			};
		case ".alac":
			return { video: "libx264", audio: "alac" };
		case ".wma":
			return { video: "libx264", audio: "wmav2" };

		// animated images
		case ".gif":
		case ".webp":
			//case ".apng":
			return { video: ext.slice(1), audio: "none" };

		default:
			return { video: "copy", audio: "copy" };
	}
};

// and here i was, thinking i'd be done with ffmpeg after finishing vertd
// but OH NO we just HAD to have someone suggest to allow album art video generation.
//
// i hate you SO much.
// - love, maddie
export const toArgs = (ext: string, isAlac: boolean = false): string[] => {
	const codecs = getCodecs(ext, isAlac);
	const args = ["-c:v", codecs.video];

	switch (codecs.video) {
		case "libx264": {
			args.push(
				"-preset",
				"ultrafast",
				"-crf",
				"18",
				"-tune",
				"stillimage",
			);
			break;
		}

		case "libvpx": {
			args.push("-c:v", "libvpx-vp9");
			break;
		}

		case "mpeg2video": {
			// for mpeg, mpg, vob, mxf
			if (ext === ".mxf") args.push("-ar", "48000"); // force 48kHz sample rate
			break;
		}
	}

	// only add audio codec if not a no-audio format
	if (codecs.audio !== "none") {
		args.push("-c:a", codecs.audio);
	}

	if (codecs.audio === "aac") args.push("-strict", "experimental");

	if (ext === ".divx") args.unshift("-f", "avi");
	if (ext === ".mxf") args.push("-strict", "unofficial");

	return args;
};

export type ConversionBitrate = (typeof CONVERSION_BITRATES)[number];
export type SampleRate = (typeof SAMPLE_RATES)[number];
