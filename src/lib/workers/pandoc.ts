import type { WorkerMessage } from "#lib/types";
import { formatError } from "#lib/util/error";
import { makeZip } from "client-zip";
import type { PandocInstance } from "pandoc-wasm/core";
import { createPandocInstance } from "pandoc-wasm/core";

type Format =
	| ".md"
	| ".docx"
	| ".csv"
	| ".tsv"
	| ".json"
	| ".doc"
	| ".rtf"
	| ".rst"
	| ".epub"
	| ".odt"
	| ".docbook"
	| ".html"
	| ".markdown"
	| ".ipynb"
	| ".typ"
	| ".opml"
	| ".org"
	| ".fb2"
	| ".tex"
	| ".man"
	| ".jats"
	| ".adoc";

let wasm: ArrayBuffer = null!;
let pandocPromise: Promise<PandocInstance> | null = null;

const ensurePandoc = (): Promise<PandocInstance> =>
	(pandocPromise ??= createPandocInstance(wasm).catch((err) => {
		pandocPromise = null;
		throw err;
	}));

const handleMessage = async (
	message: WorkerMessage,
): Promise<Partial<WorkerMessage>> => {
	switch (message.type) {
		case "load": {
			wasm = message.wasm;
			await ensurePandoc();
			return { type: "loaded" };
		}

		case "convert": {
			const instance = await ensurePandoc();
			const { to: ext, input } = message;
			const file = input.file as File;
			const to = ext as Format;
			const from = `.${file.name.split(".").pop() || ""}` as Format;
			const out = ext.startsWith(".") ? ext : `.${ext}`;
			const baseName = input.name.replace(/\.[^.]+$/, "");
			const outName = `${baseName}${out}`;

			const options = {
				from: formatToReader(from),
				to: formatToReader(to),
				"input-files": [file.name],
				"output-file": outName,
				"extract-media": ".",
			};
			const result = await instance.convert(options, null, {
				[file.name]: file,
			});
			const outputFile = result.files[options["output-file"]];

			if (result.stderr.trim()) return errorFromStderr(result.stderr);
			if (!outputFile)
				return {
					type: "error",
					error: `No output produced for ${from} to ${to}`,
				};

			const mediaEntries = Object.entries(result.mediaFiles);
			if (mediaEntries.length > 0) {
				const files: File[] = [new File([outputFile], outName)];
				for (const [name, blob] of mediaEntries)
					files.push(new File([blob], name));

				const zip = makeZip(files);
				return {
					type: "finished",
					output: await readToEnd(zip.getReader()),
					zip: true,
				};
			}

			return {
				type: "finished",
				output: new Uint8Array(await outputFile.arrayBuffer()),
			};
		}

		default:
			return { type: "error", error: "Unknown message type" };
	}
};

const errorFromStderr = (
	stderr: string,
): Partial<WorkerMessage> & { errorKind?: string } => {
	const error = stderr.trim();
	const unknownOutput = error.match(/Unknown output format '(.+)'/);
	const unknownInput = error.match(/Unknown input format '(.+)'/);
	if (unknownOutput)
		return { type: "error", errorKind: "PandocUnknownWriterError", error };
	if (unknownInput)
		return { type: "error", errorKind: "PandocUnknownReaderError", error };
	if (error.includes("JSON missing pandoc-api-version"))
		return { type: "error", errorKind: "PandocParseError", error };
	return { type: "error", error };
};

const readToEnd = async (
	reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array> => {
	const chunks: Uint8Array[] = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}

	const total = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
};

const formatToReader = (format: Format): string => {
	switch (format) {
		case ".md":
		case ".markdown":
			return "markdown";
		case ".docx":
			return "docx";
		case ".csv":
			return "csv";
		case ".tsv":
			return "tsv";
		case ".docbook":
			return "docbook";
		case ".epub":
			return "epub";
		case ".html":
			return "html";
		case ".json":
			return "json";
		case ".odt":
			return "odt";
		case ".rtf":
			return "rtf";
		case ".rst":
			return "rst";
		case ".ipynb":
			return "ipynb";
		case ".typ":
			return "typst";
		case ".opml":
			return "opml";
		case ".org":
			return "org";
		case ".fb2":
			return "fb2";
		case ".tex":
			return "latex";
		case ".man":
			return "man";
		case ".jats":
			return "jats";
		case ".adoc":
			return "asciidoc";
	}

	throw new Error(`Unsupported format: ${format}`);
};

onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const message = e.data;
	try {
		const res = await handleMessage(message);
		if (!res) return;
		postMessage({ ...res, id: message.id });
	} catch (err) {
		postMessage({
			type: "error",
			error: formatError(err),
			id: message.id,
		});
	}
};
