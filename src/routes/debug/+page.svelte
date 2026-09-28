<script lang="ts">
	import { browser } from "$app/environment";
	import Dropdown from "$lib/components/functional/Dropdown.svelte";
	import FormatDropdown from "$lib/components/functional/FormatDropdown.svelte";
	import Uploader from "$lib/components/functional/Uploader.svelte";
	import { categories } from "$lib/converters";
	import { m } from "$lib/paraglide/messages";
	import { files } from "$lib/store/index.svelte";
	import { tick } from "svelte";

	/*
$derived(
		files.files.length > 0 &&
			files.files.every((f) => f.converters.length) &&
			files.files.every(
				(f) =>
					JSON.stringify(f.converters) ===
					JSON.stringify(files.files[0].converters),
			),
	);
	*/
	const canConvert = true;
	let errors = $state<string[]>([]);
	let errContainer = $state<HTMLDivElement>();

	const convertAll = async () => {
		await files.convertAll((file, error) =>
			errors.push(`${file.name}: ${error}`),
		);
	};

	$effect(() => {
		if (!browser) return;
		scrollToBottom();
	});

	const scrollToBottom = async () => {
		if (!errContainer) return;
		errors.length;
		errContainer.scrollTop = errContainer.scrollHeight;
	};
</script>

<div class="max-w-3xl w-full mx-auto">
	<div class="w-fit relative mx-auto">
		<h1
			class="text-5xl md:p-0 flex-wrap tracking-tight leading-tight md:leading-[72px] mb-4 md:mb-6 w-fit mx-auto text-center select-none"
		>
			secret debug page
		</h1>
		<div class="absolute -bottom-2 -right-12 -rotate-[10deg] select-none">
			<p
				class="text-[#ffff00] mc text-lg"
				style="text-shadow: 0 2px 0 black, 0 -2px 0 black, 2px 0 0 black, -2px 0 0 black"
			>
				now with less bugs!
			</p>
		</div>
	</div>
	<div class="py-8">
		<Uploader class="w-full h-48" debug />
	</div>
	<p class="font-light text-muted pb-2">convert all to</p>
	<div class="flex gap-4">
		<div class="max-w-36 grow">
			{#if canConvert}
				<FormatDropdown
					onselect={(r) =>
						files.files.forEach((f) => {
							f.to = r;
							f.result = null;
						})}
					{categories}
					dropdownSize={"large"}
					leftAligned
				/>
			{:else}
				<Dropdown
					options={[m["convert.panel.na"]()]}
					style={"defaultLeft"}
					disabled
				/>
			{/if}
		</div>
		<button
			class="btn highlight px-12 py-1 h-[52px] shrink-0"
			disabled={!canConvert}
			onclick={convertAll}>go</button
		>
	</div>

	<p class="font-light text-muted pt-6 pb-2">
		{errors.length > 0 ? "errors" : "no errors yet!! :D"}
	</p>

	{#if errors.length > 0}
		<div
			class=" bg-neutral-900 font-mono px-4 py-2 rounded-lg max-h-72 overflow-y-auto overflow-x-auto whitespace-pre"
			bind:this={errContainer}
		>
			{#each errors as error}
				<p class="font-light w-fit">{error}</p>
			{/each}
		</div>
	{/if}
</div>

<style>
	@keyframes mc {
		0% {
			transform: scale(1);
			animation-timing-function: ease-in;
		}

		50% {
			transform: scale(1.07);
			animation-timing-function: ease-out;
		}

		100% {
			transform: scale(1);
		}
	}

	.mc {
		animation: mc 0.5s infinite;
	}
</style>
