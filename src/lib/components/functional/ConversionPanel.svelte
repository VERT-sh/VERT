<script lang="ts">
	import { effects, files, isMobile } from "$lib/store/index.svelte";
	import { FolderArchiveIcon, RefreshCw, Trash2Icon } from "lucide-svelte";
	import Panel from "../visual/Panel.svelte";
	import Dropdown from "./Dropdown.svelte";
	import Tooltip from "../visual/Tooltip.svelte";
	import ProgressBar from "../visual/ProgressBar.svelte";
	import FormatDropdown from "./FormatDropdown.svelte";
	import { categories } from "$lib/converters";
	import { m } from "$lib/paraglide/messages";

	const length = $derived(files.files.length);
	const progress = $derived(files.files.filter((f) => f.result).length);
	const manyFiles = $derived(files.files.length > 50);
	const compactActions = $derived(manyFiles && !$isMobile);
</script>

<Panel class="flex flex-col gap-4">
	<div
		class="w-full h-auto flex items-center justify-between flex-col md:flex-row gap-4"
	>
		<div
			class="flex items-center flex-col md:flex-row gap-2.5 max-md:w-full"
		>
			<button
				onclick={() => files.convertAll()}
				class="btn {$effects
					? ''
					: '!scale-100'} highlight flex gap-3 max-md:w-full {compactActions
					? 'p-4'
					: 'md:max-w-[15.5rem]'}"
				disabled={!files.allReady}
			>
				<RefreshCw size="24" />
				{#if !compactActions}
					<p>{m["convert.panel.convert_all"]()}</p>
				{/if}
			</button>
			<button
				class="btn {$effects
					? ''
					: '!scale-100'} flex gap-3 max-md:w-full {compactActions
					? 'p-4'
					: 'md:max-w-[15.5rem]'}"
				disabled={!files.allReady || !files.results}
				onclick={() => files.downloadAll()}
			>
				<FolderArchiveIcon size="24" />
				{#if !compactActions}
					<p>{m["convert.panel.download_all"]()}</p>
				{/if}
			</button>
			{#if $isMobile}
				<button
					class="btn p-4 {$effects
						? ''
						: '!scale-100'} flex gap-3 max-md:w-full"
					disabled={files.files.length === 0}
					onclick={() => (files.files = [])}
				>
					<Trash2Icon size="24" />
					<p>{m["convert.panel.remove_all"]()}</p>
				</button>
			{:else}
				<Tooltip
					text={m["convert.panel.remove_all"]()}
					position="right"
				>
					<button
						class="btn p-4 {$effects
							? ''
							: '!scale-100'} flex gap-3 max-md:w-full"
						disabled={files.files.length === 0}
						onclick={() => (files.files = [])}
					>
						<Trash2Icon size="24" />
					</button>
				</Tooltip>
			{/if}
		</div>
		<div class="w-full bg-separator h-0.5 flex md:hidden"></div>
		{#if manyFiles}
			<div class="w-full max-w-64 p-2 flex gap-4 items-center">
				<div
					class="flex-shrink-0 -mt-0.5 font-normal text-sm text-muted"
				>
					{progress}/{length}
				</div>
				<div class="flex-grow">
					<ProgressBar min={0} max={length} {progress} />
				</div>
			</div>
			<div class="w-full bg-separator h-0.5 flex md:hidden"></div>
		{/if}
		<div class="flex items-center gap-2 w-fit">
			<p
				class="whitespace-normal text-xl text-center w-fit px-2 md:px-0 md:text-right"
			>
				{m["convert.panel.set_all_to"]()}
			</p>
			<div class="w-[122px]">
				<!-- check if all files have the same converters -->
				<!-- video and audio together still have this dropdown disabled because audio has just ffmpeg (video has vertd & ffmpeg), even tho it can convert between video and audio  -->
				{#if files.files.length > 0 && files.files.every((f) => f.converters.length) && files.files.every((f) => JSON.stringify(f.converters) === JSON.stringify(files.files[0].converters))}
					<FormatDropdown
						onselect={(r) =>
							files.files.forEach((f) => {
								f.to = r;
								f.result = null;
							})}
						{categories}
						dropdownSize={"large"}
					/>
				{:else}
					<Dropdown options={[m["convert.panel.na"]()]} disabled />
				{/if}
			</div>
		</div>
	</div></Panel
>
