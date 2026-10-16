<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import Dropdown from "$lib/components/functional/Dropdown.svelte";
	import {
		BugIcon,
		ClipboardCopyIcon,
		CpuIcon,
		DatabaseIcon,
		DownloadIcon,
		ExternalLinkIcon,
		HardDriveIcon,
		InfoIcon,
		MonitorSmartphoneIcon,
		RefreshCwIcon,
		RulerIcon,
		SearchIcon,
		TerminalIcon,
		TrashIcon,
		WifiIcon,
		WrenchIcon,
	} from "@lucide/svelte";
	import clsx from "clsx";
	import type { Component } from "svelte";
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import { PUB_ENV } from "$env/static/public";
	import { effects } from "$lib/store/index.svelte";
	import { ToastManager } from "$lib/util/toast.svelte";
	import { swManager, type CacheInfo } from "$lib/util/sw";
	import { DISABLE_ALL_EXTERNAL_REQUESTS } from "$lib/util/consts";
	import {
		buildReport,
		downloadText,
		filterLogs,
		formatFileStamp,
		getConverterList,
		getLogLevelOptions,
		getStatusLabels,
		getStorageInfo,
		getSystemInfo,
		STATUS_CLASSES,
		type SystemInfo,
	} from "$lib/util/debug.svelte";
	import {
		clearLogs,
		error as logError,
		logs,
	} from "$lib/util/logger.svelte";
	import { m } from "$lib/paraglide/messages";

	let logQuery = $state("");
	let logLevel = $state("all");

	const logLevelOptions = $derived(getLogLevelOptions());

	const filteredLogs = $derived(filterLogs(logs.entries, logLevel, logQuery));

	let systemInfo = $state<SystemInfo>({
		cores: "-",
		memory: "-",
		platform: "-",
		screen: "-",
	});

	let cacheInfo = $state<CacheInfo | null>(null);
	let storageEstimate = $state<{ usage: number; quota: number } | null>(null);
	let swRegistered = $state(false);
	let swControlled = $state(false);

	const quotaPercent = $derived(
		storageEstimate && storageEstimate.quota > 0
			? Math.min(
					100,
					(storageEstimate.usage / storageEstimate.quota) * 100,
				)
			: 0,
	);

	const converterList = $derived(getConverterList());
	const statusLabels = $derived(getStatusLabels());
	const statusClasses = STATUS_CLASSES;

	function clearLogsHandler() {
		clearLogs();
		ToastManager.add({
			type: "success",
			message: m["settings.debug.logs.cleared"](),
		});
	}

	async function refresh() {
		await loadStorage();
		systemInfo = getSystemInfo();
	}

	async function copyReport() {
		try {
			await navigator.clipboard.writeText(buildReport(systemInfo));
			ToastManager.add({
				type: "success",
				message: m["settings.debug.tools.report_copied"](),
			});
		} catch (err) {
			logError(["debug", "report"], `failed to copy report: ${err}`);
			ToastManager.add({
				type: "error",
				message: m["settings.debug.tools.report_copy_error"](),
			});
		}
	}

	function downloadReport() {
		downloadText(
			`vert-report-${formatFileStamp()}.txt`,
			buildReport(systemInfo),
		);
		ToastManager.add({
			type: "success",
			message: m["settings.debug.tools.report_downloaded"](),
		});
	}

	async function loadStorage() {
		const info = await getStorageInfo();
		cacheInfo = info.cacheInfo;
		storageEstimate = info.storageEstimate;
		swRegistered = info.swRegistered;
		swControlled = info.swControlled;
	}

	onMount(() => {
		if (!browser) return;

		systemInfo = getSystemInfo();
		void loadStorage();
	});
</script>

