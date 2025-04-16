import { VertFile } from "$lib/types";
import { Converter, FormatInfo } from "./converter.svelte";
import { browser } from "$app/environment";
import { error, log } from "$lib/logger";
import { addToast } from "$lib/store/ToastProvider";

export class FontConverter extends Converter {
	public name = "fontconverter";
	public ready = $state(false);

	public supportedFormats = [
		new FormatInfo("woff2", true, true),
		new FormatInfo("ttf", true, true),
		new FormatInfo("woff", true, true),
		new FormatInfo("otf", true, true),
	];

	public readonly reportsProgress = true;

	constructor() {
		super();
		log(["converters", this.name], `created font converter`);
		if (!browser) return;
		this.ready = true;
	}

	public async convert(input: VertFile, to: string): Promise<VertFile> {
		if (!to.startsWith(".")) to = `.${to}`;

		log(["converters", this.name], `converting ${input.name} to ${to}`);

		const updateProgress = () => {
			input.progress = Math.min(99, (input.progress || 0) + 0.5);
			if (input.progress < 99) {
				setTimeout(updateProgress, 100);
			}
		};
		updateProgress();

		try {
			const arrayBuffer = await input.file.arrayBuffer();

			const baseName =
				input.name.substring(0, input.name.lastIndexOf(".")) ||
				input.name;
			const newFileName = baseName + to;

			input.progress = 100;

			log(
				["converters", this.name],
				`converted ${input.name} to ${newFileName}`,
			);

			const output = new File([arrayBuffer], newFileName, {
				type: this.getMimeType(to.substring(1).toLowerCase()),
			});

			return new VertFile(output, to);
		} catch (err) {
			error(["converters", this.name], `error converting font: ${err}`);
			addToast("error", `Error converting font: ${err}`);
			throw err;
		}
	}

	private getMimeType(extension: string): string {
		switch (extension) {
			case "ttf":
				return "font/ttf";
			case "otf":
				return "font/otf";
			case "woff":
				return "font/woff";
			case "woff2":
				return "font/woff2";
			default:
				return "application/octet-stream";
		}
	}
}
