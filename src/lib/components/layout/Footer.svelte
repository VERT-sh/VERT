<script lang="ts">
	import { GITHUB_URL_VERT, DISCORD_URL } from "$lib/consts";

	const items = Object.entries({
		//"Privacy policy": "#",
		"Source code": GITHUB_URL_VERT,
		"Discord server": DISCORD_URL,
	});

	const year = new Date().getFullYear();
</script>

<footer
	class="hidden md:block w-full h-14 border-t border-separator fixed bottom-0 mt-12"
>
	<div
		class="w-full h-full flex items-center justify-center text-muted gap-3 relative"
	>
		<p>© {year} VERT.</p>
		{#each items as [name, url] (name)}
			<!-- bullet point -->
			<p>•</p>
			<a
				class="hover:underline font-normal"
				href={url}
				target={url.startsWith("http") ? "_blank" : "_self"}
			>
				{name}
			</a>
		{/each}
	</div>

	<div
		class="absolute bottom-0 left-0 w-full h-24 -z-10 pointer-events-none"
		style="background: linear-gradient(to bottom, transparent, var(--bg) 100%)"
	></div>
</footer>
