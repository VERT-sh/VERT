import { VertFile } from "$lib/types";
import {
	BlobSource,
	BufferTarget,
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
import { Converter, FormatInfo, type WorkerStatus } from "./converter.svelte";
import { ToastManager } from "$lib/util/toast.svelte";

export class MediabunnyConverter extends Converter {
	public name = "mediabunny";
	public status: WorkerStatus = $state("ready");

	public supportedFormats: FormatInfo[] = [
		new FormatInfo("mp4", true, true),
		new FormatInfo("m4v", true, true),
		new FormatInfo("mkv", true, true),
		new FormatInfo("webm", true, true),
		new FormatInfo("mov", true, true),

		// mp4-based formats (should work)
		new FormatInfo("f4v", true, true),
		new FormatInfo("3gp", true, true),
		new FormatInfo("3g2", true, true),
		new FormatInfo("ts", true, true),
	];

	constructor() {
		super();
	}

	public async convert(file: VertFile, to: string): Promise<VertFile> {
		const input = new Input({
			// TODO: add settings & special handling for certain formats & codecs
			formats: [MP4, QTFF, MATROSKA, WEBM, MPEG_TS],
			source: new BlobSource(file.file)
		});

		const toFormat = to.startsWith(".") ? to.slice(1) : to;
		const originalName = file.file.name.split(".").slice(0, -1).join(".");

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

		await conversion.execute();

		if (!output.target.buffer) {
			throw new Error("Mediabunny conversion failed: no output buffer");
		}

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

	public async cancel(input: VertFile): Promise<void> {}
}
