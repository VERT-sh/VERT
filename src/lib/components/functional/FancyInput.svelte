<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";

	interface Props extends HTMLInputAttributes {
		extension?: string;
		prefix?: string;
	}

	let {
		class: className,
		value = $bindable(),
		checked = $bindable(),
		type = "text",
		disabled = false,
		extension,
		prefix,
		...rest
	}: Props = $props();
</script>

<div class="relative flex w-full {className}">
	{#if type === "checkbox"}
		<div class="relative w-full h-full">
			<input
			{...rest}
			type="checkbox"
			bind:checked
			class="w-full p-3 rounded-lg bg-panel border-2 border-button
				{prefix ? 'pl-[2rem]' : 'pl-3'} 
				{extension ? 'pr-[4rem]' : 'pr-3'}
				{disabled && 'opacity-50 cursor-not-allowed'} appearance-none"
			/>
			{#if checked}
				<div class="absolute w-7 h-7 inset-0 flex items-center justify-center pointer-events-none">
					<svg class="w-6 h-6" fill="var(--bg-panel)" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				</div>
			{/if}
		</div>
	{:else}
		<input
			{...rest}
			bind:value
			class="w-full p-3 rounded-lg bg-panel border-2 border-button
				{prefix ? 'pl-[2rem]' : 'pl-3'} 
				{extension ? 'pr-[4rem]' : 'pr-3'}
				{disabled && 'opacity-50 cursor-not-allowed'}"
		/>
	{/if}

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
