<script lang="ts">
	import { page } from "$app/state";
	import { duration, transition } from "$lib/animation";
	import VertVBig from "$lib/assets/vert-bg.svg?component";
	import {
		files,
		gradientColor,
		showGradient,
	} from "$lib/store/index.svelte";
	import { quintOut } from "svelte/easing";
	import { fade } from "$lib/animation";
	import { Tween } from "svelte/motion";

	const colors: {
		matcher: (path: string) => boolean;
		color: string;
		at: number;
	}[] = $derived([
		{
			matcher: (path) => path === "/",
			color: "var(--bg-gradient-from)",
			at: 100,
		},
		{
			matcher: (path) => path === "/convert/",
			color: `var(--bg-gradient-${$gradientColor ? $gradientColor + "-" : ""}from)`,
			at: 25,
		},
		{
			matcher: (path) => path === "/settings/",
			color: "var(--bg-gradient-blue-from)",
			at: 25,
		},
		{
			matcher: (path) => path === "/about/",
			color: "var(--bg-gradient-from)",
			at: 25,
		},
		{
			matcher: (path) => path === "/jpegify/",
			color: "var(--bg-gradient-red-from)",
			at: 100,
		},
		{
			matcher: (path) => path === "/privacy/",
			color: "var(--bg-gradient-red-from)",
			at: 100,
		},
	]);

	const color = $derived(
		Object.values(colors).find((p) => p.matcher(page.url.pathname)) || {
			matcher: () => false,
			color: "transparent",
			at: 0,
		},
	);

	// svelte-ignore state_referenced_locally This is handled in the effect below
	let at = new Tween(color.at, {
		duration,
		easing: quintOut,
	});

	$effect(() => {
		at.set(color.at);
	});

	const maskImage = $derived(
		`linear-gradient(to top, transparent ${100 - at.current}%, black 100%)`,
	);
</script>

{#if page.url.pathname === "/"}
	<div
		class="fixed -z-30 top-0 left-0 w-screen h-screen flex items-center justify-center overflow-hidden"
		transition:fade={{
			duration,
			easing: quintOut,
		}}
	>
		<VertVBig
			class="fill-[--fg] opacity-10 dynadark:opacity-5 scale-[200%] md:scale-[80%]"
		/>
	</div>
{/if}

<div
	class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
	style="background-color: {color.color}; 
	mask-image: {maskImage}; 
	-webkit-mask-image: {maskImage};
	transition: background-color {duration}ms {transition};"
></div>

{#if page.url.pathname === "/convert/" && files.files.length === 1}
	{@const bgMask =
		"linear-gradient(to top, transparent 5%, rgba(0, 0, 0, 0.5) 100%)"}
	<div
		class="fixed top-0 left-0 w-screen h-screen -z-50"
		style="background-image: url({files.files[0].blobUrl});
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		filter: blur(10px);
		mask-image: {bgMask};
		-webkit-mask-image: {bgMask};"
		transition:fade={{ duration, easing: quintOut }}
	></div>
{/if}

<!-- 
	<div
		id="gradient-bg"
		class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
		style="background: var(--bg-gradient);"
		transition:fade={{
			duration,
			easing: quintOut,
		}}
	></div>
{:else if (page.url.pathname === "/convert/" || page.url.pathname === "/jpegify/") && $showGradient}
	{#key $gradientColor}
		<div
			id="gradient-bg"
			class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
			style="background: var(--bg-gradient-{$gradientColor || 'pink'});"
			transition:fade={{
				duration,
				easing: quintOut,
			}}
		></div>
	{/key}
{:else if page.url.pathname === "/convert/" && files.files.length === 1 && files.files[0].blobUrl}
	<div
		class="fixed w-screen h-screen opacity-75 overflow-hidden top-0 left-0 -z-50 pointer-events-none grid grid-cols-1 grid-rows-1 scale-105"
	>
		<div
			class="w-full relative"
			transition:fade={{
				duration,
				easing: quintOut,
			}}
		>
			<img
				class="object-cover w-full h-full blur-md"
				src={files.files[0].blobUrl}
				alt={files.files[0].name}
			/>
			<div
				class="absolute top-0 left-0 w-full h-full"
				style="background: var(--bg-gradient-image);"
			></div>
		</div>
	</div>
{:else if page.url.pathname === "/settings/"}
	<div
		id="gradient-bg"
		class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
		style="background: var(--bg-gradient-blue);"
		transition:fade={{
			duration,
			easing: quintOut,
		}}
	></div>
{:else if page.url.pathname === "/about/"}
	<div
		id="gradient-bg"
		class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
		style="background: var(--bg-gradient-pink);"
		transition:fade={{
			duration,
			easing: quintOut,
		}}
	></div>
{/if} -->
