import { log } from "$lib/logger";
import { Settings } from "$lib/sections/settings/index.svelte";
import { VertFile } from "$lib/types";
import { Converter } from "./converter.svelte";

interface VertdError {
	type: "error";
	data: string;
}

interface VertdSuccess<T> {
	type: "success";
	data: T;
}

type VertdResponse<T> = VertdError | VertdSuccess<T>;

interface UploadResponse {
	id: string;
	auth: string;
	from: string;
	to: null;
	completed: false;
	totalFrames: number;
}

interface RouteMap {
	"/api/upload": UploadResponse;
	"/api/version": string;
}

const vertdFetch = async <U extends keyof RouteMap>(
	url: U,
	options: RequestInit,
): Promise<RouteMap[U]> => {
	const domain = Settings.instance.settings.vertdURL;
	const res = await fetch(`${domain}${url}`, options);
	const text = await res.text();
	let json: VertdResponse<RouteMap[U]> = null!;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(text);
	}

	if (json.type === "error") {
		throw new Error(json.data);
	}

	return json.data as RouteMap[U];
};

// ws types

export type ConversionSpeed =
	| "verySlow"
	| "slower"
	| "slow"
	| "medium"
	| "fast"
	| "ultraFast";

interface HelloMessage {
	type: "hello";
	auth: string;
}

interface StartJobMessage {
	type: "startJob";
	to: string;
	speed: ConversionSpeed;
}

interface ErrorMessage {
	type: "error";
	message: string;
}

type ProgressMessage = ProgressData;

interface CompletedMessage {
	type: "jobFinished";
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
	| HelloMessage
	| StartJobMessage
	| ErrorMessage
	| ProgressMessage
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
	const apiUrl = Settings.instance.settings.vertdURL;
	const formData = new FormData();
	formData.append("file", file.file, file.name);
	formData.append(
		"json",
		new Blob(
			[
				JSON.stringify({
					jobType: "conversion",
				}),
			],
			{ type: "application/json" },
		),
	);
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
	public supportedFormats = [
		".mkv",
		".mp4",
		".webm",
		".avi",
		".wmv",
		".mov",
		".gif",
		".mts",
	];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private log: (...msg: any[]) => void = () => {};

	constructor() {
		super();
		this.log = (msg) => log(["converters", this.name], msg);
		this.log("created converter");
		this.log("not rly sure how to implement this :P");
		this.ready = true;
	}

	public async convert(input: VertFile, to: string): Promise<VertFile> {
		if (to.startsWith(".")) to = to.slice(1);

		const uploadRes = await uploadFile(input);
		console.log(uploadRes);

		return new Promise((resolve, reject) => {
			const apiUrl = Settings.instance.settings.vertdURL;
			const protocol = apiUrl.startsWith("https") ? "wss:" : "ws:";
			const ws = new WebSocket(
				`${protocol}//${apiUrl.replace("http://", "").replace("https://", "")}/api/ws`,
			);
			ws.onopen = () => {
				const speed = Settings.instance.settings.vertdSpeed;
				this.log("opened ws connection to vertd");
				const hello: HelloMessage = {
					type: "hello",
					auth: uploadRes.auth,
				};
				ws.send(JSON.stringify(hello));
				this.log("sent hello message");
				const msg: StartJobMessage = {
					type: "startJob",
					to,
					speed,
				};
				ws.send(JSON.stringify(msg));
				this.log("sent startJob message");
			};

			ws.onmessage = async (e) => {
				const msg: VertdMessage = JSON.parse(e.data);
				this.log(`received message ${msg.type}`);
				switch (msg.type) {
					// case "progressUpdate": {
					// 	const data = msg.data;
					// 	if (data.type !== "frame") break;
					// 	const frame = data.data;
					// 	input.progress = progressEstimate(
					// 		frame / uploadRes.totalFrames,
					// 		"convert",
					// 	);
					// 	break;
					// }

					case "frame": {
						input.progress = progressEstimate(
							msg.data / uploadRes.totalFrames,
							"convert",
						);
						break;
					}

					case "jobFinished": {
						this.log("job finished");
						ws.close();
						const url = `${apiUrl}/api/download/${uploadRes.auth}`;
						this.log(`downloading from ${url}`);
						// const res = await fetch(url).then((res) => res.blob());
						const res = await downloadFile(url, input);
						resolve(new VertFile(new File([res], input.name), to));
						break;
					}

					case "error": {
						this.log(`error: ${msg.message}`);
						reject(msg.message);
					}
				}
			};
		});
	}

	public async valid(): Promise<boolean> {
		if (!Settings.instance.settings.vertdURL) {
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
