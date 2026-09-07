import { readFile } from "node:fs/promises";
import {
	initializeImageMagick,
	MagickImage,
	MagickReadSettings,
	MagickFormat,
} from "@imagemagick/magick-wasm";
import { moduleUrl } from "./helpers-load-ts.mjs";

const { magickConvert } = await import(
	await moduleUrl(
		new URL("../src/lib/util/magick-convert.ts", import.meta.url),
	)
);
await initializeImageMagick(
	await readFile(
		new URL(import.meta.resolve("@imagemagick/magick-wasm/magick.wasm")),
	),
);

export const write = (image, format) =>
	image.write(format, (bytes) => new Uint8Array(bytes));
export const rgba = (image) =>
	image.getPixels(
		(pixels) =>
			new Uint8Array(
				pixels.toByteArray(0, 0, image.width, image.height, "RGBA"),
			),
	);

// Synthetic RGB gradient, or three transparent/semitransparent/opaque bands.
export function fixture(alpha = false) {
	const width = 48,
		height = 32;
	const pixels = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			pixels.set(
				alpha
					? [255, 0, 0, x < 16 ? 0 : x < 32 ? 128 : 255]
					: [x * 5, y * 7, (x * 13 + y * 3) % 256, 255],
				(y * width + x) * 4,
			);
		}
	}
	return MagickImage.create(
		pixels,
		new MagickReadSettings({ format: MagickFormat.Rgba, width, height }),
	);
}

// Exercise the same function the conversion worker calls, with real WASM codecs.
export async function convert(bytes, to, keepMetadata = false, quality = 100) {
	const input = MagickImage.create(bytes);
	try {
		return await magickConvert(input, to, keepMetadata, quality);
	} finally {
		input.dispose();
	}
}
