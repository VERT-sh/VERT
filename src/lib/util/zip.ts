import { error, log } from "$lib/util/logger";
import { unzip } from "fflate";
import { downloadZip } from "client-zip";

export interface ZipEntry {
	filename: string;
	data: Uint8Array;
}

export async function extractZip(file: File): Promise<ZipEntry[]> {
	log(["zip"], `extracting zip: ${file.name}`);

	const arrayBuffer = await file.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);

	return new Promise((resolve, reject) => {
		unzip(uint8Array, (err, unzipped) => {
			if (err) {
				error(["zip"], `failed to extract zip: ${err.message}`);
				reject(new Error(`Failed to extract zip: ${err.message}`));
				return;
			}

			const entries = Object.entries(unzipped)
				.filter(([filename]) => !ignoreEntry(filename))
				.map(([filename, data]) => ({
					filename,
					data: new Uint8Array(data),
				}));

			log(["zip"], `extracted ${entries.length} entries from ${file.name}`);
			resolve(entries);
		});
	});
}

export async function createZip(files: File[]): Promise<Uint8Array> {
	log(["zip"], `creating zip with ${files.length} files`);
	const zipBlob = await downloadZip(files).blob();
	return new Uint8Array(await zipBlob.arrayBuffer());
}

export function ignoreEntry(filename: string): boolean {
	return (
		filename.startsWith(".") ||
		filename.includes("/__MACOSX/") ||
		filename.endsWith("/")
	);
}
