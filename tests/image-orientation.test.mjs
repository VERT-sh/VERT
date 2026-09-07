import test from "node:test";
import assert from "node:assert/strict";
import {
	MagickImage,
	MagickFormat,
	Orientation,
} from "@imagemagick/magick-wasm";
import { fixture, write, rgba, convert } from "./helpers-magick.mjs";
for (const keep of [true, false])
	test(`all eight EXIF orientations normalize pixels for PNG/WebP (metadata ${keep})`, async () => {
		for (const orientation of Object.values(Orientation).filter(
			(n) => n > 0,
		)) {
			const src = fixture();
			src.orientation = orientation;
			src.setAttribute("comment", "orientation-fixture");
			const tiff = write(src, MagickFormat.Tiff);
			src.autoOrient();
			try {
				for (const to of [".png", ".webp"]) {
					const output = MagickImage.create(
						await convert(tiff, to, keep, 100),
					);
					try {
						assert.deepEqual(
							[output.width, output.height],
							[src.width, src.height],
							`${orientation} → ${to}`,
						);
						assert.deepEqual(
							rgba(output),
							rgba(src),
							`${orientation} → ${to}`,
						);
						output.autoOrient();
						assert.deepEqual(
							rgba(output),
							rgba(src),
							"Viewer must not rotate normalized pixels twice",
						);
					} finally {
						output.dispose();
					}
				}
			} finally {
				src.dispose();
			}
		}
	});

test("JPEG EXIF orientation is applied before EXIF/XMP/comment removal", async () => {
	// Minimal little-endian EXIF IFD: Orientation (SHORT) = RightTop.
	const exif = new Uint8Array(32);
	exif.set([69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0]);
	const view = new DataView(exif.buffer);
	view.setUint16(14, 1, true);
	view.setUint16(16, 0x112, true);
	view.setUint16(18, 3, true);
	view.setUint32(20, 1, true);
	view.setUint16(24, Orientation.RightTop, true);
	const src = fixture();
	src.setProfile("exif", exif);
	src.orientation = Orientation.RightTop;
	src.setProfile(
		"xmp",
		new TextEncoder().encode(
			'<x:xmpmeta xmlns:x="adobe:ns:meta/">private-fixture</x:xmpmeta>',
		),
	);
	src.setAttribute("comment", "private-fixture");
	const jpeg = write(src, MagickFormat.Jpeg);
	src.dispose();
	const input = MagickImage.create(jpeg);
	const output = MagickImage.create(await convert(jpeg, ".png", false, 100));
	try {
		assert.equal(input.orientation, Orientation.RightTop);
		assert.ok(input.getProfile("exif"));
		assert.ok(input.getProfile("xmp"));
		input.autoOrient();
		assert.deepEqual([output.width, output.height], [32, 48]);
		assert.deepEqual(rgba(output), rgba(input));
		assert.equal(output.getProfile("exif"), null);
		assert.equal(output.getProfile("xmp"), null);
		assert.equal(output.getAttribute("comment"), null);
	} finally {
		input.dispose();
		output.dispose();
	}
});
