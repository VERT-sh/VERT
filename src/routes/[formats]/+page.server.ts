import { converters } from "$lib/converters";
import type { EntryGenerator } from "./$types";

// generate conversion pairs at build time (e.g. mkv-mp4) for SEO
export const entries: EntryGenerator = () => {
	const seenPairs = new Set<string>();

	const addPair = (
		fromName: string,
		fromSupported: boolean,
		toName: string,
		toSupported: boolean,
	) => {
		if (!fromSupported || !toSupported || fromName === toName) return;

		const from = fromName.replace(".", "").toLowerCase();
		const to = toName.replace(".", "").toLowerCase();
		const slug = `${from}-${to}`;

		if (!seenPairs.has(slug)) seenPairs.add(slug);
	};

	// check all conversions (same converter and cross-converter)
	for (const fromConverter of converters) {
		for (const toConverter of converters) {
			const sameConverter = fromConverter.name === toConverter.name;

			for (const fromFormat of fromConverter.supportedFormats) {
				for (const toFormat of toConverter.supportedFormats) {
					// skip if same converter and same format, or if different converter but formats are the same
					if (sameConverter && fromFormat.name === toFormat.name)
						continue;
					if (!sameConverter && fromFormat.name === toFormat.name)
						continue;

					addPair(
						fromFormat.name,
						fromFormat.fromSupported,
						toFormat.name,
						toFormat.toSupported,
					);
				}
			}
		}
	}

	const result = Array.from(seenPairs).map((slug) => ({ formats: slug }));
	console.log(`[SEO] generating ${result.length} format conversion routes`);
	return result;
};

export const prerender = true;

export const load = ({ params }) => {
	const { formats } = params;

	// parse the slug (e.g. { from: "mkv", to: "mp4" })
	const parts = formats.split("-");

	if (parts.length !== 2) {
		return {
			fromFormat: null,
			toFormat: null,
			error: "Invalid format slug",
		};
	}

	const [from, to] = parts;
	const fromFormat = `.${from}`;
	const toFormat = `.${to}`;

	let fromValid = false;
	let toValid = false;

	for (const converter of converters) {
		for (const format of converter.supportedFormats) {
			if (format.name === fromFormat && format.fromSupported)
				fromValid = true;
			if (format.name === toFormat && format.toSupported) toValid = true;
		}
	}

	if (!fromValid || !toValid) {
		return {
			fromFormat: null,
			toFormat: null,
			error: "Invalid conversion pair",
		};
	}

	return {
		fromFormat,
		toFormat,
		error: null,
	};
};
