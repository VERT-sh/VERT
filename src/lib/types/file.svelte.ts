import type { Converter } from "$lib/converters/converter.svelte";
import { addToast } from "$lib/store/ToastProvider";

export class VertFile {
	public id: string = Math.random().toString(36).slice(2, 8);

	public get from() {
		return "." + this.file.name.split(".").pop()!;
	}

	public get name() {
		return this.file.name;
	}

	public progress = $state(0);
	public result = $state<VertFile | null>(null);

	public to = $state("");

	public blobUrl = $state<string>();

	public processing = $state(false);

	public converter: Converter | null = null;

	constructor(
		public readonly file: File,
		to: string,
		converter?: Converter | null,
		blobUrl?: string,
	) {
		this.to = to;
		this.converter = converter ?? null;
		this.convert = this.convert.bind(this);
		this.download = this.download.bind(this);
		this.blobUrl = blobUrl;
	}

	public async convert() {
		if (!this.converter) throw new Error("No converter found");
		this.result = null;
		this.progress = 0;
		this.processing = true;
		let res;
		try {
			res = await this.converter.convert(this, this.to);
			this.result = res;
		} catch (err) {
			console.error(err);
			addToast("error", `Error converting file: ${this.file.name}`);
			this.result = null;
		}
		this.processing = false;
		return res;
	}

	public async download() {
		if (!this.result) throw new Error("No result found");

		const settings = JSON.parse(localStorage.getItem("settings") ?? "{}");
		const filenameFormat = settings.filenameFormat ?? "VERT_%name%";

		const format = (name: string) => {
			const date = new Date().toISOString();
			const baseName = this.file.name.replace(/\.[^/.]+$/, "");
			const originalExtension = this.file.name.split(".").pop()!;
			return name
				.replace(/%date%/g, date)
				.replace(/%name%/g, baseName)
				.replace(/%extension%/g, originalExtension);
		};

		const blob = URL.createObjectURL(
			new Blob([await this.result.file.arrayBuffer()], {
				type: this.to.slice(1),
			}),
		);
		const a = document.createElement("a");
		a.href = blob;
		a.download = `${format(filenameFormat)}${this.to}`;
		// force it to not open in a new tab
		a.target = "_blank";
		a.style.display = "none";
		a.click();
		URL.revokeObjectURL(blob);
		a.remove();
	}
}
