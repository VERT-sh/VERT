import test from "node:test";
import assert from "node:assert/strict";
import {
	MagickFormat,
	MagickImage,
	MagickReadSettings,
} from "@imagemagick/magick-wasm";
import { write, rgba, convert } from "./helpers-magick.mjs";

for (const depth of [1, 2, 4]) {
	for (const to of [".tiff", ".tif"]) {
		test(`${depth}-bit grayscale keeps packed TIFF samples for ${to}`, async () => {
			const width = 256,
				height = 128,
				levels = 2 ** depth;
			const pixels = new Uint8Array(width * height * 4);
			for (let i = 0; i < width * height; i++) {
				const value = ((i % levels) * 255) / (levels - 1);
				pixels.set([value, value, value, 255], i * 4);
			}
			const source = MagickImage.create(
				pixels,
				new MagickReadSettings({
					format: MagickFormat.Rgba,
					width,
					height,
				}),
			);
			let input, output;
			try {
				source.depth = depth;
				const png = write(source, MagickFormat.Png);
				input = MagickImage.create(png);
				assert.equal(input.depth, depth);
				output = MagickImage.create(await convert(png, to, false, 100));
				assert.equal(
					output.depth,
					depth,
					"Do not expand valid packed samples to 8 bits",
				);
				assert.deepEqual(rgba(output), rgba(input));
			} finally {
				output?.dispose();
				input?.dispose();
				source.dispose();
			}
		});
	}
}
