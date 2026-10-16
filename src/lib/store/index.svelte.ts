import {
	byNative,
	categories,
	categoryByConverter,
	converterCategories,
	converters,
} from "#lib/converters";
import type { Converter } from "#lib/converters/converter.svelte";
import { priorityFor } from "#lib/converters/priority";
import { vertdFetch } from "#lib/converters/vertd/vertd.svelte";
import { m } from "#lib/paraglide/messages";
import { getLocale, setLocale } from "#lib/paraglide/runtime";
import { VertFile } from "#lib/types";
import { conversionConcurrency, GB } from "#lib/util/consts";
import { formatFilename } from "#lib/util/file";
import { error, log } from "#lib/util/logger.svelte";
import { readSettings } from "#lib/util/settings";
import { ToastManager } from "#lib/util/toast.svelte";
import { browser } from "$app/env";
import { parseBlob, selectCover } from "music-metadata";
import PQueue from "p-queue";
import sanitizeHtml from "sanitize-html";
import { get, writable } from "svelte/store";

const IMAGE_FORMATS = new Set(
	converters
		.find((c) => c.name === "imagemagick")
		?.formatStrings((f) => f.fromSupported) ?? [],
);

const zipExtension = (filename: string): string => {
	const base = filename.replace(/\\/g, "/").split("/").pop() ?? filename;
	const dot = base.lastIndexOf(".");
	return dot === -1 ? "" : base.slice(dot).toLowerCase();
};

// detect a media sequence zip (frameSequence or DASH) from its members
function detectSequenceKind(
	filenames: string[],
): "frameSequence" | "dash" | undefined {
	const exts = filenames.map(zipExtension);

	// DASH - an .mpd manifest, or bare .m4s/.m4d segments
	if (exts.some((ext) => ext === ".mpd" || ext === ".m4s" || ext === ".m4d"))
		return "dash";

	// frameSequence - all files being the same image format
	const first = exts[0];
	if (first && IMAGE_FORMATS.has(first) && exts.every((ext) => ext === first))
		return "frameSequence";

	return undefined;
}

class Files {
	public files = $state<VertFile[]>([]);

	public async remove(file: VertFile): Promise<void> {
		this.files = this.files.filter((entry) => entry !== file);
		await file.dispose();
		await file.cancel();
	}

	public async removeAll(): Promise<void> {
		await Promise.all([...this.files].map((file) => this.remove(file)));
	}

	private getRequiredConverters(file: VertFile): Converter[] {
		if (file.isZip()) return file.converters;

		const compatibleConverters = file.findConverters([file.from, file.to]);
		const selectedConverterName = file.conversionSettings.converter;

		if (!selectedConverterName) return compatibleConverters;

		const selectedConverter = compatibleConverters.find(
			(converter) => converter.name === selectedConverterName,
		);

		return selectedConverter ? [selectedConverter] : compatibleConverters;
	}

	public isReady(file: VertFile): boolean {
		const requiredConverters = this.getRequiredConverters(file);
		if (requiredConverters.length === 0) return false;

		return (
			!file.processing &&
			requiredConverters.some((converter) => converter.isReady())
		);
	}

	// preload first required converter when added to list (or changing format)
	public preloadConverters(file: VertFile): void {
		const [preferred] = this.getRequiredConverters(file);
		void preferred?.init();
	}

	// for frame sequences, toggle between video engines when on, per-image engines when off.
	public syncSequenceConverters(file: VertFile): void {
		if (file.sequenceKind !== "frameSequence") return;

		const sequenceMode = file.conversionSettings.imageSequence === true;
		const candidates = sequenceMode
			? converters.filter(
					(c) => c.name === "ffmpeg-video" || c.name === "vertd",
				)
			: converters;

		file.converters = candidates;

		const current = file.conversionSettings.converter;
		if (current && candidates.some((c) => c.name === current)) return;

		const fallback = sequenceMode
			? !file.isLarge() &&
				candidates.some((c) => c.name === "ffmpeg-video")
				? "ffmpeg-video"
				: (candidates.find((c) => c.name === "vertd")?.name ??
					candidates[0]?.name)
			: ([...candidates].sort(
					(a, b) =>
						priorityFor(
							b.name,
							file.archiveFormats?.[0] ?? file.from,
						) -
						priorityFor(
							a.name,
							file.archiveFormats?.[0] ?? file.from,
						),
				)[0]?.name ?? candidates[0]?.name);

		if (fallback) {
			file.conversionSettings = {
				...file.conversionSettings,
				converter: fallback,
			};
			void candidates.find((c) => c.name === fallback)?.init();
		}
	}

