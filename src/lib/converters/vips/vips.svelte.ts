import { m } from "#lib/paraglide/messages";
import { VertFile, type WorkerMessage } from "#lib/types";
import type {
	ConversionSettings,
	SettingCategories,
	SettingDefinition,
} from "#lib/types/conversion-settings";
import { ToastManager } from "#lib/util/toast.svelte";
import VipsWorker from "#lib/workers/vips?worker&url";
import { browser } from "$app/env";
import { SvelteMap } from "svelte/reactivity";
import { Converter, formatDuration } from "../converter.svelte";
import {
	VIPS_OPAQUE_FORMATS,
	VIPS_QUALITY_FORMATS,
	vipsFormats,
} from "./formats";

export class VipsConverter extends Converter {
	public name = "libvips";
	public ready = $state(false);

	private activeConversions = new SvelteMap<string, Worker>();

	public supportedFormats = vipsFormats;

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
		const worker = new Worker(VipsWorker, { type: "module" });
		try {
			await this.waitForMessage(worker, "loaded", 60000, () => {
				worker.postMessage({ type: "load", id: "init" });
			});

			this.ready = true;
			this.status = "ready";
			this.log(`wasm-vips initialised`);
		} catch (err) {
			this.error(`failed to initialise wasm-vips: ${err}`);
			ToastManager.add({
				type: "error",
				message: m["workers.errors.vips"](),
			});
			throw err;
		} finally {
			worker.terminate();
		}
	}

	public async getAvailableSettings(
		input: VertFile,
	): Promise<SettingCategories> {
		const to = input.to.toLowerCase();
		const settings: SettingDefinition[] = [];

		if (VIPS_QUALITY_FORMATS.has(to)) {
			settings.push({
				key: "quality",
				label: m["convert.settings.image.quality.label"](),
				type: "number",
				min: 0,
				max: 100,
				placeholder: m["convert.settings.image.quality.placeholder"](),
			});
		}

		settings.push({
			key: "resolution",
			label: m["convert.settings.image.resolution.label"](),
			type: "text",
			default: "",
			placeholder: m["convert.settings.image.resolution.placeholder"](),
		});

		settings.push({
			key: "depth",
			label: m["convert.settings.image.depth.label"](),
			type: "text",
			default: "",
			placeholder: m["convert.settings.image.depth.placeholder"](),
		});

		settings.push({
			key: "colorSpace",
			label: m["convert.settings.image.color_space"](),
			type: "select",
			default: "auto",
			options: [
				{ value: "auto", label: "Auto" },
				{ value: "srgb", label: "sRGB" },
				{ value: "rgb", label: "RGB" },
				{ value: "cmyk", label: "CMYK" },
				{ value: "lab", label: "CIELAB" },
				{ value: "xyz", label: "CIEXYZ" },
				{ value: "gray", label: "Grayscale" },
			],
		});

		if (!VIPS_OPAQUE_FORMATS.has(to)) {
			settings.push({
				key: "transparency",
				label: m["convert.settings.image.transparency"](),
				type: "boolean",
				default: true,
			});
		}

		const metadata: SettingDefinition = {
			key: "metadata",
			label: m["convert.settings.common.metadata"](),
			type: "boolean",
			default: true,
		};

		return {
			Image: settings,
			General: [metadata],
		};
	}

	public async convert(
		input: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<VertFile> {
		await this.init();

		this.trackConversion(input);
		this.log(`converting ${input.name} (${input.id}) to ${to}`);
		const startedAt = performance.now();

		if (!this.isolated)
			throw new Error(
				"cross-origin isolation is required for wasm-vips (SharedArrayBuffer unavailable)",
			);

		const worker = new Worker(VipsWorker, { type: "module" });
		this.activeConversions.set(input.id, worker);

		try {
			worker.postMessage({ type: "load", id: input.id });
			await this.waitForMessage(worker, "loaded", 60000);

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

			const res = await this.waitForMessage(worker);
			if (res.type === "finished") {
				this.log(
					`converted ${input.name} (${input.id}) to ${to} in ${formatDuration(performance.now() - startedAt)}`,
				);
				return new VertFile(
					new File([res.output as unknown as BlobPart], input.name),
					res.zip ? ".zip" : to,
				);
			}

			if (res.type === "error") throw new Error(res.error);

			throw new Error("Unknown message type");
		} finally {
			this.clearTrackedConversion(input);
			this.activeConversions.delete(input.id);
			worker.terminate();
		}
	}

	public async cancel(input: VertFile): Promise<void> {
		const worker = this.activeConversions.get(input.id);
		if (!worker) {
			this.error(
				`no active conversion found for file ${input.name} (${input.id})`,
			);
			return;
		}

		this.log(`cancelling conversion for file ${input.name} (${input.id})`);

		worker.terminate();
		this.activeConversions.delete(input.id);
	}

	private waitForMessage<T = WorkerMessage>(
		worker: Worker,
		type?: string,
		timeout?: number,
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

			const cleanup = () => {
				worker.removeEventListener("message", onMessage);
				worker.removeEventListener("error", onError);
				if (timeoutId) clearTimeout(timeoutId);
			};

			const timeoutId = timeout
				? setTimeout(() => {
						cleanup();
						reject(
							new Error(`Vips worker timeout after ${timeout}ms`),
						);
					}, timeout)
				: undefined;

			worker.addEventListener("message", onMessage);
			worker.addEventListener("error", onError);

			post?.();
		});
	}
}
