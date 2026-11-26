import { fileTypeFromBlob } from "file-type";
import { imageMeta } from "image-meta";

const animationFormats = new Set(["avif", "gif", "jxl", "png", "webp"]);

export async function detectImageAnimation(
	file: Blob,
	format?: string,
): Promise<boolean | undefined> {
	const ext = format?.replace(/^\./, "").toLowerCase();
	const type = ext === "apng" ? "png" : ext === "avifs" ? "avif" : ext;
	if (type !== undefined && !animationFormats.has(type)) return undefined;

	const data = new Uint8Array(
		await file
			.slice(0, type === "webp" ? 30 : 2 * 1024 * 1024)
			.arrayBuffer(),
	);
	try {
		const meta = imageMeta(data);
		if ((!type || meta.type === type) && meta.animated !== undefined)
			return meta.animated;
	} catch {
		// a short prefix can be insufficient even for a valid image
	}

	if (type === "png") {
		const detected = (await fileTypeFromBlob(file))?.ext;
		if (detected === "png" || detected === "apng")
			return detected === "apng";
	}
}