<div class="flex flex-col h-full items-center">
	<h1 class="hidden md:block text-[40px] tracking-tight leading-[72px] mb-6">
		<BugIcon size="40" class="inline-block -mt-2 mr-2" />
		{m["settings.debug.title"]()}
	</h1>

	<div
		class="w-full max-w-[1280px] flex flex-col md:flex-row gap-4 p-4 md:px-4 md:py-0"
	>
		<!-- left side -->
		<div class="flex flex-col gap-4 flex-1 min-w-0">
			<!-- logs -->
			<Panel class="flex flex-col gap-8 p-6 min-w-0">
				<div class="flex flex-col gap-4 min-w-0">
					<h2 class="text-2xl font-bold">
						<TerminalIcon
							size="40"
							class="inline-block -mt-1 mr-2 bg-accent-blue p-2 rounded-full"
							color="black"
						/>
						{m["settings.debug.logs.title"]()}
					</h2>

					<div class="flex flex-col sm:flex-row gap-3">
						<div class="relative flex flex-1">
							<input
								type="text"
								placeholder={m[
									"settings.debug.logs.search_placeholder"
								]()}
								class="flex-grow w-full !pl-11 !pr-3 rounded-lg bg-panel text-foreground"
								bind:value={logQuery}
								autocomplete="off"
							/>
							<span
								class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center"
							>
								<SearchIcon class="w-4 h-4" />
							</span>
							{#if logQuery}
								<span
									class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted"
									style="font-size: 0.7rem;"
								>
									{filteredLogs.length}
									{filteredLogs.length === 1
										? "result"
										: "results"}
								</span>
							{/if}
						</div>
						<div class="w-full sm:w-44">
							<Dropdown
								options={logLevelOptions}
								style="settings"
								bind:selected={logLevel}
							/>
						</div>
					</div>

					<div
						class="rounded-lg border-2 border-button overflow-hidden"
					>
						<div
							class="flex items-center justify-between px-3 py-2 bg-button"
						>
							<span
								class="text-xs font-bold uppercase tracking-wide text-muted"
							>
								<TerminalIcon
									size="14"
									class="inline-block mr-1 -mt-0.5"
								/>
								{m["settings.debug.logs.title"]()}
							</span>
							<span class="text-xs text-muted">
								{m["settings.debug.logs.count"]({
									count: filteredLogs.length,
								})}
							</span>
						</div>
						<div
							class="h-72 overflow-auto font-mono text-xs leading-relaxed"
						>
							<div class="flex flex-col w-max min-w-full h-full">
								{#each filteredLogs as entry (entry.id)}
									<div
										class="flex gap-2 px-3 py-1.5 border-b border-separator hover:bg-panel-highlight whitespace-nowrap"
									>
										<span class="shrink-0 text-muted"
											>{entry.time}</span
										>
										<span
											class={clsx(
												"shrink-0 font-bold uppercase",
												entry.level === "error"
													? "text-failure"
													: "text-muted",
											)}
										>
											{entry.level}
										</span>
										<span class="shrink-0 text-accent">
											[{entry.prefixes.join("] [")}]
										</span>
										<span class="whitespace-pre"
											>{entry.message}</span
										>
									</div>
								{:else}
									<div
										class="flex flex-col items-center justify-center gap-2 h-full text-muted"
									>
										<InfoIcon size="20" />
										{m["settings.debug.logs.empty"]()}
									</div>
								{/each}
							</div>
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<div class="flex flex-wrap gap-3 w-full">
							{@render logAction(
								RefreshCwIcon,
								m["settings.debug.logs.refresh"](),
								refresh,
								"flex-1 min-w-[8rem]",
							)}
							{@render logAction(
								TrashIcon,
								m["settings.debug.logs.clear"](),
								clearLogsHandler,
								"flex-1 min-w-[8rem]",
							)}
						</div>
					</div>
				</div>
			</Panel>

			<!-- tools -->
			<Panel class="flex flex-col gap-8 p-6">
				<div class="flex flex-col gap-4">
					<h2 class="text-2xl font-bold">
						<WrenchIcon
							size="40"
							class="inline-block -mt-1 mr-2 bg-accent-red p-2 rounded-full"
							color="black"
						/>
						{m["settings.debug.tools.title"]()}
					</h2>

					<div class="flex flex-col gap-3">
						<div class="flex flex-col gap-1">
							<p class="text-sm font-bold">
								{m["settings.debug.tools.report_title"]()}
							</p>
							<p class="text-xs text-muted font-normal">
								{m["settings.debug.tools.report_description"]()}
							</p>
						</div>
						<div class="flex flex-wrap gap-3 w-full">
							{@render logAction(
								ClipboardCopyIcon,
								m["settings.debug.tools.copy_report"](),
								copyReport,
								"flex-1 min-w-[8rem]",
							)}
							{@render logAction(
								DownloadIcon,
								m["settings.debug.tools.download_report"](),
								downloadReport,
								"flex-1 min-w-[8rem]",
							)}
						</div>
					</div>
				</div>
			</Panel>
		</div>

		<!-- right side -->
		<div class="flex flex-col gap-4 flex-1">
			<!-- system info -->
			<Panel class="flex flex-col gap-8 p-6">
				<div class="flex flex-col gap-4">
					<h2 class="text-2xl font-bold">
						<CpuIcon
							size="40"
							class="inline-block -mt-1 mr-2 bg-accent-purple p-2 rounded-full"
							color="black"
						/>
						{m["settings.debug.system.title"]()}
					</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{@render infoRow(
							CpuIcon,
							m["settings.debug.system.cores"](),
							systemInfo.cores,
						)}
						{@render infoRow(
							DatabaseIcon,
							m["settings.debug.system.memory"](),
							systemInfo.memory,
						)}
						{@render infoRow(
							MonitorSmartphoneIcon,
							m["settings.debug.system.platform"](),
							systemInfo.platform,
						)}
						{@render infoRow(
							RulerIcon,
							m["settings.debug.system.screen"](),
							systemInfo.screen,
						)}
						{@render infoRow(
							HardDriveIcon,
							m["settings.debug.storage.registration"](),
							swRegistered
								? m["settings.debug.storage.registered"]()
								: m["settings.debug.system.disabled"](),
						)}
						{@render infoRow(
							WifiIcon,
							m["settings.debug.storage.controller"](),
							swControlled
								? m["settings.debug.storage.controlled"]()
								: m["settings.debug.system.disabled"](),
						)}
						{@render infoRow(
							TerminalIcon,
							m["settings.debug.system.environment"](),
							PUB_ENV,
						)}
						{@render infoRow(
							ExternalLinkIcon,
							m["settings.debug.system.external_requests"](),
							DISABLE_ALL_EXTERNAL_REQUESTS
								? m["settings.debug.system.disabled"]()
								: m["settings.debug.system.enabled"](),
						)}
					</div>

					<div class="rounded-lg bg-button p-4 flex flex-col gap-3">
						<div class="flex items-center justify-between text-sm">
							<span class="text-muted"
								>{m[
									"settings.debug.storage.quota_used"
								]()}</span
							>
							<span class="font-bold">
								{#if storageEstimate}
									{swManager.formatSize(
										storageEstimate.usage,
									)}
									/
									{swManager.formatSize(
										storageEstimate.quota,
									)}
								{:else}
									-
								{/if}
							</span>
						</div>
						<div
							class="h-2 w-full rounded-full bg-panel overflow-hidden"
						>
							<div
								class="h-full bg-accent-blue transition-all"
								style="width: {quotaPercent}%"
							></div>
						</div>
						<span class="text-xs text-muted">
							{m["settings.debug.storage.quota_available"]()}:
							{storageEstimate
								? swManager.formatSize(
										Math.max(
											0,
											storageEstimate.quota -
												storageEstimate.usage,
										),
									)
								: "-"}
						</span>
					</div>
					<div class="flex flex-col gap-3">
						<div class="grid grid-cols-2 gap-4">
							{@render statCard(
								m["settings.debug.storage.cache_size"](),
								cacheInfo
									? swManager.formatSize(cacheInfo.totalSize)
									: "-",
							)}
							{@render statCard(
								m["settings.debug.storage.cache_files"](),
								cacheInfo ? String(cacheInfo.fileCount) : "-",
							)}
						</div>
					</div>
				</div></Panel
			>

			<!-- converter info -->
			<Panel class="flex flex-col gap-8 p-6">
				<div class="flex flex-col gap-4">
					<h2 class="text-2xl font-bold">
						<RefreshCwIcon
							size="40"
							class="inline-block -mt-1 mr-2 bg-accent p-2 rounded-full"
							color="black"
						/>
						{m["settings.debug.converters.title"]()}
					</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{#each converterList as converter (converter.name)}
							{@const Icon = converter.icon}
							<div
								class="flex flex-col gap-4 rounded-lg bg-button p-4"
							>
								<div
									class="flex items-start justify-between gap-3"
								>
									<div
										class="flex items-center gap-3 min-w-0"
									>
										<span
											class={clsx(
												"shrink-0 p-2 rounded-lg text-black",
												converter.accent,
											)}
										>
											<Icon size="20" />
										</span>
										<div class="flex flex-col min-w-0">
											<span
												class="text-sm font-bold truncate"
												>{converter.name}</span
											>
											<span
												class="text-xs text-muted truncate"
											>
												{converter.category}</span
											>
										</div>
									</div>
									<span
										class={clsx(
											"shrink-0 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap",
											statusClasses[converter.status] ??
												"bg-button text-muted",
										)}
									>
										{statusLabels[converter.status] ??
											converter.status}
									</span>
								</div>
								<div
									class="flex items-center justify-between gap-2 border-t border-separator pt-3"
								>
									<span class="text-xs text-muted"
										>{m[
											"settings.debug.converters.formats"
										]()}</span
									>
									<span class="text-sm font-bold"
										>{converter.formats}</span
									>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</Panel>
		</div>
	</div>
</div>

{#snippet logAction(
	Icon: Component,
	label: string,
	onclick: () => void,
	className = "",
)}
	<button
		{onclick}
		class={clsx(
			"btn px-4 rounded-lg text-black dynadark:text-white flex items-center justify-center",
			$effects ? "" : "!scale-100",
			className,
		)}
	>
		<Icon size="20" class="mr-2" />
		{label}
	</button>
{/snippet}

{#snippet infoRow(Icon: Component, label: string, value: string)}
	<div
		class="flex items-center justify-between gap-3 rounded-lg bg-button p-3"
	>
		<span class="flex items-center gap-2 text-sm text-muted min-w-0">
			<Icon size="18" class="shrink-0" />
			<span class="truncate">{label}</span>
		</span>
		<span class="text-sm font-bold truncate">{value}</span>
	</div>
{/snippet}

{#snippet statCard(label: string, value: string)}
	<div class="bg-button p-4 rounded-lg">
		<div class="text-sm text-muted">{label}</div>
		<div class="text-lg font-bold truncate">{value}</div>
	</div>
{/snippet}
