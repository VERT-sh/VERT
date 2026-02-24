/**
 * Format metadata for a single file format.
 * Adapted from VERT's FormatInfo class (converter.svelte.ts).
 */
export class FormatInfo {
	public name: string;

	constructor(
		name: string,
		public fromSupported = true,
		public toSupported = true,
		public isNative = true,
	) {
		this.name = name;
		if (!this.name.startsWith(".")) {
			this.name = `.${this.name}`;
		}

		if (!this.fromSupported && !this.toSupported) {
			throw new Error("Format must support at least one direction");
		}
	}
}

/** Options passed to a converter's convert method. */
export interface ConvertOptions {
	inputPath: string;
	outputPath: string;
	outputFormat: string;
	quality?: number;
	keepMetadata?: boolean;
	audioBitrate?: string;
	sampleRate?: number;
}

/** Result returned from a successful conversion. */
export interface ConvertResult {
	outputPath: string;
	format: string;
	sizeBytes: number;
}

/** Base interface for all converters. */
export interface NodeConverter {
	/** Converter name (e.g. "imagemagick", "ffmpeg", "pandoc"). */
	readonly name: string;
	/** Supported formats. */
	readonly supportedFormats: FormatInfo[];
	/** Whether this converter is available on the system. */
	isAvailable(): Promise<boolean>;
	/** Convert a file. */
	convert(options: ConvertOptions): Promise<ConvertResult>;
}

/** Common MIME types by extension (undotted). */
export const MIME_TYPES: Record<string, string> = {
	// Common image formats
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	jpe: "image/jpeg",
	jfif: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	svgz: "image/svg+xml",
	bmp: "image/bmp",
	ico: "image/x-icon",
	cur: "image/x-icon",
	tiff: "image/tiff",
	tif: "image/tiff",
	avif: "image/avif",
	heic: "image/heic",
	heif: "image/heif",
	jxl: "image/jxl",
	psd: "image/vnd.adobe.photoshop",
	hdr: "image/vnd.radiance",
	exr: "image/x-exr",
	dds: "image/vnd.ms-dds",
	pbm: "image/x-portable-bitmap",
	pgm: "image/x-portable-graymap",
	ppm: "image/x-portable-pixmap",
	pnm: "image/x-portable-anymap",
	pam: "image/x-portable-arbitrarymap",
	pcx: "image/x-pcx",
	tga: "image/x-tga",
	qoi: "image/x-qoi",
	ani: "application/x-navi-animation",
	icns: "image/x-icns",

	// Audio formats
	mp3: "audio/mpeg",
	wav: "audio/wav",
	flac: "audio/flac",
	ogg: "audio/ogg",
	oga: "audio/ogg",
	opus: "audio/opus",
	aac: "audio/aac",
	m4a: "audio/mp4",
	m4b: "audio/mp4",
	wma: "audio/x-ms-wma",
	amr: "audio/amr",
	ac3: "audio/ac3",
	aiff: "audio/aiff",
	aif: "audio/aiff",
	aifc: "audio/aiff",
	au: "audio/basic",
	mp2: "audio/mpeg",
	caf: "audio/x-caf",
	voc: "audio/x-voc",
	weba: "audio/webm",

	// Document formats
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	md: "text/markdown",
	html: "text/html",
	rtf: "application/rtf",
	csv: "text/csv",
	tsv: "text/tab-separated-values",
	json: "application/json",
	rst: "text/x-rst",
	epub: "application/epub+zip",
	odt: "application/vnd.oasis.opendocument.text",
	docbook: "application/docbook+xml",

	// Video formats (input only for audio extraction)
	mp4: "video/mp4",
	mkv: "video/x-matroska",
	avi: "video/x-msvideo",
	mov: "video/quicktime",
	webm: "video/webm",
	wmv: "video/x-ms-wmv",
	flv: "video/x-flv",
	mpg: "video/mpeg",
	mpeg: "video/mpeg",
	m4v: "video/mp4",
	"3gp": "video/3gpp",
	ogv: "video/ogg",
};
