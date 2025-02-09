<script lang="ts">
	import { page } from "$app/state";
	import { beforeNavigate, goto } from "$app/navigation";
	import { PUB_HOSTNAME, PUB_PLAUSIBLE_URL } from "$env/static/public";
	import { duration, fly } from "$lib/animation";
	import VertVBig from "$lib/assets/vert-bg.svg?component";
	import featuredImage from "$lib/assets/VERT_Feature.webp";
	import Navbar from "$lib/components/functional/Navbar.svelte";
	import Footer from "$lib/components/visual/Footer.svelte";
	import Logo from "$lib/components/visual/svg/Logo.svelte";

	import { fade } from "$lib/animation";
	import {
		files,
		gradientColor,
		isMobile,
		effects,
		showGradient,
		theme,
	} from "$lib/store/index.svelte";
	import {
		InfoIcon,
		RefreshCw,
		SettingsIcon,
		UploadIcon,
	} from "lucide-svelte";
	import { onMount } from "svelte";
	import { quintOut } from "svelte/easing";
	import "../app.scss";
	import { DISCORD_URL, GITHUB_URL_VERT, VERT_NAME } from "$lib/consts";
	import { type Toast as ToastType, toasts } from "$lib/store/ToastProvider";
	import Toast from "$lib/components/visual/Toast.svelte";
	import { Settings } from "$lib/sections/settings/index.svelte";
	let { children } = $props();

	let dropping = $state(false);
	let goingLeft = $state(false);
	let toastList = $state<ToastType[]>([]);

	toasts.subscribe((value) => {
		toastList = value as ToastType[];
	});

	const items = $derived<
		{
			name: string;
			url: string;
			activeMatch: (pathname: string) => boolean;
			icon: any;
			badge?: number;
		}[]
	>([
		{
			name: "Upload",
			url: "/",
			activeMatch: (pathname) => pathname === "/",
			icon: UploadIcon,
		},
		{
			name: "Convert",
			url: "/convert",
			activeMatch: (pathname) => pathname === "/convert",
			icon: RefreshCw,
			badge: files.files.length,
		},
		{
			name: "Settings",
			url: "/settings",
			activeMatch: (pathname) => pathname.startsWith("/settings"),
			icon: SettingsIcon,
		},
		{
			name: "About",
			url: "/about",
			activeMatch: (pathname) => pathname.startsWith("/about"),
			icon: InfoIcon,
		},
	]);

	const dropFiles = (e: DragEvent) => {
		e.preventDefault();
		dropping = false;
		const oldLength = files.files.length;
		files.add(e.dataTransfer?.files);
		if (oldLength !== files.files.length) goto("/convert");
	};

	const handleDrag = (e: DragEvent, drag: boolean) => {
		e.preventDefault();
		dropping = drag;
	};

	onMount(() => {
		isMobile.set(window.innerWidth <= 768);
		window.addEventListener("resize", () => {
			isMobile.set(window.innerWidth <= 768);
		});

		effects.set(localStorage.getItem("effects") !== "false"); // defaults to true if not set
		theme.set(
			(localStorage.getItem("theme") as "light" | "dark") || "light",
		);

		Settings.instance.load();
	});

	beforeNavigate((e) => {
		const oldIndex = items.findIndex((i) =>
			i.activeMatch(e.from?.url.pathname || ""),
		);
		const newIndex = items.findIndex((i) =>
			i.activeMatch(e.to?.url.pathname || ""),
		);
		if (newIndex < oldIndex) {
			goingLeft = true;
		} else {
			goingLeft = false;
		}
	});
</script>

