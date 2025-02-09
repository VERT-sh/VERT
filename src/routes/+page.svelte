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
</script>

<div
	class="w-screen px-2 md:px-8 h-full flex items-start justify-center overflow-hidden max-h-screen"
>
	<div class="content w-screen flex items-center justify-center flex-grow">
		<div class="max-w-5xl w-full">
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
						All processing is done on your device. No file size
						limit, no ads, and completely open source.
					</p>
				</div>
				<div class="flex-grow w-11/12 md:w-full h-72">
					<Uploader class="w-full h-full" />
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Centers content on most screen sizes, excluding mobile */
	@media screen and (min-width: 768px) {
		.content {
			padding-top: 10vh;
			padding-bottom: 10vh;
		}
	}

	@media screen and (min-width: 768px) and (min-height: 576px) {
		.content {
			padding-top: 15vh;
			padding-bottom: 15vh;
		}
	}

	@media screen and (min-width: 768px) and (min-height: 720px) {
		.content {
			padding-top: 20vh;
			padding-bottom: 20vh;
		}
	}

	@media screen and (min-width: 768px) and (min-height: 1080px) {
		.content {
			padding-top: 25vh;
			padding-bottom: 25vh;
		}
	}

	@media screen and (min-width: 768px) and (min-height: 1440px) {
		.content {
			padding-top: 30vh;
			padding-bottom: 30vh;
		}
	}

	@media screen and (min-width: 768px) and (min-height: 2160px) {
		.content {
			padding-top: 35vh;
			padding-bottom: 35vh;
		}
	}
</style>
