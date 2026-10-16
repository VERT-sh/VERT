// ffprobe helpers, ported from `converter/job.rs

import type { FFmpeg } from "@ffmpeg/ffmpeg";

export interface VideoStreamProbe {
	index: number;
	codec_name: string;
	width: number;
	height: number;
	pix_fmt: string;
	r_frame_rate: string;
	bit_rate?: string;
	disposition?: { attached_pic?: number };
}

export interface AudioStreamProbe {
	index: number;
	codec_name: string;
}

export interface VideoMetadata {
	streams: VideoStreamProbe[];
	durationSecs: number | null;
}

interface StreamsResponse<T> {
	streams?: T[];
	format?: { duration?: string };
}

// `-show_entries` list used by `Job::video_metadata` in converter/job.rs
const VIDEO_ENTRIES =
	"stream=index,codec_name,width,height,pix_fmt,r_frame_rate,bit_rate:stream_disposition=attached_pic:format=duration";

// converter/job.rs `parse_fps`
// parse fps which could be "30", "29.97" or "30000/1001"
export const parseFps = (value: string): number | null => {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const [numerator, denominator] = trimmed.split("/");
	const num = Number(numerator);
	if (!Number.isFinite(num)) return null;

	if (denominator === undefined) return Math.round(num);

	const den = Number(denominator);
	if (!Number.isFinite(den) || den === 0) return null;
	return Math.round(num / den);
};

// converter/job.rs `run_ffprobe` + `validate_ffprobe_output`
const readJson = async <T>(
	ffmpeg: FFmpeg,
	inputArgs: string[],
	entries: string,
	selectStream: "v" | "a",
	path: string,
	probeFile: string,
): Promise<StreamsResponse<T> | null> => {
	const args = [
		"-v",
		"error",
		...inputArgs,
		"-select_streams",
		selectStream,
		"-show_entries",
		entries,
		"-of",
		"json",
		path,
		"-o",
		probeFile,
	];

	try {
        // ffprobe in ffmpeg-wasm always returns -1 even on success, so rely on the JSON output instead of the return code
		await ffmpeg.ffprobe(args);

		const raw = (await ffmpeg.readFile(probeFile, "utf8")) as string;
		if (!raw.trim()) return null;
		return JSON.parse(raw) as StreamsResponse<T>;
	} catch {
		return null;
	} finally {
		await ffmpeg.deleteFile(probeFile).catch(() => {});
	}
};

// converter/job.rs `Job::video_metadata`
export const probeVideo = async (
	ffmpeg: FFmpeg,
	path: string,
	inputArgs: string[] = [],
): Promise<VideoMetadata> => {
	const probe = await readJson<VideoStreamProbe>(
		ffmpeg,
		inputArgs,
		VIDEO_ENTRIES,
		"v",
		path,
		"probe-v.json",
	);

	const durationSecs = probe?.format?.duration
		? (() => {
				const parsed = Number(probe.format?.duration);
				return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
			})()
		: null;

	return { streams: probe?.streams ?? [], durationSecs };
};

// converter/job.rs `Job::audio_streams_probe`
export const probeAudioStreams = async (
	ffmpeg: FFmpeg,
	path: string,
	inputArgs: string[] = [],
): Promise<AudioStreamProbe[]> => {
	const probe = await readJson<AudioStreamProbe>(
		ffmpeg,
		inputArgs,
		"stream=index,codec_name",
		"a",
		path,
		"probe-a.json",
	);
	return probe?.streams ?? [];
};

// converter/job.rs `VideoProbe::is_attached_picture`
export const isAttachedPicture = (stream: VideoStreamProbe): boolean =>
	(stream.disposition?.attached_pic ?? 0) !== 0;

// converter/job.rs `primary_video_stream`
// first non-attached-picture video stream, falling back to the first stream
export const primaryVideoStream = (
	streams: VideoStreamProbe[],
): VideoStreamProbe | null =>
	streams.find((stream) => !isAttachedPicture(stream)) ?? streams[0] ?? null;

// converter/job.rs `video_stream_indices`
// all mapped video streams except attached pictures, falling back to the first
export const videoStreamIndices = (streams: VideoStreamProbe[]): number[] => {
	const indices = streams
		.filter((stream) => !isAttachedPicture(stream))
		.map((stream) => stream.index);
	if (indices.length) return indices;
	return [streams[0]?.index ?? 0];
};
