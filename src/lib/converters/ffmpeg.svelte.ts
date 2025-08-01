import { VertFile } from "$lib/types";
import { Converter, FormatInfo } from "./converter.svelte";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { browser } from "$app/environment";
import { error, log } from "$lib/logger";
import { addToast } from "$lib/store/ToastProvider";

export class FFmpegConverter extends Converter {
	private ffmpeg: FFmpeg = null!;
	public name = "ffmpeg";
	public ready = $state(false);

	public supportedFormats = [
		new FormatInfo("mp3", true, true),
		new FormatInfo("wav", true, true),
		new FormatInfo("flac", true, true),
		new FormatInfo("ogg", true, true),
		new FormatInfo("oga", true, true),
		new FormatInfo("opus", true, true),
		new FormatInfo("aac", true, true),
		new FormatInfo("m4a", true, true),
		new FormatInfo("wma", true, true),
		new FormatInfo("amr", true, true),
		new FormatInfo("ac3", true, true),
		new FormatInfo("alac", true, false),
		new FormatInfo("aiff", true, true),
		new FormatInfo("aif", true, true),
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
				await this.ffmpeg.load({
					coreURL: `${baseURL}/ffmpeg-core.js`,
					wasmURL: `${baseURL}/ffmpeg-core.wasm`,
				});
				this.ready = true;
			})();
		} catch (err) {
			error(["converters", this.name], `error loading ffmpeg: ${err}`);
			addToast(
				"error",
				`Error loading ffmpeg, some features may not work.`,
			);
		}
	}

	public async convert(input: VertFile, to: string): Promise<VertFile> {
		if (!to.startsWith(".")) to = `.${to}`;
		const ffmpeg = new FFmpeg();
		ffmpeg.on("progress", (progress) => {
			input.progress = progress.progress * 100;
		});
		const baseURL =
			"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
		await ffmpeg.load({
			coreURL: `${baseURL}/ffmpeg-core.js`,
			wasmURL: `${baseURL}/ffmpeg-core.wasm`,
		});
		const buf = new Uint8Array(await input.file.arrayBuffer());
		await ffmpeg.writeFile("input", buf);
		log(
			["converters", this.name],
			`wrote ${input.name} to ffmpeg virtual fs`,
		);
		await ffmpeg.exec(["-i", "input", "output" + to]);
		log(["converters", this.name], `executed ffmpeg command`);
		const output = (await ffmpeg.readFile(
			"output" + to,
		)) as unknown as Uint8Array;
		log(
			["converters", this.name],
			`read ${input.name.split(".").slice(0, -1).join(".") + to} from ffmpeg virtual fs`,
		);
		ffmpeg.terminate();
		return new VertFile(new File([output], input.name), to);
	}
}
