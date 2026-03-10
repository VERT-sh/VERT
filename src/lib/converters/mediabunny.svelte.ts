import { VertFile } from "$lib/types";
import {
	BlobSource,
	BufferTarget,
	canEncodeAudio,
	Conversion,
	Input,
	MATROSKA,
	MkvOutputFormat,
	MovOutputFormat,
	MP4,
	Mp4OutputFormat,
	MPEG_TS,
	MpegTsOutputFormat,
	Output,
	QTFF,
	WEBM,
	WebMOutputFormat,
} from "mediabunny";
import { registerAc3Decoder, registerAc3Encoder } from "@mediabunny/ac3";
import { registerMp3Encoder } from "@mediabunny/mp3-encoder";
import { registerFlacEncoder } from "@mediabunny/flac-encoder";
import { Converter, FormatInfo, type WorkerStatus } from "./converter.svelte";
import { error, log } from "$lib/util/logger";
import { m } from "$lib/paraglide/messages";
import type {
	SettingDefinition,
	ConversionSettings,
} from "$lib/types/conversion-settings";
import { CONVERSION_BITRATES, SAMPLE_RATES } from "./ffmpeg.svelte";
import { ToastManager } from "$lib/util/toast.svelte";

// codec compatibility stuff, based on mediabunny's docs
// https://mediabunny.dev/guide/supported-formats-and-codecs#compatibility-table
const mp4VideoCodecs = ["avc", "hevc", "vp8", "vp9", "av1"] as const;
const mp4AudioCodecs = [
	"aac",
	"opus",
	"mp3",
	"vorbis",
	"flac",
	"ac3",
	"eac3",
	"pcm-s16",
	"pcm-s16be",
	"pcm-s24",
	"pcm-s24be",
	"pcm-s32",
	"pcm-s32be",
	"pcm-f32",
	"pcm-f64",
] as const;
const codecCompatibility = {
	video: {
		mp4: mp4VideoCodecs,
		m4v: mp4VideoCodecs,
		f4v: mp4VideoCodecs,
		"3gp": mp4VideoCodecs,
		"3g2": mp4VideoCodecs,
		mkv: mp4VideoCodecs,
		webm: ["vp8", "vp9", "av1"],
		mov: mp4VideoCodecs,
		ts: ["avc", "hevc"],
	},
	audio: {
		mp4: mp4AudioCodecs,
		m4v: mp4AudioCodecs,
		f4v: mp4AudioCodecs,
		"3gp": mp4AudioCodecs,
		"3g2": mp4AudioCodecs,
		m4a: mp4AudioCodecs,
		m4b: mp4AudioCodecs,
		m4p: mp4AudioCodecs,
		mkv: [
			"aac",
			"opus",
			"mp3",
			"vorbis",
			"flac",
			"ac3",
			"eac3",
			"pcm-u8",
			"pcm-s16",
			"pcm-s24",
			"pcm-s32",
			"pcm-f32",
			"pcm-f64",
		],
		webm: ["opus", "vorbis"],
		mov: [
			"aac",
			"opus",
			"mp3",
			"vorbis",
			"flac",
			"ac3",
			"eac3",
			"pcm-u8",
			"pcm-s8",
			"pcm-s16",
			"pcm-s16be",
			"pcm-s24",
			"pcm-s24be",
			"pcm-s32",
			"pcm-s32be",
			"pcm-f32",
			"pcm-f32be",
			"pcm-f64",
			"ulaw",
			"alaw",
		],
		ts: ["aac", "mp3", "ac3", "eac3"],
	},
} as const;

const getCompatibleCodecs = (
	type: keyof typeof codecCompatibility,
	format: string,
) => {
	const normalized = format.replace(/^\./, "").toLowerCase();
	const direct =
		codecCompatibility[type][
			normalized as keyof (typeof codecCompatibility)[typeof type]
		];
	if (direct) return [...direct];
	return [];
};

const buildVideoConfig = (
	settings: ConversionSettings,
): Record<string, unknown> => {
	const config: Record<string, unknown> = {};

	if (settings.videoCodec !== "auto") config.codec = settings.videoCodec;

	if (settings.videoBitrate !== "auto") {
		const bitrate =
			settings.videoBitrate === "custom"
				? settings.customVideoBitrate
				: settings.videoBitrate;
		config.bitrate = Number(bitrate);
	}

	if (settings.fps !== "auto") {
		const fps =
			settings.fps === "custom" ? settings.customFps : settings.fps;
		config.frameRate = Number(fps);
	}

	if (settings.resolution !== "auto") {
		const resolution =
			settings.resolution === "custom"
				? settings.customResolution
				: settings.resolution;
		const [width, height] = resolution.split("x").map(Number);
		config.width = width;
		config.height = height;
		config.fit = "contain"; // TODO: maybe allow changing this?
	}

	return config;
};

