import { VertFile } from "$lib/types";
import { Converter, FormatInfo } from "./converter.svelte";
import { browser } from "$app/environment";
import MuPDFWorker from "$lib/workers/mupdf?worker&url";

export class MuPDFConverter extends Converter {
	public name = "mupdf";

	private activeConversions = new Map<string, Worker>();

	constructor() {
		super(60);
		if (!browser) return;
		this.status = "ready";
		this.clearTimeout();
	}

	public async convert(file: VertFile, to: string): Promise<VertFile> {
		const worker = new Worker(MuPDFWorker, { type: "module" });
		this.activeConversions.set(file.id, worker);

		worker.postMessage({ file: file.file, to, id: file.id });

		const result = await new Promise<{ type: string; output?: Uint8Array; error?: string }>(
			(resolve) => {
				worker.onmessage = (e) => resolve(e.data);
				worker.onerror = (e) => resolve({ type: "error", error: e.message });
			},
		);

		worker.terminate();
		this.activeConversions.delete(file.id);

		if (result.type === "error") throw new Error(result.error);

		if (!to.startsWith(".")) to = `.${to}`;
		return new VertFile(new File([result.output! as BlobPart], file.name), to);
	}

	public async cancel(input: VertFile): Promise<void> {
		const worker = this.activeConversions.get(input.id);
		if (worker) {
			worker.terminate();
			this.activeConversions.delete(input.id);
		}
	}

	public supportedFormats = [
		new FormatInfo("pdf", true, false),
		new FormatInfo("md", false, true),
		new FormatInfo("txt", false, true),
	];
}
