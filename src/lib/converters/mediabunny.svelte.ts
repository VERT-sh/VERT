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
import { registerMp3Encoder } from "@mediabunny/mp3-encoder";
import { registerAc3Decoder, registerAc3Encoder } from "@mediabunny/ac3";
import { Converter, FormatInfo, type WorkerStatus } from "./converter.svelte";
import { ToastManager } from "$lib/util/toast.svelte";
import { error, log } from "$lib/util/logger";
import { registerFlacEncoder } from "@mediabunny/flac-encoder";

// codec compatibility object, based on docs
// https://mediabunny.dev/guide/supported-formats-and-codecs#compatibility-table
const codecCompatibility = {
	video: {
		mp4: ["avc", "hevc", "vp8", "vp9", "av1"],
		m4v: ["avc", "hevc", "vp8", "vp9", "av1"],
		f4v: ["avc", "hevc", "vp8", "vp9", "av1"],
		"3gp": ["avc", "hevc", "vp8", "vp9", "av1"],
		"3g2": ["avc", "hevc", "vp8", "vp9", "av1"],
		mkv: ["avc", "hevc", "vp8", "vp9", "av1"],
		webm: ["vp8", "vp9", "av1"],
		mov: ["avc", "hevc", "vp8", "vp9", "av1"],
		ts: ["avc", "hevc"],
	},
	audio: {
		mp4: [
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
		],
		m4v: [
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
		],
		f4v: [
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
		],
		"3gp": [
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
		],
		"3g2": [
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
		],
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

	constructor() {
		super();

		// additional mediabunny coders
		// currently both official ones -- maybe add our own in the future
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

	public async convert(file: VertFile, to: string): Promise<VertFile> {
		const input = new Input({
			// TODO: add settings & special handling for certain formats & codecs
			formats: [MP4, QTFF, MATROSKA, WEBM, MPEG_TS],
			source: new BlobSource(file.file),
		});

		const output = new Output({
			format: this.format(to),
			target: new BufferTarget(),
		});

		const conversion = await Conversion.init({
			input,
			output,
		});

		if (!conversion.isValid) {
			for (const discarded of conversion.discardedTracks) {
				ToastManager.add({
					type: "error",
					message: `Mediabunny discarded unsupported track: ${discarded.reason}`,
				});
			}

			throw new Error(`Mediabunny conversion not valid`);
		}

		conversion.onProgress = (progress) => {
			file.progress = progress * 100;
		};

		this.activeConversions.set(file.id, conversion);
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
				return new MpegTsOutputFormat(); // FIXME: audio tracks discarded - prob needs another audio codec
			default:
				throw new Error(`Unsupported format: ${ext}`);
		}
	}

	public async cancel(input: VertFile): Promise<void> {
		const conversion = this.activeConversions.get(input.id);
		if (!conversion) {
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

		conversion.cancel();
		this.activeConversions.delete(input.id);
	}
}
