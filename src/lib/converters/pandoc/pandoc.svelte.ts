import { m } from "#lib/paraglide/messages";
import { VertFile, type WorkerMessage } from "#lib/types";
import { ToastManager } from "#lib/util/toast.svelte";
import PandocWorker from "#lib/workers/pandoc?worker&url";
import { browser } from "$app/env";
import pandocWasm from "pandoc-wasm/wasm?url";
import { Converter, FormatInfo, formatDuration } from "../converter.svelte";

export class PandocConverter extends Converter {
	public name = "pandoc";
	public ready = $state(false);
	public wasm: ArrayBuffer = null!;

	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	private activeConversions = new Map<string, Worker>();
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	private workerCancellation = new Map<Worker, AbortController>();

	constructor() {
		super();
		if (!browser) return;
		this.log(`created converter`);
	}

	protected async download(): Promise<void> {
		if (!browser) return;
		try {
			this.wasm = await fetch(pandocWasm).then((r) => r.arrayBuffer());

			this.status = "ready";
			return Promise.resolve();
		} catch (err) {
			this.error(`Failed to load Pandoc WASM: ${err}`);
			ToastManager.add({
				type: "error",
				message: m["workers.errors.pandoc"](),
			});
			throw err;
		}
	}

	public async convert(file: VertFile, to: string): Promise<VertFile> {
		await this.init();

		this.throwIfCancelled(file);

		this.trackConversion(file);
		this.log(`converting ${file.name} (${file.id}) to ${to}`);
		const startedAt = performance.now();
		const worker = new Worker(PandocWorker, {
			type: "module",
		});

		this.activeConversions.set(file.id, worker);
		const cancellation = new AbortController();
		this.workerCancellation.set(worker, cancellation);

		try {
			const loadMsg: WorkerMessage = {
				type: "load",
				wasm: this.wasm,
				id: file.id,
			};
			worker.postMessage(loadMsg);
			await waitForMessage(worker, cancellation.signal, "loaded");
			cancellation.signal.throwIfAborted();
			const convertMsg: WorkerMessage = {
				type: "convert",
				to,
				input: {
					file: file.file,
					name: file.name,
					from: file.from,
					to,
				},
				id: file.id,
				conversionSettings: "", // no settings for pandoc yet
			};
			worker.postMessage(convertMsg);
			const result = await waitForMessage(worker, cancellation.signal);
			if (result.type === "error") {
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
			this.log(
				`converted ${file.name} (${file.id}) to ${to} in ${formatDuration(performance.now() - startedAt)}`,
			);
			return new VertFile(
				new File([result.output], file.name),
				result.zip ? ".zip" : to,
			);
		} finally {
			cancellation.abort();
			this.workerCancellation.delete(worker);
			this.clearTrackedConversion(file);
			this.clearCancel(file);
			this.activeConversions.delete(file.id);
			worker.terminate();
		}
	}

	public async cancel(input: VertFile): Promise<void> {
		await super.cancel(input);

		const worker = this.activeConversions.get(input.id);
		if (!worker) return;

		this.workerCancellation.get(worker)?.abort();
		worker.terminate();
		this.activeConversions.delete(input.id);
	}

	public supportedFormats = [
		new FormatInfo("docx", true, true),
		//new FormatInfo("doc", true, true), pandoc doesn't actually support old doc (https://github.com/jgm/pandoc/issues/5809)
		new FormatInfo("md", true, true),
		new FormatInfo("html", true, true),
		new FormatInfo("rtf", true, false),
		new FormatInfo("csv", true, false),
		new FormatInfo("tsv", true, false),
		new FormatInfo("json", true, true), // must be a pandoc-converted json
		new FormatInfo("rst", true, true),
		new FormatInfo("epub", true, true),
		new FormatInfo("odt", true, true),
		new FormatInfo("docbook", true, true),
		new FormatInfo("ipynb", true, true),
		new FormatInfo("typ", true, true),
		new FormatInfo("opml", true, true),
		new FormatInfo("org", true, true),
		new FormatInfo("fb2", true, true),
		new FormatInfo("tex", true, true),
		new FormatInfo("man", true, true),
		new FormatInfo("jats", true, true),
		new FormatInfo("adoc", false, true),
	];
}

function waitForMessage(
	worker: Worker,
	signal: AbortSignal,
	type?: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			worker.removeEventListener("message", onMessage);
			worker.removeEventListener("error", onError);
			signal.removeEventListener("abort", onAbort);
		};
		const onAbort = () => {
			cleanup();
			reject(signal.reason);
		};
		const onMessage = (e: MessageEvent) => {
			if (type && e.data.type !== type && e.data.type !== "error") return;
			cleanup();
			resolve(e.data);
		};
		const onError = (e: ErrorEvent) => {
			cleanup();
			reject(new Error(`Worker error: ${e.message}`));
		};
		if (signal.aborted) {
			onAbort();
			return;
		}
		signal.addEventListener("abort", onAbort);
		worker.addEventListener("message", onMessage);
		worker.addEventListener("error", onError);
	});
}
