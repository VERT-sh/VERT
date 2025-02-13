<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";

	import { PUB_HOSTNAME, PUB_PLAUSIBLE_URL } from "$env/static/public";
	import { VERT_NAME } from "$lib/consts";
	import Toast from "$lib/components/visual/Toast.svelte";
	import * as Layout from "$lib/components/layout";
	import * as Navbar from "$lib/components/layout/Navbar";
	import featuredImage from "$lib/assets/VERT_Feature.webp";
	import { type Toast as ToastType, toasts } from "$lib/store/ToastProvider";
	import { Settings } from "$lib/sections/settings/index.svelte";
	import {
		files,
		isMobile,
		effects,
		theme,
		dropping,
	} from "$lib/store/index.svelte";
	import "../app.scss";

	let { children } = $props();

	let toastList = $state<ToastType[]>([]);

	toasts.subscribe((value) => {
		toastList = value as ToastType[];
	});

	const dropFiles = (e: DragEvent) => {
		e.preventDefault();
		dropping.set(false);
		const oldLength = files.files.length;
		files.add(e.dataTransfer?.files);
		if (oldLength !== files.files.length) goto("/convert");
	};

	const handleDrag = (e: DragEvent, drag: boolean) => {
		e.preventDefault();
		dropping.set(drag);
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
		content="With VERT you can quickly convert any image, video and audio file. No ads, no tracking, open source, and all processing is done on your device."
	/>
	<meta property="og:type" content="website" />
	<meta
		property="og:title"
		content="{VERT_NAME} — Free, fast, and awesome file convert"
	/>
	<meta
		property="og:description"
		content="With VERT you can quickly convert any image, video and audio file. No ads, no tracking, open source, and all processing is done on your device."
	/>
	<meta property="og:image" content={featuredImage} />
	<meta property="twitter:card" content="summary_large_image" />
	<meta
		property="twitter:title"
		content="{VERT_NAME} — Free, fast, and awesome file convert"
	/>
	<meta
		property="twitter:description"
		content="With VERT you can quickly convert any image, video and audio file. No ads, no tracking, open source, and all processing is done on your device."
	/>
	<meta property="twitter:image" content={featuredImage} />
	<link rel="manifest" href="/manifest.json" />
	{#if PUB_PLAUSIBLE_URL}<script
			defer
			data-domain={PUB_HOSTNAME || "vert.sh"}
			src="{PUB_PLAUSIBLE_URL}/js/script.pageview-props.tagged-events.js"
		></script>{/if}
</svelte:head>

<!-- FIXME: if user resizes between desktop/mobile, highlight of page disappears (only shows on original size) -->
<div
	class="flex flex-col min-h-screen h-full"
	ondrop={dropFiles}
	ondragenter={(e) => handleDrag(e, true)}
	ondragover={(e) => handleDrag(e, true)}
	ondragleave={(e) => handleDrag(e, false)}
	role="region"
>
	<Layout.UploadRegion />

	<div>
		<Layout.MobileLogo />
		<Navbar.Desktop />
	</div>

	<!-- 
		SvelteKit throws the following warning when developing - safe to ignore as we render the children in this component:
		`<slot />` or `{@render ...}` tag missing — inner content will not be rendered
	-->
	<Layout.PageContent {children} />

	<div class="fixed bottom-28 md:bottom-0 right-0 p-4 space-y-4 z-50">
		{#each toastList as { id, type, message, durations }}
			<Toast {id} {type} {message} {durations} />
		{/each}
	</div>

	<div>
		<Layout.Footer />
		<Navbar.Mobile />
	</div>
</div>

<!-- Gradients placed here to prevent it overlapping in transitions -->
<Layout.Gradients />
