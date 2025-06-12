import { browser } from "$app/environment";
import { converters } from "$lib/converters";
import { error, log } from "$lib/logger";
import { VertFile } from "$lib/types";
import { parseBlob, selectCover } from "music-metadata";
import PQueue from "p-queue";
import { writable } from "svelte/store";
import { addDialog } from "./DialogProvider";

class Files {
	public files = $state<VertFile[]>([]);

	public requiredConverters = $derived(
		Array.from(new Set(files.files.map((f) => f.converters).flat())),
	);

	public ready = $derived(
		this.files.length === 0
			? false
			: this.requiredConverters.every((f) => f?.ready) &&
			this.files.every((f) => !f.processing),
	);
	public results = $derived(
		this.files.length === 0 ? false : this.files.every((f) => f.result),
	);

	private thumbnailQueue = new PQueue({
		concurrency: browser ? navigator.hardwareConcurrency || 4 : 4,
	});

	private _addThumbnail = async (file: VertFile) => {
		this.thumbnailQueue.add(async () => {
			const isAudio = converters
				.find((c) => c.name === "ffmpeg")
				?.formatStrings()
				?.includes(file.from.toLowerCase());
			const isVideo = converters
				.find((c) => c.name === "vertd")
				?.formatStrings()
				?.includes(file.from.toLowerCase());

			try {
				if (isAudio) {
					// try to get the thumbnail from the audio via music-metadata
					const { common } = await parseBlob(file.file, {
						skipPostHeaders: true,
					});
					const cover = selectCover(common.picture);
					if (cover) {
						const blob = new Blob([cover.data], {
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
		mediaElement.src = URL.createObjectURL(file);

		await new Promise((resolve) => {
			if (isVideo) {
				(mediaElement as HTMLVideoElement).onloadeddata = resolve;
			} else {
				(mediaElement as HTMLImageElement).onload = resolve;
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
		const url = canvas.toDataURL();
		canvas.remove();
		return url;
	}

	private _warningShown = false;
	private _add(file: VertFile | File) {
		if (file instanceof VertFile) {
			this.files.push(file);
			this._addThumbnail(file);
		} else {
			const format = "." + file.name.split(".").pop()?.toLowerCase();
			if (!format) {
				log(["files"], `no extension found for ${file.name}`);
				return;
			}
			const converter = converters.find((c) =>
				c
					.formatStrings()
					.includes(format || ".somenonexistentextension"),
			);
			if (!converter) {
				log(["files"], `no converter found for ${file.name}`);
				this.files.push(new VertFile(file, format));
				return;
			}
			const to = converter.formatStrings().find((f) => f !== format);
			if (!to) {
				log(["files"], `no output format found for ${file.name}`);
				return;
			}
			const vf = new VertFile(file, to);
			this.files.push(vf);
			this._addThumbnail(vf);

			const isVideo = converter.name === "vertd";
			const acceptedExternalWarning =
				localStorage.getItem("acceptedExternalWarning") === "true";
			if (isVideo && !acceptedExternalWarning && !this._warningShown) {
				this._warningShown = true;
				const message =
					"If you choose to convert into a video format, some of your files will be uploaded to an external server to be converted. Do you want to continue?";
				const buttons = [
					{
						text: "No",
						action: () => {
							this.files = [
								...this.files.filter(
									(f) =>
										!f.converters
											.map((c) => c.name)
											.includes("vertd"),
								),
							];
							this._warningShown = false;
						},
					},
					{
						text: "Yes",
						action: () => {
							localStorage.setItem(
								"acceptedExternalWarning",
								"true",
							);
							this._warningShown = false;
						},
					},
				];
				addDialog(
					"External server warning",
					message,
					buttons,
					"warning",
				);
			}
		}
	}

	public add(file: VertFile | null | undefined): void;
	public add(file: File | null | undefined): void;
	public add(file: File[] | null | undefined): void;
	public add(file: VertFile[] | null | undefined): void;
	public add(file: FileList | null | undefined): void;
	public add(
		file:
			| VertFile
			| File
			| VertFile[]
			| File[]
			| FileList
			| null
			| undefined,
	) {
		if (!file) return;
		if (Array.isArray(file) || file instanceof FileList) {
			for (const f of file) {
				this._add(f);
			}
		} else {
			this._add(file);
		}
	}

	public async convertAll() {
		const promiseFns = this.files.map((f) => () => f.convert());
		const coreCount = navigator.hardwareConcurrency || 4;
		const queue = new PQueue({ concurrency: coreCount });
		await Promise.all(promiseFns.map((fn) => queue.add(fn)));
	}

	public async downloadAll() {
		if (files.files.length === 0) return;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const dlFiles: any[] = [];
		for (let i = 0; i < files.files.length; i++) {
			const file = files.files[i];
			const result = file.result;
			if (!result) {
				error(["files"], "No result found");
				continue;
			}
			dlFiles.push({
				name: file.file.name.replace(/\.[^/.]+$/, "") + result.to,
				lastModified: Date.now(),
				input: await result.file.arrayBuffer(),
			});
		}
		const { downloadZip } = await import("client-zip");
		const blob = await downloadZip(dlFiles, "converted.zip").blob();
		const url = URL.createObjectURL(blob);

		const settings = JSON.parse(localStorage.getItem("settings") ?? "{}");
		const filenameFormat = settings.filenameFormat ?? "VERT_%name%";

		const format = (name: string) => {
			const date = new Date().toISOString();
			return name
				.replace(/%date%/g, date)
				.replace(/%name%/g, "Multi")
				.replace(/%extension%/g, "");
		};

		const a = document.createElement("a");
		a.href = url;
		a.download = `${format(filenameFormat)}.zip`;
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

export const isMobile = writable(false);
export const effects = writable(true);
export const theme = writable<"light" | "dark">("light");
