import test from "node:test";
import assert from "node:assert/strict";
import {
	MagickImage,
	MagickFormat,
	MagickReadSettings,
} from "@imagemagick/magick-wasm";
import { fixture, write, rgba, convert } from "./helpers-magick.mjs";

test("PNG conversion preserves decoded dimensions and pixels", async () => {
	const source = fixture();
	let output;
	try {
		output = MagickImage.create(
			await convert(write(source, MagickFormat.Png), ".png"),
		);
		assert.deepEqual(
			[output.width, output.height],
			[source.width, source.height],
		);
		assert.deepEqual(rgba(output), rgba(source));
	} finally {
		output?.dispose();
		source.dispose();
	}
});

for (const keep of [false, true]) {
	test(`PNG comment follows keepMetadata=${keep}`, async () => {
		const source = fixture();
		let output;
		try {
			source.setAttribute("comment", "synthetic-test");
			output = MagickImage.create(
				await convert(write(source, MagickFormat.Png), ".png", keep),
			);
			assert.equal(
				output.getAttribute("comment"),
				keep ? "synthetic-test" : null,
			);
		} finally {
			output?.dispose();
			source.dispose();
		}
	});
}

test("ICO conversion keeps its 256-pixel size limit and aspect ratio", async () => {
	const source = fixture();
	let output;
	try {
		source.resize(600, 400);
		output = MagickImage.create(
			await convert(write(source, MagickFormat.Png), ".ico"),
			new MagickReadSettings({ format: MagickFormat.Ico }),
		);
		assert.deepEqual([output.width, output.height], [256, 171]);
	} finally {
		output?.dispose();
		source.dispose();
	}
});

test("encoder failures reject the conversion promise", async () => {
	const source = fixture();
	try {
		await assert.rejects(
			convert(write(source, MagickFormat.Png), ".invalid-format"),
		);
	} finally {
		source.dispose();
	}
});
