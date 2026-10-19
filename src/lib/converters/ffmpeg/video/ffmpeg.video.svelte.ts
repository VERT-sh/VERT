import type { ConversionSpeed } from "#lib/converters/vertd/vertd.svelte";
import { m } from "#lib/paraglide/messages";
import { Settings } from "#lib/sections/settings/index.svelte";
import { VertFile } from "#lib/types";
import type {
	ConversionSettings,
	SettingCategories,
	SettingDefinition,
} from "#lib/types/conversion-settings";
import { browser } from "$app/env";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { codecOptions, filterCommonCodecs } from "../../codec-labels";
import { FormatInfo, formatDuration } from "../../converter.svelte";
import { applyPriorities } from "../../priority";
import { videoFormats } from "../../vertd/vertd.svelte";
import { BaseFFmpegConverter } from "../ffmpeg.base.svelte";
import { animatedImageFormats } from "../ffmpeg.codecs";
import {
	getDecodableAudioCodecs,
	isSpatialAudioStream,
	pickUsableAudioStreams,
} from "../ffmpeg.decoders";
import { buildImageSequenceCommand } from "./ffmpeg.animated";
import {
	applyConstraint,
	codecSupportFor,
	constraintFor,
	encoderFor,
	preferredAudioEncoder,
	preferredVideoCodec,
	speedArgs,
	supportsCodec,
	targetBitrate,
} from "./ffmpeg.video.codecs";
import {
	parseFps,
	primaryVideoStream,
	probeAudioStreams,
	probeVideo,
	videoStreamIndices,
} from "./ffmpeg.video.probe";

const normalize = (format: string) => format.replace(/^\./, "").toLowerCase();

// format.rs `ConverterFormat::supports_single_video_stream`
// containers that can only carry a single video stream
const singleVideoStreamFormats = ["gif", "amv", "swf", "h264", "webp", "apng"];

// format.rs (inside) `to_args`
// formats that can't be encoded in to
const cantEncode = ["rm", "rmvb"];

// format.rs `ConverterFormat::input_format_args`
// input args for specific source formats
const inputFormatArgs = (format: string): string[] =>
	["mts", "ts", "flv", "nut"].includes(format) ? ["-fflags", "+genpts"] : [];

// format.rs `ConverterFormat::output_format_args`
// output args for specific target formats
const outputFormatArgs = (format: string): string[] => {
	switch (format) {
		case "ogx":
			return ["-f", "ogg"];
		case "divx":
			return ["-f", "avi"];
		case "mxf":
			return ["-timecode", "00:00:00:00", "-g", "128"];
		default:
			return [];
	}
};

const SPEED_ORDER: ConversionSpeed[] = [
	"verySlow",
	"slower",
	"slow",
	"medium",
	"fast",
	"ultraFast",
];

const speedRangeToLevel = (value: number) => 5 - value;
const speedToRange = (speed: ConversionSpeed) =>
	Math.max(0, SPEED_ORDER.indexOf(speed));

const isAuto = (value: unknown): boolean =>
	value === undefined || value === null || value === "" || value === "auto";

const customValue = (value: unknown): string | null =>
	isAuto(value) ? null : String(value);

export class FFmpegVideoConverter extends BaseFFmpegConverter {
	public name = "ffmpeg-video";
	public ready = $state(false);

	public supportedFormats = applyPriorities(
		"ffmpeg-video",
		videoFormats.map(
			(f) => new FormatInfo(f, true, !cantEncode.includes(f), true),
		),
	);

	constructor() {
		super();
		if (!browser) return;
		this.log(`created converter`);
	}

