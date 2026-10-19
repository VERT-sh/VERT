import { m } from "#lib/paraglide/messages";
import type { VertFile } from "#lib/types";
import { ToastManager } from "#lib/util/toast.svelte";
import { browser } from "$app/env";
import ffmpegMtWasmURL from "@ffmpeg/core-mt/wasm?url";
import ffmpegMtWorkerRaw from "@ffmpeg/core-mt/worker?raw";
import ffmpegMtCoreURL from "@ffmpeg/core-mt?url";
import ffmpegWasmURL from "@ffmpeg/core/wasm?url";
import ffmpegCoreURL from "@ffmpeg/core?url";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { SvelteMap } from "svelte/reactivity";
import { Converter } from "../converter.svelte";
import { EngineVariants, type FFmpegVariant } from "../engine-variants.svelte";

const coreURL = new URL(ffmpegCoreURL, import.meta.url).href;
const wasmURL = new URL(ffmpegWasmURL, import.meta.url).href;
const mtCoreURL = new URL(ffmpegMtCoreURL, import.meta.url).href;
const mtWasmURL = new URL(ffmpegMtWasmURL, import.meta.url).href;

// The pthread worker ffmpeg-core-mt spawns is a *classic* worker, but the ESM
// worker file only runs as a module and Vite injects an import into it in dev,
// so serve it as a blob of the raw source instead (works in dev and prod).
// ..whatever the ai said above. i didn't know how to fix this but it works so uuuuh, sorry -maya
let mtWorkerURL: string | undefined;
const getMtWorkerURL = (): string =>
	(mtWorkerURL ??= URL.createObjectURL(
		new Blob([ffmpegMtWorkerRaw], { type: "text/javascript" }),
	));

export abstract class BaseFFmpegConverter extends Converter {
	public abstract name: string;
	public reportsProgress = true;

	protected loadedVariant: "mt" | "st" | null = null;
	protected requestedVariant: "mt" | "st" | null = null;

	protected activeConversions = new SvelteMap<string, FFmpeg>();

	private cancelLoad = new SvelteMap<string, () => void>();

	public getVariantLabel(): string | null {
		const variant = EngineVariants.instance.ffmpegActive;
		return variant === "mt"
			? m["convert.settings.engines.ffmpeg_mt"]()
			: m["convert.settings.engines.ffmpeg_st"]();
	}

	public getVariantOptions() {
		return [
			{ value: "auto", label: m["convert.settings.engines.auto"]() },
			{
				value: "mt",
				label: m["convert.settings.engines.ffmpeg_mt"](),
			},
			{
				value: "st",
				label: m["convert.settings.engines.ffmpeg_st"](),
			},
		];
	}

	public getVariantValue(): string {
		return EngineVariants.instance.ffmpeg;
	}

	public setVariant(value: string): void {
		EngineVariants.instance.setFfmpeg(value as FFmpegVariant);
	}

	protected async download(): Promise<void> {
		// this is just to cache the wasm and js for when we actually use it. we're not using this ffmpeg instance
		if (!browser) return;
		this.resolveThreads();

		try {
			await this.probeCore();
			this.status = "ready";
			return Promise.resolve();
		} catch (err) {
			if (this.loadedVariant === "mt") {
				this.log(
					`multi-threaded ffmpeg core failed to load, falling back to single-threaded: ${err}`,
				);
				ToastManager.add({
					type: "info",
					message: m["workers.info.ffmpeg_mt_unavailable"](),
				});
				this.loadedVariant = "st";
				try {
					await this.probeCore();
					this.status = "ready";
					return Promise.resolve();
				} catch (fallbackErr) {
					this.error(
						`single-threaded ffmpeg core failed too: ${fallbackErr}`,
					);
				}
			}

			ToastManager.add({
				type: "error",
				message: m["workers.errors.ffmpeg"](),
			});
			throw err;
		}
	}

	// load (and immediately discard) a worker to validate and/or cache
	protected async probeCore(): Promise<void> {
		const ffmpeg = new FFmpeg();
		try {
			await ffmpeg.load(this.loadConfig());
		} finally {
			ffmpeg.terminate();
		}
	}

	/**
	 * Ensure the core is loaded and matches the currently selected engine
	 * variant, re-downloading if the user switched variants since last time.
	 */
	protected async ensureCore(): Promise<void> {
		await this.init();
		if (EngineVariants.instance.ffmpegActive !== this.requestedVariant)
			await this.download();
	}

	protected async setupFFmpeg(input: VertFile): Promise<FFmpeg> {
		const ffmpeg = new FFmpeg();

		ffmpeg.on("progress", (progress) => {
			input.progress = progress.progress * 100;
		});

		this.activeConversions.set(input.id, ffmpeg);

		let abortLoad!: () => void;
		const aborted = new Promise<never>((_, reject) => {
			abortLoad = () => reject(new Error("Conversion cancelled"));
		});
		this.cancelLoad.set(input.id, abortLoad);

		try {
			await Promise.race([ffmpeg.load(this.loadConfig()), aborted]);
			if (this.isCancelled(input))
				throw new Error("Conversion cancelled");
		} catch (err) {
			// don't leave a half-loaded instance registered
			if (this.activeConversions.get(input.id) === ffmpeg) {
				// we throw before the caller's try/finally, so clear the marker here
				this.activeConversions.delete(input.id);
			}
			this.clearCancel(input);
			ffmpeg.terminate();
			throw err;
		} finally {
			this.cancelLoad.delete(input.id);
		}

		return ffmpeg;
	}

	public async cancel(input: VertFile): Promise<void> {
		await super.cancel(input);

		this.cancelLoad.get(input.id)?.();

		const ffmpeg = this.activeConversions.get(input.id);
		if (!ffmpeg) return;

		ffmpeg.terminate();
		this.activeConversions.delete(input.id);
	}

	protected resolveThreads(): void {
		const variants = EngineVariants.instance;

		if (variants.ffmpeg === "mt" && !variants.ffmpegMtSupported) {
			this.log(
				"multi-threaded ffmpeg requested but the page is not cross-origin isolated, using single-threaded",
			);
			ToastManager.add({
				type: "info",
				message: m["workers.info.ffmpeg_mt_unavailable"](),
			});
		}

		this.loadedVariant = variants.ffmpegActive;
		this.requestedVariant = this.loadedVariant;
		this.log(`using ${this.loadedVariant} ffmpeg core`);
	}

	protected loadConfig() {
		return this.loadedVariant === "mt"
			? {
					coreURL: mtCoreURL,
					wasmURL: mtWasmURL,
					workerURL: getMtWorkerURL(),
				}
			: { coreURL, wasmURL };
	}
}
