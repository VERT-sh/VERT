import {
	initializeImageMagick,
	MagickFormat,
	MagickImage,
	MagickImageCollection,
	MagickReadSettings,
	type IMagickImage,
} from "@imagemagick/magick-wasm";
import { makeZip } from "client-zip";
import { parseAni } from "$lib/util/parse/ani";
import { parseIcns } from "vert-wasm";
import type { WorkerMessage } from "$lib/types";

let magickInitialized = false;

self.postMessage({ type: "ready", id: "0" });

const handleMessage = async (
	message: WorkerMessage,
): Promise<Partial<WorkerMessage>> => {
	switch (message.type) {
		case "load": {
			try {
				if (!message.wasm || !(message.wasm instanceof ArrayBuffer)) {
					throw new Error(
						`Invalid WASM data: ${typeof message.wasm}`,
					);
				}

				const wasmBytes = new Uint8Array(message.wasm);

				await initializeImageMagick(wasmBytes);
				magickInitialized = true;
				return { type: "loaded" };
			} catch (error) {
				return {
					type: "error",
					error: `error loading magick-wasm: ${(error as Error).message}`,
				};
			}
		}
		case "convert": {
			if (!magickInitialized) {
				return { type: "error", error: "magick-wasm not initialized" };
			}

			const compression: number | undefined =
				message.compression ?? undefined;
			const keepMetadata: boolean = message.keepMetadata ?? true;
			if (!message.to.startsWith(".")) message.to = `.${message.to}`;
			message.to = message.to.toLowerCase();
			if (message.to === ".jfif") message.to = ".jpeg";

			let from = message.input.from;
			if (from === ".jfif") from = ".jpeg";
			if (from === ".fit") from = ".fits";

			const buffer = await message.input.file.arrayBuffer();

			// special ico handling to split them all into separate images
			if (from === ".ico") {
				const imgs = MagickImageCollection.create();

				while (true) {
					try {
						const img = MagickImage.create(
							new Uint8Array(buffer),
							new MagickReadSettings({
								format: MagickFormat.Ico,
								frameIndex: imgs.length,
							}),
						);
						imgs.push(img);
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
					} catch (_) {
						break;
					}
				}

				if (imgs.length === 0) {
					return {
						type: "error",
						error: `Failed to read ICO -- no images found inside?`,
					};
				}

				const convertedImgs: Uint8Array[] = [];
				await Promise.all(
					imgs.map(async (img, i) => {
						const output = await magickConvert(
							img,
							message.to,
							keepMetadata,
							compression,
						);
						convertedImgs[i] = output;
					}),
				);

				const zip = makeZip(
					convertedImgs.map(
						(img, i) =>
							new File(
								[new Uint8Array(img)],
								`image${i}.${message.to.slice(1)}`,
							),
					),
					"images.zip",
				);

				// read the ReadableStream to the end
				const zipBytes = await readToEnd(zip.getReader());

				imgs.dispose();

				return {
					type: "finished",
					output: zipBytes,
					zip: true,
				};
			} else if (from === ".ani") {
				console.log("Parsing ANI file");
				try {
					const parsedAni = parseAni(new Uint8Array(buffer));
					const files: File[] = [];
					await Promise.all(
						parsedAni.images.map(async (img, i) => {
							const blob = await magickConvert(
								MagickImage.create(
									img,
									new MagickReadSettings({
										format: MagickFormat.Ico,
									}),
								),
								message.to,
								keepMetadata,
								compression,
							);
							files.push(
								new File(
									[new Uint8Array(blob)],
									`image${i}${message.to}`,
								),
							);
						}),
					);

					const zip = makeZip(files, "images.zip");
					const zipBytes = await readToEnd(zip.getReader());

					return {
						type: "finished",
						output: zipBytes,
						zip: true,
					};
				} catch (e) {
					console.error(e);
				}
			} else if (from === ".icns") {
				const icns: Uint8Array[] = parseIcns(new Uint8Array(buffer));
				if (typeof icns === "string") {
					return {
						type: "error",
						error: `Failed to read ICNS -- ${icns}`,
					};
				}

				const formats = [
					MagickFormat.Png,
					MagickFormat.Jpeg,
					MagickFormat.Rgba,
					MagickFormat.Rgb,
				];
				const outputs: Uint8Array[] = [];
				for (const file of icns) {
					for (const format of formats) {
						try {
							const img = MagickImage.create(
								file,
								new MagickReadSettings({
									format: format,
								}),
							);
							const converted = await magickConvert(
								img,
								message.to,
								keepMetadata,
								compression,
							);
							outputs.push(converted);
							break;
							// eslint-disable-next-line @typescript-eslint/no-unused-vars
						} catch (_) {
							continue;
						}
					}
				}

				const zip = makeZip(
					outputs.map(
						(img, i) =>
							new File(
								[new Uint8Array(img)],
								`image${i}.${message.to.slice(1)}`,
							),
					),
					"images.zip",
				);
				const zipBytes = await readToEnd(zip.getReader());

				return {
					type: "finished",
					output: zipBytes,
					zip: true,
				};
			}

			// build frames of animated formats (webp/gif)
			// APNG does not work on magick-wasm since it needs ffmpeg built-in (not in magick-wasm) - handle in ffmpeg
			if (
				(from === ".webp" || from === ".gif") &&
				(message.to === ".gif" || message.to === ".webp")
			) {
				const collection = MagickImageCollection.create(
					new Uint8Array(buffer),
				);
				const format =
					message.to === ".gif"
						? MagickFormat.Gif
						: MagickFormat.WebP;
				const result = await new Promise<Uint8Array>((resolve) => {
					collection.write(format, (output) => {
						resolve(structuredClone(output));
					});
				});
				collection.dispose();

				return {
					type: "finished",
					output: result,
				};
			}

			const img = MagickImage.create(
				new Uint8Array(buffer),
				new MagickReadSettings({
					format: from.slice(1).toUpperCase() as MagickFormat,
				}),
			);

			const converted = await magickConvert(
				img,
				message.to,
				keepMetadata,
				compression,
			);

			return {
				type: "finished",
				output: converted,
			};
		}
		default:
			return {
				type: "error",
				error: `Unknown message type: ${message.type}`,
			};
	}
};

