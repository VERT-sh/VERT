<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import { PiggyBankIcon, CopyIcon, CheckIcon } from "lucide-svelte";
	import HotMilk from "$lib/assets/hotmilk.svg?component";
	import { DISCORD_URL } from "$lib/consts";
	import { error } from "$lib/logger";
	import { m } from "$lib/paraglide/messages";
	import { link, sanitize } from "$lib/store/index.svelte";
	import { ToastManager } from "$lib/toast/index.svelte";

	let copied = false;
	let timeoutId: NodeJS.Timeout | null = null;

	function copyToClipboard() {
		try {
			navigator.clipboard.writeText("hello@vert.sh");
			copied = true;
			ToastManager.add({
				type: "success",
				message: m["about.sponsors.email_copied"](),
			});

			if (timeoutId) clearTimeout(timeoutId);
			timeoutId = setTimeout(() => (copied = false), 2000);
		} catch (err) {
			error(`Failed to copy email: ${err}`);
		}
	}
</script>

<Panel class="flex flex-col gap-3 p-6 min-h-[280px]">
	<h2 class="text-2xl font-bold flex items-center">
		<div
			class="rounded-full bg-accent-pink p-2 inline-block mr-3 w-10 h-10"
		>
			<PiggyBankIcon color="black" />
		</div>
		{m["about.sponsors.title"]()}
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
			{@html sanitize(link(
				"discord_link",
				m["about.sponsors.description"](),
				DISCORD_URL,
				true
			))}
			<span class="inline-block mx-[2px] relative top-[2px]">
				<button
					id="email"
					class="flex items-center gap-[6px] cursor-pointer"
					onclick={copyToClipboard}
					aria-label="Copy email to clipboard"
				>
					{#if copied}
						<CheckIcon size="14"></CheckIcon>
					{:else}
						<CopyIcon size="14"></CopyIcon>
					{/if}
					hello@vert.sh
				</button>
			</span>!
		</p>
	</div>
</Panel>

<style lang="postcss">
	#email {
		@apply font-mono bg-gray-200 rounded-md px-1 text-inherit no-underline dynadark:bg-panel-alt dynadark:text-white;
	}

	#email:hover {
		@apply font-mono !bg-accent !text-black rounded-md px-1 duration-200;
	}
</style>
