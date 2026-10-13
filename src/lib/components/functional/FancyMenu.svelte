<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { browser } from "$app/env";
	import { page } from "$app/state";
	import type { ResolvedPathname } from "$app/types";
	import { duration, fly } from "#lib/util/animation";
	import clsx from "clsx";
	import { onMount, tick } from "svelte";
	import { quintOut } from "svelte/easing";
	import type { Writable } from "svelte/store";

	interface Props {
		links: {
			name: string;
			url: ResolvedPathname;
			activeMatch: (pathname: string) => boolean;
		}[];
		shouldGoBack: Writable<boolean> | null;
	}

	let { links, shouldGoBack = null }: Props = $props();

	let hasLoaded = $state(false);

	let navWidth = $state(1);
	let linkCount = $derived(links.length);
	let activeLinkIndex = $derived(
		links.findIndex((i) => i.activeMatch(page.url.pathname)),
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
	class="bg-background relative flex h-16 w-full items-center"
>
	{#if activeLinkIndex !== -1}
		<div
			class="bg-foreground pointer-events-none absolute top-1 h-[calc(100%-8px)] rounded-xl"
			style:width="{navWidth / linkCount - 8}px"
			style:left="{(navWidth / linkCount) * activeLinkIndex + 4}px"
			style:transition="{hasLoaded ? duration - 200 : 0}ms ease left"
		></div>
	{/if}
	{#each links as { name, url } (url)}
		<a
			class={clsx(
				"relative ml-1 mr-1 flex h-[calc(100%-8px)] w-1/2 items-center justify-center overflow-hidden rounded-xl px-2 font-medium",
				{
					"bg-foreground": page.url.pathname === url && !browser,
				},
			)}
			href={url}
			onclick={() => {
				if (shouldGoBack) {
					const currentIndex = links.findIndex((i) =>
						i.activeMatch(page.url.pathname),
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
						class="col-start-1 row-start-1 text-center mix-blend-difference invert dynadark:invert-0"
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