	public requiredConverters = $derived(
		Array.from(
			new Set(
				this.files.flatMap((file) => this.getRequiredConverters(file)),
			),
		),
	);

	public ready = $derived(
		this.files.length === 0
			? false
			: this.files.some((file) => this.isReady(file)),
	);

	public allReady = $derived(
		this.files.length === 0
			? false
			: this.files.every((file) => this.isReady(file)),
	);

	public results = $derived(
		this.files.length === 0 ? false : this.files.every((f) => f.result),
	);

	private thumbnailQueue = new PQueue({
		concurrency: browser ? navigator.hardwareConcurrency || 4 : 4,
	});

	private _addThumbnail = async (file: VertFile) => {
		this.thumbnailQueue.add(async () => {
			// for now only ffmpeg are "real" audio files that music-metadata can read
			const isAudio = converters
				.filter((c) => c.name === "ffmpeg")
				.flatMap((c) =>
					c.supportedFormats
						.filter((f) => f.isNative)
						.map((f) => f.name),
				)
				.includes(file.from.toLowerCase());
			const isVideo = converters
				.find((c) => converterCategories.video.includes(c.name))
				?.supportedFormats.filter((f) => f.isNative)
				.map((f) => f.name)
				?.includes(file.from.toLowerCase());

			try {
				if (file.blobUrl?.startsWith("blob:"))
					URL.revokeObjectURL(file.blobUrl);

				if (isAudio) {
					// try to get the thumbnail from the audio via music-metadata
					const { common } = await parseBlob(file.file, {
						skipPostHeaders: true,
					});
					const cover = selectCover(common.picture);
					if (cover) {
						const coverData = new Uint8Array(cover.data);
						const blob = new Blob([coverData.buffer], {
							type: cover.format,
						});
						file.blobUrl = URL.createObjectURL(blob);
					}
				} else if (isVideo) {
					// video
					file.blobUrl = await this._generateThumbnailFromMedia(
						file.file,
						true,
					);
				} else {
					// image
					file.blobUrl = await this._generateThumbnailFromMedia(
						file.file,
						false,
					);
				}
			} catch (e) {
				error(["files"], e);
			}
		});
	};

	private async _generateThumbnailFromMedia(
		file: File,
		isVideo: boolean,
	): Promise<string | undefined> {
		const maxSize = 180;
		const mediaElement = isVideo
			? document.createElement("video")
			: new Image();
		const mediaUrl = URL.createObjectURL(file);
		mediaElement.src = mediaUrl;

		try {
			await new Promise((resolve, reject) => {
				if (isVideo) {
					const video = mediaElement as HTMLVideoElement;
					// seek to 10% of video time or 2 seconds in
					video.onloadeddata = () => {
						const seekTime = Math.min(video.duration * 0.1, 2);
						video.currentTime = seekTime;
					};
					video.onseeked = resolve;
					video.onerror = reject;
				} else {
					(mediaElement as HTMLImageElement).onload = resolve;
					(mediaElement as HTMLImageElement).onerror = reject;
				}
			});

			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (!ctx) return undefined;

			const width = isVideo
				? (mediaElement as HTMLVideoElement).videoWidth
				: (mediaElement as HTMLImageElement).width;
			const height = isVideo
				? (mediaElement as HTMLVideoElement).videoHeight
				: (mediaElement as HTMLImageElement).height;

			const scale = Math.max(maxSize / width, maxSize / height);
			canvas.width = width * scale;
			canvas.height = height * scale;
			ctx.drawImage(mediaElement, 0, 0, canvas.width, canvas.height);

			// check if completely transparent
			const imageData = ctx.getImageData(
				0,
				0,
				canvas.width,
				canvas.height,
			);
			const isTransparent = Array.from(imageData.data).every(
				(value, index) => {
					return (index + 1) % 4 !== 0 || value === 0;
				},
			);
			if (isTransparent) {
				canvas.remove();
				return undefined;
			}

			const url = canvas.toDataURL();
			canvas.remove();
			return url;
		} finally {
			URL.revokeObjectURL(mediaUrl);
		}
	}