const readToEnd = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
	const chunks: Uint8Array[] = [];
	let done = false;
	while (!done) {
		const { value, done: d } = await reader.read();
		if (value) chunks.push(value);
		done = d;
	}
	const blob = new Blob(
		chunks.map((chunk) => new Uint8Array(chunk)),
		{ type: "application/zip" },
	);
	const arrayBuffer = await blob.arrayBuffer();
	return new Uint8Array(arrayBuffer);
};

const magickConvert = async (
	img: IMagickImage,
	to: string,
	keepMetadata: boolean,
	compression?: number,
) => {
	let fmt = to.slice(1).toUpperCase();
	if (fmt === "JFIF") fmt = "JPEG";

	// ICO size clamp to avoid WidthOrHeightExceedsLimit
	if (fmt === "ICO") {
		const max = 256;
		const w = img.width;
		const h = img.height;

		if (w > max || h > max) {
			const scale = max / Math.max(w, h);
			const newW = Math.max(1, Math.round(w * scale));
			const newH = Math.max(1, Math.round(h * scale));

			img.resize(newW, newH);
		}
	}

	const result = await new Promise<Uint8Array>((resolve, reject) => {
		try {
			// magick-wasm automatically clamps (https://github.com/dlemstra/magick-wasm/blob/76fc6f2b0c0497d2ddc251bbf6174b4dc92ac3ea/src/magick-image.ts#L2480)
			if (compression) img.quality = compression;
			if (!keepMetadata) img.strip();

			img.write(fmt as unknown as MagickFormat, (o: Uint8Array) => {
				resolve(structuredClone(o));
			});
		} catch (error) {
			reject(error);
		}
	});

	return result;
};

onmessage = async (e) => {
	const message = e.data;
	try {
		const res = await handleMessage(message);
		if (!res) return;
		postMessage({
			...res,
			id: message.id,
		});
	} catch (e) {
		postMessage({
			type: "error",
			error: e,
			id: message.id,
		});
	}
};
