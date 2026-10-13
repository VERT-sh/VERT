import { browser } from "$app/env";

const COI_RELOAD_KEY = "vertCoiReloaded";

export interface CacheInfo {
	totalSize: number;
	fileCount: number;
	files: Array<{
		url: string;
		size: number;
		type: string;
	}>;
}

class ServiceWorkerManager {
	private registration: ServiceWorkerRegistration | null = null;
	private initialized = false;

	async init(): Promise<void> {
		if (!browser || !("serviceWorker" in navigator) || this.initialized) {
			return;
		}

		try {
			this.registration = await navigator.serviceWorker.register(
				"/sw.js",
				{
					scope: "/",
				},
			);

			this.initialized = true;

			await navigator.serviceWorker.ready;
			this.ensureCrossOriginIsolation();
		} catch (error) {
			console.error(
				"[SW Manager] service worker registration failed:",
				error,
			);
		}
	}

	// ensure we are cross-origin isolated (COOP/COEP) so we can use SharedArrayBuffer
	private ensureCrossOriginIsolation(): void {
		const controlled = !!navigator.serviceWorker.controller;
		const isolated = window.crossOriginIsolated === true;

		if (controlled || isolated) {
			// success (or resumed) — allow a future reload for SW updates
			sessionStorage.removeItem(COI_RELOAD_KEY);
			if (controlled && !isolated)
				console.warn(
					"[SW Manager] service worker active but page is not cross-origin isolated; wasm-vips will be unavailable.",
				);
			return;
		}

		// already reloaded once and still not isolated, don't infinite loop
		if (sessionStorage.getItem(COI_RELOAD_KEY)) return;

		sessionStorage.setItem(COI_RELOAD_KEY, "controlling");
		console.log(
			"[SW Manager] reloading to let the service worker enable cross-origin isolation",
		);
		window.location.reload();
	}

	async getCacheInfo(): Promise<CacheInfo> {
		if (!this.registration || !navigator.serviceWorker.controller) {
			console.warn(
				"[SW Manager] no service worker available for cache info",
			);
			return { totalSize: 0, fileCount: 0, files: [] };
		}

		return new Promise((resolve, reject) => {
			const messageChannel = new MessageChannel();
			let settled = false;
			const timeoutId = setTimeout(() => {
				if (settled) return;
				settled = true;
				reject(new Error("Timeout waiting for cache info"));
			}, 5000);

			messageChannel.port1.onmessage = (e) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeoutId);
				resolve(e.data);
			};

			navigator.serviceWorker?.controller?.postMessage(
				{ type: "GET_CACHE_INFO" },
				[messageChannel.port2],
			);
		});
	}

	async clearCache(): Promise<void> {
		if (!this.registration || !navigator.serviceWorker.controller) {
			throw new Error("No service worker available for cache clearing");
		}

		return new Promise((resolve, reject) => {
			const messageChannel = new MessageChannel();
			let settled = false;
			const timeoutId = setTimeout(() => {
				if (settled) return;
				settled = true;
				reject(new Error("Timeout waiting for cache clear"));
			}, 10000);

			messageChannel.port1.onmessage = (e) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeoutId);
				if (e.data.success) {
					resolve();
				} else {
					reject(new Error(e.data.error || "Failed to clear cache"));
				}
			};

			navigator.serviceWorker?.controller?.postMessage(
				{ type: "CLEAR_CACHE" },
				[messageChannel.port2],
			);
		});
	}

	formatSize(bytes: number): string {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	}
}

export const swManager = new ServiceWorkerManager();

// Auto-initialize when imported
if (browser) {
	swManager.init();
}