	public async getAvailableSettings(
		input: VertFile,
	): Promise<SettingCategories> {
		const toFormat = normalize(input.to);
		const support = codecSupportFor(toFormat);

		const speedOptions = [
			m["convert.settings.video.local_speed.very_slow"](),
			m["convert.settings.video.local_speed.slower"](),
			m["convert.settings.video.local_speed.slow"](),
			m["convert.settings.video.local_speed.medium"](),
			m["convert.settings.video.local_speed.fast"](),
			m["convert.settings.video.local_speed.ultra_fast"](),
		];

		const speed: SettingDefinition = {
			key: "ffmpegVideoSpeed",
			label: m["convert.settings.video.local_speed.title"](),
			description: m["convert.settings.video.local_speed.description"](),
			type: "range",
			min: 0,
			max: speedOptions.length - 1,
			step: 1,
			default: speedToRange(Settings.instance.settings.ffmpegVideoSpeed),
			options: speedOptions.map((label, value) => ({ value, label })),
			forceFullWidth: true,
		};

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

		const metadata: SettingDefinition = {
			key: "metadata",
			label: m["convert.settings.common.metadata"](),
			type: "boolean",
			default: Settings.instance.settings.metadata,
		};

		if (animatedImageFormats.includes(toFormat))
			return { Video: [speed, fps, resolution], General: [metadata] };

		const videoCodec: SettingDefinition = {
			key: "videoCodec",
			label: m["convert.settings.video.codec.video"](),
			type: "select",
			default: "auto",
			options: [
				{ value: "auto", label: m["convert.settings.common.auto"]() },
				...codecOptions(
					filterCommonCodecs(
						(support?.video ?? []).map(encoderFor),
						"video",
					),
				),
			],
		};

		const videoBitrate: SettingDefinition = {
			key: "videoBitrate",
			label: m["convert.settings.video.bitrate.video"](),
			type: "text",
			default: "",
			placeholder:
				m["convert.settings.video.bitrate.video_placeholder"](),
		};

		const audioCodec: SettingDefinition = {
			key: "audioCodec",
			label: m["convert.settings.video.codec.audio"](),
			type: "select",
			default: "auto",
			options: [
				{ value: "auto", label: m["convert.settings.common.auto"]() },
				...codecOptions(
					filterCommonCodecs(
						(support?.audio ?? []).map(encoderFor),
						"audio",
					),
				),
			],
		};

		const audioBitrate: SettingDefinition = {
			key: "audioBitrate",
			label: m["convert.settings.video.bitrate.audio"](),
			type: "text",
			default: "",
			placeholder:
				m["convert.settings.video.bitrate.audio_placeholder"](),
		};

		const audioChannels: SettingDefinition = {
			key: "audioChannels",
			label: m["convert.settings.video.audioChannels.label"](),
			type: "text",
			default: "",
			placeholder:
				m["convert.settings.video.audioChannels.placeholder"](),
		};

		const sampleRate: SettingDefinition = {
			key: "sampleRate",
			label: m["convert.settings.audio.sample_rate.label"](),
			type: "text",
			default: "",
			placeholder: m["convert.settings.audio.sample_rate.placeholder"](),
		};

		return {
			Video: [speed, videoCodec, videoBitrate, fps, resolution],
			Audio: [audioCodec, audioBitrate, audioChannels, sampleRate],
			General: [metadata],
		};
	}

