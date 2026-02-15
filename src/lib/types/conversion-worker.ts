import { VertFile } from "./file.svelte";

interface ConvertMessage {
	type: "convert";
	input: {
		file: File;
		name: string;
		from: string;
		to: string;
	} | VertFile;
	to: string;
	conversionSettings: string; // JSON stringified ConversionSettings
}

interface FinishedMessage {
	type: "finished";
	output: ArrayBufferLike | Uint8Array;
	zip?: boolean;
}

interface LoadMessage {
	type: "load";
	wasm: ArrayBuffer;
}

interface LoadedMessage {
	type: "loaded";
}

interface ReadyMessage {
	type: "ready";
}

interface ErrorMessage {
	type: "error";
	error: string;
}

export type WorkerMessage = (
	| ConvertMessage
	| FinishedMessage
	| LoadMessage
	| LoadedMessage
	| ReadyMessage
	| ErrorMessage
) & {
	id: string; // unused? rn just using file id, probably meant to be incrementing w/ every message posted?
};
