export interface FormatCodecSupport {
	video: string[];
	audio: string[];
}

// converter/codecs.rs `codec_support_for`
// prettier-ignore
export const FORMAT_CODECS: Record<string, FormatCodecSupport> = {
	mp4: {
		video: ["h264", "hevc", "mpeg4", "vp9", "mpeg2video", "mpeg1video"],
		audio: ["aac", "mp3", "ac3", "eac3", "alac", "flac", "libopus"],
	},
	webm: {
		video: ["vp9", "vp8"],
		audio: ["libopus", "libvorbis"],
	},
	avi: {
		video: ["mpeg4", "msmpeg4v3", "msmpeg4v2", "h264", "mjpeg", "dvvideo", "huffyuv"],
		audio: ["mp3", "ac3", "pcm_s16le", "pcm_s24le"],
	},
	mkv: {
		video: ["h264", "hevc", "vp9", "vp8", "mpeg2video", "mpeg4", "prores", "dnxhd", "ffv1", "huffyuv", "mjpeg", "mpeg1video"],
		audio: ["aac", "mp3", "ac3", "eac3", "libopus", "libvorbis", "flac", "alac", "wavpack", "tta", "pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le", "pcm_s16be", "pcm_s24be", "pcm_s32be", "pcm_mulaw", "pcm_alaw", "pcm_u8"],
	},
	mov: {
		video: ["h264", "hevc", "prores", "dnxhd", "mpeg4", "mjpeg", "ffv1"],
		audio: ["aac", "alac", "mp3", "flac", "pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le", "pcm_s16be", "pcm_s24be", "pcm_mulaw", "pcm_alaw", "pcm_u8"],
	},
	m2ts: {
		video: ["h264", "mpeg2video"],
		audio: ["ac3", "eac3", "pcm_s16le"],
	},
	mts: {
		video: ["h264", "mpeg2video", "hevc"],
		audio: ["ac3", "aac", "mp2", "mp3", "eac3"],
	},
	ts: {
		video: ["h264", "hevc", "mpeg2video", "mpeg1video"],
		audio: ["aac", "ac3", "mp2", "mp3", "eac3"],
	},
	mpeg: {
		video: ["mpeg2video", "mpeg1video"],
		audio: ["ac3", "mp2", "mp3"],
	},
	mpg: {
		video: ["mpeg2video", "mpeg1video"],
		audio: ["ac3", "mp2", "mp3"],
	},
	flv: {
		video: ["h264", "flv1", "h263"],
		audio: ["aac", "mp3", "nellymoser", "speex", "adpcm_swf"],
	},
	f4v: {
		video: ["h264"],
		audio: ["aac", "mp3"],
	},
	vob: {
		video: ["mpeg2video", "mpeg1video"],
		audio: ["ac3", "mp2", "pcm_s16le"],
	},
	m4v: {
		video: ["h264", "mpeg4"],
		audio: ["aac", "ac3", "alac", "flac"],
	},
	"3gp": {
		video: ["h264", "mpeg4", "h263"],
		audio: ["aac"],
	},
	"3g2": {
		video: ["h264", "mpeg4", "h263"],
		audio: ["aac"],
	},
	mxf: {
		video: ["prores", "dnxhd", "h264", "mpeg2video", "mjpeg"],
		audio: ["pcm_s24le", "pcm_s16le", "pcm_s32le"],
	},
	gxf: {
		video: ["mpeg2video", "dvvideo", "mjpeg", "mpeg1video"],
		audio: ["pcm_s16le", "pcm_s24le", "ac3"],
	},
	ogv: {
		video: ["theora", "vp8"],
		audio: ["libvorbis", "libopus", "flac", "speex"],
	},
	ogx: {
		video: ["theora", "vp8"],
		audio: ["libvorbis", "libopus", "flac", "speex"],
	},
	swf: {
		video: ["flv1", "flashsv", "mjpeg"],
		audio: ["mp3"],
	},
	amv: {
		video: ["amv"],
		audio: ["adpcm_ima_amv"],
	},
	asf: {
		video: ["wmv2", "wmv1", "msmpeg4v3"],
		audio: ["wmav2", "wmav1", "mp3"],
	},
	wmv: {
		video: ["wmv2", "wmv1"],
		audio: ["wmav2"],
	},
	nut: {
		video: ["h264", "mpeg4", "vp9", "vp8", "ffv1", "mjpeg", "huffyuv", "h263", "prores", "mpeg2video", "h261", "svq1", "ljpeg", "snow"],
		audio: ["aac", "mp3", "ac3", "eac3", "libopus", "libvorbis", "flac", "alac", "wavpack", "pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le", "pcm_s16be", "pcm_s24be", "pcm_s32be", "pcm_mulaw", "pcm_alaw", "pcm_u8"],
	},
	h264: {
		video: ["h264"],
		audio: [],
	},
	divx: {
		video: ["mpeg4", "h264", "hevc"],
		audio: ["mp3", "ac3", "aac", "pcm_s16le"],
	},
	gif: {
		video: ["gif"],
		audio: [],
	},
	apng: {
		video: ["apng"],
		audio: [],
	},
	webp: {
		video: ["webp"],
		audio: [],
	},
};

