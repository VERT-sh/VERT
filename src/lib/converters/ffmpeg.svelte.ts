import { VertFile } from "$lib/types";
import { Converter, FormatInfo } from "./converter.svelte";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { browser } from "$app/environment";
import { error, log } from "$lib/util/logger";
import { m } from "$lib/paraglide/messages";
import { Settings } from "$lib/sections/settings/index.svelte";
import { ToastManager } from "$lib/util/toast.svelte";
import type {
	SettingDefinition,
	ConversionSettings,
} from "$lib/types/conversion-settings";

// TODO: differentiate in UI? (not native formats)
const videoFormats = [
	"mkv",
	"mp4",
	"avi",
	"mov",
	"webm",
	"ts",
	"mts",
	"m2ts",
	"wmv",
	"mpg",
	"mpeg",
	"flv",
	"f4v",
	"vob",
	"m4v",
	"3gp",
	"3g2",
	"mxf",
	"ogv",
	"rm",
	"rmvb",
	"divx",
];

export class FFmpegConverter extends Converter {
	private ffmpeg: FFmpeg = null!;
	public name = "ffmpeg";
	public ready = $state(false);

	private activeConversions = new Map<string, FFmpeg>();

	public supportedFormats = [
		new FormatInfo("mp3", true, true),
		new FormatInfo("wav", true, true),
		new FormatInfo("flac", true, true),
		new FormatInfo("ogg", true, true),
		new FormatInfo("mogg", true, false),
		new FormatInfo("oga", true, true),
		new FormatInfo("opus", true, true),
		new FormatInfo("aac", true, true),
		new FormatInfo("alac", true, true), // outputted as m4a
		new FormatInfo("m4a", true, true), // can be alac
		new FormatInfo("caf", true, false), // can be alac
		new FormatInfo("wma", true, true),
		new FormatInfo("amr", true, true),
		new FormatInfo("ac3", true, true),
		new FormatInfo("aiff", true, true),
		new FormatInfo("aifc", true, true),
		new FormatInfo("aif", true, true),
		new FormatInfo("mp1", true, false),
		new FormatInfo("mp2", true, true),
		new FormatInfo("mpc", true, false), // unknown if it works, can't find sample file but ffmpeg should support i think?
		//new FormatInfo("raw", true, false), // usually pcm
		new FormatInfo("dsd", true, false), // dsd
		new FormatInfo("dsf", true, false), // dsd
		new FormatInfo("dff", true, false), // dsd
		new FormatInfo("mqa", true, false),
		new FormatInfo("au", true, true),
		new FormatInfo("m4b", true, true),
		new FormatInfo("voc", true, true),
		new FormatInfo("weba", true, true),
		...videoFormats.map((f) => new FormatInfo(f, true, true, false)),
	];

	public readonly reportsProgress = true;

	constructor() {
		super();
		log(["converters", this.name], `created converter`);
		if (!browser) return;
		try {
			// this is just to cache the wasm and js for when we actually use it. we're not using this ffmpeg instance
			this.ffmpeg = new FFmpeg();
			(async () => {
				const baseURL =
					"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

				this.status = "downloading";

				await this.ffmpeg.load({
					coreURL: `${baseURL}/ffmpeg-core.js`,
					wasmURL: `${baseURL}/ffmpeg-core.wasm`,
				});

				this.status = "ready";
			})();
		} catch (err) {
			error(["converters", this.name], `Error loading ffmpeg: ${err}`);
			this.status = "error";
			ToastManager.add({
				type: "error",
				message: m["workers.errors.ffmpeg"](),
			});
		}
	}

