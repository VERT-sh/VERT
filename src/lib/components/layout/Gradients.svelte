<script lang="ts">
	import { page } from "$app/state";
	import { duration } from "$lib/animation";
	import VertVBig from "$lib/assets/vert-bg.svg?component";
	import { files, gradientColor, showGradient } from "$lib/store/index.svelte";
	import { quintOut } from "svelte/easing";
	import { fade } from "$lib/animation";
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
	<div
		id="gradient-bg"
		class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
		style="background: var(--bg-gradient);"
		transition:fade={{
			duration,
			easing: quintOut,
		}}
	></div>
{:else if page.url.pathname === "/convert" && $showGradient}
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
		transition:fade={{
			duration,
			easing: quintOut,
		}}
	></div>
{:else if page.url.pathname === "/about"}
	<div
		id="gradient-bg"
		class="fixed top-0 left-0 w-screen h-screen -z-40 pointer-events-none"
		style="background: var(--bg-gradient-pink);"
		transition:fade={{
			duration,
			easing: quintOut,
		}}
	></div>
{/if}