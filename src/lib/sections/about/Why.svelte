<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import { MessageCircleQuestionIcon } from "lucide-svelte";
</script>

<Panel class="flex flex-col gap-3 p-6">
	<h2 class="text-2xl font-bold flex items-center">
		<div
			class="rounded-full bg-accent-pink p-2 inline-block mr-3 w-10 h-10"
		>
			<MessageCircleQuestionIcon color="black" />
		</div>
		Why VERT?
	</h2>
	<p class="text-lg font-normal">
		<b>File converters have always disappointed us.</b> They're ugly,
		riddled with ads, and most importantly; slow. We decided to solve this
		problem once and for all by making an alternative that solves all those
		problems, and more.<br />
		<br />
		All your files are converted completely on-device; this means that there's
		no delay between sending and receiving the files from a server, and we never
		get to snoop on the files you convert.
	</p>
</Panel>
