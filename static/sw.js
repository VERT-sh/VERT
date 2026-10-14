const CACHE_NAME = "vert-wasm-cache-v6"; // updated when workers update

let coepCredentialless = false;

const WASM_FILES = [
	"/pandoc.wasm", // from https://github.com/haskell-wasm/pandoc-wasm
];

const WASM_URL_PATTERNS = [
	/\/src\/lib\/workers\/.*\.js$/, // dev mode worker files
	/\/assets\/.*worker.*\.js$/, // prod worker files
	/magick.*\.wasm$/, // magick-wasm (unneeded?)
	/vips.*\.wasm$/, // wasm-vips (main + dynamic libs)
	/\/ffmpeg-core[^/]*\.(js|wasm)$/, // ffmpeg wasm core
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

const REVALIDATE_URLS = WASM_FILES.filter((file) => file.startsWith("/"));

function shouldRevalidate(url) {
	const urlObj = new URL(url);
	return REVALIDATE_URLS.includes(urlObj.pathname);
}

// compare the headers nginx/browsers send for static files so we only rewrite the cache when the file changed
function cacheSignature(response) {
	return (
		response.headers.get("etag") ||
		response.headers.get("last-modified") ||
		response.headers.get("content-length") ||
		""
	);
}

async function revalidate(request) {
	try {
		const cache = await caches.open(CACHE_NAME);
		const cached = await cache.match(request);
		if (!cached) return;

		const response = await fetch(request, { cache: "no-cache" });
		// 304 or any non-2xx means the cached copy is still current
		if (!response.ok) return;

		const signature = cacheSignature(response);
		const cachedSignature = cacheSignature(cached);

		if (!signature || signature !== cachedSignature) {
			await cache.put(request, response);
			console.log("[SW] revalidated and updated:", request.url);
		}
	} catch (err) {
		console.warn("[SW] revalidation failed:", request.url, err);
	}
}

// add COOP/COEP headers to requests so we are cross-origin isolated, needed for SharedArrayBuffer
function withCrossOriginIsolation(response) {
	if (response.status === 0) return response;

	const headers = new Headers(response.headers);
	headers.set(
		"Cross-Origin-Embedder-Policy",
		coepCredentialless ? "credentialless" : "require-corp",
	);
	if (!coepCredentialless)
		headers.set("Cross-Origin-Resource-Policy", "cross-origin");
	headers.set("Cross-Origin-Opener-Policy", "same-origin");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

// fetch a cacheable url, storing a copy on success
async function fetchAndCache(request) {
	const response = await fetch(request);

	if (!response.ok) {
		console.warn(
			"[SW] not caching failed response:",
			response.status,
			request.url,
		);
		return response;
	}

	const responseToCache = response.clone();
	caches
		.open(CACHE_NAME)
		.then((cache) => cache.put(request, responseToCache))
		.then(() => console.log("[SW] cached successfully:", request.url))
		.catch((err) =>
			console.warn("[SW] failed to cache:", request.url, err),
		);

	return response;
}

self.addEventListener("install", (e) => {
	console.log("[SW] installing service worker");

	e.waitUntil(
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

self.addEventListener("activate", (e) => {
	e.waitUntil(
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

self.addEventListener("fetch", (e) => {
	const r = e.request;

	if (r.cache === "only-if-cached" && r.mode !== "same-origin") return;

	const request =
		coepCredentialless && r.mode === "no-cors"
			? new Request(r, { credentials: "omit" })
			: r;

	const caching = shouldCacheUrl(request.url);
	const revalidateInBackground = shouldRevalidate(request.url);

	e.respondWith(
		(caching
			? caches.match(request).then((cachedResponse) => {
					if (cachedResponse) {
						console.log("[SW] serving from cache:", request.url);
						return cachedResponse;
					}
					console.log("[SW] fetching and caching:", request.url);
					return fetchAndCache(request);
				})
			: fetch(request)
		)
			.then(withCrossOriginIsolation)
			.catch((err) => {
				console.error("[SW] fetch failed for:", request.url, err);
				throw err;
			}),
	);

	// refresh same-origin wasm in the background so a redeploy is picked up, even while the cached copy is served
	if (revalidateInBackground) e.waitUntil(revalidate(request));
});

self.addEventListener("message", (e) => {
	if (!e.data) return;
	const type = e.data.type;
	const port = e.ports?.[0];

	if (type === "coepCredentialless") {
		coepCredentialless = e.data.value === true;
		return;
	}

	if (type === "GET_CACHE_INFO") {
		if (!port) return;
		e.waitUntil(
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

				port.postMessage({
					totalSize,
					fileCount: files.length,
					files,
				});
			}),
		);
	}

	if (type === "CLEAR_CACHE") {
		if (!port) return;
		e.waitUntil(
			caches
				.delete(CACHE_NAME)
				.then(() => {
					console.log("[SW] cache cleared");
					return caches.open(CACHE_NAME);
				})
				.then(() => {
					port.postMessage({ success: true });
				})
				.catch((err) => {
					console.error("[SW] failed to clear cache:", err);
					port.postMessage({
						success: false,
						error: err.message,
					});
				}),
		);
	}
});
