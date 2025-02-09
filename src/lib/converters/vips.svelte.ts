import { browser } from "$app/environment";
import { error, log } from "$lib/logger";
import { addToast } from "$lib/store/ToastProvider";
import type { OmitBetterStrict, WorkerMessage } from "$lib/types";
import { VertFile } from "$lib/types";
import VipsWorker from "$lib/workers/vips?worker&url";
import { Converter } from "./converter.svelte";

export class VipsConverter extends Converter {
	private worker: Worker = browser
		? new Worker(VipsWorker, {
				type: "module",
			})
		: null!;
	private id = 0;
	public name = "libvips";
	public ready = $state(false);
	public supportedFormats = [
		".png",
		".jpeg",
		".jpg",
		".webp",
		".gif",
		".hdr",
		".jpe",
		".mat",
		".pbm",
		".pfm",
		".pgm",
		".pnm",
		".ppm",
		".raw",
		".tif",
		".tiff",
		".jfif",
	];

	public readonly reportsProgress = false;

	constructor() {
		super();
		log(["converters", this.name], `created converter`);
		if (!browser) return;
		log(["converters", this.name], `loading worker @ ${VipsWorker}`);
		this.worker.onmessage = (e) => {
			const message: WorkerMessage = e.data;
			log(["converters", this.name], `received message ${message.type}`);
            if (message.type === "loaded") {
                this.ready = true;
            } else if (message.type === "error") {
                error(["converters", this.name], `error in worker: ${message.error}`);
				addToast("error", `Error in VIPS worker, some features may not work.`);
				throw new Error(message.error);
			} else {
				error(["converters", this.name], `unknown message type: ${message.type}`);
			}
		};
	}

	public async convert(input: VertFile, to: string): Promise<VertFile> {
		log(["converters", this.name], `converting ${input.name} to ${to}`);
		const msg = {
			type: "convert",
			input: {
				file: input.file,
				name: input.name,
				to: input.to,
				from: input.from,
			},
			to,
		} as WorkerMessage;
		const res = await this.sendMessage(msg);

		if (res.type === "finished") {
			log(["converters", this.name], `converted ${input.name} to ${to}`);
			return new VertFile(
				new File([res.output as unknown as BlobPart], input.name),
				to,
			);
		}

		if (res.type === "error") {
			throw new Error(res.error);
		}

		throw new Error("Unknown message type");
	}

	private sendMessage(
		message: OmitBetterStrict<WorkerMessage, "id">,
	): Promise<OmitBetterStrict<WorkerMessage, "id">> {
		const id = this.id++;
		let resolved = false;
		return new Promise((resolve) => {
			const onMessage = (e: MessageEvent) => {
				if (e.data.id === id) {
					this.worker.removeEventListener("message", onMessage);
					resolve(e.data);
					resolved = true;
				}
			};

			setTimeout(() => {
				if (!resolved) {
					this.worker.removeEventListener("message", onMessage);
					throw new Error("Timeout");
				}
			}, 60000);

			this.worker.addEventListener("message", onMessage);
			const msg = { ...message, id, worker: null };
			try {
				this.worker.postMessage(msg);
			} catch (e) {
				error(["converters", this.name], e);
			}
		});
	}
}
