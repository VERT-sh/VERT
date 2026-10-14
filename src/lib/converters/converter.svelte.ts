/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { VertFile } from "#lib/types";
import type {
	ConversionSettings,
	NormalizedSettings,
	SettingCategories,
} from "#lib/types/conversion-settings";
import { error, log } from "#lib/util/logger.svelte";

export type WorkerStatus =
	| "idle" // not initialized yet (nothing downloaded)
	| "downloading" // fetching the converter's assets (wasm/js)
	| "initializing" // initialize converter after downloading
	| "ready"
	| "partially-ready"
	| "error"; // actual failure during initialization

// human-readable conversion duration, e.g. "450ms" / "1.23s" / "1m 5.4s"
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	const seconds = ms / 1000;
	if (seconds < 60) return `${seconds.toFixed(2)}s`;
	const minutes = Math.floor(seconds / 60);
	const remaining = (seconds % 60).toFixed(1);
	return `${minutes}m ${remaining}s`;
}

export class FormatInfo {
	public name: string;

	constructor(
		name: string,
		public fromSupported = true,
		public toSupported = true,
		public isNative = true,
		public priority = 1,
	) {
		this.name = name;
		if (!this.name.startsWith(".")) {
			this.name = `.${this.name}`;
		}

		if (!this.fromSupported && !this.toSupported) {
			throw new Error("Format must support at least one direction");
		}
	}
}

/**
 * Base class for all converters.
 */
export class Converter {
	/**
	 * The public name of the converter.
	 */
	public name: string = "Unknown";
	/**
	 * List of supported formats.
	 */
	public supportedFormats: FormatInfo[] = [];

	public status: WorkerStatus = $state("idle");
	public readonly reportsProgress: boolean = false;

	private timeoutId?: ReturnType<typeof setTimeout>;
	private activeInput?: VertFile;
	private initPromise: Promise<void> | null = null;

	protected log: (...msg: unknown[]) => void = (...msg) =>
		log(["converters", this.name], ...msg);
	protected error: (...msg: unknown[]) => void = (...msg) =>
		error(["converters", this.name], ...msg);

	constructor(public readonly timeout: number = 10) {}

	/**
	 * Downloads any assets (WASM/JS) the converter needs.
	 */
	protected async download(): Promise<void> {}

	/**
	 * Initializes the converter after downloading its assets.
	 */
	protected async setup(): Promise<void> {}

	public init(): Promise<void> {
		// allow a another attempt if the previous one failed
		if (this.status === "error") this.initPromise = null;
		return (this.initPromise ??= this.runInit());
	}

	private async runInit(): Promise<void> {
		if (this.status === "ready" || this.status === "partially-ready")
			return;

		const hasDownload = this.download !== Converter.prototype.download;
		const hasSetup = this.setup !== Converter.prototype.setup;

		// nothing to do unless a subclass implements one of the hooks
		if (!hasDownload && !hasSetup) {
			this.status = "ready";
			return;
		}

		this.log(`initializing (was ${this.status})`);
		this.startTimeout();
		try {
			if (hasDownload) {
				this.status = "downloading";
				await this.download();
			}
			if (hasSetup) {
				this.status = "initializing";
				await this.setup();
			}

			this.log(`initialization complete (was ${this.status})`);

			// if the hooks didn't set a terminal status, assume it succeeded
			if (this.status === "downloading" || this.status === "initializing")
				this.status = "ready";
		} catch (err) {
			this.error(`initialization failed: ${err}`);
			this.status = "error";
		} finally {
			this.clearTimeout();
		}
	}

	/**
	 * Get available settings for this converter.
	 * Can be overridden per converter for format-specific settings.
	 * @param input The input file.
	 */
	public async getAvailableSettings(
		input?: VertFile,
	): Promise<SettingCategories> {
		return {};
	}

	/**
	 * Get default settings for a conversion.
	 * @param input The input file.
	 */
	public async getDefaultSettings(
		input?: VertFile,
	): Promise<ConversionSettings> {
		const defaults: ConversionSettings = {};
		const categories = await this.getAvailableSettings(input);
		Object.values(categories)
			.flat()
			.forEach((setting) => {
				defaults[setting.key] = setting.default;
			});
		return defaults;
	}

	public async normalizeSettings(
		input: VertFile,
		to: string,
		settings: ConversionSettings,
	): Promise<NormalizedSettings> {
		return {
			settings: { ...settings },
			changes: [],
		};
	}

	private startTimeout() {
		this.clearTimeout();
		this.timeoutId = setTimeout(() => {
			if (this.status !== "downloading" && this.status !== "initializing")
				return;
			this.log(`initialization is taking longer than ${this.timeout}s`);
		}, this.timeout * 1000);
	}

	protected trackConversion(input: VertFile) {
		this.activeInput = input;
	}

	protected clearTrackedConversion(input: VertFile) {
		if (this.activeInput?.id === input.id) this.activeInput = undefined;
	}

	protected clearTimeout() {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = undefined;
		}
	}

	/**
	 * Convert a file to a different format.
	 * @param input The input file.
	 * @param to The format to convert to. Includes the dot.
	 */
	public async convert(
		input: VertFile,
		to: string,
		settings: ConversionSettings,
		...args: any[]
	): Promise<VertFile> {
		throw new Error("Not implemented");
	}

	/**
	 * Cancel the active conversion of a file.
	 * @param input The input file.
	 */
	public async cancel(input: VertFile): Promise<void> {
		throw new Error("Not implemented");
	}

	public async valid(): Promise<boolean> {
		return true;
	}

	/**
	 * This is to indicate whether the converter is usable at all.
	 * It will be true if its still downloading / initializing - it shouldn't block the user from starting a conversion
	 * unless it does actually fail to initialize
	 */
	public isAvailable(): boolean {
		return this.status !== "error";
	}

	/**
	 * Whether this converter is initialized and usable right now
	 */
	public isReady(): boolean {
		return this.status === "ready" || this.status === "partially-ready";
	}

	/**
	 * Optional human-readable label for the concrete engine build in use
	 * (e.g. "64-bit"). Returns null for converters without selectable variants.
	 */
	public getVariantLabel(): string | null {
		return null;
	}

	/**
	 * Optional list of selectable engine variants for this converter, shown in
	 * the per-file converter picker. Returns null when the converter has none.
	 */
	public getVariantOptions(): { value: string; label: string }[] | null {
		return null;
	}

	/**
	 * The currently selected variant value (matches a `getVariantOptions` value),
	 * or null when the converter has no variants.
	 */
	public getVariantValue(): string | null {
		return null;
	}

	/**
	 * Apply a variant selection made in the picker.
	 */
	public setVariant(_value: string): void {}

	public formatStrings(predicate?: (f: FormatInfo) => boolean) {
		if (predicate) {
			return this.supportedFormats.filter(predicate).map((f) => f.name);
		}
		return this.supportedFormats.map((f) => f.name);
	}
}
