import { browser } from "$app/environment";

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
		} catch (error) {
			console.error(
				"[SW Manager] service worker registration failed:",
				error,
			);
		}
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

			messageChannel.port1.onmessage = (event) => {
				resolve(event.data);
			};

			setTimeout(() => {
				reject(new Error("Timeout waiting for cache info"));
			}, 5000);

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

			messageChannel.port1.onmessage = (event) => {
				if (event.data.success) {
					resolve();
				} else {
					reject(
						new Error(event.data.error || "Failed to clear cache"),
					);
				}
			};

			setTimeout(() => {
				reject(new Error("Timeout waiting for cache clear"));
			}, 10000);

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
