<script lang="ts">
	import FancyInput from "$lib/components/functional/FancyInput.svelte";
	import Panel from "$lib/components/visual/Panel.svelte";
	import {
		CalendarHeartIcon,
		HandCoinsIcon,
		HeartIcon,
		WalletIcon,
	} from "lucide-svelte";

	let { donors } = $props();
</script>

{#snippet donor(name: string, amount: number | string, avatar: string)}
	<div class="flex items-center bg-button rounded-full overflow-hidden">
		<img
			src={avatar}
			alt={name}
			title={name}
			class="w-9 h-9 rounded-full"
		/>
		<p class="text-sm text-black dynadark:text-white px-4">${amount}</p>
	</div>
{/snippet}

<Panel class="flex flex-col gap-8 p-6">
	<div class="flex flex-col gap-3">
		<h2 class="text-2xl font-bold flex items-center">
			<div
				class="rounded-full bg-accent-red p-2 inline-block mr-3 w-10 h-10"
			>
				<HeartIcon color="black" />
			</div>
			Donate to VERT
		</h2>
		<p class="text-base font-normal">
			With your support, we can keep maintaining and improving VERT.
		</p>
	</div>

	<div class="flex flex-col gap-3 w-full">
		<div class="flex gap-3 w-full">
			<button
				class="btn flex-1 p-4 rounded-lg bg-accent-red text-black flex items-center justify-center"
			>
				<HandCoinsIcon size="24" class="inline-block mr-2" />
				One-time
			</button>

			<button
				class="btn flex-1 p-4 rounded-lg bg-button text-black dynadark:text-white flex items-center justify-center"
			>
				<CalendarHeartIcon size="24" class="inline-block mr-2" />
				Monthly
			</button>
		</div>
		<div class="flex gap-3 w-full">
			<button class="btn bg-accent-red text-black p-4 rounded-lg flex-1"
				>$1 USD</button
			>
			<button
				class="btn bg-button text-black dynadark:text-white p-4 rounded-lg flex-1"
				>$5 USD</button
			>
			<button
				class="btn bg-button text-black dynadark:text-white p-4 rounded-lg flex-1"
				>$10 USD</button
			>
			<!-- <div class="relative flex items-center flex-[2]">
				<span class="absolute left-3 text-gray-500">$</span>
				<input
					type="number"
					class="pl-8 pr-2 rounded-lg border border-gray-300 dynadark:border-gray-500 w-full h-full bg-button text-black dynadark:text-white"
					placeholder="Custom"
				/>
			</div> -->
			<div class="flex-[2] flex items-center justify-center">
				<FancyInput placeholder="Custom" prefix="$" type="number" />
			</div>
		</div>
	</div>

	<div class="flex flex-row justify-center w-full">
		<p class="text-muted text-sm flex-[4] flex items-center">
			Payments and subscription management <br /> are handled through Liberapay
		</p>

		<button
			class="btn flex-1 p-3 rounded-3xl bg-accent-red text-black flex items-center justify-center"
		>
			<WalletIcon size="24" class="inline-block mr-2" />
			Pay now
		</button>
	</div>

	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1">
			<h2 class="text-base font-bold">Our top donors</h2>
			{#if donors && donors.length > 0}
				<p class="text-base text-muted font-normal">
					People like these fuel the things we love to do. Thank you
					so much!
				</p>
			{:else}
				<p class="text-base text-muted font-normal italic">
					Seems like no one has donated yet... so if you do, you will
					pop up here!
				</p>
			{/if}
		</div>

		{#if donors && donors.length > 0}
			<div class="flex flex-row flex-wrap gap-2">
				{#each donors as dono}
					{@const { name, amount, avatar } = dono}
					{@render donor(name, amount, avatar)}
				{/each}
			</div>
		{/if}
	</div>
</Panel>
