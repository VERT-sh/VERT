<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import { MessageCircleQuestionIcon } from "lucide-svelte";
	import { m } from "$lib/paraglide/messages";
	import { sanitize } from "$lib/store/index.svelte";
</script>

<Panel class="flex flex-col gap-3 p-6">
	<h2 class="text-2xl font-bold flex items-center">
		<div
			class="rounded-full bg-accent-pink p-2 inline-block mr-3 w-10 h-10"
		>
			<MessageCircleQuestionIcon color="black" />
		</div>
		{m["about.why.title"]()}
	</h2>
	<p class="text-lg font-normal">
		{@html sanitize(m["about.why.description"]())}
	</p>
</Panel>
