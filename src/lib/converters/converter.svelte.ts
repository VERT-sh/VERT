import type { VertFile } from "$lib/types";

export type WorkerStatus = "not-ready" | "downloading" | "ready" | "error";

export class FormatInfo {
	public name: string;

	constructor(
		name: string,
		public fromSupported = true,
		public toSupported = true,
		public isNative = true,
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

	private timeoutId?: NodeJS.Timeout;

	constructor(public readonly timeout: number = 10) {
		this.startTimeout();
	}

	private startTimeout() {
		this.timeoutId = setTimeout(() => {
			if (this.status !== "ready") this.status = "not-ready";
		}, this.timeout * 1000);
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
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		input: VertFile,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		to: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
		...args: any[]
	): Promise<VertFile> {
		throw new Error("Not implemented");
	}

	/**
	 * Cancel the active conversion of a file.
	 * @param input The input file.
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public async cancel(input: VertFile): Promise<void> {
		throw new Error("Not implemented");
	}

	public async valid(): Promise<boolean> {
		return true;
	}

	public formatStrings(predicate?: (f: FormatInfo) => boolean) {
		if (predicate) {
			return this.supportedFormats.filter(predicate).map((f) => f.name);
		}
		return this.supportedFormats.map((f) => f.name);
	}
}

export interface ChainStep {
	converter: Converter;
	to: string; // intermediate format (last step uses the final target)
}

export class ChainedConverter extends Converter {
	public override name: string;
	private steps: ChainStep[];

	constructor(steps: ChainStep[]) {
		super(0);
		if (steps.length < 2) throw new Error("Chain requires at least 2 steps");
		this.steps = steps;
		this.name = steps.map((s) => s.converter.name).join("+");
		this.clearTimeout();
		this.status = this.deriveStatus();
		this.supportedFormats = [
			...steps[0].converter.supportedFormats.filter((f) => f.fromSupported),
			...steps[steps.length - 1].converter.supportedFormats.filter((f) => f.toSupported),
		];
	}

	private deriveStatus(): WorkerStatus {
		const statuses = this.steps.map((s) => s.converter.status);
		if (statuses.some((s) => s === "error")) return "error";
		if (statuses.every((s) => s === "ready")) return "ready";
		if (statuses.some((s) => s === "downloading")) return "downloading";
		return "not-ready";
	}

	public override async convert(input: VertFile, to: string): Promise<VertFile> {
		this.status = this.deriveStatus();
		const { VertFile: VF } = await import("$lib/types");
		let current: VertFile = input;

		for (let i = 0; i < this.steps.length; i++) {
			const { converter, to: stepTo } = this.steps[i];
			const isLast = i === this.steps.length - 1;
			const target = isLast ? to : stepTo;
			const result = await converter.convert(current, target);
			if (!isLast) {
				current = new VF(
					new File([await result.file.arrayBuffer()], input.name.replace(/\.[^/.]+$/, target)),
					target,
				);
			} else {
				current = result;
			}
		}

		return current;
	}

	public override async cancel(input: VertFile): Promise<void> {
		await Promise.allSettled(this.steps.map((s) => s.converter.cancel(input)));
	}
}