<svelte:head>
	<title>{VERT_NAME}</title>
	<meta name="theme-color" content="#F2ABEE" />
	<meta
		name="title"
		content="{VERT_NAME} — Free, fast, and awesome file convert"
	/>
	<meta
		name="description"
		content="With VERT you can convert image and audio files to and from PNG, JPG, WEBP, MP3, WAV, FLAC, and more. No ads, no tracking, open source, and all processing is done on your device."
	/>
	<meta property="og:type" content="website" />
	<meta
		property="og:title"
		content="{VERT_NAME} — Free, fast, and awesome file convert"
	/>
	<meta
		property="og:description"
		content="With VERT you can convert image and audio files to and from PNG, JPG, WEBP, MP3, WAV, FLAC, and more. No ads, no tracking, open source, and all processing is done on your device."
	/>
	<meta property="og:image" content={featuredImage} />
	<meta property="twitter:card" content="summary_large_image" />
	<meta
		property="twitter:title"
		content="{VERT_NAME} — Free, fast, and awesome file convert"
	/>
	<meta
		property="twitter:description"
		content="With VERT you can convert image and audio files to and from PNG, JPG, WEBP, MP3, WAV, FLAC, and more. No ads, no tracking, open source, and all processing is done on your device."
	/>
	<meta property="twitter:image" content={featuredImage} />
	{#if PUB_PLAUSIBLE_URL}<script
			defer
			data-domain={PUB_HOSTNAME || "vert.sh"}
			src="{PUB_PLAUSIBLE_URL}/js/script.pageview-props.tagged-events.js"
		></script>{/if}
	<script src="/coi-serviceworker.min.js"></script>
</svelte:head>

<div
	class="flex flex-col min-h-screen h-full"
	ondrop={dropFiles}
	ondragenter={(e) => handleDrag(e, true)}
	ondragover={(e) => handleDrag(e, true)}
	ondragleave={(e) => handleDrag(e, false)}
	role="region"
>
	{#if dropping}
		<div
			class="fixed w-screen h-screen opacity-40 dynadark:opacity-20 z-[100] pointer-events-none blur-2xl {$effects
				? 'dragoverlay'
				: 'bg-accent-blue'}"
			class:_dragover={dropping && $effects}
			transition:fade={{
				duration,
				easing: quintOut,
			}}
		></div>
	{/if}

	<!-- FIXME: if user resizes between desktop/mobile, highlight of page disappears (only shows on original size) -->
	<div>
		<!-- Mobile logo -->
		<div class="flex md:hidden justify-center items-center pb-8 pt-4">
			<a
				class="flex items-center justify-center bg-panel p-2 rounded-[20px] shadow-panel"
				href="/"
			>
				<div
					class="h-14 bg-accent rounded-[14px] flex items-center justify-center"
				>
					<div class="w-28 h-5">
						<Logo />
					</div>
				</div>
			</a>
		</div>

		<!-- Desktop navbar -->
		<div class="hidden md:flex p-8 w-screen justify-center">
			<Navbar {items} />
		</div>
	</div>

	<div class="grid grid-rows-1 grid-cols-1 h-full flex-grow">
		{#key page.url.pathname}
			<div
				class="row-start-1 col-start-1"
				in:fly={{
					x: goingLeft ? -window.innerWidth : window.innerWidth,
					duration,
					easing: quintOut,
					delay: 25,
				}}
				out:fly={{
					x: goingLeft ? window.innerWidth : -window.innerWidth,
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

	<div class="fixed bottom-28 md:bottom-0 right-0 p-4 space-y-4 z-50">
		{#each toastList as { id, type, message, durations }}
			<Toast {id} {type} {message} {durations} />
		{/each}
	</div>

	<div>
		<div
			class="hidden md:block w-full h-14 border-t border-separator fixed bottom-0 mt-12"
		>
			<Footer
				class="w-full h-full"
				items={{
					//"Privacy policy": "#",
					"Source code": GITHUB_URL_VERT,
					"Discord server": DISCORD_URL,
				}}
			/>
		</div>

		<!-- Mobile navbar -->
		<div
			class="fixed md:hidden bottom-0 left-0 w-screen p-8 justify-center z-50"
		>
			<div class="flex flex-col justify-center items-center">
				<Navbar {items} />
			</div>
		</div>
	</div>
</div>

<!-- Gradients placed here to prevent it overlapping in transitions -->
{#if page.url.pathname === "/"}
	<div
		class="fixed -z-30 top-0 left-0 w-screen h-screen flex items-center justify-center overflow-hidden"
	>
		<VertVBig
			class="fill-[--fg] opacity-10 dynadark:opacity-5 scale-[200%] md:scale-[80%]"
		/>
	</div>
	<div
		id="gradient-bg"
		class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
		style="background: var(--bg-gradient);"
	></div>
{:else if page.url.pathname === "/convert" && $showGradient}
	<div
		id="gradient-bg"
		class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
		style="background: var(--bg-gradient-{$gradientColor || 'pink'});"
	></div>
{:else if page.url.pathname === "/convert" && files.files.length === 1 && files.files[0].blobUrl}
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
			<!-- <div class="absolute bottom-0 left-0 w-full h-full">
				<ProgressiveBlur
					direction="bottom"
					endIntensity={256}
					iterations={8}
					fadeTo="var(--bg)"
				/>
			</div> -->
		</div>
	</div>
{:else if page.url.pathname === "/settings"}
	<div
		id="gradient-bg"
		class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
		style="background: var(--bg-gradient-blue);"
	></div>
{:else if page.url.pathname === "/about"}
	<div
		id="gradient-bg"
		class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
		style="background: var(--bg-gradient-pink);"
	></div>
{/if}

<style>
	.dragoverlay {
		animation: dragoverlay-animation 3s infinite linear;
	}

	@keyframes dragoverlay-animation {
		0% {
			@apply bg-accent-pink;
		}

		25% {
			@apply bg-accent-blue;
		}

		50% {
			@apply bg-accent-purple;
		}

		75% {
			@apply bg-accent-red;
		}

		100% {
			@apply bg-accent-pink;
		}
	}
</style>
