import { m } from "#lib/paraglide/messages";
import { VertFile, type WorkerMessage } from "#lib/types";
import { ToastManager } from "#lib/util/toast.svelte";
import SpessaSynthWorker from "#lib/workers/spessasynth?worker&url";
import { browser } from "$app/env";
import { SvelteMap } from "svelte/reactivity";
import { Converter, FormatInfo, formatDuration } from "../converter.svelte";

// can't convert between MIDI and SoundFonts ofc, so they are "separate converters" but both use the same worker
export type SpessaSynthKind = "midi" | "soundfont";

const MIDI_FORMATS = [
	new FormatInfo("mid", true, true),
	new FormatInfo("midi", true, true),
	new FormatInfo("rmi", true, true), // can only encode when a sound bank is embedded
	new FormatInfo("kar", true, true), // karaoke midi, read as midi
	new FormatInfo("xmf", true, false),
	new FormatInfo("mxmf", true, false),
];

const SOUNDFONT_FORMATS = [
	new FormatInfo("sf2", true, true),
	new FormatInfo("sf3", true, true),
	new FormatInfo("sfogg", true, true),
	new FormatInfo("dls", true, true),
];

export class SpessaSynthConverter extends Converter {
	public name: string;
	public ready = $state(false);
	public supportedFormats: FormatInfo[];

	private activeConversions = new SvelteMap<string, Worker>();

	constructor(kind: SpessaSynthKind) {
		super();
		this.name =
			kind === "midi" ? "spessasynth-midi" : "spessasynth-soundfont";
		this.supportedFormats =
			kind === "midi" ? MIDI_FORMATS : SOUNDFONT_FORMATS;
		if (!browser) return;
		this.log(`created converter`);
	}

	protected async download(): Promise<void> {
		const worker = new Worker(SpessaSynthWorker, { type: "module" });
		try {
			await this.waitForMessage(worker, "ready", 10000);
			this.ready = true;
			this.status = "ready";
			this.log(`spessasynth worker initialised`);
		} catch (err) {
			this.error(`failed to initialise spessasynth worker: ${err}`);
			ToastManager.add({
				type: "error",
				message: m["workers.errors.spessasynth"](),
			});
			throw err;
		} finally {
			worker.terminate();
		}
	}

	public async convert(
		input: VertFile,
		to: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_settings: Record<string, unknown>,
	): Promise<VertFile> {
		await this.init();

		this.trackConversion(input);
		this.log(`converting ${input.name} (${input.id}) to ${to}`);
		const startedAt = performance.now();

		const worker = new Worker(SpessaSynthWorker, { type: "module" });
		this.activeConversions.set(input.id, worker);

		try {
			await this.waitForMessage(worker, "ready", 10000);

			const convertMsg: WorkerMessage = {
				type: "convert",
				id: input.id,
				input: {
					file: input.file,
					name: input.name,
					from: input.from,
					to,
				},
				to,
				conversionSettings: "{}",
			};
			worker.postMessage(convertMsg);

			const res = await this.waitForMessage(worker);
			if (res.type === "finished") {
				this.log(
					`converted ${input.name} (${input.id}) to ${to} in ${formatDuration(performance.now() - startedAt)}`,
				);
				const outputName =
					input.name.split(".").slice(0, -1).join(".") + to;
				return new VertFile(
					new File([res.output as unknown as BlobPart], outputName),
					to,
				);
			}

			if (res.type === "error") throw new Error(res.error);

			throw new Error("Unknown message type");
		} catch (err) {
			this.error(`conversion failed for ${input.name}: ${err}`);
			ToastManager.add({
				type: "error",
				message: m["workers.errors.spessasynth"](),
			});
			throw err;
		} finally {
			this.clearTrackedConversion(input);
			this.activeConversions.delete(input.id);
			worker.terminate();
		}
	}

	public async cancel(input: VertFile): Promise<void> {
		const worker = this.activeConversions.get(input.id);
		if (!worker) return;
		this.log(`cancelling conversion for file ${input.name} (${input.id})`);
		worker.terminate();
		this.activeConversions.delete(input.id);
	}

	private waitForMessage(
		worker: Worker,
		type?: string,
		timeout = 0,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	): Promise<any> {
		return new Promise((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			const onMessage = (e: MessageEvent) => {
				if (!type || e.data.type === type) {
					cleanup();
					resolve(e.data);
				} else if (e.data.type === "error") {
					cleanup();
					reject(new Error(e.data.error));
				}
			};
			const onError = (e: ErrorEvent) => {
				cleanup();
				reject(new Error(`Worker error: ${e.message}`));
			};
			const cleanup = () => {
				worker.removeEventListener("message", onMessage);
				worker.removeEventListener("error", onError);
				if (timer) clearTimeout(timer);
			};

			worker.addEventListener("message", onMessage);
			worker.addEventListener("error", onError);
			if (timeout)
				timer = setTimeout(() => {
					cleanup();
					reject(new Error(`Worker timeout after ${timeout}ms`));
				}, timeout);
		});
	}
}
