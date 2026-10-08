import { browser } from "$app/env";
import { PUB_ENV } from "$app/env/public";
import {
	AudioLinesIcon,
	BookTextIcon,
	FilmIcon,
	ImageIcon,
	RefreshCwIcon,
	ServerIcon,
} from "@lucide/svelte";
import type { Component } from "svelte";
import { converters } from "#lib/converters";
import { m } from "#lib/paraglide/messages";
import { DISABLE_ALL_EXTERNAL_REQUESTS, VERT_NAME } from "#lib/util/consts";
import {
	error as logError,
	formatLogLine,
	logs,
	type LogEntry,
} from "#lib/util/logger.svelte";
import { swManager, type CacheInfo } from "#lib/util/sw";

declare const __COMMIT_HASH__: string | undefined;
export const commitHash =
	__COMMIT_HASH__ && __COMMIT_HASH__ !== "unknown"
		? __COMMIT_HASH__
		: "unknown";

export interface ConverterInfo {
	name: string;
	status: string;
	formats: number;
	category: string;
	icon: Component;
	accent: string;
}

export const CONVERTER_META: Record<
	string,
	{ category: string; icon: Component; accent: string }
> = {
	imagemagick: {
		category: "image",
		icon: ImageIcon,
		accent: "bg-accent-blue",
	},
	ffmpeg: {
		category: "audio",
		icon: AudioLinesIcon,
		accent: "bg-accent-purple",
	},
	pandoc: {
		category: "doc",
		icon: BookTextIcon,
		accent: "bg-accent-green",
	},
	mediabunny: {
		category: "video",
		icon: FilmIcon,
		accent: "bg-accent-red",
	},
	vertd: {
		category: "video",
		icon: ServerIcon,
		accent: "bg-accent-red",
	},
};

export const STATUS_CLASSES: Record<string, string> = {
	"not-ready": "bg-button text-muted",
	downloading: "bg-accent-blue text-black",
	ready: "bg-accent-green text-black",
	"partially-ready": "bg-accent-purple text-black",
	error: "bg-accent-red text-black",
};

export function getStatusLabels(): Record<string, string> {
	return {
		"not-ready": m["settings.debug.converters.statuses.not_ready"](),
		downloading: m["settings.debug.converters.statuses.downloading"](),
		ready: m["settings.debug.converters.statuses.ready"](),
		"partially-ready":
			m["settings.debug.converters.statuses.partially_ready"](),
		error: m["settings.debug.converters.statuses.error"](),
	};
}

export function getConverterList(): ConverterInfo[] {
	return converters.map((converter) => ({
		name: converter.name,
		status: converter.status,
		formats: converter.supportedFormats.length,
		...(CONVERTER_META[converter.name] ?? {
			category: "other",
			icon: RefreshCwIcon,
			accent: "bg-button",
		}),
	}));
}

export function getLogLevelOptions() {
	return [
		{ value: "all", label: m["settings.debug.logs.levels.all"]() },
		{ value: "log", label: m["settings.debug.logs.levels.log"]() },
		{ value: "error", label: m["settings.debug.logs.levels.error"]() },
	];
}

export function filterLogs(
	entries: LogEntry[],
	level: string,
	query: string,
): LogEntry[] {
	const normalized = query.trim().toLowerCase();
	return entries.filter((entry) => {
		const matchesLevel = level === "all" || entry.level === level;
		const matchesQuery =
			!normalized ||
			entry.message.toLowerCase().includes(normalized) ||
			entry.prefixes.some((p) => p.toLowerCase().includes(normalized));
		return matchesLevel && matchesQuery;
	});
}

export interface SystemInfo {
	cores: string;
	memory: string;
	platform: string;
	screen: string;
}

const UNKNOWN = "-";

export function getSystemInfo(): SystemInfo {
	if (!browser) {
		return {
			cores: UNKNOWN,
			memory: UNKNOWN,
			platform: UNKNOWN,
			screen: UNKNOWN,
		};
	}

	const nav = navigator as Navigator & {
		deviceMemory?: number;
		userAgentData?: { platform?: string };
	};

	return {
		cores: navigator.hardwareConcurrency
			? String(navigator.hardwareConcurrency)
			: UNKNOWN,
		memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : UNKNOWN,
		platform: nav.userAgentData?.platform || navigator.platform || UNKNOWN,
		screen: `${window.screen.width}x${window.screen.height} @ ${window.devicePixelRatio}x`,
	};
}

export interface StorageInfo {
	cacheInfo: CacheInfo | null;
	storageEstimate: { usage: number; quota: number } | null;
	swRegistered: boolean;
	swControlled: boolean;
}

export async function getStorageInfo(): Promise<StorageInfo> {
	const result: StorageInfo = {
		cacheInfo: null,
		storageEstimate: null,
		swRegistered: false,
		swControlled: false,
	};

	if (!browser) return result;

	try {
		if (navigator.storage?.estimate) {
			const estimate = await navigator.storage.estimate();
			result.storageEstimate = {
				usage: estimate.usage ?? 0,
				quota: estimate.quota ?? 0,
			};
		}

		if ("serviceWorker" in navigator) {
			const registration =
				await navigator.serviceWorker.getRegistration();
			result.swRegistered = !!registration;
			result.swControlled = !!navigator.serviceWorker.controller;
			await swManager.init();
			await navigator.serviceWorker.ready;
			result.cacheInfo = await swManager.getCacheInfo();
		}
	} catch (err) {
		logError(["debug", "storage"], `failed to load storage info: ${err}`);
	}

	return result;
}

export function formatFileStamp(): string {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function downloadText(filename: string, content: string): void {
	if (!browser) return;
	const blob = new Blob([content], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function buildReport(systemInfo: SystemInfo): string {
	return [
		`${VERT_NAME} debug report`,
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		`Generated: ${new Date().toISOString()}`,
		`Environment: ${PUB_ENV}`,
		`Commit: ${commitHash}`,
		`User agent: ${browser ? navigator.userAgent : "unknown"}`,
		`Platform: ${systemInfo.platform}`,
		`Cores: ${systemInfo.cores}`,
		`Memory: ${systemInfo.memory}`,
		`Screen: ${systemInfo.screen}`,
		`External requests: ${DISABLE_ALL_EXTERNAL_REQUESTS ? "disabled" : "enabled"}`,
		`Converters: ${getConverterList()
			.map((c) => `${c.name}=${c.status}`)
			.join(", ")}`,
		"",
		`--- logs (${logs.entries.length}) ---`,
		...logs.entries.map(formatLogLine),
	].join("\n");
}
