/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { VertFile } from "$lib/types";
import type {
	ConversionSettings,
	NormalizedSettings,
	SettingCategories,
} from "$lib/types/conversion-settings";

export type WorkerStatus =
	"not-ready" | "downloading" | "ready" | "partially-ready" | "error";

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

	public status: WorkerStatus = $state("not-ready");
	public readonly reportsProgress: boolean = false;

	private timeoutId?: ReturnType<typeof setTimeout>;
	private activeInput?: VertFile;

	constructor(public readonly timeout: number = 10) {
		this.startTimeout();
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
		this.timeoutId = setTimeout(() => {
			if (this.status === "ready") return;
			this.status = "not-ready";
			if (this.activeInput) void this.cancel(this.activeInput);
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

	public isReady(): boolean {
		return this.status === "ready" || this.status === "partially-ready";
	}

	public formatStrings(predicate?: (f: FormatInfo) => boolean) {
		if (predicate) {
			return this.supportedFormats.filter(predicate).map((f) => f.name);
		}
		return this.supportedFormats.map((f) => f.name);
	}
}
