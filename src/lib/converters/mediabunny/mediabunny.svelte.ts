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
	StreamTarget,
	WEBM,
	WebMOutputFormat,
} from "mediabunny";
import { registerAacEncoder } from "@mediabunny/aac-encoder";
import { registerAc3Decoder, registerAc3Encoder } from "@mediabunny/ac3";
import { registerDtsDecoder, registerDtsEncoder } from "@mediabunny/dts";
import { registerMp3Encoder } from "@mediabunny/mp3-encoder";
import { registerFlacEncoder } from "@mediabunny/flac-encoder";
import { registerProresDecoder } from "@mediabunny/prores";
import { Converter, FormatInfo, type WorkerStatus } from "../converter.svelte";
import { error, log } from "$lib/util/logger";
import { m } from "$lib/paraglide/messages";
import type {
	SettingDefinition,
	SettingCategories,
	ConversionSettings,
} from "$lib/types/conversion-settings";
import { isMobile } from "$lib/store/index.svelte";
import { ToastManager } from "$lib/util/toast.svelte";
import { browser } from "$app/environment";
import { get } from "svelte/store";
import { Settings } from "$lib/sections/settings/index.svelte";

// codec compatibility stuff, based on mediabunny's docs
// https://mediabunny.dev/guide/supported-formats-and-codecs#compatibility-table
// prettier-ignore
const mp4VideoCodecs = ["avc","hevc","vp8","vp9","av1","prores"] as const;
// prettier-ignore
const mp4AudioCodecs = [ "aac", "opus", "mp3", "vorbis", "flac", "ac3", "eac3", "dts", "pcm-s16", "pcm-s16be", "pcm-s24", "pcm-s24be", "pcm-s32", "pcm-s32be", "pcm-f32", "pcm-f64"] as const;
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
			"dts",
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
			"dts",
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
		ts: ["aac", "mp3", "ac3", "eac3", "dts"],
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

	if (settings.videoBitrate && settings.videoBitrate !== "auto") {
		config.bitrate = Number(settings.videoBitrate);
	}

	if (settings.fps && settings.fps !== "auto") {
		config.frameRate = Number(settings.fps);
	}

	if (settings.resolution && settings.resolution !== "auto") {
		const [width, height] = settings.resolution.split("x").map(Number);
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

	if (settings.audioBitrate && settings.audioBitrate !== "auto") {
		config.bitrate = Number(settings.audioBitrate);
	}

	if (settings.sampleRate && settings.sampleRate !== "auto") {
		config.sampleRate = Number(settings.sampleRate);
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
		"m2ts",
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

		if (!browser) return;

		this.log = (msg) => log(["converters", this.name], msg);
		this.error = (msg) => error(["converters", this.name], msg);

		// additional mediabunny coders
		// currently the official ones -- maybe add our own in the future
		void this.initializeCodecs()
			.then(() => this.checkStatus())
			.catch((err) => {
				this.error(`Failed to initialize Mediabunny codecs: ${err}`);
				this.status = "error";
			});
	}

	private async checkStatus() {
		const mediabunnyInitialized = await canEncodeAudio("pcm-s16");

		const webCodecsVideoDecode = "VideoDecoder" in globalThis;
		const webCodecsVideoEncode = "VideoEncoder" in globalThis;
		const webCodecsAudioDecode = "AudioDecoder" in globalThis;
		const webCodecsAudioEncode = "AudioEncoder" in globalThis;

		this.log(
			`Supported WebCodecs APIs: VideoDecoder: ${webCodecsVideoDecode}, VideoEncoder: ${webCodecsVideoEncode}, AudioDecoder: ${webCodecsAudioDecode}, AudioEncoder: ${webCodecsAudioEncode}`,
		);

		if (!mediabunnyInitialized) {
			this.error("Mediabunny failed to initialize");
			ToastManager.add({
				type: "error",
				message: m["workers.errors.mediabunny.init"](),
				durations: {
					stay: 10000,
				},
			});
			this.status = "error";
		} else if (
			!webCodecsVideoDecode ||
			!webCodecsVideoEncode ||
			!webCodecsAudioDecode ||
			!webCodecsAudioEncode
		) {
			this.error("WebCodecs API support incomplete");
			ToastManager.add({
				type: "error",
				message: m["workers.errors.mediabunny.webcodecs"](),
				durations: {
					stay: 10000,
				},
			});
			this.status = "partially-ready";
		} else {
			this.status = "ready";
		}
	}

	private async initializeCodecs(): Promise<void> {
		if (!(await canEncodeAudio("mp3"))) {
			registerMp3Encoder();
		}
		if (!(await canEncodeAudio("aac"))) {
			registerAacEncoder();
		}
		if (!(await canEncodeAudio("flac"))) {
			registerFlacEncoder();
		}
		registerAc3Decoder();
		registerAc3Encoder();
		registerDtsDecoder();
		registerDtsEncoder();
		registerProresDecoder();
	}

	public async getAvailableSettings(
		input: VertFile,
	): Promise<SettingCategories> {
		// TODO: maybe have a slider for conversion speed/quality like vertd

		const fps: SettingDefinition = {
			key: "fps",
			label: m["convert.settings.video.fps.label"](),
			type: "text",
			default: "",
			placeholder: m["convert.settings.video.fps.placeholder"](),
		};

		const resolution: SettingDefinition = {
			key: "resolution",
			label: m["convert.settings.video.resolution.label"](),
			type: "text",
			default: "",
			placeholder: m["convert.settings.video.resolution.placeholder"](),
		};

		// TODO: allow CRF for consistent quality?
		const videoBitrate: SettingDefinition = {
			key: "videoBitrate",
			label: m["convert.settings.video.bitrate.video"](),
			type: "text",
			default: "",
			placeholder:
				m["convert.settings.video.bitrate.video_placeholder"](),
		};

		const toFormat = input.to;
		const supportedVideoCodecs = getCompatibleCodecs("video", toFormat);
		const videoCodec: SettingDefinition = {
			key: "videoCodec",
			label: m["convert.settings.video.codec.video"](),
			type: "select",
			default: "auto",
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
			label: m["convert.settings.video.codec.audio"](),
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
			label: m["convert.settings.video.bitrate.audio"](),
			type: "text",
			default: "",
			placeholder:
				m["convert.settings.video.bitrate.audio_placeholder"](),
		};

		const sampleRate: SettingDefinition = {
			key: "sampleRate",
			label: m["convert.settings.audio.sample_rate.label"](),
			type: "text",
			default: "",
			placeholder: m["convert.settings.audio.sample_rate.placeholder"](),
		};

		/*
		 *	common
		 */
		const metadata: SettingDefinition = {
			key: "metadata",
			label: m["convert.settings.common.metadata"](),
			type: "boolean",
			default: Settings.instance.settings.metadata,
		};

		// trim/crop/rotate - also have another ui for this prob

		return {
			Video: [videoCodec, videoBitrate, fps, resolution],
			Audio: [audioCodec, audioBitrate, sampleRate],
			General: [metadata],
		};
	}

	public async getDefaultSettings(
		input: VertFile,
	): Promise<ConversionSettings> {
		const defaults: ConversionSettings = {};
		const categories = await this.getAvailableSettings(input);
		Object.values(categories)
			.flat()
			.forEach((setting) => {
				defaults[setting.key] = setting.default;
			});
		return defaults;
	}

	public async convert(
		file: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<VertFile> {
		this.trackConversion(file);
		const toFormat = to.startsWith(".") ? to.slice(1) : to;
		const originalName = file.file.name.split(".").slice(0, -1).join(".");
		const outputFilename = `${originalName}.${toFormat}`;

		let streamTargetContext: Awaited<
			ReturnType<typeof this.createStreamingTarget>
		> = null;
		let input: Input | undefined;
		let output: Output | undefined;
		let slowConversionTimer: ReturnType<typeof setTimeout> | undefined;
		let retained = false;
		try {
			input = new Input({
				formats: [MP4, QTFF, MATROSKA, WEBM, MPEG_TS],
				source: new BlobSource(file.file),
			});
			streamTargetContext =
				await this.createStreamingTarget(outputFilename);
			if (streamTargetContext) {
				this.log(`using OPFS stream target for ${file.name}`);
			}

			const target = streamTargetContext?.target ?? new BufferTarget();

			output = new Output({
				format: this.format(to),
				target,
			});

			const conversionSettings =
				Object.keys(settings).length > 4
					? settings
					: Object.assign(
							settings,
							await this.getDefaultSettings(file),
						); // use defaults if not provided

			const videoConfig = buildVideoConfig(conversionSettings);
			const audioConfig = buildAudioConfig(conversionSettings);

			const conversion = await Conversion.init({
				input,
				output,
				video: videoConfig,
				audio: audioConfig,
				...(!conversionSettings.metadata
					? { tags: {} }
					: {}),
			});

			this.activeConversions.set(file.id, conversion);

			const mobile = get(isMobile);
			const deviceMemory = (
				navigator as Navigator & { deviceMemory?: number }
			).deviceMemory;
			const hardwareConcurrency = navigator.hardwareConcurrency || 3; // if we can't detect it, just fall back to something that will definitely warn
			const likelySlowDevice =
				(mobile && hardwareConcurrency <= 4) ||
				hardwareConcurrency <= 4 ||
				(deviceMemory !== undefined && deviceMemory <= 4);
			if (likelySlowDevice) void file.slowConversionOffer("device");
			this.log(`hardwareConcurrency: ${hardwareConcurrency}`);
			this.log(`deviceMemory: ${deviceMemory}`);
			this.log(`mobile: ${mobile}`);

			slowConversionTimer = setTimeout(() => {
				void file.slowConversionOffer("timeout");
			}, 60 * 1000);

			this.log(`videoConfig: ${JSON.stringify(videoConfig)}`);
			this.log(`audioConfig: ${JSON.stringify(audioConfig)}`);

			// log any discarded tracks & its reasons
			const discardedTracks = conversion.discardedTracks;
			if (discardedTracks.length > 0) {
				const discardedTrackCount = discardedTracks.length;
				const discardedTrackList = discardedTracks.map(
					(discarded, index) =>
						`${index + 1}. ${discarded.track.type} (${discarded.track.getCodec()}) - ${discarded.reason}`,
				);

				const isValid = conversion.isValid;
				const logMethod = isValid ? this.error : this.log;
				logMethod(
					`${discardedTrackCount} discarded track(s) for ${file.name}:\n${discardedTrackList.join("\n")}`,
				);
				ToastManager.add({
					type: isValid ? "warning" : "error", // warning if output created, error if nothing / conversion was completely invalid
					message: m["workers.errors.mediabunny.discarded"]({
						count: discardedTrackCount,
						file: file.name,
					}),
					durations: {
						stay: 10000,
					},
				});

				if (!isValid) {
					throw new Error(
						`Mediabunny cannot produce an output for ${file.name} due to unsupported tracks/codecs.`,
					);
				}
			}

			conversion.onProgress = (progress) => {
				file.progress = progress * 100;
			};

			await conversion.execute();

			if (streamTargetContext) {
				const streamedFile = await streamTargetContext.getFile();
				const result = new VertFile(streamedFile, toFormat);
				result.setPostDownload(streamTargetContext.cleanup);
				retained = true;
				return result;
			}

			if (!(target instanceof BufferTarget) || !target.buffer) {
				throw new Error(
					"Mediabunny conversion failed: no output buffer",
				);
			}

			const f = new File([target.buffer], `${originalName}.${toFormat}`, {
				type: "application/octet-stream",
			});

			return new VertFile(f, toFormat);
		} finally {
			this.clearTrackedConversion(file);
			if (slowConversionTimer) clearTimeout(slowConversionTimer);
			this.activeConversions.delete(file.id);
			try {
				if (output && output.state !== "finalized")
					await output.cancel();
			} catch (err) {
				this.error(`Failed to cancel Mediabunny output: ${err}`);
			}
			try {
				input?.dispose();
			} catch (err) {
				this.error(`Failed to dispose Mediabunny input: ${err}`);
			}
			if (!retained && streamTargetContext) {
				try {
					await streamTargetContext.cleanup();
				} catch (err) {
					this.error(`Failed to clean up OPFS output: ${err}`);
				}
			}
		}
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
			case ".mts":
			case ".m2ts":
			case ".ts":
				return new MpegTsOutputFormat();
			default:
				throw new Error(`Unsupported format: ${ext}`);
		}
	}

	public async cancel(input: VertFile): Promise<void> {
		const conversion = this.activeConversions.get(input.id);
		if (!conversion) {
			this.error(`no active conversion found for file ${input.name}`);
			return;
		}

		this.log(`cancelling conversion for file ${input.name}`);

		await conversion.cancel();
	}

	private async createStreamingTarget(filename: string): Promise<{
		target: StreamTarget;
		getFile: () => Promise<File>;
		cleanup: () => Promise<void>;
	} | null> {
		let cleanup: (() => Promise<void>) | undefined;
		try {
			const storage = navigator.storage as StorageManager & {
				getDirectory?: () => Promise<FileSystemDirectoryHandle>;
			};
			if (!storage.getDirectory) return null;

			const root = await storage.getDirectory();
			const tempDir = await root.getDirectoryHandle("vert-temp", {
				create: true,
			});
			const tempName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;
			const fileHandle = await tempDir.getFileHandle(tempName, {
				create: true,
			});

			// eslint-disable-next-line prefer-const
			let fileStream: FileSystemWritableFileStream | undefined;
			let closed = false;
			cleanup = async () => {
				try {
					if (fileStream && !closed) {
						await fileStream.abort();
						closed = true;
					}
					await tempDir.removeEntry(tempName);
				} catch (err) {
					if (
						err instanceof DOMException &&
						err.name === "NotFoundError"
					)
						return;
					this.error(
						`Failed to remove OPFS entry ${tempName}: ${err}`,
					);
					throw err;
				}
			};
			fileStream = await fileHandle.createWritable();
			const writable = new WritableStream({
				write: (chunk) => fileStream!.write(chunk),
				close: async () => {
					await fileStream!.close();
					closed = true;
				},
				abort: async (reason) => {
					await fileStream!.abort(reason);
					closed = true;
				},
			});

			return {
				target: new StreamTarget(writable, {
					chunked: true,
					chunkSize: 32 * 1024 * 1024,
				}),
				getFile: () => fileHandle.getFile(),
				cleanup,
			};
		} catch (err) {
			if (cleanup) await cleanup();
			this.error(
				`failed to initialize OPFS stream target, falling back to BufferTarget: ${err}`,
			);
			return null;
		}
	}
}
