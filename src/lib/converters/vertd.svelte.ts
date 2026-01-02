import VertdErrorComponent from "$lib/components/functional/VertdError.svelte";
import { error, log } from "$lib/util/logger";
import { m } from "$lib/paraglide/messages";
import { Settings } from "$lib/sections/settings/index.svelte";
import { VertdInstance } from "$lib/sections/settings/vertdSettings.svelte";
import { VertFile } from "$lib/types";
import { Converter, FormatInfo } from "./converter.svelte";
import { PUB_DISABLE_FAILURE_BLOCKS } from "$env/static/public";

interface UploadResponse {
	id: string;
	auth: string;
	from: string;
	to: null;
	completed: false;
	totalFrames: number;
}

interface RouteRequestMap {
	"/api/keep": {
		id: string;
		token: string;
	};
}

interface RouteResponseMap {
	"/api/upload": UploadResponse;
	"/api/version": string;
	"/api/keep": void;
}

export const vertdFetch: {
	<U extends keyof RouteRequestMap>(
		url: U,
		options: RequestInit,
		body: RouteRequestMap[U],
	): Promise<RouteResponseMap[U]>;
	<U extends Exclude<keyof RouteResponseMap, keyof RouteRequestMap>>(
		url: U,
		options: RequestInit,
	): Promise<RouteResponseMap[U]>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} = async (url: any, options: RequestInit, body?: any) => {
	const domain = await VertdInstance.instance.url();

	// if there is a body, insert a Content-Type: application/json header
	if (body) {
		options.headers = {
			"Content-Type": "application/json",
			...(options.headers || {}),
		};
		options.body = JSON.stringify(body);
	}

	const res = await fetch(domain + url, options);

	const text = await res.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(text);
	}

	if (json.type === "error") {
		throw new Error(json.data);
	}

	return json.data;
};

// ws types

export type ConversionSpeed =
	| "verySlow"
	| "slower"
	| "slow"
	| "medium"
	| "fast"
	| "ultraFast";

interface StartJobMessage {
	type: "startJob";
	data: {
		token: string;
		jobId: string;
		to: string;
		speed: ConversionSpeed;
		keepMetadata: boolean;
	};
}

interface ErrorMessage {
	type: "error";
	data: {
		message: string;
	};
}

interface ProgressMessage {
	type: "progressUpdate";
	data: ProgressData;
}

interface CompletedMessage {
	type: "jobFinished";
	data: {
		jobId: string;
	};
}

interface CancelJobMessage {
	type: "cancelJob";
	data: {
		jobId: string;
		token: string;
	};
}

interface JobCancelledMessage {
	type: "jobCancelled";
	data: {
		jobId: string;
	};
}

interface FpsProgress {
	type: "fps";
	data: number;
}

interface FrameProgress {
	type: "frame";
	data: number;
}

type ProgressData = FpsProgress | FrameProgress;

type VertdMessage =
	| StartJobMessage
	| ErrorMessage
	| ProgressMessage
	| CancelJobMessage
	| JobCancelledMessage
	| CompletedMessage;

const progressEstimates = {
	upload: 25,
	convert: 50,
	download: 25,
};

const progressEstimate = (
	progress: number,
	type: keyof typeof progressEstimates,
) => {
	const previousValues = Object.values(progressEstimates)
		.filter((_, i) => i < Object.keys(progressEstimates).indexOf(type))
		.reduce((a, b) => a + b, 0);
	return progress * progressEstimates[type] + previousValues;
};

const uploadFile = async (file: VertFile): Promise<UploadResponse> => {
	const apiUrl = await VertdInstance.instance.url();
	const formData = new FormData();
	formData.append("file", file.file, file.name);
	const xhr = new XMLHttpRequest();
	xhr.open("POST", `${apiUrl}/api/upload`, true);

	return new Promise((resolve, reject) => {
		xhr.upload.addEventListener("progress", (e) => {
			console.log(e);
			if (e.lengthComputable) {
				file.progress = progressEstimate(e.loaded / e.total, "upload");
			}
		});

		console.log("meow");

		xhr.onload = () => {
			try {
				console.log("xhr.responseText");
				const res = JSON.parse(xhr.responseText);
				if (res.type === "error") {
					reject(res.data);
					return;
				}
				resolve(res.data);
			} catch {
				console.log(xhr.responseText);
				reject(xhr.statusText);
			}
		};

		xhr.onerror = () => {
			console.log(xhr.statusText);
			reject(xhr.statusText);
		};

		xhr.send(formData);
		console.log("sent!");
	});
};

