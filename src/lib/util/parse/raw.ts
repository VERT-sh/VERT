// Extracts an embedded JPEG preview from a TIFF-based camera RAW file
// (DNG, NEF, CR2, ARW, RAF, ORF, PEF, RW2, NRW, SRW, 3FR, ERF, MEF,
// MOS, MRW, SR2, SRF, DCR, etc.).
//
// magick-wasm does not include libraw/dcraw, so it cannot demosaic the
// sensor data inside a RAW file -- handing the raw bytes to ImageMagick
// produces a rainbow CFA mosaic. The DNG spec (and every camera vendor
// in practice) embeds a full-resolution JPEG preview inside the TIFF
// container. We parse just enough of the TIFF directory here to find
// the largest embedded JPEG and hand that to the rest of the pipeline.

// TIFF tags we care about
const TAG_COMPRESSION = 0x0103;
const TAG_STRIP_OFFSETS = 0x0111;
const TAG_STRIP_BYTE_COUNTS = 0x0117;
const TAG_JPEG_IF_OFFSET = 0x0201; // legacy JPEGInterchangeFormat
const TAG_JPEG_IF_LENGTH = 0x0202;
const TAG_SUB_IFDS = 0x014a;

const COMPRESSION_OLD_JPEG = 6;
const COMPRESSION_NEW_JPEG = 7;

type Entry = {
	tag: number;
	type: number;
	count: number;
	valueOffset: number;
	entryPos: number; // file offset of this 12-byte entry
};

type Candidate = { offset: number; length: number };

const TYPE_SIZE: Record<number, number> = {
	1: 1, // BYTE
	2: 1, // ASCII
	3: 2, // SHORT
	4: 4, // LONG
	5: 8, // RATIONAL
	7: 1, // UNDEFINED
	9: 4, // SLONG
	10: 8, // SRATIONAL
};

/**
 * Extracts the largest embedded JPEG preview from a TIFF-based camera
 * RAW file (DNG, NEF, CR2, ARW, RAF, ORF, PEF, RW2, NRW, SRW, 3FR,
 * ERF, MEF, MOS, MRW, SR2, SRF, DCR, etc.).
 *
 * Walks the TIFF IFD chain (including SubIFDs) looking for an
 * IFD whose strips are JPEG-compressed, or for the legacy
 * `JPEGInterchangeFormat` / `JPEGInterchangeFormatLength` tag pair.
 * Candidates are validated by checking for a JPEG SOI marker (`FF D8`)
 * at the reported offset, and the largest valid candidate (typically
 * the full-resolution preview) is returned.
 *
 * Intended for the magick-wasm pipeline, which has no libraw/dcraw and
 * therefore cannot demosaic RAW sensor data directly.
 *
 * @param buf Raw file bytes.
 * @returns Bytes of the embedded JPEG preview, ready to be decoded.
 * @throws If the input is not a TIFF-based RAW or contains no usable
 *         embedded JPEG preview.
 */
