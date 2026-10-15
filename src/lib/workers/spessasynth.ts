import type { WorkerMessage } from "#lib/types";
import ffmpegWasmURL from "@ffmpeg/core/wasm?url";
import ffmpegCoreURL from "@ffmpeg/core?url";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import {
	BasicMIDI,
	BasicSoundBank,
	SoundBankLoader,
	SpessaLog,
} from "spessasynth_core";

SpessaLog.setLogLevel(false, false, false);

self.postMessage({ type: "ready", id: "0" });

const coreURL = new URL(ffmpegCoreURL, import.meta.url).href;
const wasmURL = new URL(ffmpegWasmURL, import.meta.url).href;

const isMIDI = (ext: string) => [".mid", ".midi", ".rmi", ".kar"].includes(ext);
const isBank = (ext: string) =>
	[".sf2", ".sf3", ".sfogg", ".dls"].includes(ext);

const ensureDecoder = async () => {
	try {
		await BasicSoundBank.isSF3DecoderReady;
	} catch (err) {
		console.warn(`[spessasynth] SF3 decoder failed to initialise: ${err}`);
	}
};

// ffmpeg instance purely for encoding vorbis (for sf3/sfogg)
let vorbisEncoderReady: Promise<FFmpeg> | null = null;

const initVorbisEncoder = (): Promise<FFmpeg> => {
	vorbisEncoderReady ??= (async () => {
		const ffmpeg = new FFmpeg();
		await ffmpeg.load({ coreURL, wasmURL });
		return ffmpeg;
	})();
	return vorbisEncoderReady;
};

// spessasynth_core doesn't ship an encoder for vorbis, so use ffmpeg's libvorbis encoder to compress the samples before writing an sf3/sfogg
const encodeVorbis = async (
	audioData: Float32Array,
	sampleRate: number,
): Promise<Uint8Array> => {
	const ffmpeg = await initVorbisEncoder();
	const inName = "sample.f32le";
	const outName = "sample.ogg";
	try {
		const pcm = new Uint8Array(
			audioData.buffer,
			audioData.byteOffset,
			audioData.byteLength,
		).slice();
		await ffmpeg.writeFile(inName, pcm);
		await ffmpeg.exec([
			"-f",
			"f32le",
			"-ar",
			String(sampleRate),
			"-ac",
			"1",
			"-i",
			inName,
			"-c:a",
			"libvorbis",
			"-f",
			"ogg",
			outName,
		]);
		const data = (await ffmpeg.readFile(outName)) as Uint8Array;
		return new Uint8Array(data);
	} finally {
		await ffmpeg.deleteFile(inName).catch(() => {});
		await ffmpeg.deleteFile(outName).catch(() => {});
	}
};

const handleMessage = async (
	message: WorkerMessage,
): Promise<Partial<WorkerMessage>> => {
	if (message.type !== "convert")
		return { type: "error", error: "Unknown message type" };

	const from = message.input.from;
	const to = message.to.startsWith(".") ? message.to : `.${message.to}`;
	const buffer = await message.input.file.arrayBuffer();

	try {
		await ensureDecoder();

		let output: Uint8Array;
		if (isBank(from) && isBank(to)) {
			output = new Uint8Array(await convertBank(buffer, from, to));
		} else if (isMIDI(from) && isMIDI(to)) {
			output = new Uint8Array(
				convertMIDI(buffer, to, message.input.name),
			);
		} else {
			throw new Error(`Unsupported conversion: ${from} -> ${to}`);
		}

		if (!output.length)
			throw new Error("Conversion produced an empty file");
		return { type: "finished", output };
	} catch (err) {
		return { type: "error", error: (err as Error).message };
	}
};

const convertBank = async (
	buffer: ArrayBuffer,
	from: string,
	to: string,
): Promise<ArrayBuffer> => {
	const bank = SoundBankLoader.fromArrayBuffer(buffer);
	if (to === ".dls") return bank.writeDLS();
	if (to === ".sf3" || to === ".sfogg") {
		await bank.setSampleFormat({
			format: "compressed",
			compressionFunction: encodeVorbis,
		});
		return bank.writeSF2();
	}
	// compressed banks must be decompressed before writing an uncompressed format (sf2/dls)
	if (from === ".sf3" || from === ".sfogg")
		await bank.setSampleFormat({ format: "pcm" });
	return bank.writeSF2();
};

// TODO: allow uploading soundfonts to convert from MIDI to audio files
const convertMIDI = (
	buffer: ArrayBuffer,
	to: string,
	name: string,
): ArrayBuffer => {
	const midi = BasicMIDI.fromArrayBuffer(buffer, name);

	if (to === ".rmi") {
		if (!midi.embeddedSoundBank)
			throw new Error(
				".rmi files can only be created from MIDI files that contain an embedded sound bank.",
			);
		const bank = SoundBankLoader.fromArrayBuffer(midi.embeddedSoundBank);
		return midi.writeRMIDI(midi.embeddedSoundBank, { soundBank: bank });
	}

	// .mid / .midi / .kar all save as a standard MIDI file
	return midi.writeMIDI();
};

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const res = await handleMessage(e.data);
	if (res) self.postMessage({ ...res, id: e.data.id });
};
