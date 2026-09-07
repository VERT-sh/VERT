import test from "node:test";
import assert from "node:assert/strict";
import {
	MagickImage,
	MagickReadSettings,
	MagickFormat,
} from "@imagemagick/magick-wasm";
import { fixture, write, rgba, convert } from "./helpers-magick.mjs";
const source = fixture();
const png16 = write(source, MagickFormat.Png48);
source.dispose();

for (const to of [
	".png",
	".tiff",
	".tif",
	".jxl",
	".jp2",
	".psd",
	".ppm",
	".webp",
])
	test(`16-bit PNG → ${to} uses actual Q8 precision and preserves decoded pixels`, async () => {
		const input = MagickImage.create(png16);
		const output = MagickImage.create(await convert(png16, to, true, 100));
		try {
			assert.equal(input.depth, 16);
			assert.equal(output.depth, 8);
			assert.deepEqual(rgba(output), rgba(input));
		} finally {
			input.dispose();
			output.dispose();
		}
	});

for (const to of [".tiff", ".tif", ".psd", ".png", ".jxl"])
	test(`palette PNG → ${to} preserves semi-transparent alpha instead of using palette index depth`, async () => {
		const src = fixture(true);
		const png = write(src, MagickFormat.Png);
		src.dispose();
		const input = MagickImage.create(png);
		const output = MagickImage.create(await convert(png, to, false, 100));
		try {
			assert.ok(
				input.depth < 8,
				"Fixture must have a low-bit palette index",
			);
			assert.deepEqual(rgba(output), rgba(input));
		} finally {
			input.dispose();
			output.dispose();
		}
	});

for (const to of [".tiff", ".psd", ".ppm", ".jp2"])
	test(`palette PNG → ${to} preserves 8-bit RGB values that are not palette indices`, async () => {
		const colors = [
			[28, 99, 157, 255],
			[121, 188, 33, 255],
			[94, 77, 14, 255],
		];
		const pixels = Uint8Array.from(
			Array.from({ length: 48 * 32 }, (_, i) => colors[i % 3]).flat(),
		);
		const src = MagickImage.create(
			pixels,
			new MagickReadSettings({
				format: MagickFormat.Rgba,
				width: 48,
				height: 32,
			}),
		);
		const png = write(src, MagickFormat.Png);
		src.dispose();
		const input = MagickImage.create(png);
		const output = MagickImage.create(await convert(png, to, true, 100));
		try {
			assert.ok(input.depth < 8);
			assert.deepEqual(rgba(output), pixels);
		} finally {
			input.dispose();
			output.dispose();
		}
	});