const buildAudioConfig = (
	settings: ConversionSettings,
): Record<string, unknown> => {
	const config: Record<string, unknown> = {};

	if (settings.audioCodec !== "auto") config.codec = settings.audioCodec;

	if (settings.audioBitrate !== "auto") {
		const bitrate =
			settings.audioBitrate === "custom"
				? settings.customAudioBitrate
				: settings.audioBitrate;
		config.bitrate = Number(bitrate);
	}

	if (settings.sampleRate !== "auto") {
		const sampleRate =
			settings.sampleRate === "custom"
				? settings.customSampleRate
				: settings.sampleRate;
		config.sampleRate = Number(sampleRate);
	}

	return config;
};

export class MediabunnyConverter extends Converter {
	public name = "mediabunny";
	public status: WorkerStatus = $state("ready");
	public reportsProgress: boolean = true;

	private activeConversions = new Map<string, Conversion>();

	private formats: string[] = [
		"mp4",
		"m4v",
		"mkv",
		"webm",
		"mov",
		"f4v",
		"3gp",
		"3g2",
		"mts",
		"ts",
	];

	public supportedFormats: FormatInfo[] = [
		...this.formats.map((f) => new FormatInfo(f, true, true, true, 2)),
	];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private log: (...msg: any[]) => void = () => {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private error: (...msg: any[]) => void = () => {};

	constructor() {
		super();

		this.log = (msg) => log(["converters", this.name], msg);
		this.error = (msg) => error(["converters", this.name], msg);

		// additional mediabunny coders
		// currently the official ones -- maybe add our own in the future
		this.initializeCodecs();
	}

	private async initializeCodecs(): Promise<void> {
		if (!(await canEncodeAudio("mp3"))) {
			registerMp3Encoder();
		}
		if (!(await canEncodeAudio("flac"))) {
			registerFlacEncoder();
		}
		registerAc3Decoder();
		registerAc3Encoder();
	}

	public async getAvailableSettings(
		input: VertFile,
	): Promise<SettingDefinition[]> {
		// TODO: maybe have a slider for conversion speed/quality like vertd

		const fps: SettingDefinition = {
			key: "fps",
			label: m["convert.settings.video.fps"](),
			type: "select",
			default: "auto",
			options: [
				{ value: "auto", label: m["convert.settings.common.auto"]() },
				{
					value: "custom",
					label: m["convert.settings.common.custom"](),
				},
				{ value: "24", label: "24" },
				{ value: "30", label: "30" },
				{ value: "60", label: "60" },
				{ value: "120", label: "120" },
				{ value: "144", label: "144" },
				{ value: "240", label: "240" },
			],
			hasCustomInput: true,
			customInputKey: "customFps",
			placeholder: m["convert.settings.video.fps_placeholder"](),
		};

		const resolution: SettingDefinition = {
			key: "resolution",
			label: m["convert.settings.video.resolution"](),
			type: "select",
			default: "auto",
			options: [
				{ value: "auto", label: m["convert.settings.common.auto"]() },
				{
					value: "custom",
					label: m["convert.settings.common.custom"](),
				},
				{ value: "426x240", label: "426x240" },
				{ value: "640x360", label: "640x360" },
				{ value: "854x480", label: "854x480" },
				{ value: "1280x720", label: "1280x720" },
				{ value: "1920x1080", label: "1920x1080" },
				{ value: "2560x1440", label: "2560x1440" },
				{ value: "3840x2160", label: "3840x2160" },
			],
			hasCustomInput: true,
			customInputKey: "customResolution",
			placeholder: m["convert.settings.video.resolution_placeholder"](),
		};

		// TODO: allow CRF for consistent quality?
		const videoBitrate: SettingDefinition = {
			key: "videoBitrate",
			label: m["convert.settings.video.video_bitrate"](),
			type: "select",
			default: "auto",
			options: [
				{ value: "auto", label: m["convert.settings.common.auto"]() },
				{
					value: "custom",
					label: m["convert.settings.common.custom"](),
				},
				{ value: "1000", label: "1000 kbps" },
				{ value: "2500", label: "2500 kbps" },
				{ value: "5000", label: "5000 kbps" },
				{ value: "8000", label: "8000 kbps" },
				{ value: "12000", label: "12000 kbps" },
				{ value: "18000", label: "18000 kbps" },
			],
			hasCustomInput: true,
			customInputKey: "customVideoBitrate",
			placeholder: m["convert.settings.video.bitrate_placeholder"](),
		};

		const toFormat = input.to;
		const supportedVideoCodecs = getCompatibleCodecs("video", toFormat);
		const videoCodec: SettingDefinition = {
			key: "videoCodec",
			label: m["convert.settings.video.video_codec"](),
			type: "select",
			default: "auto",
			// TODO: get supported from codecCompatibility based on output format
			options: [
				{ value: "auto", label: m["convert.settings.common.auto"]() },
				...supportedVideoCodecs.map((codec) => ({
					value: codec,
					label: codec,
				})),
			],
		};

		const supportedAudioCodecs = getCompatibleCodecs("audio", toFormat);
		const audioCodec: SettingDefinition = {
			key: "audioCodec",
			label: m["convert.settings.video.audio_codec"](),
			type: "select",
			default: "auto",
			options: [
				{ value: "auto", label: m["convert.settings.common.auto"]() },
				...supportedAudioCodecs.map((codec) => ({
					value: codec,
					label: codec,
				})),
			],
		};

		/*
		 *	audio settings
		 */
		const audioBitrate: SettingDefinition = {
			key: "audioBitrate",
			label: m["convert.settings.video.audio_bitrate"](),
			type: "select",
			default: "auto",
			options: CONVERSION_BITRATES.map((b) => ({
				value: b.toString(),
				label:
					b === "auto"
						? m["convert.settings.common.auto"]()
						: b === "custom"
							? m["convert.settings.common.custom"]()
							: `${b} kbps`,
			})),
			hasCustomInput: true,
			customInputKey: "customAudioBitrate",
			placeholder: m["convert.settings.audio.bitrate_placeholder"](),
		};

		const sampleRate: SettingDefinition = {
			key: "sampleRate",
			label: m["convert.settings.audio.sample_rate"](),
			type: "select",
			default: "auto",
			options: SAMPLE_RATES.map((r) => ({
				value: r.toString(),
				label:
					r === "auto"
						? m["convert.settings.common.auto"]()
						: r === "custom"
							? m["convert.settings.common.custom"]()
							: `${r} Hz`,
			})),
			hasCustomInput: true,
			customInputKey: "customSampleRate",
			placeholder: m["convert.settings.audio.sample_rate_placeholder"](),
		};

		/*
		 *	common
		 */
		const metadata: SettingDefinition = {
			key: "metadata",
			label: m["convert.settings.common.metadata"](),
			type: "boolean",
			default: true,
		};

		// trim/crop/rotate - also have another ui for this prob

		return [
			videoBitrate,
			resolution,
			videoCodec,
			audioCodec,
			fps,
			metadata,
			audioBitrate,
			sampleRate,
		];
	}

	public async getDefaultSettings(
		input: VertFile,
	): Promise<ConversionSettings> {
		const defaults: ConversionSettings = {};
		const settings = await this.getAvailableSettings(input);
		settings.forEach((setting) => {
			defaults[setting.key] = setting.default;
		});
		return defaults;
	}

	public async convert(
		file: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<VertFile> {
		const input = new Input({
			// TODO: add settings & special handling for certain formats & codecs
			formats: [MP4, QTFF, MATROSKA, WEBM, MPEG_TS],
			source: new BlobSource(file.file),
		});

		const output = new Output({
			format: this.format(to),
			target: new BufferTarget(),
		});

		const conversionSettings =
			Object.keys(settings).length > 0
				? settings // user-provided settings
				: await this.getDefaultSettings(file); // use defaults if not provided

		const videoConfig = buildVideoConfig(conversionSettings);
		const audioConfig = buildAudioConfig(conversionSettings);

		const conversion = await Conversion.init({
			input,
			output,
			video: videoConfig,
			audio: audioConfig,
			...(conversionSettings.metadata === "false" ? { tags: {} } : {}),
		});

		this.activeConversions.set(file.id, conversion);

		this.log(`videoConfig: ${JSON.stringify(videoConfig)}`);
		this.log(`audioConfig: ${JSON.stringify(audioConfig)}`);

		for (const discarded of conversion.discardedTracks) {
			ToastManager.add({
				type: "error",
				message: `Mediabunny discarded ${discarded.track.type} track ${discarded.track.id} (${discarded.track.codec}) for reason: ${discarded.reason}`,
				durations: {
					stay: 10000,
				},
			});
		}

		conversion.onProgress = (progress) => {
			file.progress = progress * 100;
		};

		await conversion.execute();
		this.activeConversions.delete(file.id);

		if (!output.target.buffer) {
			throw new Error("Mediabunny conversion failed: no output buffer");
		}

		const toFormat = to.startsWith(".") ? to.slice(1) : to;
		const originalName = file.file.name.split(".").slice(0, -1).join(".");
		const f = new File(
			[output.target.buffer],
			`${originalName}.${toFormat}`,
			{
				type: "application/octet-stream",
			},
		);

		return new VertFile(f, toFormat);
	}

	private format(ext: string) {
		switch (ext) {
			// i'm seeing this "ISMV" format from microsoft, so maybe?
			case ".mp4":
			case ".m4v":
			case ".f4v":
			case ".3gp":
			case ".3g2":
				return new Mp4OutputFormat();
			case ".mkv":
				return new MkvOutputFormat();
			case ".webm":
				return new WebMOutputFormat();
			case ".mov":
				return new MovOutputFormat();
			case ".ts":
				return new MpegTsOutputFormat();
			default:
				throw new Error(`Unsupported format: ${ext}`);
		}
	}

	public async cancel(input: VertFile): Promise<void> {
		const conversion = this.activeConversions.get(input.id);
		if (!conversion) {
			this.error(
				`no active conversion found for file ${input.name}`,
			);
			return;
		}

		this.log(`cancelling conversion for file ${input.name}`);

		conversion.cancel();
		this.activeConversions.delete(input.id);
	}
}
