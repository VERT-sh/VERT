import test from "node:test";
import assert from "node:assert/strict";
import {
	MagickImage,
	MagickFormat,
	CompressionMethod,
} from "@imagemagick/magick-wasm";
import { fixture, write, rgba, convert } from "./helpers-magick.mjs";
for (const to of [".tiff", ".tif"])
	for (const from of [MagickFormat.Jpeg, MagickFormat.Bmp, MagickFormat.Png])
		test(`${from} → ${to} uses lossless compression without another JPEG encoding`, async () => {
			const src = fixture();
			const bytes = write(src, from);
			src.dispose();
			const input = MagickImage.create(bytes);
			const outputBytes = await convert(bytes, to, false, 80);
			const output = MagickImage.create(outputBytes);
			try {
				assert.equal(output.compression, CompressionMethod.Zip);
				assert.ok(outputBytes.length < input.width * input.height * 3);
				assert.deepEqual(rgba(output), rgba(input));
			} finally {
				input.dispose();
				output.dispose();
			}
		});