const normalize = (format: string) => format.replace(/^\./, "").toLowerCase();

// converter/codecs.rs `codec_support_for`
export const codecSupportFor = (format: string): FormatCodecSupport | null =>
	FORMAT_CODECS[normalize(format)] ?? null;

// converter/codecs.rs `canonical_codec`
export const canonicalCodec = (codec: string): string => {
	const value = codec.toLowerCase();
	switch (value) {
		case "libx264":
		case "libx264rgb":
		case "libopenh264":
			return "h264";
		case "libx265":
		case "libkvazaar":
			return "hevc";
		case "libxvid":
			return "mpeg4";
		case "libvpx":
			return "vp8";
		case "libvpx-vp9":
			return "vp9";
		case "libwebp":
		case "libwebp_anim":
			return "webp";
		case "prores_ks":
		case "prores_aw":
			return "prores";
		case "libmp3lame":
		case "libshine":
			return "mp3";
		case "libopus":
			return "opus";
		case "libvorbis":
			return "vorbis";
		case "libspeex":
			return "speex";
		default:
			return value.startsWith("lib") ? value.slice(3) : value;
	}
};

// converter/codecs.rs `support_video_codec` / `support_audio_codec`
export const supportsCodec = (codecs: string[], encoder: string): boolean =>
	codecs.some((codec) => canonicalCodec(codec) === canonicalCodec(encoder));

// converter/format.rs `preferred_video_encoder` (codec pick)
export const preferredVideoCodec = (format: string): string | null =>
	codecSupportFor(format)?.video[0] ?? null;

// converter/format.rs `preferred_audio_encoder`
export const preferredAudioEncoder = (format: string): string | null => {
	const codec = codecSupportFor(format)?.audio[0];
	return codec ? encoderFor(codec) : null;
};

// converter/format.rs `default_encoder_for_codec`
export const encoderFor = (codec: string): string => {
	switch (codec.toLowerCase()) {
		case "h264":
			return "libx264";
		case "hevc":
			return "libx265";
		case "vp8":
			return "libvpx";
		case "vp9":
			return "libvpx-vp9";
		case "theora":
			return "libtheora";
		case "prores":
			return "prores_ks";
		case "webp":
			return "libwebp";
		case "flv1":
			return "flv";
		case "mp3":
			return "libmp3lame";
		case "vorbis":
			return "libvorbis";
		case "opus":
			return "libopus";
		case "speex":
			return "libspeex";
		default:
			return codec;
	}
};

// converter/speed.rs `ConversionSpeed::to_args` — encoder preset table
// (0 = fastest, 5 = slowest)
const encoderPreset = (
	encoder: string,
	level: number,
): [string, string] | null => {
	switch (encoder) {
		case "libx264":
		case "libx265":
			return [
				"-preset",
				["ultrafast", "fast", "medium", "slow", "slower", "veryslow"][
					level
				],
			];
		case "libvpx":
		case "libvpx-vp9":
			return ["-cpu-used", ["8", "6", "4", "2", "1", "0"][level]];
		default:
			return null;
	}
};

// converter/speed.rs `ConversionSpeed::to_args`
export const speedArgs = (
	level: number,
	encoder: string,
	toFormat: string,
	bitrate: number,
): string[] => {
	if (encoder === "copy") return [];

	const args: string[] = [];
	const preset = encoderPreset(encoder, level);
	if (preset) args.push(...preset);

	if (normalize(toFormat) === "webp" && encoder === "libwebp")
		args.push("-lossless", level >= 3 ? "1" : "0");

	if (normalize(toFormat) !== "gif") args.push("-b:v", String(bitrate));

	return args;
};

// converter/job.rs `Job::bitrate`
// resolution-based default bitrate, capped by probe
export const targetBitrate = (
	width: number,
	height: number,
	probedBitrate: number | null,
): number => {
	const fallback = (() => {
		if (width >= 3840 || height >= 2160) return 30_000_000;
		if (width >= 2560 || height >= 1440) return 14_000_000;
		if (width >= 1920 || height >= 1080) return 7_000_000;
		if (width >= 1280 || height >= 720) return 4_000_000;
		return 1_500_000;
	})();

	if (probedBitrate && probedBitrate > 0)
		return Math.min(probedBitrate, fallback);
	return fallback;
};

// constraints stuff (port of vertd's `converter/constraint.rs`)

export type Constraint<T> =
	{ kind: "cap"; value: T } | { kind: "exact"; value: T };

export interface FormatConstraint {
	videoBitrate?: Constraint<number>;
	resolution?: Constraint<[number, number]>;
	fps?: Constraint<number>;
	audioBitrate?: Constraint<number>;
	audioSampleRate?: Constraint<number>;
	audioChannels?: Constraint<number>;
	dynamicAudioBlockSize?: boolean;
}

