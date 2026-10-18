export interface CodecInfo {
	name: string; // value to send to the converter, e.g. "libopus"
	canonical: string; // codec family, e.g. "opus"
	label: string; // friendly display name, e.g. "Opus"
}

// aliases -> canonical codec name
const codecAliases: Record<string, string> = {
	avc: "h264",
	x264: "h264",
	x264rgb: "h264",
	openh264: "h264",
	h265: "hevc",
	x265: "hevc",
	kvazaar: "hevc",
	vpx: "vp8",
	"vpx-vp9": "vp9",
	webp_anim: "webp",
	prores_ks: "prores",
	prores_aw: "prores",
	mp3lame: "mp3",
	shine: "mp3",
};

// canonical codec name -> friendly label
// only common codecs since vertd returns its own server-side labels
const codecLabels: Record<string, string> = {
	// video
	h264: "H264 (AVC)",
	hevc: "H265 (HEVC)",
	vp8: "VP8",
	vp9: "VP9",
	av1: "AV1",
	prores: "Apple ProRes",
	mpeg4: "MPEG-4 Part 2",
	mpeg1video: "MPEG-1",
	mpeg2video: "MPEG-2",
	mjpeg: "Motion JPEG",
	dnxhd: "Avid DNxHD",
	ffv1: "FFV1",
	dvvideo: "DV",
	theora: "Theora",
	flv1: "Sorenson Spark (FLV1)",
	wmv2: "Windows Media Video 8",
	apng: "APNG",
	webp: "WebP",
	gif: "GIF",

	// audio
	aac: "AAC",
	mp3: "MP3",
	mp2: "MP2",
	ac3: "AC-3 (Dolby Digital)",
	eac3: "E-AC-3 (Dolby Digital Plus)",
	dts: "DTS",
	opus: "Opus",
	vorbis: "Vorbis",
	flac: "FLAC",
	alac: "ALAC",
	wmav2: "Windows Media Audio 8",
};

const pcmPattern = /^pcm[-_]([usf])(\d+)([bl]e)?$/;
// mediabunny omits the endianness for little-endian pcm, ffmpeg is explicit
const canonicalPcm = (match: RegExpExecArray): string => {
	const [, type, bits, endian] = match;
	return `pcm_${type}${bits}${endian === "be" ? "be" : "le"}`;
};

const normalize = (codec: string) =>
	codec.toLowerCase().replace(/^lib/, "").trim();

// canonical name for a codec (e.g. "avc" / "libx264" -> "h264")
export const canonicalCodecName = (codec: string): string => {
	const value = normalize(codec);

	const pcm = pcmPattern.exec(value);
	if (pcm) return canonicalPcm(pcm);

	return codecAliases[value] ?? value;
};

// common codecs since vertd returns its own server-side labels
const commonCodecs: Record<"video" | "audio", Set<string>> = {
	video: new Set([
		"h264",
		"hevc",
		"vp8",
		"vp9",
		"av1",
		"prores",
		"mpeg4",
		"mpeg1video",
		"mpeg2video",
		"mjpeg",
		"dnxhd",
		"ffv1",
		"theora",
		"flv1",
		"wmv2",
		"h263",
		"dvvideo",
		"apng",
		"webp",
		"gif",
	]),
	audio: new Set([
		"aac",
		"mp3",
		"mp2",
		"ac3",
		"eac3",
		"dts",
		"opus",
		"vorbis",
		"flac",
		"alac",
		"pcm_s16le",
		"pcm_s24le",
		"pcm_s32le",
		"pcm_f32le",
	]),
};

// keep only the common codecs of a type, preserving order.
// falls back to the full list when a format only has uncommon codecs (e.g. amv)
export const filterCommonCodecs = (
	codecs: string[],
	type: "video" | "audio",
): string[] => {
	const common = codecs.filter((codec) =>
		commonCodecs[type].has(canonicalCodecName(codec)),
	);
	return common.length ? common : codecs;
};

// friendly label for a codec name (e.g. "avc" -> "H264 (AVC)")
// falls back to the original name for unknown codecs
export const codecLabel = (codec: string): string => {
	const canonical = canonicalCodecName(codec);
	return codecLabels[canonical] ?? codec;
};

export const toCodecInfo = (codec: CodecInfo | string): CodecInfo => {
	if (typeof codec !== "string") return codec;

	return {
		name: codec,
		canonical: canonicalCodecName(codec),
		label: codecLabel(codec),
	};
};

export const codecOptions = (codecs: (CodecInfo | string)[]) =>
	codecs.map(toCodecInfo).map((codec) => ({
		value: codec.name,
		label: codec.label,
	}));
