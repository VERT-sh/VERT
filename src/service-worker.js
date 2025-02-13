/// <reference types="@sveltejs/kit" />
// code modified from https://svelte.dev/docs/kit/service-workers
import { build, files, version } from "$service-worker";

// create a unique cache name for this deployment
const CACHE = `cache-${version}`;

const ASSETS = [
	...build, // the app itself
	...files, // everything in `static`
];

self.addEventListener("install", (event) => {
	// create a new cache and add all files to it
	async function addFilesToCache() {
		try {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
			console.log(`assets cached successfully: ${ASSETS}`);
		} catch (err) {
			console.error(`failed to cache assets: ${err}`);
		}
	}

	console.log(`installing service worker for version ${version}`);
	event.waitUntil(addFilesToCache());
});

self.addEventListener("activate", (event) => {
	// remove previous cached data from disk
	async function deleteOldCaches() {
		try {
			const keys = await caches.keys();
			for (const key of keys) {
				if (key !== CACHE) {
					await caches.delete(key);
					console.log(`deleted old cache: ${key}`);
				}
			}
		} catch (error) {
			console.error(`failed to delete old caches: ${error}`);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener("fetch", (event) => {
	// ignore requests other than GET
	if (event.request.method !== "GET") return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// assets can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);
			if (response) {
				console.log(`serving ${url.pathname} from cache`);
				return response;
			}
		}

		// for everything else, try the network first, but
		// fall back to the cache if we're offline
		try {
			const response = await fetch(event.request);

			// if we're offline, fetch can return a value that is not a Response instead
			// of throwing, and we can't pass this non-Response to respondWith
			if (!(response instanceof Response)) {
				throw new Error("invalid response from fetch");
			}

			if (response.status === 200)
				cache.put(event.request, response.clone());

			return response;
		} catch (err) {
			const response = await cache.match(event.request);

			if (response) {
				console.log(`Returning ${event.request.url} from cache`);
				return response;
			}

			// if there's no cache, then just error out
			// as there is nothing we can do to respond to this request
			throw err;
		}
	}

	event.respondWith(respond());
});