	private async _handleZipFile(input: VertFile): Promise<void> {
		const file = input.file;
		try {
			log(["files"], `extracting zip file: ${file.name}`);

			const { extractZip } = await import("#lib/util/file");
			const entries = await extractZip(file);

			const totalEntries = entries.length;
			log(["files"], `extracted ${totalEntries} files from zip`);

			const sequenceKind = detectSequenceKind(
				entries.map((entry) => entry.filename),
			);

			if (sequenceKind === "dash") {
				await this._handleDashZip(input);
				return;
			}

			if (sequenceKind === "frameSequence")
				input.sequenceKind = "frameSequence";

			// check if all files in zip use the same converter and are compatible
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const convertersUsed = new Set<string>();
			let incompatibleFiles = false;
			const archiveFiles: VertFile[] = [];

			for (const { filename, data } of entries) {
				const member = new VertFile(
					new File([new Uint8Array(data)], filename, {
						type: "application/octet-stream",
					}),
					".zip",
				);
				await member.checkFileType();
				archiveFiles.push(member);
				const format = member.from;
				if (!format || format === ".zip") {
					incompatibleFiles = true;
					continue;
				}

				const converter = converters
					.sort(byNative(format))
					.find((c) => c.formatStrings().includes(format));

				if (converter) convertersUsed.add(converter.name);
				else incompatibleFiles = true;
			}

			const converterCount = convertersUsed.size;
			const canConvertAsOne = converterCount === 1 && !incompatibleFiles;

			log(
				["files"],
				`extracted ${entries.length} files from zip (converters: ${converterCount}, compatible: ${canConvertAsOne})`,
			);

			if (canConvertAsOne) {
				// all files use same converter - add zip as a single VertFile file
				const vf = input;
				vf.to = ".zip";
				vf.archiveFormats = archiveFiles.map((member) => member.from);
				const mainConverter = Array.from(convertersUsed)[0];
				vf.converters =
					vf.sequenceKind === "frameSequence"
						? vf.conversionSettings.imageSequence
							? converters.filter(
									(c) =>
										c.name === "ffmpeg-video" ||
										c.name === "vertd",
								)
							: converters
						: converters.filter((c) => c.name === mainConverter);

				this.files.push(vf);
				this._addThumbnail(vf);

				// TODO: this is weird, we rely on conversionSettings for the right converter but zip archives obv dont have settings to change
				let defaultConverter: string;
				if (
					vf.sequenceKind === "frameSequence" &&
					vf.conversionSettings.imageSequence
				) {
					// sequence mode prefers local ffmpeg, then falls back to vertd
					const has = (name: string) =>
						vf.converters.some((c) => c.name === name);
					defaultConverter =
						!vf.isLarge() && has("ffmpeg-video")
							? "ffmpeg-video"
							: has("vertd")
								? "vertd"
								: vf.converters[0].name;
				} else {
					// pick first inner format (if multiple) for priority check, since all files should be compatible with the same converter
					const inner = vf.archiveFormats?.[0] ?? vf.from;
					defaultConverter =
						[...vf.converters].sort(
							(a, b) =>
								priorityFor(b.name, inner) -
								priorityFor(a.name, inner),
						)[0]?.name ?? vf.converters[0].name;
				}
				vf.conversionSettings = {
					...vf.conversionSettings,
					converter: defaultConverter,
				};
				this.preloadConverters(vf);

				const type = categoryByConverter[mainConverter] ?? "video";
				ToastManager.add({
					type: "success",
					message: m["convert.archive_file.detected"]({
						type: m[`convert.archive_file.${type}`](),
						filename: file.name,
					}),
				});
			} else {
				// mixed converters/incompatible files - extract all individually
				for (const file of archiveFiles) {
					file.to = file.from;
					await this._add(file);
				}

				ToastManager.add({
					type: "success",
					message: m["convert.archive_file.extracted"]({
						filename: file.name,
						extract_count: entries.length,
						ignore_count: 0,
					}),
				});
			}
		} catch (e) {
			error(["files"], `error processing zip file: ${e}`);
			throw e;
		}
	}

	private async _handleDashZip(input: VertFile): Promise<void> {
		const vertd = converters.find((c) => c.name === "vertd");
		if (!vertd) {
			throw new Error(
				"DASH media sequences require the vertd server, which is unavailable",
			);
		}

		input.sequenceKind = "dash";
		input.archiveFormats = [input.from];
		input.converters = [vertd];
		input.conversionSettings = {
			...input.conversionSettings,
			converter: "vertd",
			imageSequence: true,
		};

		this.files.push(input);
		this._addThumbnail(input);
		this.preloadConverters(input);

		log(["files"], `detected dash media sequence in ${input.name}`);
		ToastManager.add({
			type: "success",
			message: m["convert.archive_file.detected"]({
				type: m["convert.archive_file.video"](),
				filename: input.name,
			}),
		});
		ToastManager.add({
			type: "success",
			message: m["convert.archive_file.detected_sequence"]({
				sequence: m["convert.archive_file.sequence_dash"](),
				filename: input.name,
			}),
		});
	}

