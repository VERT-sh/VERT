<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { browser } from "$app/env";
	import { page } from "$app/state";
	import { duration, fade } from "#lib/util/animation";
	import {
		effects,
		files,
		goingLeft,
		setTheme,
	} from "#lib/store/index.svelte";
	import clsx from "clsx";
	import {
		InfoIcon,
		MoonIcon,
		RefreshCwIcon,
		SettingsIcon,
		SunIcon,
		UploadIcon,
	} from "@lucide/svelte";
	import { quintOut } from "svelte/easing";
	import Panel from "../../visual/Panel.svelte";
	import Logo from "../../visual/svg/Logo.svelte";
	import { beforeNavigate } from "$app/navigation";
	import { resolve } from "$app/paths";
	import Tooltip from "#lib/components/visual/Tooltip.svelte";
	import { m } from "#lib/paraglide/messages";

	const items = $derived<
		{
			name: string;
			url: string;
			activeMatch: (pathname: string) => boolean;
			icon: typeof UploadIcon;
			badge?: number;
		}[]
	>([
		{
			name: m["navbar.upload"](),
			url: "/",
			activeMatch: (pathname) => pathname === "/",
			icon: UploadIcon,
		},
		{
			name: m["navbar.convert"](),
			url: "/convert",
			activeMatch: (pathname) =>
				pathname === "/convert/" || pathname === "/convert",
			icon: RefreshCwIcon,
			badge: files.files.length,
		},
		{
			name: m["navbar.settings"](),
			url: "/settings",
			activeMatch: (pathname) => pathname.startsWith("/settings"),
			icon: SettingsIcon,
		},
		{
			name: m["navbar.about"](),
			url: "/about",
			activeMatch: (pathname) => pathname.startsWith("/about"),
			icon: InfoIcon,
		},
	]);

	let links = $state<HTMLAnchorElement[]>([]);
	let container = $state<HTMLDivElement>();
	let containerRect = $derived(container?.getBoundingClientRect());
	let isInitialized = $state(false);

	const linkRects = $derived(links.map((l) => l.getBoundingClientRect()));

	const selectedIndex = $derived(
		items.findIndex((i) => i.activeMatch(page.url.pathname)),
	);

	const isSecretPage = $derived(selectedIndex === -1);

	$effect(() => {
		if (containerRect && linkRects.length > 0 && links.length > 0) {
			setTimeout(() => {
				isInitialized = true;
			}, 10);
		} else {
			isInitialized = false;
		}
	});

	beforeNavigate((e) => {
		const oldIndex = items.findIndex((i) =>
			i.activeMatch(e.from?.url.pathname || ""),
		);
		const newIndex = items.findIndex((i) =>
			i.activeMatch(e.to?.url.pathname || ""),
		);
		if (newIndex < oldIndex) {
			goingLeft.set(true);
		} else {
			goingLeft.set(false);
		}
	});
</script>

{#snippet link(item: (typeof items)[0], index: number)}
	{@const Icon = item.icon}
	<a
		bind:this={links[index]}
		href={item.url}
		aria-label={item.name}
		class={clsx(
			"relative z-10 flex h-full min-w-16 flex-1 items-center justify-center gap-3 overflow-hidden rounded-xl md:min-w-32",
			{
				"bg-panel-highlight":
					item.activeMatch(page.url.pathname) && !browser,
			},
		)}
		draggable={false}
	>
		<div class="grid grid-cols-1 grid-rows-1">
			{#key item.name}
				<div
					class="col-start-1 row-start-1 flex h-full w-full items-center justify-center gap-3"
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
								class="absolute -right-1 -top-1 grid h-4 w-fit grid-cols-1 grid-rows-1 overflow-hidden rounded-full bg-badge px-1.5 font-display font-medium text-on-badge"
								style="font-size: 0.7rem;"
								transition:fade={{
									duration,
									easing: quintOut,
								}}
							>
								{#key item.badge}
									<div
										class="col-start-1 row-start-1 flex h-full w-full items-center justify-center"
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
					<p
						class="hidden min-w-0 hyphens-auto break-all font-medium md:flex"
					>
						{item.name}
					</p>
				</div>
			{/key}
		</div>
	</a>
{/snippet}

<div bind:this={container}>
	<Panel class="relative flex h-20 w-screen max-w-[778px] items-center gap-3">
		{@const linkRect = linkRects.at(selectedIndex) || linkRects[0]}
		{#if linkRect && isInitialized}
			<div
				class="absolute rounded-xl bg-panel-highlight"
				style:width="{linkRect.width}px"
				style:height="{linkRect.height}px"
				style:top="{linkRect.top - (containerRect?.top || 0)}px"
				style:left="{linkRect.left - (containerRect?.left || 0)}px"
				style:opacity={isSecretPage ? 0 : 1}
				style:transition={$effects
					? `left var(--transition) ${duration}ms, top var(--transition) ${duration}ms, opacity var(--transition) ${duration}ms`
					: null}
			></div>
		{/if}
		<a
			class="hidden h-full w-28 items-center justify-center rounded-xl bg-accent md:flex"
			href={resolve("/")}
		>
			<div class="h-5 w-full">
				<Logo />
			</div>
		</a>
		{#each items as item, i (item.url)}
			{@render link(item, i)}
		{/each}
		<div class="hidden h-full w-0.5 bg-separator md:flex"></div>
		<Tooltip text={m["navbar.toggle_theme"]()} position="right">
			<button
				onclick={() => {
					const isDark =
						document.documentElement.classList.contains("dark");
					setTheme(isDark ? "light" : "dark");
				}}
				class="hidden h-full w-14 items-center justify-center md:flex"
			>
				<SunIcon class="block dynadark:hidden" />
				<MoonIcon class="hidden dynadark:block" />
			</button>
		</Tooltip>
	</Panel>
</div>
