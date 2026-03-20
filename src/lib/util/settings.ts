import { browser } from "$app/environment";
import { error } from "$lib/util/logger";

export function readSettings<T extends object = Record<string, unknown>>(): Partial<T> {
	if (!browser) return {};

	const raw = localStorage.getItem("settings");
	if (!raw) return {};

	try {
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			localStorage.removeItem("settings");
			return {};
		}

		return parsed as Partial<T>;
	} catch (e) {
		error(["settings", "error"], `failed to parse saved settings: ${e}`);
		localStorage.removeItem("settings");
		return {};
	}
}