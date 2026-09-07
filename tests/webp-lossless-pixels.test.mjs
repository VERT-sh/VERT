import test from "node:test";
import assert from "node:assert/strict";
import { MagickImage, MagickFormat } from "@imagemagick/magick-wasm";
import { fixture, write, rgba, convert } from "./helpers-magick.mjs";
import { moduleUrl } from "./helpers-load-ts.mjs";

const { magickConvert } = await import(
	await moduleUrl(
		new URL("../src/lib/util/magick-convert.ts", import.meta.url),
	)
);

for (const keep of [false, true]) {
	test(`quality 100 WebP preserves RGB under full and partial transparency (metadata ${keep})`, async () => {
		const image = fixture(true);
		let input, output;
		try {
			const bytes = write(image, MagickFormat.Png32);
			input = MagickImage.create(bytes);
			assert.deepEqual([...rgba(input).slice(0, 4)], [255, 0, 0, 0]);
			output = MagickImage.create(
				await convert(bytes, ".webp", keep, 100),
			);
			assert.deepEqual(rgba(output), rgba(input));
		} finally {
			output?.dispose();
			input?.dispose();
			image.dispose();
		}
	});
}

test("lossy WebP retains the encoder default for transparent RGB", async () => {
	const image = fixture(true);
	try {
		assert.ok((await magickConvert(image, ".webp", false, 80)).length > 0);
		assert.equal(image.quality, 80);
		assert.equal(image.settings.getDefine("webp:exact"), null);
	} finally {
		image.dispose();
	}
});
