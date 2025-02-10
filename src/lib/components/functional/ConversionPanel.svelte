<script lang="ts">
	import { effects, files } from "$lib/store/index.svelte";
	import { FolderArchiveIcon, RefreshCw } from "lucide-svelte";
	import Panel from "../visual/Panel.svelte";
	import Dropdown from "./Dropdown.svelte";
</script>

<Panel
	class="w-full h-auto flex items-center justify-between flex-col md:flex-row gap-4"
>
	<div class="flex items-center flex-col md:flex-row gap-2.5 max-md:w-full">
		<button
			onclick={() => files.convertAll()}
			class="btn {$effects ? "" : "!scale-100"} highlight flex gap-3 max-md:w-full"
			disabled={!files.ready}
		>
			<RefreshCw size="24" />
			<p>Convert all</p>
		</button>
		<button
			class="btn {$effects ? "" : "!scale-100"} flex gap-3 max-md:w-full"
			disabled={!files.ready || !files.results}
			onclick={() => files.downloadAll()}
		>
			<FolderArchiveIcon size="24" />
			<p>Download all as .zip</p>
		</button>
	</div>
	<div class="w-full bg-separator h-0.5 flex md:hidden"></div>
	<div class="flex items-center gap-2">
		<p class="whitespace-nowrap text-xl">Set all to</p>
		{#if files.requiredConverters.length === 1}
			<Dropdown
				onselect={(r) =>
					files.files.forEach((f) => {
						f.to = r;
						f.result = null;
					})}
				options={files.files[0]?.converter?.supportedFormats || []}
			/>
		{:else}
			<Dropdown options={["N/A"]} disabled />
		{/if}
	</div>
</Panel>
