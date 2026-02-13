<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";

	interface Props extends HTMLInputAttributes {
		extension?: string;
		prefix?: string;
	}

	let {
		class: className,
		value = $bindable(),
		disabled = false,
		extension,
		prefix,
		...rest
	}: Props = $props();
</script>

<div class="relative flex w-full {className}">
	<input
		{...rest}
		bind:value
		class="w-full p-3 rounded-lg bg-panel border-2 border-button
			{prefix ? 'pl-[2rem]' : 'pl-3'} 
			{extension ? 'pr-[4rem]' : 'pr-3'}
			{disabled && 'opacity-50 cursor-not-allowed'}"
	/>
	{#if prefix}
		<div class="absolute left-0 top-0 bottom-0 flex items-center px-2">
			<span class="text-sm text-gray-400 px-2 py-1 rounded">{prefix}</span
			>
		</div>
	{/if}
	{#if extension}
		<div class="absolute right-0 top-0 bottom-0 flex items-center px-4">
			<span
				class="text-sm bg-button text-black dynadark:text-white px-2 py-1 rounded"
				>{extension}</span
			>
		</div>
	{/if}
</div>