const cap = <T>(value: T): Constraint<T> => ({ kind: "cap", value });
const exact = <T>(value: T): Constraint<T> => ({ kind: "exact", value });

// converter/constraint.rs `FormatConstraint::for_format`
// prettier-ignore
export const constraintFor = (format: string): FormatConstraint | null => {
	switch (normalize(format)) {
		case "amv":
			return {
				videoBitrate: cap(384_000),
				resolution: cap([320, 240]),
				fps: exact(30),
				audioBitrate: cap(32_000),
				audioSampleRate: exact(22_050),
				audioChannels: exact(1),
				dynamicAudioBlockSize: true,
			};
		case "3gp":
		case "3g2":
			return {
				videoBitrate: cap(512_000),
				resolution: cap([320, 240]),
				fps: exact(30),
				audioBitrate: cap(16_000),
				audioSampleRate: exact(22_050),
				audioChannels: exact(2),
			};
		case "swf":
			return {
				videoBitrate: cap(800_000),
				resolution: cap([640, 480]),
				fps: exact(30),
				audioBitrate: cap(128_000),
				audioSampleRate: exact(22_050),
			};
		case "asf":
		case "wmv":
			return {
				videoBitrate: cap(1_500_000),
				resolution: cap([640, 480]),
				fps: exact(30),
				audioBitrate: cap(128_000),
				audioSampleRate: exact(44_100),
				audioChannels: exact(2),
			};
		case "mpeg":
		case "mpg":
		case "vob":
			return {
				videoBitrate: cap(2_000_000),
				resolution: cap([720, 576]),
				fps: exact(30),
				audioBitrate: cap(192_000),
				audioSampleRate: exact(48_000),
			};
		case "mxf":
			return {
				audioSampleRate: exact(48_000),
			};
		case "gxf":
			return {
				resolution: exact([720, 576]),
				audioSampleRate: exact(48_000),
				audioChannels: exact(1),
			};
		default:
			return null;
	}
};

export interface AppliedConstraint {
	bitrate: number;
	fps: number;
	requiresVideoEncoding: boolean;
	requiresAudioEncoding: boolean;
	args: string[];
	extraArgs: string[];
}

// converter/constraint.rs `FormatConstraint::apply`
export const applyConstraint = (
	constraint: FormatConstraint | null,
	bitrate: number,
	fps: number,
	resolution: [number, number],
	autoVideoBitrate: boolean,
	autoFps: boolean,
	autoResolution: boolean,
	autoAudioBitrate: boolean,
	autoSampleRate: boolean,
): AppliedConstraint => {
	const applied: AppliedConstraint = {
		bitrate,
		fps,
		requiresVideoEncoding: false,
		requiresAudioEncoding: false,
		args: [],
		extraArgs: [],
	};
	if (!constraint) return applied;

	if (autoVideoBitrate && constraint.videoBitrate) {
		const { kind, value } = constraint.videoBitrate;
		if (
			(kind === "cap" && bitrate > value) ||
			(kind === "exact" && bitrate !== value)
		) {
			applied.bitrate = value;
			applied.requiresVideoEncoding = true;
		}
	}

	if (autoFps && constraint.fps) {
		const { kind, value } = constraint.fps;
		if ((kind === "cap" && fps > value) || kind === "exact") {
			applied.fps = value;
			applied.args.push("-r", String(value));
			applied.requiresVideoEncoding = true;
		}
	}

	if (autoResolution && constraint.resolution) {
		const { kind, value } = constraint.resolution;
		const [w, h] = value;
		if (kind === "cap") {
			if (!(resolution[0] <= w && resolution[1] <= h)) {
				applied.args.push(
					"-vf",
					`scale='min(${w},iw)':'min(${h},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
				);
				applied.requiresVideoEncoding = true;
			}
		} else if (!(resolution[0] === w && resolution[1] === h)) {
			applied.args.push("-vf", `scale=${w}:${h}`);
			applied.requiresVideoEncoding = true;
		}
	}

	if (autoAudioBitrate && constraint.audioBitrate)
		applied.args.push("-b:a", String(constraint.audioBitrate.value));

	if (autoSampleRate && constraint.audioSampleRate)
		applied.args.push("-ar", String(constraint.audioSampleRate.value));

	if (constraint.audioChannels) {
		applied.args.push("-ac", String(constraint.audioChannels.value));
		applied.requiresAudioEncoding = true;
	}

	if (constraint.dynamicAudioBlockSize) {
		const effectiveFps = Math.max(1, applied.fps);
		const effectiveSampleRate = constraint.audioSampleRate?.value ?? 22_050;
		const blockSize = Math.max(
			1,
			Math.floor(
				(effectiveSampleRate + Math.floor(effectiveFps / 2)) /
					effectiveFps,
			),
		);
		applied.args.push("-block_size", String(blockSize));
		applied.requiresAudioEncoding = true;
	}

	return applied;
};