	private async _add(file: VertFile | File) {
		const input =
			file instanceof VertFile ? file : new VertFile(file, ".zip");
		await input.checkFileType();
		// if zip, extract and add contents
		const isZip = input.from === ".zip";
		if (isZip && !input.archiveFormats) {
			try {
				await this._handleZipFile(input);
			} catch (err) {
				error(["files"], `error extracting zip file: ${err}`);
				ToastManager.add({
					type: "error",
					message: m["convert.archive_file.extract_error"]({
						filename: input.file.name,
						error: String(err),
					}),
				});
			}
			return;
		}
		if (file instanceof VertFile) {
			this.files.push(file);
			this._addThumbnail(file);
			this.preloadConverters(file);
		} else {
			// regular files
			const format = input.from;
			if (!format) {
				log(["files"], `no extension found for ${file.name}`);
				return;
			}
			const converter = converters
				.sort(byNative(format))
				.find((converter) =>
					converter.formatStrings().includes(format),
				);
			if (!converter) {
				log(["files"], `no converter found for ${file.name}`);
				input.to = format;
				this.files.push(input);
				return;
			}
			const category = Object.keys(categories).find((name) =>
				categories[name].formats.includes(format),
			);
			// first format (in category order) the file can actually convert to
			const candidates = category
				? categories[category].formats
				: converter.formatStrings();
			const to = candidates.find(
				(f) => f !== format && input.hasAvailableConverter(format, f),
			);
			if (!to) {
				log(["files"], `no output format found for ${file.name}`);
				return;
			}
			const vf = input;
			vf.to = to;
			this.files.push(vf);
			this._addThumbnail(vf);
			this.preloadConverters(vf);

			const convName = converter.name;
			if (
				file.size > MAX_ARRAY_BUFFER_SIZE &&
				converterCategories.video.includes(convName)
			) {
				ToastManager.add({
					type: "warning",
					message: m["convert.large_file_warning"]({
						filename: file.name,
						limit: (MAX_ARRAY_BUFFER_SIZE / GB).toFixed(2),
					}),
					durations: {
						stay: 10000,
					},
				});
			}
		}
	}

	private addFile(input: VertFile | File): Promise<void> {
		return this._add(input).catch((err) => {
			error(["files"], `error adding file ${input.name}: ${err}`);
			ToastManager.add({
				type: "error",
				message: m["workers.errors.general"]({
					file: input.name,
					message: String(err),
				}),
			});
		});
	}

	public add(file: VertFile | null | undefined): void;
	public add(file: File | null | undefined): void;
	public add(file: File[] | null | undefined): void;
	public add(file: VertFile[] | null | undefined): void;
	public add(file: FileList | null | undefined): void;
	public add(
		file:
			VertFile | File | VertFile[] | File[] | FileList | null | undefined,
	) {
		if (!file) return;
		if (Array.isArray(file) || file instanceof FileList) {
			for (const f of file) void this.addFile(f);
		} else {
			void this.addFile(file);
		}
	}

	// like add(), but resolves once all files have finished being added
	public addAsync(file: VertFile | null | undefined): Promise<void>;
	public addAsync(file: File | null | undefined): Promise<void>;
	public addAsync(file: File[] | null | undefined): Promise<void>;
	public addAsync(file: VertFile[] | null | undefined): Promise<void>;
	public addAsync(file: FileList | null | undefined): Promise<void>;
	public async addAsync(
		file:
			VertFile | File | VertFile[] | File[] | FileList | null | undefined,
	) {
		if (!file) return;
		if (Array.isArray(file)) {
			await Promise.all(file.map((f) => this.addFile(f)));
		} else if (file instanceof FileList) {
			await Promise.all(Array.from(file).map((f) => this.addFile(f)));
		} else {
			await this.addFile(file);
		}
	}

	public async convertAll() {
		const filenames = this.files.map((file) => file.name);
		const promiseFns = this.files.map((f) => () => f.convert());
		const queue = new PQueue({ concurrency: conversionConcurrency() });
		const results = await Promise.allSettled(
			promiseFns.map((fn) => queue.add(fn)),
		);
		for (const [i, result] of results.entries()) {
			if (result.status === "rejected")
				error(
					["files", "convert"],
					`batch conversion failed for file ${i + 1} (${filenames[i]}): ${result.reason}`,
				);
		}
	}

