<script lang="ts">
	import ConversionPanel from "#lib/components/functional/ConversionPanel.svelte";
	import FormatDropdown from "#lib/components/functional/FormatDropdown.svelte";
	import Uploader from "#lib/components/functional/Uploader.svelte";
	import Panel from "#lib/components/visual/Panel.svelte";
	import ProgressBar from "#lib/components/visual/ProgressBar.svelte";
	import Tooltip from "#lib/components/visual/Tooltip.svelte";
	import {
		categories,
		categoryByConverter,
		type ConverterCategory,
	} from "#lib/converters";
	import {
		effects,
		files,
		gradientColor,
		showGradient,
		dropdownStates,
		fileSettings,
	} from "#lib/store/index.svelte";
	import { VertFile } from "#lib/types";
	import type { Component } from "svelte";
	import {
		AudioLines,
		ArchiveIcon,
		BookText,
		DownloadIcon,
		FileArchiveIcon,
		FileMusicIcon,
		FileQuestionMarkIcon,
		FileVideoCameraIcon,
		FilmIcon,
		ImageIcon,
		ImageOffIcon,
		RotateCwIcon,
		XIcon,
	} from "@lucide/svelte";
	import { m } from "#lib/paraglide/messages";
	import { Settings } from "#lib/sections/settings/index.svelte";
	import { MAX_ARRAY_BUFFER_SIZE } from "#lib/store/index.svelte";
	import { GB } from "#lib/util/consts";
	import { formatBytes } from "#lib/util/file";
	import SettingsModal from "#lib/components/functional/popups/SettingsModal.svelte";
	import { ToastManager } from "#lib/util/toast.svelte";
	import { vertdSizeLimit } from "#lib/sections/settings/vertdSettings.svelte";
	import clsx from "clsx";

	const gradientColors: Record<ConverterCategory, string> = {
		image: "blue",
		audio: "purple",
		video: "red",
		doc: "green",
		archive: "pink",
		unknown: "pink",
	};

	const gradientVars: Record<ConverterCategory, string> = {
		audio: "--bg-gradient-purple-alt",
		video: "--bg-gradient-red-alt",
		doc: "--bg-gradient-green-alt",
		image: "--bg-gradient-blue-alt",
		archive: "--bg-gradient-pink-alt",
		unknown: "--bg-gradient-pink-alt",
	};

	type FileType = "archive" | ConverterCategory | "unknown";

	const fileTypeIcons: Record<FileType, Component> = {
		archive: ArchiveIcon,
		audio: AudioLines,
		video: FilmIcon,
		doc: BookText,
		image: ImageIcon,
		unknown: FileQuestionMarkIcon,
	};

	const fileTypeBigIcons: Record<FileType, Component> = {
		archive: FileArchiveIcon,
		audio: FileMusicIcon,
		video: FileVideoCameraIcon,
		doc: BookText,
		image: ImageIcon,
		unknown: ImageOffIcon,
	};

	const fileTypeColors: Record<FileType, string> = {
		archive: "bg-accent-pink",
		audio: "bg-accent-purple",
		video: "bg-accent-red",
		doc: "bg-accent-green",
		image: "bg-accent-blue",
		unknown: "bg-accent-pink",
	};

	const getFileType = (file: VertFile): FileType => {
		if (file.isZip()) return "archive";
		return (
			categoryByConverter[getCurrentConverter(file)?.name ?? ""] ??
			"unknown"
		);
	};

	const getFileTypeLabel = (fileType: FileType): string => {
		return m[`convert.errors.${fileType}`]();
	};

	let processedFileIds = $state(new Set<string>());

	$effect(() => {
		const limit = $vertdSizeLimit;
		for (const file of files.files) {
			const exceedsLimit = file.size > limit;
			const unavailable = file.unavailableConverters;
			const shouldMarkUnavailable = exceedsLimit
				? !unavailable["vertd"]
				: unavailable["vertd"];

			if (shouldMarkUnavailable) {
				file.unavailableConverters = exceedsLimit
					? { ...unavailable, vertd: "vertd-size-limit" }
					: Object.fromEntries(
							Object.entries(unavailable).filter(
								([key]) => key !== "vertd",
							),
						);
			}
			if (exceedsLimit)
				file.unavailableConverters["vertd"] = "vertd-size-limit";
			else delete file.unavailableConverters["vertd"];

			if (!exceedsLimit || file.vertdSizeWarningShown) continue;

			file.vertdSizeWarningShown = true;
			ToastManager.add({
				type: "warning",
				message: m["convert.errors.vertd.file_too_large"]({
					filename: file.name,
					fileSize: formatBytes(file.size),
					limit: formatBytes(limit),
				}),
			});
		}
	});

	const getCurrentConverter = (file: VertFile) => {
		const converterName = file.conversionSettings.converter;
		const availableConverters = file.isZip()
			? file.converters
			: file.to
				? file.findConverters([file.from, file.to])
				: file.findConverters();

		if (converterName) {
			const selectedConverter = availableConverters.find(
				(c) => c.name === converterName,
			);
			if (selectedConverter) return selectedConverter;
		}

		// prefer a usable (loaded) converter over one that still has to initialize
		const readyConverter = availableConverters.find(
			(c) => c.status === "ready" || c.status === "partially-ready",
		);
		return readyConverter ?? availableConverters[0];
	};

	$effect(() => {
		if (!Settings.instance.settings || files.files.length === 0) return;

		files.files.forEach((file) => {
			const settings = Settings.instance.settings;
			if (processedFileIds.has(file.id)) return;

			const converter = getCurrentConverter(file);
			if (!converter) return;
			const category = categoryByConverter[converter.name];
			if (!category) return;

			let targetFormat: string | undefined;

			// restore saved format (if navigated back to page for example)
			const savedFormat = $dropdownStates[file.name];
			if (
				savedFormat &&
				savedFormat !== file.from &&
				categories[category]?.formats.includes(savedFormat)
			) {
				targetFormat = savedFormat;
			} else if (settings.useDefaultFormat) {
				// else use default format if enabled
				let defaultFormat: string | undefined;
				const df = settings.defaultFormat;
				if (category === "image") defaultFormat = df.image;
				else if (category === "audio") defaultFormat = df.audio;
				else if (category === "video") defaultFormat = df.video;
				else if (category === "doc") defaultFormat = df.document;

				if (
					defaultFormat &&
					defaultFormat !== file.from &&
					categories[category]?.formats.includes(defaultFormat)
				) {
					targetFormat = defaultFormat;
				}
			}

			// or use first available format (or if default format is same as input)
			if (!targetFormat) {
				const firstDiff = categories[category]?.formats.find(
					(f) => f !== file.from,
				);
				targetFormat =
					firstDiff || categories[category]?.formats[0] || "";
			}

			file.to = targetFormat;
			files.preloadConverters(file);
			processedFileIds.add(file.id);
		});
	});

	const handleSelect = (option: string, file: VertFile) => {
		file.result = null;
		files.preloadConverters(file);
	};

	$effect(() => {
		// Set gradient color depending on the file types
		const fileTypes = files.files
			.map((file) => {
				const category =
					categoryByConverter[getCurrentConverter(file)?.name ?? ""];
				return file.isZip()
					? gradientColors.archive
					: category
						? gradientColors[category]
						: null;
			})
			.filter((type): type is string => type !== null);

		const uniqueTypes = new Set(fileTypes);
		const type =
			files.files.length > 0 &&
			fileTypes.length === files.files.length &&
			uniqueTypes.size === 1
				? fileTypes[0]
				: "";

		if (files.files.length === 0 || !type) showGradient.set(false);
		else showGradient.set(true);

		gradientColor.set(type);
	});
