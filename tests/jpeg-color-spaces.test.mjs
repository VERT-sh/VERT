import test from "node:test";
import assert from "node:assert/strict";
import {
	AlphaAction,
	ColorSpace,
	MagickFormat,
	MagickImage,
} from "@imagemagick/magick-wasm";
import { fixture, write, convert } from "./helpers-magick.mjs";

for (const keep of [true, false]) {
	for (const to of [".jpeg", ".jpg", ".jpe", ".jfif"]) {
		test(`CMYK transparency composites onto white for ${to} (metadata ${keep})`, async () => {
			const source = fixture(true);
			let input, output;
			try {
				source.colorSpace = ColorSpace.CMYK;
				const tiff = write(source, MagickFormat.Tiff);
				input = MagickImage.create(tiff);
				assert.equal(input.colorSpace, ColorSpace.CMYK);
				assert.equal(input.hasAlpha, true);
				output = MagickImage.create(await convert(tiff, to, keep, 100));
				// Inspect displayed RGB values, not raw CMYK channel values.
				output.colorSpace = ColorSpace.sRGB;
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
						`${actual} != ${expected}`,
					);
				}
			} finally {
				output?.dispose();
				input?.dispose();
				source.dispose();
			}
		});
	}
}

test("opaque CMYK keeps its color space and does not enter the alpha path", async () => {
	const source = fixture();
	let output;
	try {
		source.colorSpace = ColorSpace.CMYK;
		source.alpha(AlphaAction.Off);
		assert.equal(source.hasAlpha, false);
		output = MagickImage.create(
			await convert(write(source, MagickFormat.Tiff), ".jpeg", true, 100),
		);
		assert.equal(output.colorSpace, ColorSpace.CMYK);
	} finally {
		output?.dispose();
		source.dispose();
	}
});

for (const keep of [true, false]) {
	test(`Lab transparency composites onto white (metadata ${keep})`, async () => {
		const source = fixture(true);
		let input, output;
		try {
			source.colorSpace = ColorSpace.Lab;
			const tiff = write(source, MagickFormat.Tiff);
			input = MagickImage.create(tiff);
			assert.equal(input.colorSpace, ColorSpace.Lab);
			assert.equal(input.hasAlpha, true);
			input.colorSpace = ColorSpace.sRGB;
			const opaque = input.getPixels(
				(p) => new Uint8Array(p.toByteArray(40, 16, 1, 1, "RGB")),
			);
			output = MagickImage.create(
				await convert(tiff, ".jpeg", keep, 100),
			);
			output.colorSpace = ColorSpace.sRGB;
			for (const [x, expected] of [
				[8, [255, 255, 255]],
				[40, opaque],
			]) {
				const actual = output.getPixels((p) =>
					p.toByteArray(x, 16, 1, 1, "RGB"),
				);
				assert.ok(
					actual.every((v, i) => Math.abs(v - expected[i]) <= 2),
					`${actual} != ${expected}`,
				);
			}
		} finally {
			output?.dispose();
			input?.dispose();
			source.dispose();
		}
	});
}
