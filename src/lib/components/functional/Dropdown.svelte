<script lang="ts">
	import { duration, fade, transition } from "$lib/util/animation";
	import { ChevronDown } from "lucide-svelte";
	import { onMount } from "svelte";
	import { quintOut } from "svelte/easing";

	type Props = {
		options: string[];
		selected?: string;
		onselect?: (option: string) => void;
		disabled?: boolean;
		settingsStyle?: boolean;
	};

	let {
		options,
		selected = $bindable(options[0]),
		onselect,
		disabled,
		settingsStyle,
	}: Props = $props();

	let open = $state(false);
	let hover = $state(false);
	let isUp = $state(false);
	let dropdown = $state<HTMLDivElement>();

	const toggle = () => {
		open = !open;
	};

	const select = (option: string) => {
		const oldIndex = options.indexOf(selected || "");
		const newIndex = options.indexOf(option);
		isUp = oldIndex > newIndex;
		selected = option;
		onselect?.(option);
		toggle();
	};

	onMount(() => {
		const click = (e: MouseEvent) => {
			if (dropdown && !dropdown.contains(e.target as Node)) {
				open = false;
			}
		};

		window.addEventListener("click", click);
		return () => window.removeEventListener("click", click);
	});
</script>

<div
	class="relative w-full min-w-fit {settingsStyle
		? 'font-normal'
		: 'text-xl font-medium'} text-center"
	bind:this={dropdown}
>
	<button
		class="font-display w-full {settingsStyle
			? 'justify-between'
			: 'justify-center'} overflow-hidden relative cursor-pointer {settingsStyle
			? 'px-4'
			: 'px-3'} py-3.5 bg-button {disabled
			? 'opacity-50 cursor-auto'
			: 'cursor-pointer'} flex items-center {settingsStyle
			? 'rounded-xl'
			: 'rounded-full'} focus:!outline-none"
		onclick={toggle}
		onmouseenter={() => (hover = true)}
		onmouseleave={() => (hover = false)}
		{disabled}
	>
		<!-- <p>{selected}</p> -->
		<div class="grid grid-cols-1 grid-rows-1 w-fit flex-grow-0">
			{#key selected}
				<p
					in:fade={{
						duration,
						easing: quintOut,
					}}
					out:fade={{
						duration,
						easing: quintOut,
					}}
					class="col-start-1 row-start-1 {settingsStyle
						? 'text-left'
						: 'text-center'} font-body {settingsStyle
						? 'font-normal'
						: 'font-medium'}"
				>
					{selected}
				</p>
			{/key}
			{#each options as option}
				<p
					class="col-start-1 row-start-1 invisible pointer-events-none"
				>
					{option}
				</p>
			{/each}
		</div>
		<ChevronDown
			class="w-4 h-4 ml-3 mt-0.5 flex-shrink-0"
			style="transform: rotate({open
				? 180
				: 0}deg); transition: transform {duration}ms {transition};"
		/>
	</button>
	{#if open}
		<div
			style={hover ? "will-change: opacity, fade, transform" : ""}
			transition:fade={{
				duration,
				easing: quintOut,
			}}
			class="w-full shadow-xl bg-panel-alt shadow-black/25 absolute overflow-hidden top-full mt-1 left-0 z-50 bg-background rounded-xl max-h-[30vh] overflow-y-auto"
		>
			{#each options as option}
				<button
					class="w-full p-2 px-4 text-left hover:bg-panel"
					onclick={() => select(option)}
				>
					{option}
				</button>
			{/each}
		</div>
	{/if}
</div>
