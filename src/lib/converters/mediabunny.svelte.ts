import { VertFile } from "$lib/types";
import {
	ALL_FORMATS,
	BufferTarget,
	Conversion,
	Input,
	MkvOutputFormat,
	MovOutputFormat,
	Mp4InputFormat,
	Mp4OutputFormat,
	Output,
	ReadableStreamSource,
	WebMInputFormat,
	WebMOutputFormat,
} from "mediabunny";
import { Converter, FormatInfo, type WorkerStatus } from "./converter.svelte";
import { ToastManager } from "$lib/util/toast.svelte";

export class MediabunnyConverter extends Converter {
	public name = "mediabunny";
	public status: WorkerStatus = $state("ready");

	public supportedFormats: FormatInfo[] = [
		new FormatInfo("mp4", true, true),
		new FormatInfo("mkv", false, true),
		new FormatInfo("webm", true, true),
		new FormatInfo("mov", false, true),
	];

	constructor() {
		super();
	}

	public async convert(file: VertFile, to: string): Promise<VertFile> {
		const stream = file.file.stream(); // ReadableStream<Uint8Array<ArrayBuffer>>
		const input = new Input({
			formats: [new Mp4InputFormat(), new WebMInputFormat()],
			source: new ReadableStreamSource(stream),
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
			case ".mp4":
				return new Mp4OutputFormat();
			case ".mkv":
				return new MkvOutputFormat();
			case ".webm":
				return new WebMOutputFormat();
			case ".mov":
				return new MovOutputFormat();
			default:
				throw new Error(`Unsupported format: ${ext}`);
		}
	}

	public async cancel(input: VertFile): Promise<void> {}
}
