<script lang="ts" context="module">
	import { resolve } from "$app/paths";
	import { GITHUB_URL_VERT, DISCORD_URL } from "#lib/util/consts";
	import { m } from "#lib/paraglide/messages";

	declare const __COMMIT_HASH__: string | undefined;

	const commitHash =
		__COMMIT_HASH__ && __COMMIT_HASH__ !== "unknown"
			? __COMMIT_HASH__
			: null;

	const year = new Date().getFullYear();

	// we can't use svelte snippets or a derived object to render the footer as it causes a full-page reload
	// ...for some reason. i have no idea, maybe it's to do with the {#key $locale} in +layout.svelte
</script>

<footer
	class="fixed bottom-0 mt-12 hidden h-14 w-full border-t border-separator md:block"
>
	<div
		class="relative flex h-full w-full items-center justify-center gap-3 text-muted"
	>
		<p>{m["footer.copyright"]({ year })}</p>
		<p>•</p>
		<a
			class="font-normal hover:underline"
			href={GITHUB_URL_VERT}
			target="_blank"
			rel="external"
		>
			{m["footer.source_code"]()}
		</a>
		<p>•</p>
		<a
			class="font-normal hover:underline"
			href={DISCORD_URL}
			target="_blank"
			rel="external"
		>
			{m["footer.discord_server"]()}
		</a>
		<p>•</p>
		<a class="font-normal hover:underline" href={resolve("/privacy")}>
			{m["footer.privacy_policy"]()}
		</a>
		{#if commitHash}
			<p>•</p>
			<a
				class="font-normal hover:underline"
				href="{GITHUB_URL_VERT}/commit/{commitHash}"
				target="_blank"
				rel="external"
			>
				{commitHash}
			</a>
		{/if}
	</div>

	<div
		class="pointer-events-none absolute bottom-0 left-0 -z-10 h-24 w-full"
		style="background: linear-gradient(to bottom, transparent, var(--bg) 100%)"
	></div>
</footer>