	public async convert(
		input: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<VertFile> {
		this.trackConversion(input);
		if (!to.startsWith(".")) to = `.${to}`;
		this.log(`converting ${input.name} (${input.id}) to ${to}`);
		const startedAt = performance.now();

		const conversionSettings =
			Object.keys(settings).length > 4
				? { ...settings }
				: { ...(await this.getDefaultSettings(input)), ...settings };

		await this.ensureCore();

		this.throwIfCancelled(input);

		let conversionError: string | null = null;
		const ffmpeg = await this.setupFFmpeg(input);

		const errorListener = (l: { message: string }) => {
			const msg = l.message;
			if (
				msg.includes("Error initializing output stream") ||
				msg.includes("Error while opening encoder") ||
				msg.includes("Error while opening decoder") ||
				msg.includes("Conversion failed!") ||
				(msg.includes("Error") && msg.includes("stream"))
			) {
				if (!conversionError) conversionError = msg;
			}
		};
		ffmpeg.on("log", errorListener);

		const logListener = (l: { message: string }) => this.log(l.message);
		ffmpeg.on("log", logListener);

		try {
			const isImageSequence =
				input.isZip() && settings.imageSequence === true;

			let command: string[];
			if (isImageSequence) {
				command = await this.buildImageSequenceCommand(
					ffmpeg,
					input,
					to,
					conversionSettings,
				);
			} else {
				const buf = new Uint8Array(await input.file.arrayBuffer());
				// keep the extension so ffmpeg/ffprobe can detect the container
				await ffmpeg.writeFile(input.name, buf);
				this.log(
					`wrote ${input.name} (${input.id}) to ffmpeg virtual fs`,
				);
				command = await this.buildVideoCommand(
					ffmpeg,
					input,
					to,
					conversionSettings,
				);
			}

			this.log(`FFmpeg command: ${command.join(" ")}`);
			await ffmpeg.exec(command);
			this.log("executed ffmpeg command");

			if (conversionError) throw new Error(conversionError);

			const output = (await ffmpeg.readFile(
				"output" + to,
			)) as unknown as Uint8Array;
			if (!output || output.length === 0)
				throw new Error("empty file returned");

			const outputFileName =
				input.name.split(".").slice(0, -1).join(".") + to;
			const outBuf = new Uint8Array(output).buffer.slice(0);
			this.log(
				`converted ${input.name} (${input.id}) to ${to} in ${formatDuration(performance.now() - startedAt)}`,
			);
			return new VertFile(new File([outBuf], outputFileName), to);
		} finally {
			this.clearTrackedConversion(input);
			this.clearCancel(input);
			ffmpeg.off("log", errorListener);
			ffmpeg.off("log", logListener);
			this.activeConversions.delete(input.id);
			ffmpeg.terminate();
		}
	}

	// converter/format.rs `Conversion::to_args` (minus GPU paths)
	private async buildVideoCommand(
		ffmpeg: FFmpeg,
		input: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<string[]> {
		const from = normalize(input.from);
		const toFormat = normalize(to);
		const fromSupport = codecSupportFor(from);
		const toSupport = codecSupportFor(toFormat);
		const keepMetadata = settings.metadata;

		const metadataArgs = keepMetadata
			? ["-map_metadata", "0", "-map_chapters", "0"]
			: ["-map_metadata", "-1", "-map_chapters", "-1"];

		const [video, probedAudioStreams] = await Promise.all([
			probeVideo(ffmpeg, input.name),
			probeAudioStreams(ffmpeg, input.name),
		]);
		const audioStreams = pickUsableAudioStreams(
			probedAudioStreams,
			getDecodableAudioCodecs(),
		);
		if (audioStreams.length !== probedAudioStreams.length)
			this.log(
				`skipping ${probedAudioStreams.length - audioStreams.length} undecodable audio stream(s) in ${input.name} (${input.id})`,
			);
		const primary = primaryVideoStream(video.streams);
		if (!primary)
			this.log(
				`ffprobe returned no video metadata for ${input.name} (${input.id}), falling back to defaults`,
			);
		const pixFmt = primary?.pix_fmt ?? "";
		const inputCodec = (primary?.codec_name ?? "").toLowerCase();
		const hasUsableAudio = audioStreams.length > 0;
		const probedBitrate = primary?.bit_rate
			? Number(primary.bit_rate) || null
			: null;
		const fps = Math.min(parseFps(primary?.r_frame_rate ?? "") ?? 30, 24);
		const width = primary?.width ?? 0;
		const height = primary?.height ?? 0;

		const autoVideoBitrate = isAuto(settings.videoBitrate);
		const autoFps = isAuto(settings.fps);
		const autoResolution = isAuto(settings.resolution);
		const autoAudioBitrate = isAuto(settings.audioBitrate);
		const autoSampleRate = isAuto(settings.sampleRate);
		const autoVideoCodec = isAuto(settings.videoCodec);
		const autoAudioCodec = isAuto(settings.audioCodec);

		const effectiveBitrate = targetBitrate(width, height, probedBitrate);
		const constraint = constraintFor(toFormat);
		const applied = applyConstraint(
			constraint,
			effectiveBitrate,
			fps,
			[width, height],
			autoVideoBitrate,
			autoFps,
			autoResolution,
			autoAudioBitrate,
			autoSampleRate,
		);

		const hasAlpha =
			/^(yuva|gbrap|ya|rgba|bgra)/.test(pixFmt) ||
			["argb", "abgr", "ayuv", "vuya"].includes(pixFmt);
		const flattenAlpha =
			hasAlpha && !animatedImageFormats.includes(toFormat);

		const supportsRemux =
			!!fromSupport && !!toSupport && toFormat !== "gif";
		const requiresVideoEncoding =
			!autoVideoCodec ||
			!autoVideoBitrate ||
			!autoFps ||
			!autoResolution ||
			applied.requiresVideoEncoding;
		const requiresAudioEncoding =
			!autoAudioCodec ||
			!autoAudioBitrate ||
			!autoSampleRate ||
			!!customValue(settings.audioChannels) ||
			applied.requiresAudioEncoding;

		const canRemuxVideo =
			supportsRemux &&
			!requiresVideoEncoding &&
			!flattenAlpha &&
			supportsCodec(fromSupport!.video, inputCodec) &&
			supportsCodec(toSupport!.video, inputCodec);

		const result: string[] = [];

		if (canRemuxVideo) {
			// format.rs `Conversion::remux_args`
			this.log(
				`remuxing ${input.from} to ${to} for ${input.name} (${input.id})`,
			);
			result.push("-map", "0:v:0");
			if (["mts", "ts"].includes(toFormat))
				result.push("-avoid_negative_ts", "make_zero");
			result.push("-c:v", "copy", "-strict", "experimental");
		} else {
			// format.rs `to_args`
			switch (toFormat) {
				case "gif": {
					const gifWidth = width || 320;
					result.push(
						"-filter_complex",
						`[0:v:0]fps=${applied.fps},scale=${gifWidth}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer[gif]`,
						"-map",
						"[gif]",
						"-loop",
						"0",
						"-strict",
						"experimental",
					);
					break;
				}
				case "swf":
					result.push("-f", "swf", "-strict", "experimental");
					break;
				case "amv":
					if (!hasUsableAudio) {
						result.push(
							"-f",
							"lavfi",
							"-i",
							"anullsrc=channel_layout=mono:sample_rate=22050",
							"-map",
							"0:v:0",
							"-map",
							"1:a:0",
							"-shortest",
							"-strict",
							"experimental",
						);
					} else {
						result.push(
							"-map",
							"0:v:0",
							"-map",
							`0:${audioStreams[0].index}`,
							"-strict",
							"experimental",
						);
					}
					break;
				case "rm":
				case "rmvb":
					throw new Error(
						m["workers.errors.ffmpeg_video_unsupported"]({
							to: `.${toFormat}`,
						}),
					);
				default:
					result.push("-strict", "experimental");
			}

			// map every video stream (excluding cover art), the exclusions only support a single video stream
			if (!["gif", "amv"].includes(toFormat)) {
				let indices = videoStreamIndices(video.streams);
				if (singleVideoStreamFormats.includes(toFormat))
					indices = indices.slice(0, 1);
				for (const index of indices) result.push("-map", `0:${index}`);
			}

			// auto video codec
			if (autoVideoCodec) {
				const preferred = preferredVideoCodec(toFormat);
				if (preferred)
					insertCodecArg(result, "-c:v", encoderFor(preferred));
			}
		}

		// custom fps
		const fpsValue = customValue(settings.fps);
		if (fpsValue && Number.isFinite(Number(fpsValue)))
			result.push("-r", String(Math.trunc(Number(fpsValue))));

		// custom resolution (gif is handled by the palette filter)
		const resolutionValue = customValue(settings.resolution);
		if (resolutionValue && toFormat !== "gif") {
			const [w, h] = resolutionValue.split("x");
			if (Number(w) > 0 && Number(h) > 0)
				appendVideoFilter(result, `scale=${w}:${h}`);
		}

		// custom audio settings
		const audioBitrateValue = customValue(settings.audioBitrate);
		if (audioBitrateValue) result.push("-b:a", `${audioBitrateValue}k`);
		const audioChannelsValue = customValue(settings.audioChannels);
		if (audioChannelsValue) result.push("-ac", audioChannelsValue);

		// custom video/audio codecs
		const videoCodecValue = customValue(settings.videoCodec);
		if (videoCodecValue) insertCodecArg(result, "-c:v", videoCodecValue);
		const audioCodecValue = customValue(settings.audioCodec);
		if (audioCodecValue) insertCodecArg(result, "-c:a", audioCodecValue);

		// custom sample rate
		const sampleRateValue = customValue(settings.sampleRate);
		if (sampleRateValue) result.push("-ar", sampleRateValue);

		// container constraint args
		appendConstraintArgs(result, applied.args);

		if (!canRemuxVideo) {
			// resolve the final video encoder & apply speed presets
			const videoEncoder = lastCodecValue(result, "-c:v") ?? "";
			const userVideoBitrate = customValue(settings.videoBitrate);
			const videoBitrate = userVideoBitrate
				? Number(userVideoBitrate) * 1000
				: applied.bitrate;

			const level = speedRangeToLevel(
				Number(settings.ffmpegVideoSpeed ?? 2),
			);
			result.push(
				...speedArgs(level, videoEncoder, toFormat, videoBitrate),
			);
		}

		// AVI needs Annex B h264, so convert the bitstream when copying an AVCC source.
		const finalVideoEncoder = lastCodecValue(result, "-c:v") ?? "";
		if (inputCodec.includes("h264")) {
			const bsf = aviCopyBitstreamFilter(toFormat, finalVideoEncoder);
			if (bsf) {
				this.log(
					`copying AVCC h264 into ${toFormat}, adding ${bsf} (${input.name} ${input.id})`,
				);
				result.push("-bsf:v", bsf);
			}
		}

		// audio streams
		const supportsAudio = !!toSupport && toSupport.audio.length > 0;
		if (
			!supportsAudio ||
			(audioStreams.length === 0 && toFormat !== "amv")
		) {
			result.push("-an");
		} else {
			const audioCodec =
				customValue(settings.audioCodec) ??
				preferredAudioEncoder(toFormat) ??
				"";
			for (const [outputIndex, stream] of audioStreams.entries()) {
				// amv/swf only allow a single audio stream
				if (["amv", "swf"].includes(toFormat) && outputIndex > 0) break;
				if (toFormat !== "amv")
					result.push("-map", `0:${stream.index}`);

				const copy =
					!requiresAudioEncoding &&
					!isSpatialAudioStream(stream) &&
					!!stream.codec_name &&
					supportsCodec(toSupport.audio, stream.codec_name);
				const encoder = copy ? "copy" : audioCodec;
				if (!encoder)
					throw new Error(
						m["workers.errors.ffmpeg_video_no_audio_encoder"]({
							to: `.${toFormat}`,
						}),
					);
				result.push(`-c:a:${outputIndex}`, encoder);

				// AVI needs an explicit codec tag to accept copied ADTS AAC
				if (
					encoder === "copy" &&
					stream.codec_name?.toLowerCase() === "aac"
				) {
					const tag = aviAacCodecTag(toFormat, encoder);
					if (tag) result.push(`-tag:a:${outputIndex}`, tag);
				}

				// webm + opus needs to be stereo
				if (
					!copy &&
					toFormat === "webm" &&
					["opus", "libopus"].includes(encoder) &&
					isAuto(settings.audioChannels)
				)
					result.push(`-ac:a:${outputIndex}`, "2");
			}

			// amv requires an audio track
			if (toFormat === "amv" && !hasUsableAudio)
				result.push("-c:a:0", audioCodec);
		}

		// flatten alpha onto black for non-alpha containers
		if (flattenAlpha)
			appendVideoFilter(
				result,
				"format=rgba,geq=r='r(X,Y)*alpha(X,Y)/255':g='g(X,Y)*alpha(X,Y)/255':b='b(X,Y)*alpha(X,Y)/255':a=255,format=yuv420p",
			);

		this.log(
			`conversion plan for ${input.name} (${input.id}): remux=${canRemuxVideo}, keepMetadata=${keepMetadata}, hasUsableAudio=${hasUsableAudio}`,
		);

		return [
			"-y",
			"-hide_banner",
			...inputFormatArgs(from),
			"-i",
			input.name,
			...result,
			...metadataArgs,
			...outputFormatArgs(toFormat),
			"output" + to,
		];
	}

	private async buildImageSequenceCommand(
		ffmpeg: FFmpeg,
		input: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<string[]> {
		const toFormat = normalize(to);
		this.log(
			`converting image sequence ${input.name} (${input.id}) to ${to}`,
		);

		const { extractZip } = await import("#lib/util/file");
		const entries = (await extractZip(input.file)).sort((a, b) =>
			a.filename.localeCompare(b.filename, undefined, {
				numeric: true,
				sensitivity: "base",
			}),
		);

		if (!entries.length) throw new Error("No images found in zip archive");

		const imageFiles: Array<{ name: string }> = [];
		for (const [index, entry] of entries.entries()) {
			const fileName = entry.filename.split("/").pop() ?? entry.filename;
			const ext = fileName.split(".").pop()?.toLowerCase();
			if (!ext) continue;

			const paddedName = `img${String(index + 1).padStart(5, "0")}.${ext}`;
			await ffmpeg.writeFile(paddedName, entry.data);
			imageFiles.push({ name: paddedName });
		}

		if (!imageFiles.length)
			throw new Error("No images found in zip archive");

		const listContent = imageFiles
			.map(
				(image) =>
					`file '${image.name}'\nduration ${1 / (settings.imageSequenceFPS || 15)}`,
			)
			.join("\n");
		await ffmpeg.writeFile(
			"frames.txt",
			`${listContent}\nfile '${imageFiles[imageFiles.length - 1].name}'\n`,
		);
		this.log(`wrote ${imageFiles.length} images to ffmpeg virtual fs`);

		return [
			"-y",
			"-hide_banner",
			...buildImageSequenceCommand(toFormat, settings, false),
		];
	}
}

// converter/format.rs `Conversion::insert_codec_arg`
const insertCodecArg = (args: string[], flag: string, codec: string): void => {
	const index = args.indexOf(flag);
	if (index === -1) {
		args.push(flag, codec);
		return;
	}
	args[index + 1] = codec;
};

// converter/format.rs `Conversion::last_codec_value`
const lastCodecValue = (args: string[], flag: string): string | null => {
	for (let i = args.length - 2; i >= 0; i--)
		if (args[i] === flag) return args[i + 1];
	return null;
};

// format.rs `Conversion::is_avi_family`
const isAviFamily = (toFormat: string): boolean =>
	toFormat === "avi" || toFormat === "divx";

// format.rs `Conversion::avi_copy_bitstream_filter`
// avi needs the bitstream filter for h264 if copying
// "no startcode found, use the video bitstream filter 'h264_mp4toannexb'"
const aviCopyBitstreamFilter = (
	toFormat: string,
	videoEncoder: string,
): string | null =>
	isAviFamily(toFormat) && videoEncoder === "copy"
		? "h264_mp4toannexb"
		: null;

// format.rs `Conversion::avi_aac_codec_tag`
// avi needs the codec tag for ADTS AAC if copying
// "ADTS is only supported with codec tag 0x1610"
const aviAacCodecTag = (
	toFormat: string,
	audioEncoder: string,
): string | null =>
	isAviFamily(toFormat) && audioEncoder === "copy" ? "0x1610" : null;

// converter/format.rs `Conversion::append_video_filter`
const appendVideoFilter = (args: string[], filter: string): void => {
	const index = args.indexOf("-vf");
	if (index !== -1) {
		args[index + 1] = `${args[index + 1]},${filter}`;
		return;
	}
	args.push("-vf", filter);
};

// converter/format.rs `Conversion::append_constraint_args`
const appendConstraintArgs = (args: string[], constraints: string[]): void => {
	for (let i = 0; i < constraints.length; i++) {
		const arg = constraints[i];
		if (arg === "-vf") {
			appendVideoFilter(args, constraints[++i]);
			continue;
		}
		args.push(arg);
	}
};
