import { Settings } from "./index.svelte";
import { PUB_VERTD_URL } from "$env/static/public";
import { log } from "$lib/util/logger";
import { writable } from "svelte/store";
import { getVertdLimit } from "$lib/store/index.svelte";

const LOCATIONS = [
	{ url: "https://eu.vertd.vert.sh" },
	{ url: "https://usa.vertd.vert.sh" },
];

export type VertdInner =
	{ type: "auto" } | { type: "eu" } | { type: "us" } | { type: "custom" };

export const getVertdCustomHeaders = (): Record<string, string> => {
	const raw = Settings.instance.settings.vertdCustomHeaders.trim();
	if (!raw) return {};

	const headers: Record<string, string> = {};

	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const separatorIndex = trimmed.indexOf(":");
		if (separatorIndex <= 0) continue;

		const key = trimmed.slice(0, separatorIndex).trim();
		const value = trimmed.slice(separatorIndex + 1).trim();
		if (!key || !value) continue;

		headers[key] = value;
	}

	return headers;
};

export const vertdSizeLimit = writable(Number.POSITIVE_INFINITY);

export class VertdInstance {
	public static instance = new VertdInstance();

	private inner = $state<VertdInner>({
		type: "auto",
	});

	public save() {
		localStorage.setItem("vertdInstance", JSON.stringify(this.inner));
	}

	public load() {
		const ls = localStorage.getItem("vertdInstance");

		// if custom vertd url and no saved setting, default to the custom url
		if (!ls) {
			const isCustomUrl =
				PUB_VERTD_URL && PUB_VERTD_URL !== "https://vertd.vert.sh";
			if (isCustomUrl) {
				this.inner = { type: "custom" };
				return;
			}
		}

		if (!ls) return;
		const inner: VertdInner = JSON.parse(ls);
		this.inner = {
			...this.inner,
			...inner,
		};
	}

	public innerData() {
		return this.inner;
	}

	public set(inner: VertdInner) {
		this.inner = inner;
		this.save();
	}

	public async url() {
		const latency = async (url: string) => {
			try {
				const start = performance.now();
				await fetch(url, {
					method: "GET",
					cache: "no-store",
					mode: "cors",
					headers: getVertdCustomHeaders(),
				});
				return performance.now() - start;
			} catch {
				return Number.POSITIVE_INFINITY;
			}
		};

		switch (this.inner.type) {
			case "auto": {
				const results = await Promise.all(
					LOCATIONS.map(async ({ url }) => ({
						url,
						latency: await latency(url),
					})),
				);

				const fastest = results
					.filter((result) => Number.isFinite(result.latency))
					.sort((a, b) => a.latency - b.latency)[0];

				const latencySummary = results
					.map(
						(result) =>
							`${result.url} = ${Number.isFinite(result.latency) ? `${result.latency.toFixed(2)}ms` : "unreachable"}`,
					)
					.join("\n");
				log(
					["settings", "vertd"],
					`vertd latency results: ${latencySummary}`,
				);

				if (fastest) return fastest.url;

				// if none are reachable, fall back to custom
				return Settings.instance.settings.vertdURL;
			}

			case "eu": {
				return "https://eu.vertd.vert.sh";
			}

			case "us": {
				return "https://usa.vertd.vert.sh";
			}

			case "custom": {
				return Settings.instance.settings.vertdURL;
			}
		}
	}
}

export function useVertdSizeLimit() {
	$effect(() => {
		let cancelled = false;

		const loadLimit = async () => {
			const apiUrl = await VertdInstance.instance.url();
			if (cancelled) return;

			const cacheKey = `vertd:size-limit:${apiUrl}`;
			const sessionStorageAvailable =
				typeof sessionStorage !== "undefined";

			let cachedLimit: number | null = null;

			if (sessionStorageAvailable) {
				try {
					const cached = sessionStorage.getItem(cacheKey);
					if (cached !== null) {
						const parsed = Number(cached);
						if (Number.isFinite(parsed) && parsed > 0) {
							cachedLimit = parsed;
						} else {
							sessionStorage.removeItem(cacheKey);
						}
					}
				} catch (e) {
					log(
						["vertd"],
						`failed to read vertd size limit from sessionStorage: ${e}`,
					);
				}
			}

			if (cachedLimit !== null) {
				log(
					["vertd"],
					`using cached vertd size limit: ${cachedLimit} bytes`,
				);
				vertdSizeLimit.set(cachedLimit);
				return;
			}

			const serverLimit = await getVertdLimit();
			const finalLimit = serverLimit ?? Number.POSITIVE_INFINITY;
			vertdSizeLimit.set(finalLimit);
			log(["vertd"], `fetched vertd size limit: ${finalLimit} bytes`);

			if (sessionStorageAvailable) {
				try {
					sessionStorage.setItem(cacheKey, finalLimit.toString());
				} catch (e) {
					log(
						["vertd"],
						`failed to cache vertd size limit in sessionStorage: ${e}`,
					);
				}
			}
		};

		void loadLimit();

		return () => {
			cancelled = true;
		};
	});
}
