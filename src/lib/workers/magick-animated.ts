import type {
	AnimationFrame,
	AnimationRequest,
} from "#lib/converters/ffmpeg/video/magick.animated.ts";
import {
	initializeImageMagick,
	MagickFormat,
	MagickImageCollection,
	MagickReadSettings,
} from "@imagemagick/magick-wasm";
import magickWasm from "@imagemagick/magick-wasm/magick.wasm?url";
import { RIFFFile } from "riff-file";

// imagemagick's webp decoder rounds delays to centiseconds, round to nearest ms
function webpFrameDurations(data: Uint8Array): number[] {
	const riff = new RIFFFile();
	riff.setSignature(data);
	const { subChunks } = riff.signature as {
		subChunks: {
			chunkId: string;
			chunkSize: number;
			chunkData: { start: number };
		}[];
	};
	return subChunks
		.filter((chunk) => chunk.chunkId === "ANMF" && chunk.chunkSize >= 16)
		.map(({ chunkData }) => {
			const offset = chunkData.start + 12;
			return (
				data[offset] + data[offset + 1] * 256 + data[offset + 2] * 65536
			);
		});
}

function sendFrames(frames: AnimationFrame[]) {
	self.postMessage(
		{ result: frames },
		{
			transfer: frames
				.map(({ png }) => png.buffer)
				.filter((buffer) => buffer instanceof ArrayBuffer),
		},
	);
}

self.onmessage = async ({ data: request }: MessageEvent<AnimationRequest>) => {
	const { operation, format } = request;
	try {
		const data =
			operation === "encode"
				? request.data
				: new Uint8Array(await request.file.arrayBuffer());

		if (operation === "decode" && format === "webp") {
			const [{ decodeAnimation }, { encode }] = await Promise.all([
				import("wasm-webp"),
				import("fast-png"),
			]);
			const frames = await decodeAnimation(data, true);
			sendFrames(
				(frames ?? []).map(({ data, width, height, duration }) => ({
					png: encode({ data, width, height, channels: 4, depth: 8 }),
					duration,
				})),
			);
			return;
		}

		await initializeImageMagick(new URL(magickWasm, import.meta.url));
		const target = {
			avif: MagickFormat.Avif,
			jxl: MagickFormat.Jxl,
			gif: MagickFormat.Gif,
			webp: MagickFormat.WebP,
		}[format];
		const input = new MagickReadSettings({
			format: operation === "encode" ? MagickFormat.WebP : target,
		});
		const frames = MagickImageCollection.create();
		try {
			if (operation === "count") {
				frames.ping(data, input);
				self.postMessage({ result: frames.length });
				return;
			}

			frames.read(data, input);
			frames.coalesce();
			if (operation === "decode") {
				sendFrames(
					Array.from(frames, (frame) => ({
						png: frame.write(
							MagickFormat.Png,
							(bytes) => new Uint8Array(bytes),
						),
						duration:
							(frame.animationDelay * 1000) /
							(frame.animationTicksPerSecond || 100),
					})),
				);
				return;
			}

			const durations = webpFrameDurations(data);
			if (durations.length === frames.length) {
				frames.forEach((frame, index) => {
					frame.animationTicksPerSecond = 1000;
					frame.animationDelay = durations[index];
				});
			}
			const result = frames.write(
				target,
				(bytes) => new Uint8Array(bytes),
			);
			self.postMessage({ result }, { transfer: [result.buffer] });
		} finally {
			frames.dispose();
		}
	} catch (error) {
		self.postMessage({ error: String(error) });
	}
};
