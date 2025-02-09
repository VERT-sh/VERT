<script lang="ts">
	import { browser } from "$app/environment";
	import { page } from "$app/state";
	import { duration, fade } from "$lib/animation";
	import { effects, setTheme } from "$lib/store/index.svelte";
	import clsx from "clsx";
	import { MoonIcon, SunIcon } from "lucide-svelte";
	import { quintOut } from "svelte/easing";
	import Panel from "../visual/Panel.svelte";
	import Logo from "../visual/svg/Logo.svelte";

	type Props = {
		items: {
			name: string;
			url: string;
			activeMatch: (pathname: string) => boolean;
			icon: any;
			badge?: number;
		}[];
	};

	let { items }: Props = $props();

	let links = $state<HTMLAnchorElement[]>([]);
	let container = $state<HTMLDivElement>();
	let containerRect = $derived(container?.getBoundingClientRect());
	$effect(() => {
		$inspect(containerRect);
	});

	const linkRects = $derived(links.map((l) => l.getBoundingClientRect()));

	const selectedIndex = $derived(
		items.findIndex((i) => i.activeMatch(page.url.pathname)),
	);
</script>

{#snippet link(item: (typeof items)[0], index: number)}
	{@const Icon = item.icon}
	<a
		bind:this={links[index]}
		href={item.url}
		aria-label={item.name}
		class={clsx(
			"w-16 md:w-32 h-full relative z-10 rounded-xl flex items-center justify-center gap-3 overflow-hidden",
			{
				"bg-panel-highlight":
					item.activeMatch(page.url.pathname) && !browser,
			},
		)}
		draggable={false}
	>
		<div class="grid grid-rows-1 grid-cols-1">
			{#key item.name}
				<div
					class="w-full row-start-1 col-start-1 h-full flex items-center justify-center gap-3"
					in:fade={{
						duration,
						easing: quintOut,
					}}
					out:fade={{
						duration,
						easing: quintOut,
					}}
				>
					<div class="relative">
						<Icon />
						{#if item.badge}
							<div
								class="absolute overflow-hidden grid grid-rows-1 grid-cols-1 -top-1 font-display -right-1 w-fit px-1.5 h-4 rounded-full bg-badge text-on-badge font-medium"
								style="font-size: 0.7rem;"
								transition:fade={{
									duration,
									easing: quintOut,
								}}
							>
								{#key item.badge}
									<div
										class="flex items-center justify-center w-full h-full col-start-1 row-start-1"
										in:fade={{
											duration,
											easing: quintOut,
										}}
										out:fade={{
											duration,
											easing: quintOut,
										}}
									>
										{item.badge}
									</div>
								{/key}
							</div>
						{/if}
					</div>
					<p class="font-medium hidden md:flex">
						{item.name}
					</p>
				</div>
			{/key}
		</div>
	</a>
{/snippet}

<div bind:this={container}>
	<Panel class="max-w-[778px] w-full h-20 flex items-center gap-3 relative">
		{#if linkRects[selectedIndex]}
			<div
				class="absolute bg-panel-highlight rounded-xl"
				style="width: {linkRects[selectedIndex]
					.width}px; height: {linkRects[selectedIndex]
					.height}px; top: {linkRects[selectedIndex].top -
					(containerRect?.top || 0)}px; left: {linkRects[
					selectedIndex
				].left - (containerRect?.left || 0)}px; {$effects
					? `transition: left var(--transition) ${duration}ms, top var(--transition) ${duration}ms;`
					: ''}"
			></div>
		{/if}
		<a
			class="w-28 h-full bg-accent rounded-xl items-center justify-center hidden md:flex"
			href="/"
		>
			<div class="h-5 w-full">
				<Logo />
			</div>
		</a>
		{#each items as item, i (item.url)}
			{@render link(item, i)}
		{/each}
		<div class="w-0.5 bg-separator h-full hidden md:flex"></div>
		<button
			onclick={() => {
				const isDark =
					document.documentElement.classList.contains("dark");
				setTheme(isDark ? "light" : "dark");
			}}
			class="w-14 h-full items-center justify-center hidden md:flex"
		>
			<SunIcon class="dynadark:hidden block" />
			<MoonIcon class="dynadark:block hidden" />
		</button>
	</Panel>
</div>
