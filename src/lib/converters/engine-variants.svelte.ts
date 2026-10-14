import { error } from "#lib/util/logger.svelte";
import { browser } from "$app/env";

export type MagickVariant = "auto" | "x64" | "x86";
export type FFmpegVariant = "auto" | "mt" | "st";

const STORAGE_KEY = "engineVariants";

interface PersistedVariants {
	magick: MagickVariant;
	ffmpeg: FFmpegVariant;
	magickX64Supported: boolean | null;
}

export class EngineVariants {
	public static instance = new EngineVariants();

	public magick = $state<MagickVariant>("auto");
	public ffmpeg = $state<FFmpegVariant>("auto");

	public magickX64Supported = $state<boolean | null>(null);

	private resolving: Promise<void> | null = null;

	constructor() {
		if (browser) this.load();
	}

	// the concrete magick build to use
	public get magickActive(): "x64" | "x86" {
		if (this.magick !== "auto") return this.magick;
		return this.magickX64Supported === true ? "x64" : "x86";
	}

	// multi-threaded ffmpeg needs cross-origin isolation (SharedArrayBuffer)
	public get ffmpegMtSupported(): boolean {
		return (
			typeof crossOriginIsolated !== "undefined" && crossOriginIsolated
		);
	}

	// the concrete ffmpeg core to use
	public get ffmpegActive(): "mt" | "st" {
		if (this.ffmpeg !== "auto") return this.ffmpeg;
		return this.ffmpegMtSupported ? "mt" : "st";
	}

	public setMagick(variant: MagickVariant): void {
		this.magick = variant;
		this.save();
	}

	public setFfmpeg(variant: FFmpegVariant): void {
		this.ffmpeg = variant;
		this.save();
	}

	public resolve(): Promise<void> {
		if (this.magickX64Supported !== null) return Promise.resolve();

		this.resolving ??= (async () => {
			try {
				const { memory64 } = await import("wasm-feature-detect");
				this.magickX64Supported = await memory64();
			} catch (err) {
				error(
					["converters", "engines"],
					`memory64 detection failed, assuming unsupported: ${err}`,
				);
				this.magickX64Supported = false;
			}
			this.save();
		})();

		return this.resolving;
	}

	private load(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;

			const parsed = JSON.parse(raw) as Partial<PersistedVariants>;
			if (parsed.magick) this.magick = parsed.magick;
			if (parsed.ffmpeg) this.ffmpeg = parsed.ffmpeg;
			if (typeof parsed.magickX64Supported === "boolean")
				this.magickX64Supported = parsed.magickX64Supported;
		} catch (err) {
			error(
				["converters", "engines"],
				`failed to load engine variants: ${err}`,
			);
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	private save(): void {
		try {
			const data: PersistedVariants = {
				magick: this.magick,
				ffmpeg: this.ffmpeg,
				magickX64Supported: this.magickX64Supported,
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch (err) {
			error(
				["converters", "engines"],
				`failed to save engine variants: ${err}`,
			);
		}
	}
}
