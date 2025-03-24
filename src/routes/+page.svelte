<script lang="ts">
	import Uploader from "$lib/components/functional/Uploader.svelte";
	import { converters } from "$lib/converters";
	import { vertdLoaded } from "$lib/store/index.svelte";
	import { AudioLines, Check, Film, Image } from "lucide-svelte";

	const { data } = $props();

	const getSupportedFormats = (name: string) =>
		converters.find((c) => c.name === name)?.supportedFormats.join(", ") ||
		"none";

	const status = $derived({
		images: {
			ready: converters.find((c) => c.name === "libvips")?.ready,
			formats: getSupportedFormats("libvips"),
		},
		audio: {
			ready: converters.find((c) => c.name === "ffmpeg")?.ready,
			formats: getSupportedFormats("ffmpeg"),
		},
		video: {
			ready:
				converters.find((c) => c.name === "vertd")?.ready &&
				$vertdLoaded,
			formats: getSupportedFormats("vertd"),
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
					All processing is done on your device. No file size limit,
					no ads, and completely open source.
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

		<div class="grid gap-4 md:grid-cols-3 mt-8">
			<div class="file-category-card">
				<div class="file-category-card-inner">
					<div class="icon-container bg-accent-blue">
						<Image size="20" />
					</div>
					<span>Images</span>
				</div>

				<div class="file-category-card-content">
					<p class="flex items-center justify-center gap-2">
						<Check size="20" /> Fully supported
					</p>
					<p>
						<b>Status: </b>
						{status.images.ready ? "ready" : "not ready"}
					</p>
					<p>
						<b>Supported formats:</b>
						{status.images.formats}
					</p>
				</div>
			</div>

			<div class="file-category-card">
				<div class="file-category-card-inner">
					<div class="icon-container bg-accent-purple">
						<AudioLines size="20" />
					</div>
					<span>Audio</span>
				</div>

				<div class="file-category-card-content">
					<p class="flex items-center justify-center gap-2">
						<Check size="20" /> Fully supported
					</p>
					<p>
						<b>Status: </b>
						{status.audio.ready ? "ready" : "not ready"}
					</p>
					<p>
						<b>Supported formats:</b>
						{status.audio.formats}
					</p>
				</div>
			</div>

			<div class="file-category-card">
				<div class="file-category-card-inner">
					<div class="icon-container bg-accent-red">
						<Film size="20" />
					</div>
					<span>Video *</span>
				</div>
				<div class="file-category-card-content">
					<p>
						Video uploads to a server for processing by default,
						learn how to set it up locally <a
							target="_blank"
							href="https://github.com/VERT-sh/VERT/wiki/How-to-convert-video-with-VERT"
							>here</a
						>.
					</p>
					<p>
						<b>Status: </b>
						{status.video.ready ? "ready" : "not ready"}
					</p>
					<p>
						<b>Supported formats:</b>
						{status.video.formats}
					</p>
				</div>
			</div>
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