	public async downloadAll() {
		if (this.files.length === 0) return;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const dlFiles: any[] = [];
		const filenames: string[] = [];

		for (let i = 0; i < this.files.length; i++) {
			const file = this.files[i];
			const result = file.result;

			if (!result) {
				error(["files"], "No result found");
				continue;
			}

			let to = result.to;
			if (!to.startsWith(".")) to = `.${to}`;

			filenames.push(file.file.name.replace(/\.[^/.]+$/, "") + to);
		}

		let totalSize = 0;

		for (let i = 0; i < this.files.length; i++) {
			const file = this.files[i];
			const result = file.result;

			if (!result) continue;

			let filename = filenames[i];

			// check if this filename appears more than once
			const isDuplicate =
				filenames.filter((name) => name === filename).length > 1;
			if (isDuplicate) {
				const nameParts = filename.lastIndexOf(".");
				const nameWithoutExt = filename.substring(0, nameParts);
				const ext = filename.substring(nameParts);
				filename = `${nameWithoutExt} (${i + 1})${ext}`;
			}

			totalSize += result.file.size;
			dlFiles.push({
				name: filename,
				lastModified: Date.now(),
				input: result.file.stream(),
			});
		}

		const { downloadZip } = await import("client-zip");
		const size = (totalSize / (1024 * 1024)).toFixed(2);
		log(
			["files"],
			`adding ${dlFiles.length} files into zip (size: ${size}MB)...`,
		);
		ToastManager.add({
			type: "info",
			message: m["convert.panel.download_all_toast"]({
				count: dlFiles.length,
				size,
			}),
		});
		const blob = await downloadZip(dlFiles, "converted.zip").blob();

		const url = URL.createObjectURL(blob);

		const settings = readSettings<{ filenameFormat?: string }>();
		const filenameFormat = settings.filenameFormat || "VERT_%name%";

		const a = document.createElement("a");
		a.href = url;
		a.download = `${formatFilename(filenameFormat, "Multi")}.zip`;
		a.click();
		URL.revokeObjectURL(url);
		a.remove();
	}
}

export function setTheme(themeTo: "light" | "dark") {
	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(themeTo);
	localStorage.setItem("theme", themeTo);
	log(["theme"], `set to ${themeTo}`);
	theme.set(themeTo);

	// Lock dark reader if it's set to dark mode
	if (themeTo === "dark") {
		const lock = document.createElement("meta");
		lock.name = "darkreader-lock";
		document.head.appendChild(lock);
	} else {
		const lock = document.querySelector('meta[name="darkreader-lock"]');
		if (lock) lock.remove();
	}
}

export function setEffects(effectsEnabled: boolean) {
	localStorage.setItem("effects", effectsEnabled.toString());
	log(["effects"], `set to ${effectsEnabled}`);
	effects.set(effectsEnabled);
}

export const files = new Files();
export const showGradient = writable(true);
export const gradientColor = writable("");
export const goingLeft = writable(false);
export const dropping = writable(false);
export const vertdLoaded = writable(false);
export const dropdownStates = writable<Record<string, string>>({});
export const fileSettings = $state(writable<VertFile | undefined | null>(null)); // undefined = all files, null = hidden

export const isMobile = writable(false);
export const effects = writable(true);
export const theme = writable<"light" | "dark">("light");
export const locale = writable(getLocale());
export const availableLocales = {
	en: "English",
	es: "Español",
	fr: "Français",
	de: "Deutsch",
	it: "Italiano",
	ba: "Bosanski",
	hr: "Hrvatski",
	id: "Bahasa Indonesia",
	tr: "Türkçe",
	ja: "日本語",
	ko: "한국어",
	pl: "Polski",
	cs: "Čeština",
	no: "Norsk",
	el: "Ελληνικά",
	"zh-Hans": "简体中文",
	"zh-Hant": "繁體中文",
	"pt-BR": "Português (Brasil)",
};

export function updateLocale(newLocale: string) {
	if (!Object.keys(availableLocales).includes(newLocale)) newLocale = "en";

	log(["locale"], `set to ${newLocale}`);
	localStorage.setItem("locale", newLocale);
	// @ts-expect-error shush
	setLocale(newLocale, { reload: false });
	// @ts-expect-error shush
	locale.set(newLocale);
}

