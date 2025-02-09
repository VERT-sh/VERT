<script lang="ts">
	type Props = {
		class: string;
		items: { [name: string]: string };
	};

	const { class: classList, items }: Props = $props();

	const year = new Date().getFullYear();

	const links = $derived(Object.entries(items));
</script>

<footer class={classList}>
	<div
		class="w-full h-full flex items-center justify-center text-muted gap-3 relative"
	>
		<p>© {year} VERT.</p>
		{#each links as [name, url] (name)}
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
		class="absolute bottom-0 left-0 w-full h-24 -z-10"
		style="background: linear-gradient(to bottom, transparent, var(--bg) 100%)"
	></div>
</footer>
