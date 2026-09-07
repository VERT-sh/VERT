import {
	ColorSpace,
	Quantum,
	type IMagickImage,
} from "@imagemagick/magick-wasm";

/** Keep AVIF quality 100 lossless without libheif's incompatible AOM IQ tune. */
export function configureAvifOutput(image: IMagickImage): void {
	// Q8 WASM may retain a 16-bit PNG's depth tag after decoding to 8-bit
	// pixels. Passing that tag to libheif expands the output to 12-bit AV1,
	// increasing size without restoring any precision. Respect the actual
	// engine precision (and preserve higher precision in a future Q16 build).
	image.depth = Math.min(image.depth, Quantum.depth);
	if (image.quality < 100) return;

	// An identity matrix stores RGB/GBR without chroma subsampling and makes
	// libheif choose SSIM instead of IQ (IQ enables delta-q, forbidden losslessly).
	// Keep source primaries/transfer, or defer to its ICC profile when present.
	let primaries = "2";
	let transfer = "2";
	if (!image.getColorProfile()) {
		const cicp = image
			.getAttribute("heic:cicp")
			?.match(/^(\d+)\/(\d+)\/\d+\/[01]$/);
		if (cicp) {
			[, primaries, transfer] = cicp;
		} else if (image.colorSpace === ColorSpace.sRGB) {
			primaries = "1";
			transfer = "13";
		}
	}
	image.settings.setDefine("heic:chroma", "444");
	image.settings.setDefine("heic:cicp", `${primaries}/${transfer}/0/1`);
}
