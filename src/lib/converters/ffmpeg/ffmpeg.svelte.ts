import { VertFile } from "$lib/types";
import { Converter, FormatInfo } from "../converter.svelte";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { browser } from "$app/environment";
import { error, log } from "$lib/util/logger";
import { m } from "$lib/paraglide/messages";
import { Settings } from "$lib/sections/settings/index.svelte";
import { ToastManager } from "$lib/util/toast.svelte";
import {
	getCodecs,
	toArgs,
} from "./ffmpeg.codecs";
import { buildImageSequenceCommand } from "./ffmpeg.animated";
import { extractAlbumArt, avWithArt, avWithBg } from "./utils/ffmpeg";
import type {
	NormalizedSettings,
	SettingDefinition,
	ConversionSettings,
} from "$lib/types/conversion-settings";
import { videoFormats } from "../vertd/vertd.svelte";

// TODO: differentiate in UI? (not native formats)
export class FFmpegConverter extends Converter {
	private ffmpeg: FFmpeg = null!;
	public name = "ffmpeg";
	public ready = $state(false);

	private activeConversions = new Map<string, FFmpeg>();

	// non supported audio to video formats
	private cantConvert: string[] = ["ogx"];

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
		new FormatInfo("qoa", true, true),
		new FormatInfo("wma", true, true),
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
		...videoFormats.map(
			//  exclude cantConvert from audio to video
			(f: string) => {
				const isCantConvert = this.cantConvert.includes(f);
				return new FormatInfo(f, true, !isCantConvert, false, 0);
			},
		),
	];

	public readonly reportsProgress = true;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private log: (...msg: any[]) => void = () => {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private error: (...msg: any[]) => void = () => {};

	constructor() {
		super();
		this.log = (msg) => log(["converters", this.name], msg);
		this.error = (msg) => error(["converters", this.name], msg);
		this.log(`created converter`);
		if (!browser) return;

		// this is just to cache the wasm and js for when we actually use it. we're not using this ffmpeg instance
		this.ffmpeg = new FFmpeg();
		void (async () => {
			try {
				const baseURL =
					"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

				this.status = "downloading";

				await this.ffmpeg.load({
					coreURL: `${baseURL}/ffmpeg-core.js`,
					wasmURL: `${baseURL}/ffmpeg-core.wasm`,
				});

				this.status = "ready";
			} catch (err) {
				this.error(`Error loading ffmpeg: ${err}`);
				this.status = "error";
				ToastManager.add({
					type: "error",
					message: m["workers.errors.ffmpeg"](),
				});
			}
		})();
	}

	public async getAvailableSettings(): Promise<SettingDefinition[]> {
		// audio - bitrate, sample rate, channels, normalize, trim silence

		const global = Settings.instance.settings;

		const bitrate: SettingDefinition = {
			key: "bitrate",
			label: m["convert.settings.audio.bitrate.label"](),
			type: "string",
			placeholder: m["convert.settings.audio.bitrate.placeholder"](),
		};

		const sampleRate: SettingDefinition = {
			key: "sampleRate",
			label: m["convert.settings.audio.sample_rate.label"](),
			type: "string",
			placeholder: m["convert.settings.audio.sample_rate.placeholder"](),
		};

		const channels: SettingDefinition = {
			key: "channels",
			label: m["convert.settings.audio.channels.label"](),
			type: "number",
			default: 2,
			min: 1,
			max: 8,
			placeholder: m["convert.settings.audio.channels.placeholder"](),
		};

		/*
		 *	common
		 */
		const metadata: SettingDefinition = {
			key: "metadata",
			label: m["convert.settings.common.metadata"](),
			type: "boolean",
			default: global.metadata ?? true,
		};

		// resize, crop, rotate - prob want a ui

		return [bitrate, sampleRate, channels, metadata];
	}

	public async getDefaultSettings(): Promise<ConversionSettings> {
		const defaults: ConversionSettings = {};
		const settings = await this.getAvailableSettings();
		settings.forEach((setting) => {
			defaults[setting.key] = setting.default;
		});
		return defaults;
	}

	public async normalizeSettings(
		input: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<NormalizedSettings> {
		const normalized = { ...settings };
		const changes: NormalizedSettings["changes"] = [];

		const change = (setting: string, newValue: string | number) => {
			const oldValue = normalized[setting];
			if (oldValue === newValue) return;

			normalized[setting] = newValue;
			changes.push({
				setting,
				oldValue,
				newValue,
				file: input.name,
			});
		};

		if (to === ".opus") {
			// work around browser stereo+libopus wasm crash
			// no idea why its broken like this in the browser only lol
			if (normalized.channels >= 2) change("channels", 1);

			const bitrate = Number(normalized.bitrate);
			if (Number.isFinite(bitrate) && bitrate > 256)
				change("bitrate", 256);
		} else if (to === ".amv") {
			change("sampleRate", 22050);
			change("channels", 1);
			change("bitrate", 32);
		} else if (to === ".mpg" || to === ".mpeg" || to === ".vob") {
			const bitrate = Number(normalized.bitrate);
			if (Number.isFinite(bitrate) && bitrate > 0)
				change("bitrate", Math.pow(2, Math.round(Math.log2(bitrate))));
		} else if (to === ".gxf") {
			change("sampleRate", 48000);
			change("channels", 1);
		}

		return { settings: normalized, changes };
	}

	public async convert(
		input: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<VertFile> {
		if (!to.startsWith(".")) to = `.${to}`;

		const conversionSettings =
			Object.keys(settings).length > 4 // TODO: find better way to do this lmfao, rn we are just assuming all settings are present if there's at least 5 keys but ts bad
				? settings
				: {
						...(await this.getDefaultSettings()),
						...settings,
					}; // use defaults if not provided

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
				const rate = conversionSettings.sampleRate;
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

		const logListener = (l: { message: string }) => {
			this.log(l.message);
		};

		ffmpeg.on("log", logListener);

		try {
			let buf = new Uint8Array(await input.file.arrayBuffer());

			if (input.from === ".qoa") {
				const { decodeQoa, encodeWav } =
					await import("$lib/util/parse/qoa");
				const decoded = decodeQoa(buf);
				buf = new Uint8Array(
					encodeWav(
						decoded.pcm,
						decoded.sampleRate,
						decoded.channels,
						true,
					),
				);
			}

			await ffmpeg.writeFile("input", buf);
			this.log(`wrote ${input.name} to ffmpeg virtual fs`);

			const specialHandled = await handleSpecialOutput(
				ffmpeg,
				input,
				to,
				conversionSettings,
				conversionError,
			);
			if (specialHandled) {
				return specialHandled;
			} else {
				const command = await this.buildConversionCommand(
					ffmpeg,
					input,
					to,
					conversionSettings,
					isAlac,
				);
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
				this.log(`read ${outputFileName} from ffmpeg virtual fs`);

				const outBuf = new Uint8Array(output).buffer.slice(0);
				return new VertFile(new File([outBuf], outputFileName), to);
			}
		} finally {
			ffmpeg.off("log", errorListener);
			ffmpeg.off("log", logListener);
			this.activeConversions.delete(input.id);
			ffmpeg.terminate();
		}
	}

	public async cancel(input: VertFile): Promise<void> {
		const ffmpeg = this.activeConversions.get(input.id);
		if (!ffmpeg) {
			this.error(`no active conversion found for file ${input.name}`);
			return;
		}

		this.log(`cancelling conversion for file ${input.name}`);

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
		}

		const baseURL =
			"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
		await ffmpeg.load({
			coreURL: `${baseURL}/ffmpeg-core.js`,
			wasmURL: `${baseURL}/ffmpeg-core.wasm`,
		});

		return ffmpeg;
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
		const isImageSequence = input.isZip() && settings.imageSequence;

		const userBitrate = settings.bitrate;
		const userSampleRate = settings.sampleRate;
		const keepMetadata = settings.metadata;

		// image sequences -> animated image // video
		if (isImageSequence) {
			this.log(`converting image sequence ${input.name} to ${to}`);

			const { extractZip } = await import("$lib/util/file");
			const entries = (await extractZip(input.file)).sort((a, b) =>
				a.filename.localeCompare(b.filename, undefined, {
					numeric: true,
					sensitivity: "base",
				}),
			);

			if (!entries.length)
				throw new Error("No images found in zip archive");

			const imageFiles: Array<{ name: string }> = [];

			for (const [index, entry] of entries.entries()) {
				const fileName =
					entry.filename.split("/").pop() ?? entry.filename;
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

			return buildImageSequenceCommand(outputFormat, settings, isAlac);
		}

		// else normal single file conversion

		let audioBitrateArgs: string[] = [];
		let sampleRateArgs: string[] = [];
		let channelsArgs: string[] = [];
		let metadataArgs: string[] = [];
		const extraArgs: string[] = [];
		if (to === ".amv") {
			// amv requires mono audio, 32kbps, and 22050 sample rate
			// block size is 22050 (sample rate) / fps. max is 8192, so we have to force a higher fps
			const amvFps = 3;
			extraArgs.push(
				"-r",
				String(amvFps),
				"-block_size",
				String(Math.floor(22050 / amvFps)),
			);
		}

		this.log(`keep metadata: ${keepMetadata}`);
		if (!keepMetadata) {
			metadataArgs = [
				"-map_metadata", // remove metadata
				"-1",
				"-map_chapters", // remove chapters
				"-1",
			];
		}

		if (userBitrate) {
			audioBitrateArgs = ["-b:a", `${userBitrate}k`];
			this.log(`using user setting for audio bitrate: ${userBitrate}`);
		}

		// sample rate setting
		if (userSampleRate) {
			sampleRateArgs = ["-ar", String(userSampleRate)];
			this.log(`using user setting for sample rate: ${userSampleRate}Hz`);
		}

		// channels setting
		if (settings.channels !== 2) {
			channelsArgs = ["-ac", String(settings.channels)];
			this.log(
				`using user setting for audio channels: ${settings.channels}`,
			);
		}

		// video to audio
		if (videoFormats.includes(inputFormat)) {
			this.log(`Converting video ${input.from} to audio ${to}`);
			return [
				"-i",
				"input",
				"-map",
				"0:a:0",
				...metadataArgs,
				...audioBitrateArgs,
				...sampleRateArgs,
				...channelsArgs,
				...extraArgs,
				"output" + to,
			];
		}

		// audio to video
		if (videoFormats.includes(outputFormat)) {
			this.log(`Converting audio ${input.from} to video ${to}`);

			const hasAlbumArt = keepMetadata
				? await extractAlbumArt(ffmpeg)
				: false;
			const codecArgs = toArgs(to, isAlac);

			if (hasAlbumArt) {
				this.log("Using album art as video background");
				return avWithArt(
					to,
					codecArgs,
					metadataArgs,
					audioBitrateArgs,
					sampleRateArgs,
					channelsArgs,
					extraArgs,
				);
			} else {
				this.log("Using solid color background");
				return avWithBg(
					to,
					toArgs(to, isAlac),
					metadataArgs,
					audioBitrateArgs,
					sampleRateArgs,
					channelsArgs,
					extraArgs,
				);
			}
		}

		// audio to audio
		this.log(`Converting audio ${input.from} to audio ${to}`);
		const { audio: audioCodec } = getCodecs(to, isAlac);
		if (m4a && keepMetadata) extraArgs.push("-c:v", "copy"); // for album art

		return [
			"-i",
			"input",
			"-c:a",
			audioCodec,
			...metadataArgs,
			...audioBitrateArgs,
			...sampleRateArgs,
			...channelsArgs,
			...extraArgs,
			"-strict",
			"experimental",
			"output" + to,
		];
	}
}

// const handleSpecialInput = async (
// 	ffmpeg: FFmpeg,
// 	input: VertFile,
// ): Promise<VertFile | null> => {
//
// }

const handleSpecialOutput = async (
	ffmpeg: FFmpeg,
	input: VertFile,
	to: string,
	conversionSettings: ConversionSettings,
	conversionError: string | null,
): Promise<VertFile | null> => {
	if (to === ".qoa") {
		const sampleRate =
			conversionSettings.sampleRate &&
			conversionSettings.sampleRate !== "auto"
				? (conversionSettings.sampleRate as number)
				: 48000;

		let channels = 2;
		if (
			conversionSettings.channels &&
			conversionSettings.channels !== "auto"
		)
			channels = conversionSettings.channels as number;

		const pcmArgs = [
			"-i",
			"input",
			"-f",
			"f32le",
			"-ar",
			String(sampleRate),
			"-ac",
			String(channels),
			"-c:a",
			"pcm_f32le",
			"output.raw",
		];
		await ffmpeg.exec(pcmArgs);

		if (conversionError) throw new Error(conversionError);

		const pcmRaw = (await ffmpeg.readFile(
			"output.raw",
		)) as unknown as Uint8Array;
		const { encodeQoa } = await import("$lib/util/parse/qoa");
		const qoaBytes = encodeQoa(
			new Uint8Array(pcmRaw),
			sampleRate,
			channels,
		);
		const outputFileName =
			input.name.split(".").slice(0, -1).join(".") + ".qoa";
		return new VertFile(
			new File([new Uint8Array(qoaBytes)], outputFileName),
			".qoa",
		);
	}
	// if (whatever other formats need special parsing)

	return null;
};
