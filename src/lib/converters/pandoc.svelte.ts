import { VertFile, type WorkerMessage } from "$lib/types";
import { Converter, FormatInfo } from "./converter.svelte";
import { browser } from "$app/environment";
import PandocWorker from "$lib/workers/pandoc?worker&url";
import { error, log } from "$lib/logger";
import { ToastManager } from "$lib/toast/index.svelte";
import { m } from "$lib/paraglide/messages";

export class PandocConverter extends Converter {
	public name = "pandoc";
	public ready = $state(false);
	public wasm: ArrayBuffer = null!;

	private activeConversions = new Map<string, Worker>();

	constructor() {
		super();
		if (!browser) return;
		(async () => {
			try {
				this.status = "downloading";
				this.wasm = await fetch("/pandoc.wasm").then((r) =>
					r.arrayBuffer(),
				);

				this.status = "ready";
			} catch (err) {
				this.status = "error";
				ToastManager.add({
					type: "error",
					message: `Failed to load Pandoc worker: ${err}`, // TODO: i18n
				});
			}
		})();
	}

	public async convert(file: VertFile, to: string): Promise<VertFile> {
		const worker = new Worker(PandocWorker, {
			type: "module",
		});

		this.activeConversions.set(file.id, worker);

		const loadMsg: WorkerMessage = {
			type: "load",
			wasm: this.wasm,
			id: file.id,
		};
		worker.postMessage(loadMsg);
		await waitForMessage(worker, "loaded");
		const convertMsg: WorkerMessage = {
			type: "convert",
			to,
			input: {
				file: file.file,
				name: file.name,
				from: file.from,
				to,
			},
			compression: null,
			id: file.id,
		};
		worker.postMessage(convertMsg);
		const result = await waitForMessage(worker);
		if (result.type === "error") {
			worker.terminate();
			// throw new Error(result.error);
			const error = result.error.toString();
			switch (result.errorKind) {
				case "PandocUnknownReaderError": {
					throw new Error(
						`${file.from} is not a supported input format for documents.`,
					);
				}

				case "PandocUnknownWriterError": {
					throw new Error(
						`${to} is not a supported output format for documents.`,
					);
				}

				case "PandocParseError": {
					if (error.includes("JSON missing pandoc-api-version")) {
						throw new Error(
							`This JSON file is not a pandoc-converted JSON file. It must be converted with pandoc / VERT to be converted again.`,
						);
					}
				}

				// eslint-disable-next-line no-fallthrough
				default:
					if (result.errorKind)
						throw new Error(
							`[${result.errorKind}] ${result.error}`,
						);
					else throw new Error(result.error);
			}
		}

		if (!to.startsWith(".")) to = `.${to}`;
		this.activeConversions.delete(file.id);
		worker.terminate();
		return new VertFile(
			new File([result.output], file.name),
			result.isZip ? ".zip" : to,
		);
	}

	public async cancel(input: VertFile): Promise<void> {
		const worker = this.activeConversions.get(input.id);
		if (!worker) {
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

		worker.terminate();
		this.activeConversions.delete(input.id);
	}

	public supportedFormats = [
		new FormatInfo("docx", true, true),
		new FormatInfo("doc", true, true),
		new FormatInfo("md", true, true),
		new FormatInfo("html", true, true),
		new FormatInfo("rtf", true, true),
		new FormatInfo("csv", true, true),
		new FormatInfo("tsv", true, true),
		new FormatInfo("json", true, true), // must be a pandoc-converted json
		new FormatInfo("rst", true, true),
		new FormatInfo("epub", true, true),
		new FormatInfo("odt", true, true),
		new FormatInfo("docbook", true, true),
	];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function waitForMessage(worker: Worker, type?: string): Promise<any> {
	return new Promise((resolve) => {
		const onMessage = (e: MessageEvent) => {
			if (type && e.data.type === type) {
				worker.removeEventListener("message", onMessage);
				resolve(e.data);
			} else {
				worker.removeEventListener("message", onMessage);
				resolve(e.data);
			}
		};
		worker.addEventListener("message", onMessage);
	});
}