	public async getAvailableSettings(
		input: VertFile,
	): Promise<SettingDefinition[]> {
		// audio - bitrate, sample rate, channels, normalize, trim silence

		const global = Settings.instance.settings;

		const ffmpeg = await this.setupFFmpeg(input, true);
		const buf = new Uint8Array(await input.file.arrayBuffer());
		await ffmpeg.writeFile("input", buf);

		// TODO: should we really be doing all this detection here? it adds a lot of time before the settings even show up.
		// which isn't very nice for the UX guh

		const detectedBitrate = await this.detectAudioBitrate(ffmpeg);
		const bitrate: SettingDefinition = {
			key: "bitrate",
			label: m["convert.settings.audio.bitrate"](),
			type: "select",
			default: global.ffmpegQuality,
			options: CONVERSION_BITRATES.map((b) => ({
				value: b,
				label: b,
			})),
			hasCustomInput: true,
			customInputKey: "customBitrate",
			placeholder: detectedBitrate ?? "128"
		};

		const detectedSampleRate = await this.detectAudioSampleRate(ffmpeg);
		const sampleRate: SettingDefinition = {
			key: "sampleRate",
			label: m["convert.settings.audio.sample_rate"](),
			type: "select",
			default:
				global.ffmpegSampleRate === "custom"
					? global.ffmpegCustomSampleRate
					: global.ffmpegSampleRate,
			options: SAMPLE_RATES.map((r) => ({
				value: r,
				label: r,
			})),
			hasCustomInput: true,
			customInputKey: "customSampleRate",
			placeholder: detectedSampleRate ?? "44100"
		};

		const audioTracks = await this.detectAudioTracks(ffmpeg);
		const tracks: SettingDefinition = {
			key: "tracks",
			label: m["convert.settings.audio.tracks"](),
			type: "number",
			default: audioTracks ?? 1,
			min: 1,
			max: audioTracks ? audioTracks : 1,
			placeholder: audioTracks ?? 1
		};

		const audioChannels = await this.detectAudioChannels(ffmpeg);
		const channels: SettingDefinition = {
			key: "channels",
			label: m["convert.settings.audio.channels"](),
			type: "number",
			default: audioChannels ?? 2,
			min: 1,
			max: audioChannels ? audioChannels * 2 : 5,
			placeholder: audioChannels ?? 2
		};

		const metadata: SettingDefinition = {
			key: "metadata",
			label: m["convert.settings.common.metadata"](),
			type: "boolean",
			default: global.metadata ?? true,
		};

		// resize, crop, rotate - prob want a ui

		return [bitrate, sampleRate, tracks, channels, metadata];
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
		input: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<VertFile> {
		if (!to.startsWith(".")) to = `.${to}`;

		const conversionSettings =
			Object.keys(settings).length > 0
				? settings
				: await this.getDefaultSettings(input); // use defaults if not provided

		const isAlac = to === ".alac";
		if (isAlac) to = ".m4a";

		let conversionError: string | null = null;
		const ffmpeg = await this.setupFFmpeg(input);

		this.activeConversions.set(input.id, ffmpeg);

		// listen for errors during conversion
		const errorListener = (l: { message: string }) => {
			const msg = l.message;
			if (
				msg.includes("Specified sample rate") &&
				msg.includes("is not supported")
			) {
				const rate =
					conversionSettings.sampleRate === "custom"
						? conversionSettings.customSampleRate
						: conversionSettings.sampleRate;
				conversionError = m["workers.errors.invalid_rate"]({
					rate,
				});
			} else if (msg.includes("Stream map '0:a:0' matches no streams.")) {
				conversionError = m["workers.errors.no_audio"]();
			} else if (
				msg.includes("Error initializing output stream") ||
				msg.includes("Error while opening encoder") ||
				msg.includes("Error while opening decoder") ||
				(msg.includes("Error") && msg.includes("stream")) ||
				msg.includes("Conversion failed!")
			) {
				// other general errors
				if (!conversionError) conversionError = msg;
			}
		};

		ffmpeg.on("log", errorListener);

		const buf = new Uint8Array(await input.file.arrayBuffer());
		await ffmpeg.writeFile("input", buf);
		log(
			["converters", this.name],
			`wrote ${input.name} to ffmpeg virtual fs`,
		);

		const command = await this.buildConversionCommand(
			ffmpeg,
			input,
			to,
			conversionSettings,
			isAlac,
		);
		log(["converters", this.name], `FFmpeg command: ${command.join(" ")}`);
		await ffmpeg.exec(command);
		log(["converters", this.name], "executed ffmpeg command");

		if (conversionError) {
			ffmpeg.off("log", errorListener);
			ffmpeg.terminate();
			throw new Error(conversionError);
		}

		const output = (await ffmpeg.readFile(
			"output" + to,
		)) as unknown as Uint8Array;

		if (!output || output.length === 0) {
			ffmpeg.off("log", errorListener);
			ffmpeg.terminate();
			throw new Error("empty file returned");
		}

		const outputFileName =
			input.name.split(".").slice(0, -1).join(".") + to;
		log(
			["converters", this.name],
			`read ${outputFileName} from ffmpeg virtual fs`,
		);

		ffmpeg.off("log", errorListener);
		ffmpeg.terminate();

		const outBuf = new Uint8Array(output).buffer.slice(0);
		return new VertFile(new File([outBuf], outputFileName), to);
	}

	public async cancel(input: VertFile): Promise<void> {
		const ffmpeg = this.activeConversions.get(input.id);
		if (!ffmpeg) {
			error(
				["converters", this.name],
				`no active conversion found for file ${input.name}`,
			);
			return;
		}

		log(
			["converters", this.name],
			`cancelling conversion for file ${input.name}`,
		);

		ffmpeg.terminate();
		this.activeConversions.delete(input.id);
	}

	private async setupFFmpeg(
		input: VertFile,
		temporary = false,
	): Promise<FFmpeg> {
		const ffmpeg = new FFmpeg();

		if (!temporary) {
			ffmpeg.on("progress", (progress) => {
				input.progress = progress.progress * 100;
			});

			ffmpeg.on("log", (l) => {
				log(["converters", this.name], l.message);
			});
		}

		const baseURL =
			"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
		await ffmpeg.load({
			coreURL: `${baseURL}/ffmpeg-core.js`,
			wasmURL: `${baseURL}/ffmpeg-core.wasm`,
		});

		return ffmpeg;
	}

	private async detectAudioBitrate(ffmpeg: FFmpeg): Promise<number | null> {
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

		try {
			let bitrate: number | null = null;

			const bitrateListener = (event: { message: string }) => {
				if (bitrate !== null) return;
				const n = parseInt(event.message.trim(), 10);
				if (!n) return;
				bitrate = Math.round(n / 1000);
				log(
					["converters", this.name],
					`Detected stream audio bitrate: ${bitrate} kbps`,
				);
			};

			ffmpeg.on("log", bitrateListener);

			try {
				await ffmpeg.ffprobe.call(ffmpeg, args);
				return bitrate;
			} finally {
				ffmpeg.off("log", bitrateListener);
			}
		} catch {
			return null;
		}
	}

	private async detectAudioSampleRate(
		ffmpeg: FFmpeg,
	): Promise<number | null> {
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

		try {
			let sampleRate: number | null = null;

			const sampleRateListener = (event: { message: string }) => {
				if (sampleRate !== null) return;
				const n = parseInt(event.message.trim(), 10);
				if (!n) return;
				sampleRate = n;
				log(
					["converters", this.name],
					`Detected stream audio sample rate: ${sampleRate} Hz`,
				);
			};

			ffmpeg.on("log", sampleRateListener);

			try {
				await ffmpeg.ffprobe.call(ffmpeg, args);
				return sampleRate;
			} finally {
				ffmpeg.off("log", sampleRateListener);
			}
		} catch {
			return null;
		}
	}

	private async detectAudioTracks(ffmpeg: FFmpeg): Promise<number | null> {
		const args = [
			"-v",
			"error",
			"-select_streams",
			"a",
			"-show_entries",
			"stream=index",
			"-of",
			"json",
			"input",
		];

		try {
			let output = "";

			const tracksListener = (event: { message: string }) => {
				output += `${event.message}\n`;
			};

			ffmpeg.on("log", tracksListener);

			try {
				log(
					["converters", this.name],
					`Running ffprobe to detect audio tracks with args: ${args.join(" ")}`,
				);
				await ffmpeg.ffprobe.call(ffmpeg, args);
			} finally {
				ffmpeg.off("log", tracksListener);
			}

			if (!output.trim()) return null;

			const parsed = JSON.parse(output);
			const tracks = Array.isArray(parsed?.streams)
				? parsed.streams.length
				: null;

			log(
				["converters", this.name],
				`Detected stream audio tracks: ${tracks}`,
			);

			return tracks;
		} catch (err) {
			error(
				["converters", this.name],
				`Error detecting audio tracks: ${err}`,
			);
			return null;
		}
	}

	private async detectAudioChannels(ffmpeg: FFmpeg): Promise<number | null> {
		const args = [
			"-v",
			"0",
			"-select_streams",
			"a",
			"-show_entries",
			"stream=channels",
			"-of",
			"compact=p=0:nk=1",
			"input",
		];

		try {
			let channels: number | null = null;

			const channelsListener = (event: { message: string }) => {
				if (channels !== null) return;
				const n = parseInt(event.message.trim(), 10);
				if (!n) return;
				channels = n;
				log(
					["converters", this.name],
					`Detected stream audio channels: ${channels}`,
				);
			};

			ffmpeg.on("log", channelsListener);

			try {
				await ffmpeg.ffprobe.call(ffmpeg, args);
				return channels;
			} finally {
				ffmpeg.off("log", channelsListener);
			}
		} catch {
			return null;
		}
	}

	private async buildConversionCommand(
		ffmpeg: FFmpeg,
		input: VertFile,
		to: string,
		settings: ConversionSettings,
		isAlac: boolean = false,
	): Promise<string[]> {
		const inputFormat = input.from.slice(1);
		const outputFormat = to.slice(1);
		const m4a = isAlac || to === ".m4a";

		const lossless = [
			"flac",
			"m4a",
			"caf",
			"alac",
			"wav",
			"dsd",
			"dsf",
			"dff",
		];
		const userBitrate = settings.bitrate;
		const customBitrate = settings.customBitrate;
		const userSampleRate = settings.sampleRate;
		const customSampleRate = settings.customSampleRate;
		const keepMetadata = settings.metadata;

		let audioBitrateArgs: string[] = [];
		let sampleRateArgs: string[] = [];
		let channelsArgs: string[] = [];
		let tracksArgs: string[] = [];
		let metadataArgs: string[] = [];
		let m4aArgs: string[] = [];

		log(["converters", this.name], `keep metadata: ${keepMetadata}`);
		if (!keepMetadata) {
			metadataArgs = [
				"-map_metadata", // remove metadata
				"-1",
				"-map_chapters", // remove chapters
				"-1",
				"-map", // remove cover art
				"a",
			];
		}

		const isLosslessToLossy =
			lossless.includes(inputFormat) && !lossless.includes(outputFormat);
		if (userBitrate !== "auto") {
			// user's setting
			audioBitrateArgs = [
				"-b:a",
				`${userBitrate === "custom" ? customBitrate : userBitrate}k`,
			];
			log(
				["converters", this.name],
				`using user setting for audio bitrate: ${userBitrate}`,
			);
		} else {
			// detect bitrate of original file and use
			if (isLosslessToLossy) {
				// use safe default
				audioBitrateArgs = ["-b:a", "128k"];
				log(
					["converters", this.name],
					`converting from lossless to lossy, using default audio bitrate: 128k`,
				);
			} else {
				const inputBitrate = await this.detectAudioBitrate(ffmpeg);
				audioBitrateArgs = inputBitrate
					? ["-b:a", `${inputBitrate}k`]
					: [];
				log(
					["converters", this.name],
					`using detected audio bitrate: ${inputBitrate}k`,
				);
			}
		}

		// sample rate setting
		if (userSampleRate !== "auto") {
			sampleRateArgs = [
				"-ar",
				userSampleRate === "custom" ? customSampleRate : userSampleRate,
			];
			log(
				["converters", this.name],
				`using user setting for sample rate: ${userSampleRate}Hz`,
			);
		} else {
			// detect sample rate of original file and use
			if (isLosslessToLossy) {
				// use safe default
				const defaultRate = to === ".opus" ? "48000" : "44100";
				log(
					["converters", this.name],
					`converting from lossless to lossy, using default sample rate: ${defaultRate}Hz`,
				);
				sampleRateArgs = ["-ar", defaultRate];
			} else {
				let inputSampleRate = await this.detectAudioSampleRate(ffmpeg);
				if (to === ".opus" && inputSampleRate === 44100) {
					// special case: opus does not support 44100Hz which is more common - adjust to 48000Hz
					log(
						["converters", this.name],
						"conversion to opus with 44100Hz sample rate detected, adjusting to 48000Hz",
					);
					inputSampleRate = 48000;
				}

				sampleRateArgs = inputSampleRate
					? ["-ar", `${inputSampleRate}`]
					: [];
				log(
					["converters", this.name],
					`using detected audio sample rate: ${inputSampleRate}Hz`,
				);
			}
		}

		// channels setting
		if (settings.channels !== "auto") {
			channelsArgs = ["-ac", settings.channels];
			log(
				["converters", this.name],
				`using user setting for audio channels: ${settings.channels}`,
			);
		}

		// tracks setting
		// TODO: select specific tracks? (prob should be for the other settings that need extra ui stuff)
		if (settings.tracks !== "auto") {
			// -map for each audio track
			if (settings.tracks > 1) {
				for (let i = 0; i < settings.tracks; i++) {
					tracksArgs.push("-map", `0:a:${i - 1}`);
				}
			} else {
				tracksArgs = ["-map", "0:a:0"]; // default to first audio track if not specified
			}

			log(
				["converters", this.name],
				`using user setting for audio tracks: ${settings.tracks}`,
			);
		}

		// video to audio
		if (videoFormats.includes(inputFormat)) {
			log(
				["converters", this.name],
				`Converting video ${input.from} to audio ${to}`,
			);
			return [
				"-i",
				"input",
				"-map",
				"0:a:0",
				...metadataArgs,
				...audioBitrateArgs,
				...sampleRateArgs,
				...channelsArgs,
				...tracksArgs,
				"output" + to,
			];
		}

		// audio to video
		if (videoFormats.includes(outputFormat)) {
			log(
				["converters", this.name],
				`Converting audio ${input.from} to video ${to}`,
			);

			const hasAlbumArt = keepMetadata
				? await this.extractAlbumArt(ffmpeg)
				: false;
			const codecArgs = toArgs(to, isAlac);

			if (hasAlbumArt) {
				log(
					["converters", this.name],
					"Using album art as video background",
				);
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
			} else {
				log(["converters", this.name], "Using solid color background");
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
					...toArgs(to, isAlac),
					...metadataArgs,
					...audioBitrateArgs,
					...sampleRateArgs,
					...channelsArgs,
					...tracksArgs,
					"output" + to,
				];
			}
		}

		// audio to audio
		log(
			["converters", this.name],
			`Converting audio ${input.from} to audio ${to}`,
		);
		const { audio: audioCodec } = getCodecs(to, isAlac);
		if (m4a && keepMetadata) m4aArgs = ["-c:v", "copy"]; // for album art

		return [
			"-i",
			"input",
			...m4aArgs,
			"-c:a",
			audioCodec,
			...metadataArgs,
			...audioBitrateArgs,
			...sampleRateArgs,
			...channelsArgs,
			...tracksArgs,
			"output" + to,
		];
	}

