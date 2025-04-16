<script lang="ts">
	import Uploader from "$lib/components/functional/Uploader.svelte";
	import { converters } from "$lib/converters";
	import { vertdLoaded } from "$lib/store/index.svelte";
	import clsx from "clsx";
	import { AudioLines, BookText, Check, Film, Image, Type } from "lucide-svelte";

	const { data } = $props();

	const getSupportedFormats = (name: string) =>
		converters
			.find((c) => c.name === name)
			?.supportedFormats.map(
				(f) =>
					`${f.name}${f.fromSupported && f.toSupported ? "" : "*"}`,
			)
			.join(", ") || "none";

	const status: {
		[key: string]: {
			ready: boolean;
			formats: string;
			icon: typeof Image;
		};
	} = $derived({
		Images: {
			ready: converters.find((c) => c.name === "libvips")?.ready || false,
			formats: getSupportedFormats("libvips"),
			icon: Image,
		},
		Audio: {
			ready: converters.find((c) => c.name === "ffmpeg")?.ready || false,
			formats: getSupportedFormats("ffmpeg"),
			icon: AudioLines,
		},
		Documents: {
			ready: converters.find((c) => c.name === "pandoc")?.ready || false,
			formats: getSupportedFormats("pandoc"),
			icon: BookText,
		},
		Fonts: {
			ready: converters.find((c) => c.name === "fontconverter")?.ready || false,
			formats: getSupportedFormats("fontconverter"),
			icon: Type,
		},
		Video: {
			ready:
				converters.find((c) => c.name === "vertd")?.ready ||
				(false && $vertdLoaded),
			formats: getSupportedFormats("vertd"),
			icon: Film,
		},
	});
</script>

<div class="max-w-6xl w-full mx-auto px-6 md:px-8">
	<div class="flex items-center justify-center pb-10 md:py-16">
		<div
			class="flex items-center h-auto gap-12 md:gap-24 md:flex-row flex-col"
		>
			<div class="flex-grow w-full text-center md:text-left">
				<h1
					class="text-4xl px-12 md:p-0 md:text-6xl flex-wrap tracking-tight leading-tight md:leading-[72px] mb-4 md:mb-6"
				>
					The file converter you'll love.
				</h1>
				<p
					class="font-normal px-5 md:p-0 text-lg md:text-xl text-black text-muted dynadark:text-muted"
				>
					All image and audio processing is done on your device.
					Videos are converted on our lightning-fast servers. No file
					size limit, no ads, and completely open source.
				</p>
			</div>
			<div class="flex-grow w-full h-72">
				<Uploader class="w-full h-full" />
			</div>
		</div>
	</div>

	<hr />

	<div class="mt-10 md:mt-16">
		<h2 class="text-center text-4xl">VERT supports...</h2>

		<div class="flex gap-4 mt-8 md:flex-row flex-col">
			{#each Object.entries(status) as [key, s]}
				{@const Icon = s.icon}
				<div class="file-category-card w-full flex flex-col">
					<div class="file-category-card-inner">
						<div
							class={clsx("icon-container", {
								"bg-accent-blue": key === "Images",
								"bg-accent-purple": key === "Audio",
								"bg-accent-green": key === "Documents",
								"bg-accent-red": key === "Video",
								"bg-accent-pink": key === "Fonts"
							})}
						>
							<Icon size="20" />
						</div>
						<span>{key}</span>
					</div>

					<div class="file-category-card-content flex-grow">
						{#if key === "Video"}
							<p>
								Video uploads to a server for processing by
								default, learn how to set it up locally <a
									target="_blank"
									href="https://github.com/VERT-sh/VERT/wiki/How-to-convert-video-with-VERT"
									>here</a
								>.
							</p>
						{:else}
							<p
								class="flex items-center justify-center gap-2 h-full"
							>
								<Check size="20" /> Fully supported
							</p>
						{/if}
						<p>
							<b>Status: </b>
							{s.ready ? "ready" : "not ready"}
						</p>
						<p>
							<b>Supported formats:</b>
							{s.formats}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.file-category-card {
		@apply bg-panel rounded-2xl p-5 shadow-panel;
	}

	.file-category-card p {
		@apply font-normal text-center text-sm mt-4;
	}

	.file-category-card-inner {
		@apply flex items-center justify-center gap-3 text-xl;
	}

	.file-category-card-content {
		@apply flex flex-col text-center justify-between;
	}

	.icon-container {
		@apply p-2 rounded-full text-on-accent;
	}
</style>
