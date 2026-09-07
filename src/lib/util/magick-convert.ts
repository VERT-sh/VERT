import {
	AlphaAction,
	MagickImage,
	MagickColors,
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

			if (["JPEG", "JPG", "JPE"].includes(fmt) && img.hasAlpha) {
				// JPEG has no alpha channel; composite edges instead of exposing hidden RGB.
				// Alpha removal reads channel values in the source color space.
				// Transform a single white pixel so CMYK, Lab and RGB agree on white.
				const background = MagickImage.create(MagickColors.White, 1, 1);
				try {
					background.colorSpace = img.colorSpace;
					background.getPixels((pixels) => {
						img.backgroundColor = pixels.getColor(0, 0)!;
					});
				} finally {
					background.dispose();
				}
				img.alpha(AlphaAction.Remove);
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
