import { m } from "#lib/paraglide/messages";
import { VertFile, type WorkerMessage } from "#lib/types";
import type {
	ConversionSettings,
	SettingCategories,
	SettingDefinition,
} from "#lib/types/conversion-settings";
import { ToastManager } from "#lib/util/toast.svelte";
import VectorizerWorker from "#lib/workers/vectorizer?worker&url";
import { browser } from "$app/env";
import { SvelteMap } from "svelte/reactivity";
import { Converter, formatDuration } from "../converter.svelte";
import { vectorizerFormats } from "./formats";

export class VectorizerConverter extends Converter {
	public name = "vectorizer";
	public ready = $state(false);

	private activeConversions = new SvelteMap<string, Worker>();

	private workerCancellation = new SvelteMap<Worker, AbortController>();

	public supportedFormats = vectorizerFormats;

	public readonly reportsProgress = false;

	constructor() {
		super();
		if (!browser) return;
		this.log(`created converter`);
	}

	private get isolated(): boolean {
		return (
			typeof crossOriginIsolated !== "undefined" && crossOriginIsolated
		);
	}

	public override isAvailable(): boolean {
		if (browser && !this.isolated) return false;
		return super.isAvailable();
	}

	protected async download(): Promise<void> {
		const worker = new Worker(VectorizerWorker, { type: "module" });
		try {
			await this.waitForMessage(worker, "loaded", 60000, undefined, () => {
				worker.postMessage({ type: "load", id: "init" });
			});

			this.ready = true;
			this.status = "ready";
			this.log(`vectorizer initialised`);
		} catch (err) {
			this.error(`failed to initialise vectorizer: ${err}`);
			ToastManager.add({
				type: "error",
				message: m["workers.errors.vectorizer"](),
			});
			throw err;
		} finally {
			worker.terminate();
		}
	}

	public async getAvailableSettings(): Promise<SettingCategories> {
		const detail: SettingDefinition = {
			key: "vectorizeDetail",
			label: m["convert.settings.image.vectorize.detail"](),
			type: "select",
			default: "poster",
			options: [
				{
					value: "bw",
					label: m["convert.settings.image.vectorize.detail_bw"](),
				},
				{
					value: "poster",
					label: m[
						"convert.settings.image.vectorize.detail_poster"
					](),
				},
				{
					value: "photo",
					label: m["convert.settings.image.vectorize.detail_photo"](),
				},
			],
		};

		const optimize: SettingDefinition = {
			key: "vectorizeOptimize",
			label: m["convert.settings.image.vectorize.optimize"](),
			type: "boolean",
			default: true,
		};

		return {
			Image: [detail, optimize],
		};
	}

	public async convert(
		input: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<VertFile> {
		await this.init();

		this.throwIfCancelled(input);

		this.trackConversion(input);
		this.log(`converting ${input.name} (${input.id}) to ${to}`);
		const startedAt = performance.now();

		if (!this.isolated)
			throw new Error(
				"cross-origin isolation is required for the vectorizer (SharedArrayBuffer unavailable)",
			);

		const worker = new Worker(VectorizerWorker, { type: "module" });
		this.activeConversions.set(input.id, worker);
		const cancellation = new AbortController();
		this.workerCancellation.set(worker, cancellation);

		try {
			worker.postMessage({ type: "load", id: input.id });
			await this.waitForMessage(
				worker,
				"loaded",
				60000,
				cancellation.signal,
			);

			const convertMsg: WorkerMessage = {
				type: "convert",
				id: input.id,
				input: {
					file: input.file,
					name: input.name,
					from: input.from,
					to: input.to,
				},
				to,
				conversionSettings: JSON.stringify(settings ?? {}),
			};
			worker.postMessage(convertMsg);

			const res = await this.waitForMessage(
				worker,
				undefined,
				0,
				cancellation.signal,
			);
			if (res.type === "finished") {
				this.log(
					`converted ${input.name} (${input.id}) to ${to} in ${formatDuration(performance.now() - startedAt)}`,
				);
				return new VertFile(
					new File([res.output as unknown as BlobPart], input.name),
					to,
				);
			}

			if (res.type === "error") throw new Error(res.error);

			throw new Error("Unknown message type");
		} finally {
			cancellation.abort();
			this.workerCancellation.delete(worker);
			this.clearTrackedConversion(input);
			this.clearCancel(input);
			this.activeConversions.delete(input.id);
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

	private waitForMessage<T = WorkerMessage>(
		worker: Worker,
		type?: string,
		timeout?: number,
		signal?: AbortSignal,
		post?: () => void,
	): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const onMessage = (e: MessageEvent<WorkerMessage>) => {
				if (type && e.data.type === type) {
					cleanup();
					resolve(e.data as T);
				} else if (!type) {
					cleanup();
					resolve(e.data as T);
				} else if (e.data.type === "error") {
					cleanup();
					reject(new Error(e.data.error));
				}
			};

			const onError = (e: ErrorEvent) => {
				cleanup();
				reject(new Error(`Worker error: ${e.message}`));
			};

			const onAbort = () => {
				cleanup();
				reject(new Error("Conversion cancelled"));
			};

			const cleanup = () => {
				worker.removeEventListener("message", onMessage);
				worker.removeEventListener("error", onError);
				signal?.removeEventListener("abort", onAbort);
				if (timeoutId) clearTimeout(timeoutId);
			};

			const timeoutId = timeout
				? setTimeout(() => {
						cleanup();
						reject(
							new Error(
								`Vectorizer worker timeout after ${timeout}ms`,
							),
						);
					}, timeout)
				: undefined;

			if (signal?.aborted) return onAbort();

			worker.addEventListener("message", onMessage);
			worker.addEventListener("error", onError);
			signal?.addEventListener("abort", onAbort);

			post?.();
		});
	}
}
