<script lang="ts">
	import { effects } from "#lib/store/index.svelte";
	import clsx from "clsx";

	interface Props {
		class?: string;
		value?: string | number;
		checked?: boolean;
		type?: string;
		disabled?: boolean | null;
		extension?: string;
		prefix?: string;
		inputClass?: string;
		thin?: boolean;
		multiline?: boolean;
		[name: string]: unknown;
	}

	let {
		class: className,
		inputClass,
		value = $bindable(),
		checked = $bindable(),
		type = "text",
		disabled = false,
		extension,
		prefix,
		thin = false,
		multiline = false,
		...rest
	}: Props = $props();
</script>

<div class="relative flex {className}">
	{#if type === "checkbox"}
		<input
			{...rest}
			type="checkbox"
			bind:checked
			{disabled}
			class={clsx(
				"w-full appearance-none rounded-lg border-2 border-button bg-panel p-3",
				prefix ? "pl-[2rem]" : "pl-3",
				extension ? "pr-[4rem]" : "pr-3",
				disabled && "cursor-not-allowed opacity-50",
				inputClass,
				$effects && "transition-colors duration-200",
			)}
		/>
		{#if checked}
			<div
				class="pointer-events-none absolute inset-0 flex h-7 w-7 items-center justify-center"
			>
				<svg class="h-6 w-6" fill="var(--bg-panel)" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
		{/if}
	{:else if multiline}
		<textarea
			{...rest}
			bind:value
			{disabled}
			class={clsx(
				"w-full rounded-lg border-2 border-button bg-panel",
				thin ? "py-1.5" : "p-3",
				prefix ? "pl-[2rem]" : thin ? "pl-2.5" : "pl-3",
				extension
					? thin
						? "pr-[3.5rem]"
						: "pr-[4rem]"
					: thin
						? "pr-2.5"
						: "pr-3",
				disabled && "cursor-not-allowed opacity-50",
				inputClass,
			)}></textarea>
	{:else}
		<input
			{...rest}
			{type}
			bind:value
			{disabled}
			class={clsx(
				"w-full rounded-lg border-2 border-button bg-panel",
				thin ? "py-1.5" : "p-3",
				prefix ? "pl-[2rem]" : thin ? "pl-2.5" : "pl-3",
				extension
					? thin
						? "pr-[3rem]"
						: "pr-[4rem]"
					: thin
						? "pr-2.5"
						: "pr-3",
				disabled && "cursor-not-allowed opacity-50",
				inputClass,
			)}
		/>
	{/if}

	{#if prefix}
		<div class="absolute bottom-0 left-0 top-0 flex items-center px-2">
			<span class="rounded px-2 py-1 text-sm text-gray-400">{prefix}</span
			>
		</div>
	{/if}
	{#if extension}
		<div
			class={clsx(
				"absolute bottom-0 right-0 top-0 flex items-center",
				thin ? "px-2" : "px-4",
			)}
		>
			<span
				class={clsx(
					"rounded bg-button text-black dynadark:text-white",
					thin ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-sm",
				)}>{extension}</span
			>
		</div>
	{/if}
</div>
