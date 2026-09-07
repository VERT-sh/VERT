import test from "node:test";
import assert from "node:assert/strict";
import {
	MagickImage,
	MagickFormat,
	ColorProfile,
} from "@imagemagick/magick-wasm";
import { fixture, write, rgba, convert } from "./helpers-magick.mjs";
import { readFile } from "node:fs/promises";
import { moduleUrl } from "./helpers-load-ts.mjs";
const { srgbProfileBytes } = await import(
	await moduleUrl(
		new URL("../src/lib/assets/profiles/srgb.ts", import.meta.url),
	)
);
const p3 = new ColorProfile(
	new Uint8Array(
		await readFile(new URL("./fixtures/display-p3.icc", import.meta.url)),
	),
);
for (const to of [".png", ".webp", ".jxl", ".tiff"])
	test(`Display P3 → ${to}: retaining metadata keeps the source ICC and pixels`, async () => {
		const src = fixture();
		src.setProfile(p3);
		const png = write(src, MagickFormat.Png);
		const output = MagickImage.create(await convert(png, to, true, 100));
		try {
			assert.deepEqual(rgba(output), rgba(src));
			assert.deepEqual(output.getColorProfile()?.data, p3.data);
		} finally {
			src.dispose();
			output.dispose();
		}
	});
for (const to of [".png", ".webp", ".jxl", ".tiff"])
	test(`Display P3 → ${to}: metadata removal converts colors before discarding ICC`, async () => {
		const src = fixture();
		src.setProfile(p3);
		src.setAttribute("comment", "private-comment");
		const png = write(src, MagickFormat.Png);
		const raw = rgba(src);
		src.transformColorSpace(new ColorProfile(srgbProfileBytes));
		const expected = rgba(src);
		src.dispose();
		assert.notDeepEqual(
			raw,
			expected,
			"Fixture must require a real color transform",
		);
		const output = MagickImage.create(await convert(png, to, false, 100));
		try {
			assert.deepEqual(rgba(output), expected);
			assert.equal(output.getAttribute("comment"), null);
			// JXL may synthesize a standard output profile. Never retain the source profile.
			assert.notDeepEqual(output.getColorProfile()?.data, p3.data);
		} finally {
			output.dispose();
		}
	});