</script>

{#snippet fileItem(file: VertFile)}
	{@const currentConverter = getCurrentConverter(file)}
	{@const name = currentConverter?.name || "unknown"}
	{@const category = categoryByConverter[name]}
	{@const fileType = getFileType(file)}
	{@const Icon = fileTypeIcons[fileType]}
	{@const isInitializing =
		currentConverter?.status === "idle" ||
		currentConverter?.status === "downloading" ||
		currentConverter?.status === "initializing"}
	<Panel class="relative flex min-w-0 flex-col gap-4 p-5">
		<div class="flex h-8 w-full flex-shrink-0 items-center gap-2">
			<Tooltip
				text={fileType === "unknown"
					? m["convert.tooltips.unknown_file"]()
					: fileType === "archive"
						? m["convert.tooltips.archive_file"]()
						: fileType === "doc"
							? m["convert.tooltips.document_file"]()
							: fileType === "audio"
								? m["convert.tooltips.audio_file"]()
								: m["convert.tooltips.video_file"]()}
				position="bottom"
			>
				<Icon size="24" class="flex-shrink-0" />
			</Tooltip>
			<div class="flex-grow overflow-hidden">
				{#if file.processing}
					<ProgressBar
						min={0}
						max={100}
						progress={currentConverter?.reportsProgress ||
						file.isZip()
							? file.progress
							: null}
					/>
				{:else}
					<h2
						class="overflow-hidden text-ellipsis whitespace-nowrap font-body text-xl"
						title={`${file.name} (${file.id})`}
					>
						{file.name}
					</h2>
				{/if}
			</div>
			<div
				class={clsx(
					"flex flex-shrink-0 items-center justify-center overflow-visible transition-transform duration-300",
					isInitializing ? "w-8 opacity-100" : "w-0 opacity-0",
				)}
			>
				{#if isInitializing}
					<Tooltip
						text={m["convert.tooltips.converter_initializing"]({
							type: getFileTypeLabel(fileType),
						})}
						position="bottom"
					>
						<DownloadIcon
							size="20"
							class={clsx(
								"text-muted",
								$effects && "animate-bounce",
							)}
						/>
					</Tooltip>
				{/if}
			</div>
			<button
				class="flex h-full w-8 flex-shrink-0 items-center justify-center rounded-full hover:bg-panel-alt"
				onclick={() => files.remove(file)}
			>
				<XIcon size="24" class="text-muted" />
			</button>
		</div>
		{#if !currentConverter}
			{#if file.name.startsWith("vertd")}
				<div
					class="flex h-full flex-col justify-center text-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.vertd.server"]()}
					</p>
				</div>
			{:else}
				<div
					class="flex h-full flex-col justify-center text-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.unsupported_format"]()}
					</p>
				</div>
			{/if}
		{:else}
			{@const formatInfo = currentConverter.supportedFormats.find(
				(f) => f.name === file.from,
			)}
			{@const isLarge = file.isLarge()}
			{#if formatInfo && !formatInfo.fromSupported}
				<div
					class="flex h-full flex-col justify-center text-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.format_output_only"]()}
					</p>
				</div>
			{:else if isLarge && !file.supportsStreaming()}
				<div
					class="flex h-full flex-col justify-center text-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["workers.errors.file_too_large"]({
							limit: (MAX_ARRAY_BUFFER_SIZE / GB).toFixed(2),
						})}
					</p>
				</div>
			{:else if currentConverter.status === "error"}
				<div
					class="flex h-full flex-col justify-center text-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.worker_error"]({
							type: getFileTypeLabel(fileType),
						})}
					</p>
				</div>
			{:else}
				<div class="flex flex-row justify-between">
					<div
						class="relative flex h-[152px] w-full gap-4 overflow-hidden"
					>
						<div class="h-full w-1/2 overflow-hidden rounded-xl">
							{#if file.blobUrl}
								<img
									class="h-full w-full object-cover"
									src={file.blobUrl}
									alt={`${file.name} (${file.id})`}
								/>
							{:else}
								{@const Icon = fileTypeBigIcons[fileType]}
								<div
									class="flex h-full w-full items-center justify-center text-black"
									style:background="var({gradientVars[
										file.isZip()
											? 'archive'
											: (category ?? 'unknown')
									]})"
								>
									<Icon size="56" />
								</div>
							{/if}
						</div>
					</div>
					<div
						class="absolute right-0 top-16 mr-4 flex aspect-square h-[calc(100%-83px)] w-[calc(50%-38px)] items-center justify-center pb-1 pl-2 pr-4"
					>
						<div
							class="flex h-fit w-[122px] flex-col items-center justify-center gap-2"
						>
							<FormatDropdown
								{categories}
								from={file.from}
								bind:selected={file.to}
								onselect={(option) =>
									handleSelect(option, file)}
								{file}
							/>
							<div
								class="flex w-full items-center justify-between"
							>
								<Tooltip
									text={m["convert.tooltips.convert_file"]()}
									position="bottom"
								>
									<button
										class={clsx(
											"btn h-14 w-14 p-0 text-black",
											!$effects && "!scale-100",
											fileTypeColors[fileType],
										)}
										disabled={!files.isReady(file)}
										onclick={() => file.convert()}
									>
										<RotateCwIcon size="24" />
									</button>
								</Tooltip>
								<Tooltip
									text={m["convert.tooltips.download_file"]()}
									position="bottom"
								>
									<button
										class={clsx(
											"btn h-14 w-14 p-0",
											!$effects && "!scale-100",
										)}
										onclick={file.download}
										disabled={!file.result}
									>
										<DownloadIcon size="24" />
									</button>
								</Tooltip>
							</div>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</Panel>
{/snippet}

<div class="-mt-4 flex flex-col items-center justify-center gap-8 px-4 md:p-0">
	<div class="w-full max-w-[778px]">
		<ConversionPanel />
	</div>

	<div
		class="grid w-full max-w-[778px] auto-rows-[240px] grid-cols-1 gap-4 md:grid-cols-2 md:p-0"
	>
		{#each files.files as file, i (file.id)}
			{#if files.files.length >= 2 && i === 1}
				<Uploader
					class="col-start-1 row-start-1 h-full w-full md:col-start-2"
				/>
			{/if}
			{@render fileItem(file)}
			{#if files.files.length < 2}
				<Uploader class="h-full w-full" />
			{/if}
		{/each}
		{#if files.files.length === 0}
			<Uploader class="col-span-2 h-full w-full" />
		{/if}
	</div>
</div>

{#if $fileSettings !== null}
	<SettingsModal
		file={$fileSettings}
		onclose={() => ($fileSettings = null)}
	/>
{/if}
