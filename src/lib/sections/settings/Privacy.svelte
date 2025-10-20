<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import {
		ChartColumnIcon,
		PauseIcon,
		PlayIcon,
		RefreshCwIcon,
		Trash2Icon,
	} from "lucide-svelte";
	import type { ISettings } from "./index.svelte";
	import { effects } from "$lib/store/index.svelte";
	import { m } from "$lib/paraglide/messages";
	import { link, sanitize } from "$lib/store/index.svelte";
	import { swManager, type CacheInfo } from "$lib/sw/register";
	import { onMount } from "svelte";
	import { error } from "$lib/logger";
	import { ToastManager } from "$lib/toast/index.svelte";
	import { DISABLE_ALL_EXTERNAL_REQUESTS } from "$lib/consts";

	const { settings = $bindable() }: { settings: ISettings } = $props();

	let cacheInfo = $state<CacheInfo | null>(null);
	let isLoadingCache = $state(false);

	async function loadCacheInfo() {
		if (isLoadingCache) return;
		isLoadingCache = true;
		try {
			await swManager.init();

			if ("serviceWorker" in navigator) {
				await navigator.serviceWorker.ready;
			}

			if (!navigator.serviceWorker.controller) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			cacheInfo = await swManager.getCacheInfo();
		} catch (err) {
			error(["privacy", "cache"], "Failed to load cache info:", err);
		} finally {
			isLoadingCache = false;
		}
	}

	async function clearCache() {
		if (isLoadingCache) return;
		isLoadingCache = true;
		try {
			await swManager.clearCache();
			cacheInfo = null;
			await loadCacheInfo();
			ToastManager.add({
				type: "success",
				message: m["settings.privacy.cache_cleared"](),
			});
		} catch (err) {
			error(["privacy", "cache"], "Failed to clear cache:", err);
			ToastManager.add({
				type: "error",
				message: m["settings.privacy.cache_clear_error"](),
			});
		} finally {
			isLoadingCache = false;
		}
	}

	onMount(() => {
		loadCacheInfo();
	});
</script>

<Panel class="flex flex-col gap-8 p-6">
	<div class="flex flex-col gap-3">
		<h2 class="text-2xl font-bold">
			<ChartColumnIcon
				size="40"
				class="inline-block -mt-1 mr-2 bg-accent-blue p-2 rounded-full"
				color="black"
			/>
			{m["settings.privacy.title"]()}
		</h2>
		<div class="flex flex-col gap-8">
			{#if !DISABLE_ALL_EXTERNAL_REQUESTS}
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<p class="text-base font-bold">
							{m["settings.privacy.plausible_title"]()}
						</p>
						<p class="text-sm text-muted font-normal">
							{@html link(
								["plausible_link", "analytics_link"],
								m["settings.privacy.plausible_description"](),
								[
									"https://plausible.io/privacy-focused-web-analytics",
									"https://ats.vert.sh/vert.sh",
								],
							)}
						</p>
					</div>
					<div class="flex flex-col gap-3 w-full">
						<div class="flex gap-3 w-full">
							<button
								onclick={() => (settings.plausible = true)}
								class="btn {$effects
									? ''
									: '!scale-100'} {settings.plausible
									? 'selected'
									: ''} flex-1 p-4 rounded-lg text-black dynadark:text-white flex items-center justify-center"
							>
								<PlayIcon size="24" class="inline-block mr-2" />
								{m["settings.privacy.opt_in"]()}
							</button>

							<button
								onclick={() => (settings.plausible = false)}
								class="btn {$effects
									? ''
									: '!scale-100'} {settings.plausible
									? ''
									: 'selected'} flex-1 p-4 rounded-lg text-black dynadark:text-white flex items-center justify-center"
							>
								<PauseIcon
									size="24"
									class="inline-block mr-2"
								/>
								{m["settings.privacy.opt_out"]()}
							</button>
						</div>
					</div>
				</div>
			{/if}
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<p class="text-base font-bold">
						{m["settings.privacy.cache_title"]()}
					</p>
					<p class="text-sm text-muted font-normal">
						{m["settings.privacy.cache_description"]()}
					</p>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="bg-button p-4 rounded-lg">
						<div class="text-sm text-muted">
							{m["settings.privacy.total_size"]()}
						</div>
						<div class="text-lg font-bold flex items-center gap-2">
							{#if isLoadingCache}
								<RefreshCwIcon size="16" class="animate-spin" />
								{m["settings.privacy.loading_cache"]()}
							{:else}
								{cacheInfo
									? swManager.formatSize(cacheInfo.totalSize)
									: "0 B"}
							{/if}
						</div>
					</div>
					<div class="bg-button p-4 rounded-lg">
						<div class="text-sm text-muted">
							{m["settings.privacy.files_cached_label"]()}
						</div>
						<div class="text-lg font-bold flex items-center gap-2">
							{#if isLoadingCache}
								<RefreshCwIcon size="16" class="animate-spin" />
								{m["settings.privacy.loading_cache"]()}
							{:else}
								{cacheInfo?.fileCount ?? 0}
							{/if}
						</div>
					</div>
				</div>

				<div class="flex gap-3 w-full">
					<button
						onclick={loadCacheInfo}
						class="btn {$effects
							? ''
							: '!scale-100'} flex-1 p-4 rounded-lg text-black dynadark:text-white flex items-center justify-center"
						disabled={isLoadingCache}
					>
						<RefreshCwIcon size="24" class="inline-block mr-2" />
						{m["settings.privacy.refresh_cache"]()}
					</button>
					<button
						onclick={clearCache}
						class="btn {$effects
							? ''
							: '!scale-100'} flex-1 p-4 rounded-lg text-black dynadark:text-white flex items-center justify-center"
						disabled={isLoadingCache}
					>
						<Trash2Icon size="24" class="inline-block mr-2" />
						{m["settings.privacy.clear_cache"]()}
					</button>
				</div>
			</div>
		</div>
	</div></Panel
>
