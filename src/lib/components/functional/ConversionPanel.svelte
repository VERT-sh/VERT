<script lang="ts">
	import { effects, files, isMobile } from "#lib/store/index.svelte";
	import {
		FolderArchiveIcon,
		RefreshCwIcon,
		TrashIcon,
		ChevronDownIcon,
		SquareIcon,
	} from "@lucide/svelte";
	import Panel from "../visual/Panel.svelte";
	import Dropdown from "./Dropdown.svelte";
	import ProgressBar from "../visual/ProgressBar.svelte";
	import FormatDropdown from "./FormatDropdown.svelte";
	import { categories } from "#lib/converters";
	import { m } from "#lib/paraglide/messages";
	import { clsx } from "clsx";
	import { error } from "#lib/util/logger.svelte";
	import { formatError } from "#lib/util/error";
	import { ToastManager } from "#lib/util/toast.svelte";

	const converting = $derived(
		files.queueRunning || files.files.some((file) => file.processing),
	);
	const hasFailed = $derived(
		files.files.some((file) => file.failed && !file.processing),
	);

	const length = $derived(files.files.length);
	const progress = $derived(files.files.filter((f) => f.result).length);
	const manyFiles = $derived(files.files.length > 50);
	const compactActions = $derived(manyFiles && !$isMobile);
	const canSetAll = $derived.by(() => {
		const [firstFile, ...otherFiles] = files.files;
		if (!firstFile?.converters.length) return false;

		const converterNames = new Set(
			firstFile.converters.map((converter) => converter.name),
		);
		if (otherFiles.some((file) => !file.converters.length)) return false;

		return otherFiles.every((file) => {
			const names = new Set(
				file.converters.map((converter) => converter.name),
			);
			return (
				names.size === converterNames.size &&
				[...converterNames].every((name) => names.has(name))
			);
		});
	});

	async function clearFiles(status: "completed" | "failed" | "all") {
		try {
			await files.clear(status);
		} catch (err) {
			error(
				["files"],
				`error clearing ${status} files: ${formatError(err)}`,
			);
			ToastManager.add({ type: "error", message: formatError(err) });
		}
	}

	const clearMenuItems = $derived([
		{
			label: m["convert.panel.clear.completed"](),
			disabled: !files.results,
			onSelect: () => void clearFiles("completed"),
		},
		{
			label: m["convert.panel.clear.failed"](),
			disabled: !hasFailed,
			onSelect: () => void clearFiles("failed"),
		},
		{
			label: m["convert.panel.clear.all"](),
			onSelect: () => void clearFiles("all"),
		},
	]);
</script>

<Panel class="flex flex-col gap-4">
	<div
		class="flex h-auto w-full flex-col items-center justify-between gap-4 md:flex-row"
	>
		<div
			class="flex flex-col items-center gap-2.5 max-md:w-full md:flex-row"
		>
			<button
				onclick={() =>
					converting ? files.stopConversions() : files.convertAll()}
				aria-label={converting
					? m["convert.panel.stop"]()
					: m["convert.panel.convert_all"]()}
				title={converting
					? m["convert.panel.stop"]()
					: m["convert.panel.convert_all"]()}
				class={clsx(
					"btn highlight flex gap-3 max-md:w-full",
					!$effects && "!scale-100",
					compactActions ? "p-4" : "md:max-w-[15.5rem]",
				)}
				disabled={files.stopping || (!converting && !files.allReady)}
			>
				{#if converting}
					<SquareIcon size="24" />
				{:else}
					<RefreshCwIcon size="24" />
				{/if}
				{#if !compactActions}
					<p>
						{files.stopping
							? m["convert.panel.stopping"]()
							: converting
								? m["convert.panel.stop"]()
								: m["convert.panel.convert_all"]()}
					</p>
				{/if}
			</button>
			<button
				class={clsx(
					"btn flex gap-3 max-md:w-full",
					!$effects && "!scale-100",
					compactActions ? "p-4" : "md:max-w-[15.5rem]",
				)}
				disabled={converting || files.stopping || !files.results}
				aria-label={m["convert.panel.download_all"]()}
				title={m["convert.panel.download_all"]()}
				onclick={() => files.downloadAll()}
			>
				<FolderArchiveIcon size="24" />
				{#if !compactActions}
					<p>{m["convert.panel.download_all"]()}</p>
				{/if}
			</button>
			<Dropdown
				menuItems={clearMenuItems}
				ariaLabel={m["convert.panel.clear.files"]()}
				disabled={files.files.length === 0}
				buttonClass={clsx(
					"btn flex gap-3 p-4 text-base max-md:w-full",
					!$effects && "!scale-100",
				)}
			>
				{#snippet trigger()}
					<TrashIcon size="24" />
					<p>{m["convert.panel.clear.text"]()}</p>
					<ChevronDownIcon size="16" />
				{/snippet}
			</Dropdown>
		</div>
		<div class="flex h-0.5 w-full bg-separator md:hidden"></div>
		{#if manyFiles}
			<div class="flex w-full max-w-64 items-center gap-4 p-2">
				<div
					class="-mt-0.5 flex-shrink-0 text-sm font-normal text-muted"
				>
					{progress}/{length}
				</div>
				<div class="flex-grow">
					<ProgressBar min={0} max={length} {progress} />
				</div>
			</div>
			<div class="flex h-0.5 w-full bg-separator md:hidden"></div>
		{/if}
		<div class="flex w-fit items-center gap-2">
			<p
				class="w-fit whitespace-normal px-2 text-center text-xl md:px-0 md:text-right"
			>
				{m["convert.panel.set_all_to"]()}
			</p>
			<div class="w-[122px]">
				{#if canSetAll}
					<FormatDropdown
						allowEmpty
						onselect={(r) =>
							files.files.forEach((f) => {
								f.to = r;
								f.result = null;
							})}
						{categories}
						dropdownSize="large"
					/>
				{:else}
					<Dropdown options={[m["convert.panel.na"]()]} disabled />
				{/if}
			</div>
		</div>
	</div></Panel
>
