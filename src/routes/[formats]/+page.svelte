<script lang="ts">
	import { error, log } from "$lib/logger";
	import Index from "../+page.svelte";
	const { data } = $props();

	$effect(() => {
		if (data.fromFormat && data.toFormat) {
			log(["SEO"], `converting from: ${data.fromFormat}`);
			log(["SEO"], `converting to: ${data.toFormat}`);
		} else if (data.error) {
			error(["SEO"], `invalid slug: ${data.error}`);
		}
	});
</script>

<svelte:head>
	{#if data.fromFormat && data.toFormat}
		<title
			>Convert {data.fromFormat.replace(".", "").toUpperCase()} to {data.toFormat
				.replace(".", "")
				.toUpperCase()} - VERT</title
		>
		<meta
			name="description"
			content="Convert {data.fromFormat
				.replace('.', '')
				.toUpperCase()} files to {data.toFormat
				.replace('.', '')
				.toUpperCase()} with VERT. No ads, no tracking, open source, and all processing (other than video) is done on your device."
		/>
	{/if}
</svelte:head>

<!-- render main upload page -->
<Index />
