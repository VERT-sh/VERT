<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import { MessageCircleQuestionMarkIcon } from "@lucide/svelte";
	import { m } from "$lib/paraglide/messages";
	import { link, sanitize } from "$lib/store/index.svelte";
</script>

<Panel class="flex flex-col gap-3 p-6">
	<h2 class="text-2xl font-bold flex items-center">
		<div
			class="rounded-full bg-accent-pink p-2 inline-block mr-3 w-10 h-10"
		>
			<MessageCircleQuestionMarkIcon color="black" />
		</div>
		{m["about.why.title"]()}
	</h2>
	<p class="text-lg font-normal">
		{@html sanitize(link(
			["privacy_link"],
			m["about.why.description"](),
			["/privacy"],
		))}
	</p>
</Panel>
