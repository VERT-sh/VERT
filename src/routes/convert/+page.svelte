<script lang="ts">
	import ConversionPanel from "$lib/components/functional/ConversionPanel.svelte";
	import Dropdown from "$lib/components/functional/Dropdown.svelte";
	import Uploader from "$lib/components/functional/Uploader.svelte";
	import Panel from "$lib/components/visual/Panel.svelte";
	import ProgressBar from "$lib/components/visual/ProgressBar.svelte";
	import {
		effects,
		files,
		gradientColor,
		showGradient,
		vertdLoaded,
	} from "$lib/store/index.svelte";
	import { addToast } from "$lib/store/ToastProvider";
	import { VertFile } from "$lib/types";
	import {
		AudioLines,
		DownloadIcon,
		FileMusicIcon,
		FileQuestionIcon,
		FileVideo2,
		FilmIcon,
		ImageIcon,
		ImageOffIcon,
		RotateCwIcon,
		XIcon,
	} from "lucide-svelte";

	const handleSelect = (option: string, file: VertFile) => {
		file.result = null;
		switch (option) {
			case ".webp":
			case ".gif":
				addToast(
					"warning",
					`Converting this file to "${option}" may take some time if animated.`,
				);
		}
	};

	$effect(() => {
		// Set gradient color depending on the file types
		// TODO: if more file types added, add a "fileType" property to the file object
		const allAudio = files.files.every(
			(file) => file.converter?.name === "ffmpeg",
		);
		const allImages = files.files.every(
			(file) =>
				file.converter?.name !== "ffmpeg" &&
				file.converter?.name !== "vertd",
		);
		const allVideos = files.files.every(
			(file) => file.converter?.name === "vertd",
		);

		if (files.files.length === 1 && files.files[0].blobUrl && !allVideos) {
			showGradient.set(false);
		} else {
			showGradient.set(true);
		}

		if (
			files.files.length === 0 ||
			(!allAudio && !allImages && !allVideos)
		) {
			gradientColor.set("");
		} else {
			gradientColor.set(allAudio ? "purple" : allVideos ? "red" : "blue");
		}
	});
</script>

{#snippet fileItem(file: VertFile, index: number)}
	{@const isAudio = file.converter?.name === "ffmpeg"}
	{@const isVideo = file.converter?.name === "vertd"}
	<Panel class="p-5 flex flex-col min-w-0 gap-4 relative">
		<div class="flex-shrink-0 h-8 w-full flex items-center gap-2">
			{#if !file.converter}
				<FileQuestionIcon size="24" class="flex-shrink-0" />
			{:else if isAudio}
				<AudioLines size="24" class="flex-shrink-0" />
			{:else if isVideo}
				<FilmIcon size="24" class="flex-shrink-0" />
			{:else}
				<ImageIcon size="24" class="flex-shrink-0" />
			{/if}
			<div class="flex-grow overflow-hidden">
				{#if file.processing}
					<ProgressBar
						min={0}
						max={100}
						progress={file.converter?.reportsProgress
							? file.progress
							: null}
					/>
				{:else}
					<h2
						class="text-xl font-body overflow-hidden text-ellipsis whitespace-nowrap"
					>
						{file.name}
					</h2>
				{/if}
			</div>
			<button
				class="flex-shrink-0 w-8 rounded-full hover:bg-panel-alt h-full flex items-center justify-center"
				onclick={() =>
					(files.files = files.files.filter((_, i) => i !== index))}
			>
				<XIcon size="24" class="text-muted" />
			</button>
		</div>
		{#if !file.converter}
			{#if file.name.startsWith("vertd")}
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						We can't convert this file.
					</p>
					<p class="font-normal">
						what are you doing..? you're supposed to run the vertd
						server!
					</p>
				</div>
			{:else}
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						We can't convert this file.
					</p>
					<p class="font-normal">
						Only image, video, and audio files are supported
					</p>
				</div>
			{/if}
		{:else if isVideo && !$vertdLoaded}
			<div
				class="h-full flex flex-col text-center justify-center text-failure"
			>
				<p class="font-body font-bold">We can't convert this file.</p>
				<p class="font-normal">
					Could not find the vertd instance to start video conversion.
					Are you sure the instance URL is set correctly?
				</p>
			</div>
		{:else}
			<div class="flex flex-row justify-between">
				<div
					class="flex gap-4 w-full h-[152px] overflow-hidden relative"
				>
					<div class="w-1/2 h-full overflow-hidden rounded-xl">
						{#if file.blobUrl}
							<img
								class="object-cover w-full h-full"
								src={file.blobUrl}
								alt={file.name}
							/>
						{:else}
							<div
								class="w-full h-full flex items-center justify-center text-black"
								style="background: var({isAudio
									? '--bg-gradient-purple-alt'
									: isVideo
										? '--bg-gradient-red-alt'
										: '--bg-gradient-blue-alt'})"
							>
								{#if isAudio}
									<FileMusicIcon size="56" />
								{:else if isVideo}
									<FileVideo2 size="56" />
								{:else}
									<ImageOffIcon size="56" />
								{/if}
							</div>
						{/if}
					</div>
				</div>
				<div
					class="absolute top-16 right-0 mr-4 pl-2 h-[calc(100%-83px)] w-[calc(50%-38px)] pr-4 pb-1 flex items-center justify-center aspect-square"
				>
					<div
						class="w-[122px] h-fit flex flex-col gap-2 items-center justify-center"
					>
						<Dropdown
							options={file.converter?.supportedFormats || []}
							bind:selected={file.to}
							onselect={(option) => handleSelect(option, file)}
						/>
						<div class="w-full flex items-center justify-between">
							<button
								class="btn {$effects
									? ''
									: '!scale-100'} p-0 w-14 h-14 text-black {isAudio
									? 'bg-accent-purple'
									: isVideo
										? 'bg-accent-red'
										: 'bg-accent-blue'}"
								disabled={!files.ready}
								onclick={file.convert}
							>
								<RotateCwIcon size="24" />
							</button>
							<button
								class="btn {$effects
									? ''
									: '!scale-100'} p-0 w-14 h-14"
								onclick={file.download}
								disabled={!file.result}
							>
								<DownloadIcon size="24" />
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</Panel>
{/snippet}

<div class="flex flex-col justify-center items-center gap-8 -mt-4 px-4 md:p-0">
	<div class="max-w-[778px] w-full">
		<ConversionPanel />
	</div>

	<div
		class="w-full max-w-[778px] grid grid-cols-1 md:grid-cols-2 auto-rows-[240px] gap-4 md:p-0"
	>
		{#each files.files as file, i (file.id)}
			{#if files.files.length >= 2 && i === 1}
				<Uploader
					class="w-full h-full col-start-1 row-start-1 md:col-start-2"
				/>
			{/if}
			{@render fileItem(file, i)}
			{#if files.files.length < 2}
				<Uploader class="w-full h-full" />
			{/if}
		{/each}
		{#if files.files.length === 0}
			<Uploader class="w-full h-full col-span-2" />
		{/if}
	</div>
</div>
