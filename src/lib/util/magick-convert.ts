import {
	ColorType,
	Quantum,
	MagickFormat,
	type IMagickImage,
} from "@imagemagick/magick-wasm";

export const magickConvert = async (
	img: IMagickImage,
	to: string,
	keepMetadata: boolean,
	compression?: number,
) => {
	let fmt = to.slice(1).toUpperCase();
	if (fmt === "JFIF") fmt = "JPEG";

	// ICO size clamp to avoid WidthOrHeightExceedsLimit
	if (fmt === "ICO") {
		const max = 256;
		const w = img.width;
		const h = img.height;

		if (w > max || h > max) {
			const scale = max / Math.max(w, h);
			const newW = Math.max(1, Math.round(w * scale));
			const newH = Math.max(1, Math.round(h * scale));

			img.resize(newW, newH);
		}
	}

	const result = await new Promise<Uint8Array>((resolve, reject) => {
		try {
			// magick-wasm automatically clamps (https://github.com/dlemstra/magick-wasm/blob/76fc6f2b0c0497d2ddc251bbf6174b4dc92ac3ea/src/magick-image.ts#L2480)
			if (compression) img.quality = compression;
			if (!keepMetadata) img.strip();

			// Source depth can describe palette indices or exceed the WASM quantum depth.
			// Channel values (including alpha) need at least 8 bits after decoding.
			img.depth = Math.min(Quantum.depth, Math.max(8, img.depth));
			if (
				fmt === "PSD" &&
				img.hasAlpha &&
				[
					ColorType.Palette,
					ColorType.PaletteAlpha,
					ColorType.PaletteBilevelAlpha,
				].some((type) => type === img.colorType)
			) {
				// The PSD writer cannot encode indexed images with an alpha channel.
				img.colorType = ColorType.TrueColorAlpha;
			}

			img.write(fmt as unknown as MagickFormat, (o: Uint8Array) => {
				resolve(structuredClone(o));
			});
		} catch (error) {
			reject(error);
		}
	});

	return result;
};
