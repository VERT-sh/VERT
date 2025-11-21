<script lang="ts">
	import { duration, fade } from "$lib/util/animation";
	import { quintOut } from "svelte/easing";
	import Dialog from "../functional/Dialog.svelte";
	import {
		type Dialog as DialogType,
		dialogs,
	} from "$lib/store/DialogProvider";

	let dialogList = $state<DialogType[]>([]);

	dialogs.subscribe((value) => {
		dialogList = value as DialogType[];
	});
</script>

{#if dialogList.length > 0}
	<div
		class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-40"
		in:fade={{
			duration,
			easing: quintOut,
		}}
		out:fade={{
			duration,
			easing: quintOut,
		}}
	>
		{#each dialogList as dialog, i}
			{#if i === 0}
				<Dialog {...dialog} />
			{/if}
		{/each}
	</div>
{/if}