	private async extractAlbumArt(ffmpeg: FFmpeg): Promise<boolean> {
		//  extract using stream mapping (should work for most)
		if (
			await this.tryExtractAlbumArt(ffmpeg, [
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
			log(
				["converters", this.name],
				"Successfully extracted album art from stream 0:1",
			);
			return true;
		}

		// fallback: extract without stream mapping (this probably won't happen)
		if (
			await this.tryExtractAlbumArt(ffmpeg, [
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
			log(
				["converters", this.name],
				"Successfully extracted album art (fallback method)",
			);
			return true;
		}

		log(
			["converters", this.name],
			"No album art found, will create solid color background",
		);
		return false;
	}

	private async tryExtractAlbumArt(
		ffmpeg: FFmpeg,
		command: string[],
	): Promise<boolean> {
		try {
			await ffmpeg.exec(command);
			const coverData = await ffmpeg.readFile("cover.jpg");
			return !!(coverData && (coverData as Uint8Array).length > 0);
		} catch {
			return false;
		}
	}
}

// and here i was, thinking i'd be done with ffmpeg after finishing vertd
// but OH NO we just HAD to have someone suggest to allow album art video generation.
//
// i hate you SO much.
// - love, maddie
const toArgs = (ext: string, isAlac: boolean = false): string[] => {
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

	args.push("-c:a", codecs.audio);

	if (codecs.audio === "aac") args.push("-strict", "experimental");

	if (ext === ".divx") args.unshift("-f", "avi");
	if (ext === ".mxf") args.push("-strict", "unofficial");

	return args;
};

const getCodecs = (
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

		default:
			return { video: "libx264", audio: "aac" };
	}
};

export const CONVERSION_BITRATES = [
	"auto",
	"custom",
	320,
	256,
	192,
	128,
	96,
	64,
	32,
] as const;
export type ConversionBitrate = (typeof CONVERSION_BITRATES)[number];

export const SAMPLE_RATES = [
	"auto",
	"custom",
	"48000",
	"44100",
	"32000",
	"22050",
	"16000",
	"11025",
	"8000",
] as const;
export type SampleRate = (typeof SAMPLE_RATES)[number];