const downloadFile = async (url: string, file: VertFile): Promise<Blob> => {
	const xhr = new XMLHttpRequest();
	xhr.open("GET", url, true);
	xhr.responseType = "blob";

	return new Promise((resolve, reject) => {
		xhr.addEventListener("progress", (e) => {
			if (e.lengthComputable) {
				file.progress = progressEstimate(
					e.loaded / e.total,
					"download",
				);
			}
		});

		xhr.onload = () => {
			if (xhr.status === 200) {
				resolve(xhr.response);
			} else {
				reject(xhr.statusText);
			}
		};

		xhr.onerror = () => {
			reject(xhr.statusText);
		};

		xhr.send();
	});
};

export class VertdConverter extends Converter {
	public name = "vertd";
	public ready = $state(false);
	public reportsProgress = true;

	private activeConversions = new Map<
		string,
		{
			ws: WebSocket;
			jobId: string;
			token: string;
		}
	>();

	public supportedFormats = [
		new FormatInfo("mkv", true, true),
		new FormatInfo("mp4", true, true),
		new FormatInfo("webm", true, true),
		new FormatInfo("avi", true, true),
		new FormatInfo("wmv", true, true),
		new FormatInfo("mov", true, true),
		new FormatInfo("gif", true, true),
		new FormatInfo("mts", true, true),
		new FormatInfo("ts", true, true),
		new FormatInfo("m2ts", true, true),
		new FormatInfo("mpg", true, true),
		new FormatInfo("mpeg", true, true),
		new FormatInfo("flv", true, true),
		new FormatInfo("f4v", true, true),
		new FormatInfo("vob", true, true),
		new FormatInfo("m4v", true, true),
		new FormatInfo("3gp", true, true),
		new FormatInfo("3g2", true, true),
		new FormatInfo("mxf", true, true),
		new FormatInfo("ogv", true, true),
		new FormatInfo("rm", true, false),
		new FormatInfo("rmvb", true, false),
		new FormatInfo("h264", true, true),
		new FormatInfo("divx", true, true),
		new FormatInfo("swf", true, true),
		new FormatInfo("amv", true, true),
		new FormatInfo("asf", true, true),
		new FormatInfo("nut", true, true),
	];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private log: (...msg: any[]) => void = () => {};

	constructor() {
		super();
		this.log = (msg) => log(["converters", this.name], msg);
		this.log("created converter");
		this.log("not rly sure how to implement this :P");
		this.status = "ready";
	}

	private blocked(hash: string): boolean {
		let blockedHashes = Settings.instance.settings.vertdBlockedHashes;

		// ensure it's a map
		// this might fix the "e.get" isn't a function error, but i can't reproduce it
		if (!(blockedHashes instanceof Map) || blockedHashes === null) {
			blockedHashes = new Map(Object.entries(blockedHashes || {}));
			Settings.instance.settings.vertdBlockedHashes = blockedHashes;
			Settings.instance.save();
		}

		const now = new Date();
		const dates = blockedHashes.get(hash) || [];
		const filteredDates = dates.filter(
			(date) => now.getTime() - date.getTime() < 60 * 60 * 1000,
		);

		if (filteredDates.length === 0) {
			blockedHashes.delete(hash);
			return false;
		}

		blockedHashes.set(hash, filteredDates);

		Settings.instance.save();

		return filteredDates.length >= 3;
	}

	private failure(hash: string): void {
		let blockedHashes = Settings.instance.settings.vertdBlockedHashes;

		// same as above (blocked())
		if (!(blockedHashes instanceof Map) || blockedHashes === null) {
			blockedHashes = new Map(Object.entries(blockedHashes || {}));
			Settings.instance.settings.vertdBlockedHashes = blockedHashes;
			Settings.instance.save();
		}

		const now = new Date();
		const dates = blockedHashes.get(hash) || [];
		dates.push(now);
		blockedHashes.set(hash, dates);
		Settings.instance.save();
	}

