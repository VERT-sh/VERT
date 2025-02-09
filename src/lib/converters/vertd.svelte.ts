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

interface StartJobMessage {
	type: "startJob";
	data: {
		token: string;
		jobId: string;
		to: string;
		speed: ConversionSpeed;
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
	| CompletedMessage;

export class VertdConverter extends Converter {
	public name = "vertd";
	public ready = $state(false);
	public reportsProgress = true;
	public supportedFormats = [".mkv", ".mp4", ".webm", ".avi", ".wmv", ".mov"];
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
		// POST http://localhost:8080/api/upload
		// multipart body, key is "file", value is the file
		const formData = new FormData();
		formData.append("file", input.file, input.name);
		// const uploadRes = await fetch("http://localhost:8080/api/upload", {
		// 	method: "POST",
		// 	body: formData,
		// });

		const uploadRes = await vertdFetch("/api/upload", {
			method: "POST",
			body: formData,
		});

		return new Promise((resolve, reject) => {
			const apiUrl = Settings.instance.settings.vertdURL;
			const ws = new WebSocket(
				`ws://${apiUrl.replace("http://", "").replace("https://", "")}/api/ws`,
			);
			ws.onopen = () => {
				const speed = Settings.instance.settings.vertdSpeed;
				this.log("opened ws connection to vertd");
				const msg: StartJobMessage = {
					type: "startJob",
					data: {
						jobId: uploadRes.id,
						token: uploadRes.auth,
						to,
						speed,
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
						input.progress = (frame / uploadRes.totalFrames) * 100;
						break;
					}

					case "jobFinished": {
						this.log("job finished");
						ws.close();
						const url = `${apiUrl}/api/download/${msg.data.jobId}/${uploadRes.auth}`;
						this.log(`downloading from ${url}`);
						const res = await fetch(url).then((res) => res.blob());
						resolve(
							new VertFile(
								new File([res], input.name),
								to,
								this,
								undefined,
							),
						);
						break;
					}

					case "error": {
						this.log(`error: ${msg.data.message}`);
						reject(msg.data.message);
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
