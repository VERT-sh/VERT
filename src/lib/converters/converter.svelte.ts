import type { VertFile } from "$lib/types";

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
	public supportedFormats: string[] = [];
	/**
	 * Convert a file to a different format.
	 * @param input The input file.
	 * @param to The format to convert to. Includes the dot.
	 */
	public ready: boolean = $state(false);
	public readonly reportsProgress: boolean = false;

	public async convert(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		input: VertFile,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		to: string,
	): Promise<VertFile> {
		throw new Error("Not implemented");
	}

	public async valid(): Promise<boolean> {
		return true;
	}
}
