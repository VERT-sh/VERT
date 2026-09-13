<script lang="ts">
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
		bgColor = "bg-panel",
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

<div class="relative flex w-full {className}">
	{#if type === "checkbox"}
		<input
			{...rest}
			type="checkbox"
			bind:checked
			{disabled}
			class="w-full p-3 rounded-lg border-2 border-button
				{bgColor}
				{prefix ? 'pl-[2rem]' : 'pl-3'} 
				{extension ? 'pr-[4rem]' : 'pr-3'}
				{disabled && 'opacity-50 cursor-not-allowed'} appearance-none
				{inputClass}"
		/>
		{#if checked}
			<div
				class="absolute w-7 h-7 inset-0 flex items-center justify-center pointer-events-none"
			>
				<svg class="w-6 h-6" fill="var(--bg-panel)" viewBox="0 0 20 20">
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
			class="w-full rounded-lg bg-panel border-2 border-button
					{thin ? 'py-1.5' : 'p-3'}
					{prefix ? 'pl-[2rem]' : thin ? 'pl-2.5' : 'pl-3'}
					{extension ? (thin ? 'pr-[3.5rem]' : 'pr-[4rem]') : thin ? 'pr-2.5' : 'pr-3'}
					{disabled && 'opacity-50 cursor-not-allowed'}
					{inputClass}"
		></textarea>
	{:else}
		<input
			{...rest}
			bind:value
			{disabled}
			class="w-full rounded-lg bg-panel border-2 border-button
					{thin ? 'py-1.5' : 'p-3'}
					{prefix ? 'pl-[2rem]' : thin ? 'pl-2.5' : 'pl-3'}
					{extension ? (thin ? 'pr-[3rem]' : 'pr-[4rem]') : thin ? 'pr-2.5' : 'pr-3'}
					{disabled && 'opacity-50 cursor-not-allowed'}
					{inputClass}"
		/>
	{/if}

	{#if prefix}
		<div class="absolute left-0 top-0 bottom-0 flex items-center px-2">
			<span class="text-sm text-gray-400 px-2 py-1 rounded">{prefix}</span
			>
		</div>
	{/if}
	{#if extension}
		<div
			class="absolute right-0 top-0 bottom-0 flex items-center {thin
				? 'px-2'
				: 'px-4'}"
		>
			<span
				class="bg-button text-black dynadark:text-white rounded {thin
					? 'text-xs px-2 py-0.5'
					: 'text-sm px-2 py-1'}">{extension}</span
			>
		</div>
	{/if}
</div>
