import AnimatedMagickWorker from "#lib/workers/magick-animated?worker";
import type { AnimatedMagickFormat } from "../ffmpeg.codecs";

export interface AnimationFrame {
	png: Uint8Array;
	duration: number;
}

export type AnimationRequest =
	| { operation: "count"; file: Blob; format: AnimatedMagickFormat | "gif" }
	| { operation: "decode"; file: Blob; format: AnimatedMagickFormat | "webp" }
	| { operation: "encode"; data: Uint8Array; format: AnimatedMagickFormat };

type AnimationResults = {
	count: number;
	decode: AnimationFrame[];
	encode: Uint8Array<ArrayBuffer>;
};

export async function processAnimation<Request extends AnimationRequest>(
	request: Request,
): Promise<AnimationResults[Request["operation"]]> {
	const worker = new AnimatedMagickWorker();
	try {
		return await new Promise((resolve, reject) => {
			worker.onmessage = ({ data: message }) => {
				if ("error" in message) reject(new Error(message.error));
				else resolve(message.result);
			};
			worker.onerror = ({ message }) => reject(new Error(message));
			worker.onmessageerror = () =>
				reject(new Error("Could not read animation worker response"));
			worker.postMessage(
				request,
				request.operation === "encode" &&
					request.data.buffer instanceof ArrayBuffer
					? [request.data.buffer]
					: [],
			);
		});
	} finally {
		worker.terminate();
	}
}
