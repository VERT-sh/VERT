import type { WorkerMessage } from "#lib/types";
import type { ConversionSettings } from "#lib/types/conversion-settings";
import {
	buildConfig,
	DETAIL_LEVELS,
	loadVectorizer,
	type DetailLevel,
} from "#lib/vectorizer";

let ready: Promise<void> | null = null;

const formatError = (err: unknown): string =>
	err instanceof Error ? err.message : String(err);

const log = (...msg: unknown[]) => console.log("[vectorizer]", ...msg);
const error = (...msg: unknown[]) => console.error("[vectorizer]", ...msg);

const detailLevel = (value: unknown): DetailLevel =>
	DETAIL_LEVELS.includes(value as DetailLevel)
		? (value as DetailLevel)
		: "poster";

const handleMessage = async (
	message: WorkerMessage,
): Promise<Partial<WorkerMessage>> => {
	switch (message.type) {
		case "load": {
			try {
				ready = loadVectorizer().then(() => undefined);
				await ready;
				log("vectorizer wasm initialised");
				return { type: "loaded" };
			} catch (err) {
				return {
					type: "error",
					error: `failed to initialise vectorizer: ${formatError(err)}`,
				};
			}
		}
		case "convert": {
			try {
				await (ready ??= loadVectorizer().then(() => undefined));
				const { vectorizeSync, optimizeSync } = await loadVectorizer();

				const settings = JSON.parse(
					message.conversionSettings || "{}",
				) as ConversionSettings;

				const buffer = new Uint8Array(
					await message.input.file.arrayBuffer(),
				);
				const startedAt = performance.now();

				const detail = detailLevel(settings.vectorizeDetail);
				const raw = vectorizeSync(buffer, buildConfig(detail));
				log(
					`traced ${message.input.name} at "${detail}" detail in ${Math.round(performance.now() - startedAt)}ms`,
				);

				let svg = raw;
				const optimize = settings.vectorizeOptimize ?? true;
				if (optimize && raw.length > 0) {
					const optimizeStartedAt = performance.now();
					svg = optimizeSync(raw, { multipass: true });
					log(
						`optimized svg in ${Math.round(performance.now() - optimizeStartedAt)}ms (${raw.length} to ${svg.length} chars)`,
					);
				}

				return {
					type: "finished",
					output: new TextEncoder().encode(svg),
				};
			} catch (err) {
				error(`vectorization failed: ${err}`);
				return {
					type: "error",
					error: `vectorizer failed: ${formatError(err)}`,
				};
			}
		}
		default:
			return { type: "error", error: "Unknown message type" };
	}
};

onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const message = e.data;
	try {
		const res = await handleMessage(message);
		if (!res) return;
		postMessage({ ...res, id: message.id });
	} catch (err) {
		postMessage({
			type: "error",
			error: formatError(err),
			id: message.id,
		});
	}
};
