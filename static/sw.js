const CACHE_NAME = "vert-wasm-cache-v2"; // updated when workers update

const WASM_FILES = [
	"/pandoc.wasm",
	"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
	"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm",
];

const WASM_URL_PATTERNS = [
	/\/src\/lib\/workers\/.*\.js$/, // dev mode worker files
	/\/assets\/.*worker.*\.js$/, // prod worker files
	/magick.*\.wasm$/, // magick-wasm (unneeded?)
];

function shouldCacheUrl(url) {
	const urlObj = new URL(url);

	if (WASM_FILES.includes(urlObj.pathname) || WASM_FILES.includes(url)) {
		return true;
	}

	return WASM_URL_PATTERNS.some(
		(pattern) => pattern.test(urlObj.pathname) || pattern.test(url),
	);
}

self.addEventListener("install", (event) => {
	console.log("[SW] installing service worker");

	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			const staticFiles = WASM_FILES.filter((file) =>
				file.startsWith("/"),
			);
			if (staticFiles.length > 0) {
				console.log("[SW] pre-caching static files:", staticFiles);
				return cache.addAll(staticFiles).catch((err) => {
					console.warn("[SW] failed to pre-cache some files:", err);
				});
			}
		}),
	);

	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (
							cacheName !== CACHE_NAME &&
							cacheName.startsWith("vert-wasm-cache")
						) {
							console.log("[SW] deleting old cache:", cacheName);
							return caches.delete(cacheName);
						}
					}),
				);
			})
			.then(() => {
				return self.clients.claim();
			}),
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;

	if (!shouldCacheUrl(request.url)) {
		return; // Let the request go through normally if not a target URL
	}

    // else intercept request
	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			if (cachedResponse) {
				console.log("[SW] serving from cache:", request.url);
				return cachedResponse;
			}

			console.log("[SW] fetching and caching:", request.url);
			return fetch(request)
				.then((response) => {
					if (!response.ok) {
						console.warn(
							"[SW] not caching failed response:",
							response.status,
							request.url,
						);
						return response;
					}

					const responseToCache = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache
							.put(request, responseToCache)
							.then(() => {
								console.log(
									"[SW] cached successfully:",
									request.url,
								);
							})
							.catch((err) => {
								console.warn(
									"[SW] failed to cache:",
									request.url,
									err,
								);
							});
					});

					return response;
				})
				.catch((err) => {
					console.error("[SW] fetch failed for:", request.url, err);
					throw err;
				});
		}),
	);
});

self.addEventListener("message", (event) => {
    if (!event.data) return;
    const type = event.data.type;

	if (type === "GET_CACHE_INFO") {
		event.waitUntil(
			caches.open(CACHE_NAME).then(async (cache) => {
				const keys = await cache.keys();
				let totalSize = 0;
				const files = [];

				for (const request of keys) {
					try {
						const response = await cache.match(request);
						if (response) {
							const blob = await response.blob();
							const size = blob.size;
							totalSize += size;

							files.push({
								url: request.url,
								size: size,
								type:
									response.headers.get("content-type") ||
									"unknown",
							});
						}
					} catch (err) {
						console.warn(
							"[SW] failed to get info for cached file:",
							request.url,
							err,
						);
					}
				}

				event.ports[0].postMessage({
					totalSize,
					fileCount: files.length,
					files,
				});
			}),
		);
	}

	if (type === "CLEAR_CACHE") {
		event.waitUntil(
			caches
				.delete(CACHE_NAME)
				.then(() => {
					console.log("[SW] cache cleared");
					return caches.open(CACHE_NAME);
				})
				.then(() => {
					event.ports[0].postMessage({ success: true });
				})
				.catch((err) => {
					console.error("[SW] failed to clear cache:", err);
					event.ports[0].postMessage({
						success: false,
						error: err.message,
					});
				}),
		);
	}
});
