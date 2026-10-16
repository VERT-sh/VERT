const isWasmException = (err: unknown): err is WebAssembly.Exception =>
	typeof WebAssembly !== "undefined" &&
	typeof WebAssembly.Exception === "function" &&
	err instanceof WebAssembly.Exception;

// unwraps a wasm exception into a readable string
export const wasmExceptionMessage = (err: unknown): string | null => {
	if (!isWasmException(err)) return null;

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

	return null;
};

// serialize any thrown value into a readable message
// handles Error instances, strings, WASM exceptions (wasm-vips), ToastMsg-like objects (e.g. vertd errors carrying `additional.errorMessage`), and falling back to JSON for other objects
export const formatError = (
	err: unknown,
	fallback = "Unknown error",
): string => {
	if (err === null || err === undefined) return fallback;
	if (typeof err === "string") return err || fallback;

	const wasmMessage = wasmExceptionMessage(err);
	if (wasmMessage) return wasmMessage;

	if (err instanceof Error) return err.message || err.name;

	if (typeof err === "object") {
		const record = err as Record<string, unknown>;
		const additional = record.additional;
		if (additional && typeof additional === "object") {
			const nested = (additional as Record<string, unknown>).errorMessage;
			if (typeof nested === "string" && nested) return nested;
		}
		if (typeof record.message === "string" && record.message)
			return record.message;

		try {
			return JSON.stringify(err);
		} catch {
			return String(err);
		}
	}

	return String(err);
};
