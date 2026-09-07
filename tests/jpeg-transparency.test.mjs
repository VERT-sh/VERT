import test from "node:test";
import assert from "node:assert/strict";
import { MagickImage, MagickFormat } from "@imagemagick/magick-wasm";
import { fixture, write, convert } from "./helpers-magick.mjs";
for (const to of [".jpeg", ".jpg", ".jpe", ".jfif"])
	test(`transparent PNG → ${to} composites on white rather than exposing hidden RGB`, async () => {
		const src = fixture(true);
		const png = write(src, MagickFormat.Png);
		src.dispose();
		const output = MagickImage.create(await convert(png, to, false, 100));
		try {
			for (const [x, expected] of [
				[8, [255, 255, 255]],
				[24, [255, 127, 127]],
				[40, [255, 0, 0]],
			]) {
				const actual = output.getPixels((p) =>
					p.toByteArray(x, 16, 1, 1, "RGB"),
				);
				assert.ok(
					actual.every((v, i) => Math.abs(v - expected[i]) <= 2),
					`${actual} ≠ ${expected}`,
				);
			}
		} finally {
			output.dispose();
		}
	});
