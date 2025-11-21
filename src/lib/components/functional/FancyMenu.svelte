<script lang="ts">
	import { browser } from "$app/environment";
	import { page } from "$app/stores";
	import { duration, fly } from "$lib/util/animation";
	import clsx from "clsx";
	import { onMount, tick } from "svelte";
	import { quintOut } from "svelte/easing";
	import type { Writable } from "svelte/store";

	interface Props {
		links: {
			name: string;
			url: string;
			activeMatch: (pathname: string) => boolean;
		}[];
		shouldGoBack: Writable<boolean> | null;
	}

	let { links, shouldGoBack = null }: Props = $props();

	let hasLoaded = $state(false);

	let navWidth = $state(1);
	let linkCount = $derived(links.length);
	let activeLinkIndex = $derived(
		links.findIndex((i) => i.activeMatch($page.url.pathname)),
	);

	onMount(async () => {
		await tick();
		setTimeout(() => {
			hasLoaded = true;
		}, 16);
	});
</script>

<div
	bind:clientWidth={navWidth}
	class="w-full flex bg-background relative h-16 items-center"
>
	{#if activeLinkIndex !== -1}
		<div
			class="absolute pointer-events-none top-1 bg-foreground h-[calc(100%-8px)] rounded-xl"
			style="width: {navWidth / linkCount - 8}px; left: {(navWidth /
				linkCount) *
				activeLinkIndex +
				4}px; transition: {hasLoaded ? duration - 200 : 0}ms ease left;"
		></div>
	{/if}
	{#each links as { name, url } (url)}
		<a
			class={clsx(
				"w-1/2 px-2 ml-1 h-[calc(100%-8px)] mr-1 flex items-center justify-center rounded-xl relative overflow-hidden font-medium",
				{
					"bg-foreground": $page.url.pathname === url && !browser,
				},
			)}
			href={url}
			onclick={() => {
				if (shouldGoBack) {
					const currentIndex = links.findIndex((i) =>
						i.activeMatch($page.url.pathname),
					);
					const nextIndex = links.findIndex((i) =>
						i.activeMatch(url),
					);
					$shouldGoBack = nextIndex < currentIndex;
				}
			}}
		>
			<div class="grid grid-cols-1 grid-rows-1">
				{#key name}
					<span
						class="mix-blend-difference invert dynadark:invert-0 col-start-1 row-start-1 text-center"
						in:fly={{
							duration,
							easing: quintOut,
							y: -50,
						}}
						out:fly={{
							duration,
							easing: quintOut,
							y: 50,
						}}
					>
						{name}
					</span>
				{/key}
			</div>
		</a>
	{/each}
</div>