export function extractRawPreview(buf: Uint8Array): Uint8Array {
	if (buf.length < 8) throw new Error("file too small to be TIFF/RAW");

	const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	let little: boolean;
	if (buf[0] === 0x49 && buf[1] === 0x49) little = true;
	else if (buf[0] === 0x4d && buf[1] === 0x4d) little = false;
	else throw new Error("not a TIFF-based RAW (bad byte-order mark)");

	const magic = dv.getUint16(2, little);
	// Standard TIFF magic is 42; some RAWs use other magics (e.g. ORF
	// uses 0x4f52/0x5352, CR2 uses 42 with a CR2 sub-header). 42 covers
	// DNG, NEF, ARW, PEF, RW2, etc. -- accept anything reasonable and
	// rely on the directory parse to fail cleanly if it's not TIFF-ish.
	if (magic !== 42 && magic !== 0x4f52 && magic !== 0x5352 && magic !== 0x55)
		throw new Error(`unsupported TIFF variant (magic=${magic})`);

	const firstIfd = dv.getUint32(4, little);
	const candidates: Candidate[] = [];
	const seen = new Set<number>();

	const walk = (ifdOffset: number) => {
		if (ifdOffset === 0 || seen.has(ifdOffset)) return;
		if (ifdOffset + 2 > buf.length) return;
		seen.add(ifdOffset);

		const count = dv.getUint16(ifdOffset, little);
		const entriesStart = ifdOffset + 2;
		if (entriesStart + count * 12 > buf.length) return;

		const entries = new Map<number, Entry>();
		for (let i = 0; i < count; i++) {
			const p = entriesStart + i * 12;
			entries.set(dv.getUint16(p, little), {
				tag: dv.getUint16(p, little),
				type: dv.getUint16(p + 2, little),
				count: dv.getUint32(p + 4, little),
				valueOffset: dv.getUint32(p + 8, little),
				entryPos: p,
			});
		}

		const readValues = (e: Entry): number[] => {
			const size = TYPE_SIZE[e.type] ?? 0;
			if (size === 0) return [];
			const total = size * e.count;
			const base = total <= 4 ? e.entryPos + 8 : e.valueOffset;
			if (base + total > buf.length) return [];
			const out: number[] = [];
			for (let i = 0; i < e.count; i++) {
				const off = base + i * size;
				if (e.type === 3) out.push(dv.getUint16(off, little));
				else if (e.type === 4) out.push(dv.getUint32(off, little));
				else if (e.type === 1 || e.type === 7) out.push(buf[off]);
			}
			return out;
		};

		// Check this IFD for an embedded JPEG.
		const compressionEntry = entries.get(TAG_COMPRESSION);
		const compression = compressionEntry
			? readValues(compressionEntry)[0]
			: undefined;

		// Modern path: single-strip JPEG (DNG full-size preview, most RAWs).
		if (
			compression === COMPRESSION_NEW_JPEG ||
			compression === COMPRESSION_OLD_JPEG
		) {
			const offEntry = entries.get(TAG_STRIP_OFFSETS);
			const lenEntry = entries.get(TAG_STRIP_BYTE_COUNTS);
			if (offEntry && lenEntry) {
				const offs = readValues(offEntry);
				const lens = readValues(lenEntry);
				if (offs.length && offs.length === lens.length) {
					// Only treat as a usable preview if the strip data
					// begins with a JPEG SOI marker (FF D8).
					const o = offs[0];
					if (
						o + 2 <= buf.length &&
						buf[o] === 0xff &&
						buf[o + 1] === 0xd8
					) {
						const total = lens.reduce((a, b) => a + b, 0);
						candidates.push({ offset: o, length: total });
					}
				}
			}
		}

		// Legacy path: JPEGInterchangeFormat / Length (used by CR2 IFD0
		// preview, older NEFs, etc.).
		const jOff = entries.get(TAG_JPEG_IF_OFFSET);
		const jLen = entries.get(TAG_JPEG_IF_LENGTH);
		if (jOff && jLen) {
			const o = readValues(jOff)[0];
			const l = readValues(jLen)[0];
			if (
				o &&
				l &&
				o + 2 <= buf.length &&
				buf[o] === 0xff &&
				buf[o + 1] === 0xd8
			) {
				candidates.push({ offset: o, length: l });
			}
		}

		// Recurse into SubIFDs (where DNG puts its full-size preview).
		const sub = entries.get(TAG_SUB_IFDS);
		if (sub) {
			for (const off of readValues(sub)) walk(off);
		}

		// Continue to next IFD in chain.
		const nextOff = entriesStart + count * 12;
		if (nextOff + 4 <= buf.length) {
			walk(dv.getUint32(nextOff, little));
		}
	};

	walk(firstIfd);

	if (candidates.length === 0) {
		throw new Error(
			"no embedded JPEG preview found in RAW file -- VERT can only convert RAW files that contain an embedded preview",
		);
	}

	// Pick the largest preview (full-resolution beats thumbnail).
	candidates.sort((a, b) => b.length - a.length);
	const pick = candidates[0];
	const end = Math.min(pick.offset + pick.length, buf.length);
	return buf.slice(pick.offset, end);
}
