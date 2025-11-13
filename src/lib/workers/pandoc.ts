import type { WorkerMessage } from "$lib/types";
import * as wasiShim from "@bjorn3/browser_wasi_shim";
import * as zip from "client-zip";

self.onmessage = async (e) => {
	const message = e.data;
	try {
		const res = await handleMessage(message);
		if (!res) return;
		self.postMessage({
			...res,
			id: message.id,
		});
	} catch (e) {
		self.postMessage({
			type: "error",
			error: e,
			id: message.id,
		});
	}
};

let wasm: ArrayBuffer = null!;

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
	| ".markdown";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleMessage = async (message: WorkerMessage): Promise<any> => {
	switch (message.type) {
		case "load": {
			wasm = message.wasm;
			postMessage({ type: "loaded", id: "0" });
			break;
		}

		case "convert": {
			try {
				const { to: ext, input } = message;
				const file = input.file as File;
				const to = ext as Format;
				if (to === ".rtf") {
					throw new Error(
						"Converting into RTF is currently not supported.",
					);
				}
				const buf = new Uint8Array(await file.arrayBuffer());
				const args = `-f ${formatToReader(`.${file.name.split(".").pop() || ""}` as Format)} -t ${formatToReader(to)} --extract-media=.`;
				const [result, stderr, zip] = await pandoc(
					args,
					buf,
					file.name,
					to,
				);
				if (result.length === 0) {
					return {
						type: "error",
						error: stderr
							.replaceAll("\\n", "\n")
							.replaceAll('\\"', '"')
							.split('"')
							.slice(1, -1)
							.join('"'),
						errorKind: stderr.split(" ")[0],
					};
				}
				return {
					type: "finished",
					output: result,
					isZip: zip,
				};
			} catch (e) {
				console.error(e);
				return { type: "error", error: e };
			}
		}
	}
};

const formatToReader = (format: Format): string => {
	switch (format) {
		case ".md":
		case ".markdown":
			return "markdown";
		case ".doc":
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
	}

	throw new Error(`Unsupported format: ${format}`);
};

async function pandoc(
	args_str: string,
	in_data: Uint8Array,
	in_name: string,
	out_ext: string,
): Promise<[Uint8Array, string, boolean]> {
	if (!wasm) throw new Error("WASM not loaded");
	let stderr = "";
	const args = ["pandoc.wasm", "+RTS", "-H64m", "-RTS"];
	const env: string[] = [];
	const in_file = new wasiShim.File(in_data, {
		readonly: true,
	});
	const out_file = new wasiShim.File(new Uint8Array(), {
		readonly: false,
	});
	const map = new Map<string, wasiShim.File>([
		["in", in_file],
		["out", out_file],
	]);
	const root = new wasiShim.PreopenDirectory("/", map);
	const fds = [
		new wasiShim.OpenFile(
			new wasiShim.File(new Uint8Array(), { readonly: true }),
		),
		wasiShim.ConsoleStdout.lineBuffered((msg) => {
			console.log(`[WASI stdout] ${msg}`);
		}),
		wasiShim.ConsoleStdout.lineBuffered((msg) => {
			console.warn(`[WASI stderr] ${msg}`);
			stderr += msg + "\n";
		}),
		root,
		new wasiShim.PreopenDirectory("/tmp", new Map()),
	];

	const wasi = new wasiShim.WASI(args, env, fds, { debug: false });
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { instance }: { instance: any } = await WebAssembly.instantiate(
		wasm,
		{
			wasi_snapshot_preview1: wasi.wasiImport,
		},
	);

	wasi.initialize(instance);

	instance.exports.__wasm_call_ctors();

	function memory_data_view() {
		return new DataView(instance.exports.memory.buffer);
	}

	const argc_ptr = instance.exports.malloc(4);
	memory_data_view().setUint32(argc_ptr, args.length, true);
	const argv = instance.exports.malloc(4 * (args.length + 1));
	for (let i = 0; i < args.length; ++i) {
		const arg = instance.exports.malloc(args[i].length + 1);
		new TextEncoder().encodeInto(
			args[i],
			new Uint8Array(instance.exports.memory.buffer, arg, args[i].length),
		);
		memory_data_view().setUint8(arg + args[i].length, 0);
		memory_data_view().setUint32(argv + 4 * i, arg, true);
	}
	memory_data_view().setUint32(argv + 4 * args.length, 0, true);
	const argv_ptr = instance.exports.malloc(4);
	memory_data_view().setUint32(argv_ptr, argv, true);

	instance.exports.hs_init_with_rtsopts(argc_ptr, argv_ptr);

	const args_ptr = instance.exports.malloc(args_str.length);
	new TextEncoder().encodeInto(
		args_str,
		new Uint8Array(
			instance.exports.memory.buffer,
			args_ptr,
			args_str.length,
		),
	);

	instance.exports.wasm_main(args_ptr, args_str.length);
	// list all files in /
	const openedPath = root.dir.path_open(0, BigInt(0), 0).fd_obj;
	const dirRet = openedPath.path_lookup(".", 0);
	const dir = dirRet.inode_obj;
	if (dir) {
		const opened = dir.path_open(0, BigInt(0), 0).fd_obj;
		if (!opened) {
			return [out_file.data, stderr, false];
		}

		const fs = readRecursive(opened);
		// const media = fs.get("media");
		// if (media && media.type === "folder") {
		// 	const file = new File(
		// 		[out_file.data],
		// 		`${in_name.split(".").slice(0, -1).join(".")}${out_ext}`,
		// 	);
		// 	const zipped = await zipFiles(file, media.entries);
		// 	return [zipped, stderr, true];
		// }
		// filter to folders
		const folders = [...fs.entries()].filter(
			(f) => f[0] !== "in" && f[0] !== "out",
		);
		if (folders.length > 0) {
			const file = new File(
				[new Uint8Array(Array.from(out_file.data))],
				`${in_name.split(".").slice(0, -1).join(".")}${out_ext}`,
			);
			const filteredMap = new Map<string, PandocFsEntry>();
			for (const [name, entry] of folders) {
				filteredMap.set(name, entry);
			}
			const zipped = await zipFiles(file, filteredMap);
			return [zipped, stderr, true];
		}
	}
	return [out_file.data, stderr, false];
}