export function link(
	tag: string | string[],
	text: string,
	links: string | string[],
	newTab?: boolean | boolean[],
	className?: string | string[],
) {
	if (!text) return "";

	const tags = Array.isArray(tag) ? tag : [tag];
	const linksArr = Array.isArray(links) ? links : [links];
	const newTabArr = Array.isArray(newTab) ? newTab : [newTab];
	const classArr = Array.isArray(className) ? className : [className];

	let result = text;

	tags.forEach((t, i) => {
		const link = linksArr[i] ?? "#";
		const target = newTabArr[i]
			? 'target="_blank" rel="noopener noreferrer"'
			: "";
		const cls = classArr[i] ? `class="${classArr[i]}"` : "";

		const regex = new RegExp(`\\[${t}\\](.*?)\\[\\/${t}\\]`, "g");
		result = result.replace(
			regex,
			(_, inner) => `<a href="${link}" ${target} ${cls} >${inner}</a>`,
		);
	});

	return result;
}

export function sanitize(
	html: string,
	allowedTags: string[] = ["a", "b", "code", "br"],
): string {
	return sanitizeHtml(html, {
		allowedTags: allowedTags,
		allowedAttributes: {
			a: ["href", "target", "rel", "class"],
			"*": ["class"],
		},
		allowedSchemes: ["http", "https", "mailto", "blob"],
	});
}

/**
 * Binary search for a max value without knowing the exact value, only that it
 * can be under or over It dose not test every number but instead looks for
 * 1,2,4,8,16,32,64,128,96,95 to figure out that you thought about #96 from
 * 0-infinity
 *
 * @example findFirstPositive(x => matchMedia(`(max-resolution: ${x}dpi)`).matches)
 * @author Jimmy Wärting
 * @see {@link https://stackoverflow.com/a/72124984/1008999}
 * @param {function} f The function to run the test on (should return truthy or falsy values)
 * @param {bigint} [b=1] Where to start looking from
 * @param {function} d privately used to calculate the next value to test
 * @returns {bigint} Integer
 */
function findFirstPositive(
	f: (x: bigint) => number,
	b = 1n,
	d = (e: bigint, g: bigint, c?: bigint): bigint =>
		g < e
			? -1n
			: 0 < f((c = (e + g) >> 1n))
				? c == e || 0 >= f(c - 1n)
					? c
					: d(e, c - 1n)
				: d(c + 1n, g),
): bigint {
	for (; 0 >= f(b); b <<= 1n);
	return d(b >> 1n, b) - 1n;
}

export const getMaxArrayBufferSize = (): number => {
	if (typeof window === "undefined") return 2 * GB; // default for SSR

	// lmao uh mobile devices definitely have a much lower limit and using binary search here
	// was causing crashes especially on iOS, so just return 2GB to be safe :p
	if (get(isMobile)) {
		log(
			["converters"],
			`mobile device likely detected, using 2GB fallback for max ArrayBuffer size`,
		);
		// don't save to localStorage, since it can always be a false positive or the user's browser window is simply just small
		return 2 * GB;
	}

	// check cache first
	const cached = localStorage.getItem("maxArrayBufferSize");
	if (cached) {
		const parsed = Number(cached);
		log(
			["converters"],
			`using cached max ArrayBuffer size: ${parsed} bytes`,
		);
		if (!isNaN(parsed) && parsed > 0) return parsed;
	}

	// detect max size using binary search
	const maxSize = findFirstPositive((x) => {
		try {
			new ArrayBuffer(Number(x));
			return 0; // false = can allocate
		} catch {
			return 1; // true = cannot allocate
		}
	});

	const result = Number(maxSize);
	localStorage.setItem("maxArrayBufferSize", result.toString());
	log(["converters"], `detected max ArrayBuffer size: ${result} bytes`);

	return result;
};

export const MAX_ARRAY_BUFFER_SIZE = getMaxArrayBufferSize();

export const getVertdLimit = async (
	baseUrl?: string,
): Promise<number | null> => {
	try {
		const limit = await vertdFetch(
			"/api/size_limit",
			{
				method: "GET",
			},
			undefined,
			baseUrl,
		);
		const parsed = Number(limit);
		if (!Number.isFinite(parsed) || parsed <= 0) return null;

		log(["vertd"], `fetched vertd size limit: ${parsed} bytes`);
		return parsed;
	} catch (e) {
		error(["vertd"], `failed to fetch vertd size limit: ${e}`);
		return null;
	}
};
