<script lang="ts">
	import Panel from "#lib/components/visual/Panel.svelte";
	import {
		BugIcon,
		ChartColumnIcon,
		PauseIcon,
		PlayIcon,
		RefreshCwIcon,
		TrashIcon,
	} from "@lucide/svelte";
	import type { ISettings } from "./index.svelte";
	import { effects } from "#lib/store/index.svelte";
	import { m } from "#lib/paraglide/messages";
	import { link, sanitize } from "#lib/store/index.svelte";
	import { swManager, type CacheInfo } from "#lib/util/sw";
	import { onMount } from "svelte";
	import { error } from "#lib/util/logger.svelte";
	import { ToastManager } from "#lib/util/toast.svelte";
	import { DISABLE_ALL_EXTERNAL_REQUESTS } from "#lib/util/consts";
	import { addDialog } from "#lib/store/DialogProvider";
	import { PUB_PLAUSIBLE_URL } from "$app/env/public";
	import { resolve } from "$app/paths";
	import clsx from "clsx";

	const { settings = $bindable() }: { settings: ISettings } = $props();

	let cacheInfo = $state<CacheInfo | null>(null);
	let isLoadingCache = $state(false);
	let isClearingData = $state(false);

	async function loadCacheInfo() {
		if (isLoadingCache || isClearingData) return;
		isLoadingCache = true;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		let controllerListener: (() => void) | undefined;
		let expired = false;
		try {
			if (!("serviceWorker" in navigator)) return;
			cacheInfo = await Promise.race([
				(async () => {
					await swManager.init();
					await navigator.serviceWorker.ready;
					if (expired) return null;
					if (!navigator.serviceWorker.controller) {
						await new Promise<void>((resolve) => {
							controllerListener = () => {
								if (navigator.serviceWorker.controller)
									resolve();
							};
							navigator.serviceWorker.addEventListener(
								"controllerchange",
								controllerListener,
							);
							controllerListener();
						});
					}
					if (expired) return null;
					return swManager.getCacheInfo();
				})(),
				new Promise<never>((_, reject) => {
					timeout = setTimeout(
						() =>
							reject(
								new Error(
									"Service worker cache loading timed out",
								),
							),
						10000,
					);
				}),
			]);
		} catch (err) {
			error(["privacy", "cache"], `Failed to load cache info: ${err}`);
		} finally {
			expired = true;
			clearTimeout(timeout);
			if (controllerListener)
				navigator.serviceWorker.removeEventListener(
					"controllerchange",
					controllerListener,
				);
			isLoadingCache = false;
		}
	}

	async function clearCache() {
		if (isLoadingCache || isClearingData) return;
		isLoadingCache = true;
		try {
			await swManager.clearCache();
			cacheInfo = null;
			isLoadingCache = false;
			await loadCacheInfo();
			ToastManager.add({
				type: "success",
				message: m["settings.privacy.cache.cache_cleared"](),
			});
		} catch (err) {
			error(["privacy", "cache"], `Failed to clear cache: ${err}`);
			ToastManager.add({
				type: "error",
				message: m["settings.privacy.cache.cache_clear_error"](),
			});
		} finally {
			isLoadingCache = false;
		}
	}

	async function clearAllData() {
		if (isClearingData) return;

		addDialog(
			m["settings.privacy.site_data.clear_all_data_confirm_title"](),
			m["settings.privacy.site_data.clear_all_data_confirm"](),
			[
				{
					text: m[
						"settings.privacy.site_data.clear_all_data_cancel"
					](),
					action: () => {},
				},
				{
					text: m["settings.privacy.site_data.clear_all_data"](),
					action: async () => {
						if (isClearingData) return;
						isClearingData = true;
						try {
							let failed = false;
							const operations = [
								["cache", () => swManager.clearCache()],
								["localStorage", () => localStorage.clear()],
								[
									"sessionStorage",
									() => sessionStorage.clear(),
								],
							] as const;
							for (const [name, clear] of operations) {
								try {
									await clear();
								} catch (err) {
									failed = true;
									error(
										["privacy", "data"],
										`Failed to clear ${name}: ${err}`,
									);
								}
							}
							if (failed)
								throw new Error(
									"Some site data failed to clear",
								);

							ToastManager.add({
								type: "success",
								message:
									m[
										"settings.privacy.site_data.all_data_cleared"
									](),
							});
						} catch (err) {
							error(
								["privacy", "data"],
								`Failed to clear all data: ${err}`,
							);
							ToastManager.add({
								type: "error",
								message:
									m[
										"settings.privacy.site_data.all_data_clear_error"
									](),
							});
						} finally {
							isClearingData = false;
							setTimeout(() => {
								window.location.href = "/";
							}, 1500);
						}
					},
				},
			],
			"warning",
		);
	}

	onMount(() => {
		loadCacheInfo();
	});
</script>

