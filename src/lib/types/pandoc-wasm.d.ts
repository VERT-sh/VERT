declare module "pandoc-wasm/core" {
	export interface PandocConvertOptions {
		from?: string;
		to?: string;
		"input-files"?: string[];
		"output-file"?: string;
		"extract-media"?: string;
		[key: string]: unknown;
	}

	export interface PandocConvertResult {
		stdout: string;
		stderr: string;
		warnings: unknown[];
		files: Record<string, Blob>;
		mediaFiles: Record<string, Blob>;
	}

	export type PandocConvert = (
		options: PandocConvertOptions,
		stdin: string | null,
		files: Record<string, string | Blob>,
	) => Promise<PandocConvertResult>;

	export type PandocQuery = (options: {
		query: string;
		format?: string;
	}) => Promise<unknown>;

	export interface PandocInstance {
		convert: PandocConvert;
		query: PandocQuery;
	}

	export function createPandocInstance(
		wasmBinary: BufferSource,
	): Promise<PandocInstance>;
}