const zipFiles = async (
	output: File,
	entries: PandocEntries,
): Promise<Uint8Array> => {
	const zipFormatted = pandocToFiles(entries);
	const zipped = zip.makeZip([...zipFormatted, output]);
	// read the ReadableStream to the end
	const reader = zipped.getReader();
	const chunks: Uint8Array[] = [];
	let done = false;
	while (!done) {
		const { done: d, value } = await reader.read();
		done = d;
		if (value) {
			chunks.push(value);
		}
	}
	const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
};

const pandocToFiles = (entries: PandocEntries, parent = ""): File[] => {
	const flattened: File[] = [];

	for (const [name, entry] of entries) {
		const fullPath = parent ? `${parent}/${name}` : name;

		if (entry.type === "folder") {
			const nestedFiles = pandocToFiles(entry.entries, fullPath);
			flattened.push(...nestedFiles);
		} else {
			const file = new File([new Uint8Array(Array.from(entry.data))], fullPath);
			flattened.push(file);
		}
	}

	return flattened;
};

const readRecursive = (fd: wasiShim.Fd): PandocEntries => {
	const entries = new Map<string, PandocFsEntry>();
	const stat = fd.fd_filestat_get().filestat;
	if (!stat) return entries;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const dir: any = fd.path_lookup(".", 0).inode_obj;
	if (!dir) return entries;
	const dirEntries: Map<string, wasiShim.File | wasiShim.Directory> =
		dir.contents;
	const results = readRecursiveInternal(dirEntries);
	for (const [name, entry] of results) {
		entries.set(name, entry);
	}

	return entries;
};

const readRecursiveInternal = (
	contents: Map<string, wasiShim.File | wasiShim.Directory>,
): PandocEntries => {
	const entries = new Map<string, PandocFsEntry>();
	for (const [name, entry] of contents) {
		if (entry instanceof wasiShim.File) {
			const file: PandocFile = {
				data: entry.data,
				type: "file",
			};
			entries.set(name, file);
		} else {
			const folder: PandocFolder = {
				entries: readRecursiveInternal(
					entry.contents as unknown as Map<
						string,
						wasiShim.File | wasiShim.Directory
					>,
				),
				type: "folder",
			};
			entries.set(name, folder);
		}
	}
	return entries;
};

type PandocEntries = Map<string, PandocFsEntry>;

interface PandocFile {
	data: Uint8Array;
	type: "file";
}

interface PandocFolder {
	entries: PandocEntries;
	type: "folder";
}

type PandocFsEntry = PandocFile | PandocFolder;
