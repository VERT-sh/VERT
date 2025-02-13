<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import { PiggyBankIcon } from "lucide-svelte";
	import HotMilk from "$lib/assets/hotmilk.svg?component";
	import { DISCORD_URL } from "$lib/consts";
</script>

<Panel class="flex flex-col gap-3 p-6 min-h-[280px]">
	<h2 class="text-2xl font-bold flex items-center">
		<div
			class="rounded-full bg-accent-pink p-2 inline-block mr-3 w-10 h-10"
		>
			<PiggyBankIcon color="black" />
		</div>
		Sponsors
	</h2>
	<div class="mt-2 [&>*]:font-normal h-full flex justify-between flex-col">
		<div class="flex gap-3 justify-center text-lg">
			<a
				href="https://hotmilk.studio"
				target="_blank"
				class="w-fit h-fit rounded-2xl py-4 btn gap-2 flex flex-col justify-center items-center"
			>
				<HotMilk class="w-full h-16" />
			</a>
		</div>
		<p class="text-muted">
			Want to support us? Contact a developer in the <a
				href={DISCORD_URL}
				target="_blank">Discord</a
			> server!
		</p>
	</div>
</Panel>
