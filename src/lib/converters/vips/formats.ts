import { FormatInfo } from "../converter.svelte";
import { applyPriorities } from "../priority";

const f = (name: string, fromSupported = true, toSupported = true) =>
	new FormatInfo(name, fromSupported, toSupported, true);

export const vipsFormats: FormatInfo[] = applyPriorities("libvips", [
	// read + write
	f("png"),
	f("jpg"),
	f("jpeg"),
	f("jpe"),
	f("jfif"),
	f("webp"),
	f("gif"),
	f("tif"),
	f("tiff"),
	f("ppm"),
	f("pnm"),
]);

export const VIPS_QUALITY_FORMATS = new Set([
	".png",
	".jpg",
	".jpeg",
	".jpe",
	".jfif",
	".webp",
	".tif",
	".tiff",
]);

export const VIPS_OPAQUE_FORMATS = new Set([
	".jpg",
	".jpeg",
	".jpe",
	".jfif",
	".ppm",
	".pnm",
]);