	public async convert(input: VertFile, to: string): Promise<VertFile> {
		if (to.startsWith(".")) to = to.slice(1);

		let hash: string;
		if (PUB_DISABLE_FAILURE_BLOCKS === "false") {
			hash = await input.hash();

			if (this.blocked(hash)) {
				this.log(`conversion blocked for file ${input.name}`);
				throw new Error(
					m["convert.errors.vertd_ratelimit"]({
						filename: input.name,
					}),
				);
			}
		}

		const uploadRes = await uploadFile(input);
		const apiUrl = await VertdInstance.instance.url();

		return new Promise((resolve, reject) => {
			const protocol = apiUrl.startsWith("https") ? "wss:" : "ws:";
			const ws = new WebSocket(
				`${protocol}//${apiUrl.replace("http://", "").replace("https://", "")}/api/ws`,
			);

			this.activeConversions.set(input.id, {
				ws,
				jobId: uploadRes.id,
				token: uploadRes.auth,
			});

			ws.onopen = () => {
				const speed = Settings.instance.settings.vertdSpeed;
				const keepMetadata = Settings.instance.settings.metadata;
				this.log("opened ws connection to vertd");
				const msg: StartJobMessage = {
					type: "startJob",
					data: {
						jobId: uploadRes.id,
						token: uploadRes.auth,
						to,
						speed,
						keepMetadata,
					},
				};
				ws.send(JSON.stringify(msg));
				this.log("sent startJob message");
			};

			ws.onmessage = async (e) => {
				const msg: VertdMessage = JSON.parse(e.data);
				this.log(`received message ${msg.type}`);
				switch (msg.type) {
					case "progressUpdate": {
						const data = msg.data;
						if (data.type !== "frame") break;
						const frame = data.data;
						input.progress = progressEstimate(
							frame / uploadRes.totalFrames,
							"convert",
						);
						break;
					}

					case "jobFinished": {
						this.log("job finished");
						ws.close();
						this.activeConversions.delete(input.id);
						const url = `${apiUrl}/api/download/${msg.data.jobId}/${uploadRes.auth}`;
						this.log(`downloading from ${url}`);
						// const res = await fetch(url).then((res) => res.blob());
						const res = await downloadFile(url, input);
						resolve(new VertFile(new File([res], input.name), to));
						break;
					}

					case "jobCancelled": {
						this.log("job cancelled");
						ws.close();
						this.activeConversions.delete(input.id);
						reject("Conversion cancelled");
						break;
					}

					case "error": {
						this.log(`error: ${msg.data.message}`);
						this.activeConversions.delete(input.id);
						if (hash) this.failure(hash);

						reject({
							component: VertdErrorComponent,
							additional: {
								jobId: uploadRes.id,
								auth: uploadRes.auth,
								from: input.from,
								to: to,
								errorMessage: msg.data.message,
							},
						});
					}
				}
			};
		});
	}

	public async cancel(input: VertFile): Promise<void> {
		const activeConversion = this.activeConversions.get(input.id);
		if (!activeConversion) {
			error(
				["converters", this.name],
				`no active conversion found for file ${input.name}`,
			);
			return;
		}

		log(
			["converters", this.name],
			`cancelling conversion for file ${input.name}`,
		);

		const { ws, jobId, token } = activeConversion;

		if (ws.readyState === WebSocket.OPEN) {
			const cancelMsg: CancelJobMessage = {
				type: "cancelJob",
				data: {
					jobId,
					token,
				},
			};
			ws.send(JSON.stringify(cancelMsg));
			this.log("sent cancelJob message");
		}

		ws.close();
		this.activeConversions.delete(input.id);
	}

	public async valid(): Promise<boolean> {
		if (!(await VertdInstance.instance.url())) {
			return false;
		}

		try {
			await vertdFetch("/api/version", {
				method: "GET",
			});
			return true;
		} catch (e) {
			this.log(e as unknown as string);
			return false;
		}
	}
}
