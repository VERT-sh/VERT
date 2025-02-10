<script lang="ts">
	// this comment was written on 15/11/2024 at 16:01 GMT.
	// i bet to myself that i could complete this whole redesign implementation
	// by the time realmy got started on it. i guess we'll see how that goes
	//
	// ship fast n break things !!
	// -- nullptr

	// that definitely happened
	// -- JovannMC

	import Uploader from "$lib/components/functional/Uploader.svelte";
	import { converters } from "$lib/converters";
	import { AudioLines, Check, Film, Image } from "lucide-svelte";

	const getSupportedFormats = (name: string) =>
		converters.find((c) => c.name === name)?.supportedFormats.join(", ") ||
		"none";

	const supportedFormats = {
		images: getSupportedFormats("libvips"),
		audio: getSupportedFormats("ffmpeg"),
		video: getSupportedFormats("vertd"),
	};
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

				<div class="flex flex-col text-center justify-center">
					<p>Animated images are not supported (yet).</p>
					<p>
						<b>Supported formats:</b>
						{supportedFormats.images}
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

				<div class="flex flex-col text-center justify-between">
					<p class="flex items-center justify-center gap-2">
						<Check size="20" /> Fully supported
					</p>
					<p>
						<b>Supported formats:</b>
						{supportedFormats.audio}
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
				<div class="flex flex-col text-center justify-between">
					<p>
						Video requires special setup. <a
							target="_blank"
							href="https://github.com/VERT-sh/VERT/wiki/How-to-convert-video-with-VERT"
							>Learn more</a
						>.
					</p>
					<p><b>Supported formats:</b> {supportedFormats.video}</p>
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

	.icon-container {
		@apply p-2 rounded-full text-on-accent;
	}
</style>
