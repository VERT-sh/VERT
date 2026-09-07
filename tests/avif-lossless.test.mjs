import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MagickImage, MagickFormat, ColorType } from "@imagemagick/magick-wasm";
import { fixture, write, rgba, convert } from "./helpers-magick.mjs";
import { moduleUrl } from "./helpers-load-ts.mjs";

const { magickConvert } = await import(
	await moduleUrl(
		new URL("../src/lib/util/magick-convert.ts", import.meta.url),
	)
);

for (const from of [MagickFormat.Png, MagickFormat.WebP]) {
	for (const alpha of [false, true]) {
		test(`${from} ${alpha ? "RGBA" : "RGB"} converts to odd-sized AVIF at quality 100 without pixel loss`, async () => {
			const source = fixture(alpha);
			source.resize(17, 13);
			let input, output;
			try {
				// Use full channel depth so this test is independent of palette-depth fixes.
				source.colorType = alpha
					? ColorType.TrueColorAlpha
					: ColorType.TrueColor;
				source.quality = 100;
				const bytes = write(
					source,
					from === MagickFormat.Png ? MagickFormat.Png32 : from,
				);
				input = MagickImage.create(bytes);
				assert.equal(input.width % 2, 1);
				assert.equal(input.height % 2, 1);
				output = MagickImage.create(
					await convert(bytes, ".avif", true, 100),
				);
				assert.deepEqual(
					[output.width, output.height],
					[input.width, input.height],
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

test("lossy AVIF retains its requested quality and encoder defaults", async () => {
	const image = fixture();
	try {
		const output = await magickConvert(image, ".avif", true, 80);
		assert.ok(output.length > 0);
		assert.equal(image.quality, 80);
		assert.equal(image.settings.getDefine("heic:cicp"), null);
		assert.equal(image.settings.getDefine("heic:chroma"), null);
	} finally {
		image.dispose();
	}
});

test("lossless AVIF keeps source CICP primaries and transfer characteristics", async () => {
	const image = fixture();
	let output;
	try {
		image.setAttribute("heic:cicp", "9/16/9/0");
		output = MagickImage.create(
			await magickConvert(image, ".avif", true, 100),
		);
		assert.equal(image.quality, 100);
		assert.equal(output.getAttribute("heic:cicp"), "9/16/0/1");
		assert.deepEqual(rgba(output), rgba(image));
	} finally {
		output?.dispose();
		image.dispose();
	}
});

for (const keep of [true, false]) {
	test(`lossless AVIF follows keepMetadata=${keep} for ICC and comments`, async () => {
		// Reuse the existing upstream avatar only as a source of a valid ICC profile.
		const profileSource = MagickImage.create(
			await readFile(
				new URL("../src/lib/assets/avatars/liam.jpg", import.meta.url),
			),
		);
		const profile = profileSource.getColorProfile();
		profileSource.dispose();
		assert.ok(profile);
		const image = fixture();
		let output;
		try {
			image.setProfile(profile);
			image.setAttribute("comment", "synthetic-test");
			output = MagickImage.create(
				await magickConvert(image, ".avif", keep, 100),
			);
			if (keep) {
				assert.deepEqual(output.getColorProfile()?.data, profile.data);
				assert.equal(image.settings.getDefine("heic:cicp"), "2/2/0/1");
			} else {
				assert.equal(output.getColorProfile(), null);
				assert.equal(output.getAttribute("comment"), null);
			}
		} finally {
			output?.dispose();
			image.dispose();
		}
	});
}

for (const quality of [60, 100]) {
	test(`16-bit source tags do not inflate Q8 AVIF output depth at quality ${quality}`, async () => {
		const source = fixture();
		let input, output;
		try {
			const bytes = write(source, MagickFormat.Png48);
			input = MagickImage.create(bytes);
			assert.equal(input.depth, 16);
			output = MagickImage.create(
				await convert(bytes, ".avif", true, quality),
			);
			assert.equal(output.depth, 8);
			if (quality === 100) assert.deepEqual(rgba(output), rgba(input));
		} finally {
			output?.dispose();
			input?.dispose();
			source.dispose();
		}
	});
}
