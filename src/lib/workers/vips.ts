import type { WorkerMessage } from "#lib/types";
import type { ConversionSettings } from "#lib/types/conversion-settings";
import Vips from "wasm-vips";
import vipsWasm from "wasm-vips/vips.wasm?url";

type VipsInstance = Awaited<ReturnType<typeof Vips>>;
type VipsImage = ReturnType<VipsInstance["Image"]["newFromBuffer"]>;

const WASM_URLS: Record<string, string> = {
	"vips.wasm": vipsWasm,
};

// note: dynamic libraries still cause wasm-vips to take a long time to (or never) initialize, imagemagick handles all these anyways
const DYNAMIC_LIBRARIES: string[] = [];

const NO_QUALITY = new Set([".gif", ".svg", ".ppm", ".pnm"]);
const OPAQUE = new Set([".jpg", ".jpeg", ".jpe", ".jfif", ".ppm", ".pnm"]);

const COLOURSPACES: Record<string, string> = {
	srgb: "srgb",
	rgb: "rgb",
	cmyk: "cmyk",
	lab: "lab",
	xyz: "xyz",
	gray: "b-w",
};

const BAND_FORMATS: Record<string, string> = {
	8: "uchar",
	16: "ushort",
	32: "float",
};

const isWasmException = (err: unknown): err is WebAssembly.Exception =>
	typeof WebAssembly !== "undefined" &&
	typeof WebAssembly.Exception === "function" &&
	err instanceof WebAssembly.Exception;

const formatError = (err: unknown): string => {
	if (isWasmException(err)) {
		const payload = (err as { message?: unknown }).message;
		if (Array.isArray(payload)) {
			const parts = payload.filter(
				(part): part is string =>
					typeof part === "string" && part.length > 0,
			);
			if (parts.length) return parts.join(": ").trim();
		} else if (typeof payload === "string" && payload.length) {
			return payload;
		}
	}

	if (err instanceof Error) return err.message;
	return String(err);
};

let vips: VipsInstance | null = null;
let vipsPromise: Promise<VipsInstance> | null = null;
let initialized = false;

const loadVips = (): Promise<VipsInstance> => {
	return (vipsPromise ??= Vips({
		dynamicLibraries: DYNAMIC_LIBRARIES,
		locateFile: (name: string) =>
			new URL(WASM_URLS[name] ?? name, import.meta.url).href,
		workaroundCors: true,
	}).catch((err) => {
		throw new Error(
			`wasm-vips failed to initialise (is the page cross-origin isolated?): ${err}`,
		);
	}));
};

const conversionOptions = (
	to: string,
	settings: ConversionSettings,
): Record<string, unknown> => {
	const options: Record<string, unknown> = {};

	if (!settings.metadata || settings.metadata === "false")
		options.strip = true;

	const quality = Number(settings.quality ?? settings.compression);
	if (!Number.isNaN(quality) && quality > 0 && !NO_QUALITY.has(to))
		options.Q = Math.min(100, quality);

	return options;
};

const handleMessage = async (
	message: WorkerMessage,
): Promise<Partial<WorkerMessage>> => {
	switch (message.type) {
		case "load": {
			try {
				vips = await loadVips();
				initialized = true;
				return { type: "loaded" };
			} catch (err) {
				return { type: "error", error: formatError(err) };
			}
		}
		case "convert": {
			if (!initialized || !vips)
				return { type: "error", error: "wasm-vips not initialized" };

			const to = message.to.startsWith(".")
				? message.to.toLowerCase()
				: `.${message.to.toLowerCase()}`;
			const from = message.input.from;

			const settings = JSON.parse(
				message.conversionSettings || "{}",
			) as ConversionSettings;

			const buffer = new Uint8Array(
				await message.input.file.arrayBuffer(),
			);

			let image: VipsImage | null = null;
			let flattened: VipsImage | null = null;
			let resized: VipsImage | null = null;
			let colourspace: VipsImage | null = null;
			let cast: VipsImage | null = null;

			try {
				image = vips.Image.newFromBuffer(buffer);

				// re-read with every page/frame if the image is animated
				if (image.getTypeof("n-pages") > 0) {
					image.delete();
					image = vips.Image.newFromBuffer(buffer, "[n=-1]");
				}

				// resize image
				const resolution = String(settings.resolution ?? "").trim();
				if (resolution && resolution !== "auto") {
					const [width, height] = resolution
						.split("x")
						.map((dim: string) => Number.parseInt(dim, 10));
					if (width && width > 0) {
						resized = image.thumbnailImage(width, {
							...(height && height > 0 ? { height } : {}),
						});
					}
				}
				let source = resized ?? image;

				// colour space conversion
				const space = COLOURSPACES[settings.colorSpace as string];
				if (space) {
					colourspace = source.colourspace(space);
					source = colourspace;
				}

				// bit depth / band format
				const bandFormat = BAND_FORMATS[String(settings.depth ?? "")];
				if (bandFormat) {
					cast = source.cast(bandFormat);
					source = cast;
				}

				// flatten transparency when the target can't store alpha or the user opted out
				const keepAlpha = settings.transparency !== false;
				if ((!keepAlpha || OPAQUE.has(to)) && source.hasAlpha()) {
					flattened = source.flatten({ background: [255, 255, 255] });
					source = flattened;
				}

				const result = source.writeToBuffer(
					to,
					conversionOptions(to, settings),
				);

				return { type: "finished", output: result };
			} catch (err) {
				return {
					type: "error",
					error: `vips failed to convert ${from} to ${to}: ${formatError(err)}`,
				};
			} finally {
				cast?.delete();
				colourspace?.delete();
				flattened?.delete();
				resized?.delete();
				image?.delete();
			}
		}
		default:
			return { type: "error", error: "Unknown message type" };
	}
};

if (self.name !== "em-pthread")
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
