<script lang="ts">
	import Panel from "#lib/components/visual/Panel.svelte";
	import { PiggyBankIcon, CopyIcon, CheckIcon } from "@lucide/svelte";
	import { DISCORD_URL } from "#lib/util/consts";
	import { error } from "#lib/util/logger.svelte";
	import { m } from "#lib/paraglide/messages";
	import { link, sanitize } from "#lib/store/index.svelte";
	import { ToastManager } from "#lib/util/toast.svelte";
	import lily from "#lib/assets/lily.jpeg";

	let copied = false;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

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

<Panel class="flex min-h-[280px] flex-col gap-3 p-6">
	<h2 class="flex items-center text-2xl font-bold">
		<div
			class="mr-3 inline-block h-10 w-10 rounded-full bg-accent-pink p-2"
		>
			<PiggyBankIcon color="black" />
		</div>
		{m["about.sponsors.title"]()}
	</h2>
	<div class="flex h-full flex-col justify-between gap-4 [&>*]:font-normal">
		<div class="flex justify-center gap-3 text-lg">
			<a
				href="https://eva.pink"
				target="_blank"
				class="btn flex h-24 w-48 flex-col items-center justify-center gap-2 rounded-2xl px-0"
			>
				<img
					src={lily}
					alt="Eva"
					class="h-full w-full select-none object-cover"
				/>
			</a>
		</div>
		<p class="text-muted">
			{@html sanitize(
				link(
					"discord_link",
					m["about.sponsors.description"](),
					DISCORD_URL,
					true,
				),
			)}
			{@html sanitize(
				link(
					"discord_link",
					m["about.sponsors.description"](),
					DISCORD_URL,
					true,
				),
			)}
			<span class="relative top-[2px] mx-[2px] inline-block">
				<button
					id="email"
					class="flex cursor-pointer items-center gap-[6px]"
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
		@apply rounded-md bg-gray-200 px-1 font-mono text-inherit no-underline dynadark:bg-panel-alt dynadark:text-white;
	}

	#email:hover {
		@apply rounded-md !bg-accent px-1 font-mono !text-black duration-200;
	}
</style>
