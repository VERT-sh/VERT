import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { AudioStreamProbe } from "./video/ffmpeg.video.probe";

export type LogFn = (...args: unknown[]) => void;

// " D.AI.S apple_apac      Apple Positional Audio Codec"
const parseDecodableAudioCodecs = (output: string): Set<string> => {
	const codecs = new Set<string>();
	for (const line of output.split("\n")) {
		const fields = line.trim().split(/\s+/);
		if (fields.length < 2) continue;

		const [flags, name] = fields;
		if (flags.length < 3) continue;
		if (flags[0] !== "D" || flags[2] !== "A") continue;
		// skips the legend lines (`D.A... = Audio codec`), where the name is "="
		if (!/^[a-z0-9_]+$/i.test(name)) continue;

		codecs.add(name.toLowerCase());
	}
	return codecs;
};

let cached: ReadonlySet<string> | null = null;
let probed = false;
let inFlight: Promise<ReadonlySet<string> | null> | null = null;

const runCodecProbe = async (
	ffmpeg: FFmpeg,
	log: LogFn,
): Promise<ReadonlySet<string> | null> => {
	let output = "";
	const listener = ({ message }: { message: string }) => {
		output += `${message}\n`;
	};

	ffmpeg.on("log", listener);
	try {
		await ffmpeg.exec(["-hide_banner", "-codecs"]).catch(() => {});
	} finally {
		ffmpeg.off("log", listener);
	}

	const codecs = parseDecodableAudioCodecs(output);
	if (codecs.size === 0) {
		log(
			"codec probe failed, keeping every audio stream except known spatial tracks",
		);
		return null;
	}

	log(`codec probe found ${codecs.size} decodable audio codecs`);
	return codecs;
};

export const probeDecodableAudioCodecs = async (
	ffmpeg: FFmpeg,
	log: LogFn,
): Promise<ReadonlySet<string> | null> => {
	if (probed) return cached;
	if (inFlight) return inFlight;

	inFlight = runCodecProbe(ffmpeg, log);
	try {
		cached = await inFlight;
		probed = true;
		return cached;
	} finally {
		inFlight = null;
	}
};

// cached result of the capability probe, `null` when it failed or never ran.
export const getDecodableAudioCodecs = (): ReadonlySet<string> | null => cached;

// the current ffmpeg version in ffmpeg.wasm doesn't report `apac` at all, read the `codec_tag_string` instead
export const isSpatialAudioStream = (stream: AudioStreamProbe): boolean => {
	const name = (stream.codec_name ?? "").toLowerCase();
	const tag = (stream.codec_tag_string ?? "").toLowerCase();
	if (name === "apple_apac") return true;
	return tag === "apac" && name !== "apac";
};

const isUsableAudioStream = (
	stream: AudioStreamProbe,
	decodable: ReadonlySet<string> | null,
): boolean => {
	const spatial = isSpatialAudioStream(stream);
	if (!decodable) return !spatial;

	if (spatial)
		return (
			(stream.codec_name ?? "").toLowerCase() === "apple_apac" &&
			decodable.has("apple_apac")
		);

	// keep streams with an unknown name rather than dropping audio we can't classify
	if (!stream.codec_name) return true;

	return decodable.has(stream.codec_name.toLowerCase());
};

// converter/job.rs `audio_streams_probe` + `prefer_non_spatial_audio`
export const pickUsableAudioStreams = (
	streams: AudioStreamProbe[],
	decodable: ReadonlySet<string> | null,
): AudioStreamProbe[] =>
	streams
		.filter((stream) => isUsableAudioStream(stream, decodable))
		.sort(
			(a, b) =>
				Number(isSpatialAudioStream(a)) -
				Number(isSpatialAudioStream(b)),
		);
