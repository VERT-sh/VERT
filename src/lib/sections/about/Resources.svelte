<script lang="ts">
	import Panel from "#lib/components/visual/Panel.svelte";
	import {
		CONTACT_EMAIL,
		DISCORD_URL,
		GITHUB_URL_VERT,
	} from "#lib/util/consts";
	import { effects } from "#lib/store/index.svelte";
	import {
		CodeXmlIcon,
		LinkIcon,
		MailIcon,
		MessageCircleMoreIcon,
	} from "@lucide/svelte";
	import clsx from "clsx";
	import { m } from "#lib/paraglide/messages";
</script>

<Panel class="flex flex-col gap-4 p-6">
	<h2 class="flex items-center text-2xl font-bold">
		<div
			class="mr-3 inline-block h-10 w-10 rounded-full bg-accent-purple p-2"
		>
			<LinkIcon color="black" />
		</div>
		{m["about.resources.title"]()}
	</h2>
	<div class="flex gap-3">
		<a
			href={DISCORD_URL}
			target="_blank"
			rel="external noopener noreferrer"
			class={clsx(
				"btn flex flex-1 items-center justify-center gap-2 rounded-full bg-button p-4 text-black dynadark:text-white",
				!$effects && "!scale-100",
			)}
		>
			<MessageCircleMoreIcon size="24" class="mr-2 inline-block" />
			{m["about.resources.discord"]()}
		</a>
		<a
			href={GITHUB_URL_VERT}
			target="_blank"
			rel="external noopener noreferrer"
			class={clsx(
				"btn flex flex-1 items-center justify-center gap-2 rounded-full bg-button p-4 text-black dynadark:text-white",
				!$effects && "!scale-100",
			)}
		>
			<CodeXmlIcon size="24" class="mr-2 inline-block" />
			{m["about.resources.source"]()}
		</a>
		<a
			href="mailto:{CONTACT_EMAIL}"
			target="_blank"
			rel="noopener noreferrer"
			class={clsx(
				"btn flex flex-1 items-center justify-center gap-2 rounded-full bg-button p-4 text-black dynadark:text-white",
				!$effects && "!scale-100",
			)}
		>
			<MailIcon size="24" class="mr-2 inline-block" />
			{m["about.resources.email"]()}
		</a>
	</div>
</Panel>
