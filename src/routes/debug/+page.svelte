<script>
	import Dropdown from "$lib/components/functional/Dropdown.svelte";
	import FormatDropdown from "$lib/components/functional/FormatDropdown.svelte";
	import { categories } from "$lib/converters";
	import { m } from "$lib/paraglide/messages";
	import { files } from "$lib/store/index.svelte";
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
	<p class="font-light text-muted pb-2">convert all to</p>
	<div class="flex gap-4">
		<div class="w-full grow">
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
				<Dropdown
					options={[m["convert.panel.na"]()]}
					leftAlign
					disabled
				/>
			{/if}
		</div>
		<button class="btn highlight px-12 py-1 h-[52px] shrink-0">go</button>
	</div>
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
