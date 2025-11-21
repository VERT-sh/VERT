<script lang="ts">
	import { page } from "$app/state";
	import { duration } from "$lib/util/animation";
	import { goingLeft, isMobile } from "$lib/store/index.svelte";
	import { quintOut } from "svelte/easing";
	import { fly, fade } from "$lib/util/animation";

	let { children } = $props();
</script>

<div class="grid grid-rows-1 grid-cols-1 h-full flex-grow">
	{#key page.url.pathname}
		<div
			class="row-start-1 col-start-1"
			in:fly={{
				x: $goingLeft ? -window.innerWidth : window.innerWidth,
				duration,
				easing: quintOut,
				delay: 25,
			}}
			out:fly={{
				x: $goingLeft ? window.innerWidth : -window.innerWidth,
				duration,
				easing: quintOut,
			}}
		>
			<div
				class="flex flex-col h-full pb-32"
				in:fade={{
					duration,
					easing: quintOut,
					delay: $isMobile ? 0 : 100,
				}}
				out:fade={{
					duration,
					easing: quintOut,
					delay: $isMobile ? 0 : 200,
				}}
			>
				{@render children()}
			</div>
		</div>
	{/key}
</div>