<Panel class="flex flex-col gap-8 p-6">
	<div class="flex flex-col gap-4">
		<h2 class="text-2xl font-bold">
			<ChartColumnIcon
				size="40"
				class="-mt-1 mr-2 inline-block rounded-full bg-accent-blue p-2"
				color="black"
			/>
			{m["settings.privacy.title"]()}
		</h2>
		<div class="flex flex-col gap-8">
			{#if !DISABLE_ALL_EXTERNAL_REQUESTS && PUB_PLAUSIBLE_URL}
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<p class="text-base font-bold">
							{m["settings.privacy.plausible.title"]()}
						</p>
						<p class="text-sm font-normal text-muted">
							{@html sanitize(
								link(
									["plausible_link", "analytics_link"],
									m[
										"settings.privacy.plausible.description"
									](),
									[
										"https://plausible.io/privacy-focused-web-analytics",
										"https://ats.vert.sh/vert.sh",
									],
								),
							)}
						</p>
					</div>
					<div class="flex w-full flex-col gap-3">
						<div class="flex w-full gap-3">
							<button
								onclick={() => (settings.plausible = true)}
								class={clsx(
									"btn flex flex-1 items-center justify-center rounded-lg p-4 text-black dynadark:text-white",
									!$effects && "!scale-100",
									settings.plausible && "selected",
								)}
							>
								<PlayIcon size="24" class="mr-2 inline-block" />
								{m["settings.privacy.plausible.opt_in"]()}
							</button>

							<button
								onclick={() => (settings.plausible = false)}
								class={clsx(
									"btn flex flex-1 items-center justify-center rounded-lg p-4 text-black dynadark:text-white",
									!$effects && "!scale-100",
									!settings.plausible && "selected",
								)}
							>
								<PauseIcon
									size="24"
									class="mr-2 inline-block"
								/>
								{m["settings.privacy.plausible.opt_out"]()}
							</button>
						</div>
					</div>
				</div>
			{/if}
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<p class="text-base font-bold">
						{m["settings.privacy.cache.title"]()}
					</p>
					<p class="text-sm font-normal text-muted">
						{m["settings.privacy.cache.description"]()}
					</p>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="rounded-lg bg-button p-4">
						<div class="text-sm text-muted">
							{m["settings.privacy.cache.total_size"]()}
						</div>
						<div class="flex items-center gap-2 text-lg font-bold">
							{#if isLoadingCache}
								<RefreshCwIcon size="16" class="animate-spin" />
								{m["settings.privacy.cache.loading_cache"]()}
							{:else}
								{cacheInfo
									? swManager.formatSize(cacheInfo.totalSize)
									: "0 B"}
							{/if}
						</div>
					</div>
					<div class="rounded-lg bg-button p-4">
						<div class="text-sm text-muted">
							{m["settings.privacy.cache.files_cached_label"]()}
						</div>
						<div class="flex items-center gap-2 text-lg font-bold">
							{#if isLoadingCache}
								<RefreshCwIcon size="16" class="animate-spin" />
								{m["settings.privacy.cache.loading_cache"]()}
							{:else}
								{cacheInfo?.fileCount ?? 0}
							{/if}
						</div>
					</div>
				</div>

				<div class="flex w-full gap-3">
					<button
						onclick={loadCacheInfo}
						class={clsx(
							"btn flex flex-1 items-center justify-center rounded-lg p-4 text-black dynadark:text-white",
							!$effects && "!scale-100",
						)}
						disabled={isLoadingCache || isClearingData}
					>
						<RefreshCwIcon size="24" class="mr-2 inline-block" />
						{m["settings.privacy.cache.refresh_cache"]()}
					</button>
					<button
						onclick={clearCache}
						class={clsx(
							"btn flex flex-1 items-center justify-center rounded-lg p-4 text-black dynadark:text-white",
							!$effects && "!scale-100",
						)}
						disabled={isLoadingCache || isClearingData}
					>
						<TrashIcon size="24" class="mr-2 inline-block" />
						{m["settings.privacy.cache.clear_cache"]()}
					</button>
				</div>
			</div>

			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<p class="text-base font-bold">
						{m["settings.privacy.site_data.title"]()}
					</p>
					<p class="text-sm font-normal text-muted">
						{m["settings.privacy.site_data.description"]()}
					</p>
				</div>

				<button
					onclick={clearAllData}
					class={clsx(
						"btn flex w-full items-center justify-center rounded-lg p-4 text-black dynadark:text-white",
						!$effects && "!scale-100",
					)}
					disabled={isClearingData}
				>
					<TrashIcon size="24" class="mr-2 inline-block" />
					{m["settings.privacy.site_data.clear_all_data"]()}
				</button>
			</div>

			<div class="flex justify-center">
				<a
					href={resolve("/debug")}
					class="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
				>
					<BugIcon size="14" />
					{m["settings.privacy.debug_link"]()}
				</a>
			</div>
		</div>
	</div></Panel
>
