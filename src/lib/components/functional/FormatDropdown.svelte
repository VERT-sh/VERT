<script lang="ts">
	import {
		animateHeight,
		duration,
		fade,
		transition,
	} from "#lib/util/animation";
	import { m } from "#lib/paraglide/messages";
	import {
		isMobile,
		files,
		dropdownStates,
		fileSettings,
	} from "#lib/store/index.svelte";
	import type { Categories } from "#lib/types";
	import clsx from "clsx";
	import { ChevronDownIcon, SearchIcon, SettingsIcon } from "@lucide/svelte";
	import { onMount, tick } from "svelte";
	import { quintOut } from "svelte/easing";
	import { VertFile } from "#lib/types";
	import { log } from "#lib/util/logger.svelte";
	import FancyInput from "./FancyInput.svelte";
	import Tooltip from "../visual/Tooltip.svelte";
	import { vertdSizeLimit } from "#lib/sections/settings/vertdSettings.svelte";
	import { formatBytes } from "#lib/util/file";
	import { getCodecs } from "#lib/converters/ffmpeg/ffmpeg.codecs.ts";

	type Props = {
		categories: Categories;
		from?: string;
		selected?: string;
		onselect?: (option: string) => void;
		disabled?: boolean;
		dropdownSize?: "default" | "large" | "small";
		file?: VertFile;
		allowEmpty?: boolean;
	};

	let {
		categories,
		from,
		selected = $bindable(""),
		onselect,
		disabled,
		dropdownSize = "default",
		file,
		allowEmpty = false,
	}: Props = $props();

	let open = $state(false);
	let dropdown = $state<HTMLDivElement>();
	let dropdownMenu: HTMLDivElement | undefined = $state();
	let formatList: HTMLDivElement | undefined = $state();
	let dropdownPosition = $state<"left" | "center" | "right">("center");
	let currentCategory = $state<string | null>(null);
	let searchQuery = $state("");
	let rootCategory: string | null = null;

	// svelte-ignore state_referenced_locally
	let imageSequence = $state(
		file?.conversionSettings?.imageSequence ?? false,
	);
	// svelte-ignore state_referenced_locally
	let imageSequenceFPS = $state(
		file?.conversionSettings?.imageSequenceFPS ?? 15,
	);
	// svelte-ignore state_referenced_locally
	let imageSequenceTransparency = $state(
		file?.conversionSettings?.imageSequenceTransparency ?? false,
	);

	const sequenceFormats = [".webp", ".gif", ".apng", ".mpo"]; // .apng not supported by magick-wasm rn

	$effect(() => {
		if (!file) return;
		file.conversionSettings.imageSequence = imageSequence;
		file.conversionSettings.imageSequenceFPS = imageSequenceFPS;
		file.conversionSettings.imageSequenceTransparency =
			imageSequenceTransparency;
		files.syncSequenceConverters(file);
	});

	const normalize = (str: string) => str.replace(/^\./, "").toLowerCase();

	// returns the reason a format is disabled for the current file/settings, or "" (empty string) if it's usable
	const getUnavailableReason = (format: string): string => {
		if (!file) return "";

		// zip + image sequence / per-image mode
		const isZip = file.isZip();
		const sequenceMode = isZip && imageSequence;
		const sourceFormat = isZip
			? (file.archiveFormats?.[0] ?? file.from)
			: file.from;

		// image sequences can only output animated formats
		if (
			imageSequence &&
			categories["image"]?.formats.includes(format) &&
			!sequenceFormats.includes(format)
		)
			return m["convert.dropdown.disabled.no_converter"]({
				from: file.from,
				to: format,
			});

		// can't carry audio track
		if (
			categories["audio"]?.formats.includes(from ?? "") &&
			getCodecs(format).audio === "none"
		)
			return m["convert.dropdown.disabled.no_converter"]({
				from: file.from,
				to: format,
			});

		// converters that can produce this format for this file
		const compatible = file.converters
			.filter((converter) => {
				const toInfo = converter.supportedFormats.find(
					(info) => info.name === format,
				);
				if (!toInfo || !toInfo.toSupported) return false;

				// if sequence mode, converters handle the archives itself (rather than its contents)
				if (sequenceMode) return true;

				const fromInfo = converter.supportedFormats.find(
					(info) => info.name === sourceFormat,
				);
				return (
					!!fromInfo &&
					fromInfo.fromSupported &&
					(fromInfo.isNative || toInfo.isNative)
				);
			})
			.filter(
				(converter) =>
					!file.unavailableConverters[converter.name] &&
					converter.isAvailable(),
			);

		const largeFile = compatible.some(
			(converter) =>
				converter.name === "vertd" &&
				converter.isReady() &&
				file.unavailableConverters[converter.name] ===
					"vertd-size-limit",
		);
		if (largeFile)
			return m["convert.dropdown.disabled.vertd_size_limit"]({
				limit: formatBytes($vertdSizeLimit),
				fileSize: formatBytes(file.size),
			});

		if (compatible.length === 0)
			return m["convert.dropdown.disabled.no_converter"]({
				from: file.from,
				to: format,
			});

		return "";
	};

	const isUnavailable = (format: string): boolean =>
		!!getUnavailableReason(format);

	const getFormats = (cat: string) => categories[cat]?.formats ?? [];

	const detectCategory = (): string => {
		if (from) {
			// find category containing the input format, if any
			const match = Object.keys(categories).find((cat) =>
				categories[cat].formats.includes(from),
			);
			if (match) return match;
		}

		// else, fall back by finding the category whose formats overlap most with the converters for this file
		// this finds the best matching category based on the formats supported by the converters
		const converters = file
			? file.findConverters()
			: files.files.flatMap((f) => f.findConverters());

		let best: string | null = null;
		let maxOverlap = 0;
		for (const cat of Object.keys(categories)) {
			const count = categories[cat].formats.filter((fmt) =>
				converters.some((c) => c.formatStrings().includes(fmt)),
			).length;
			if (count > maxOverlap) {
				maxOverlap = count;
				best = cat;
			}
		}

		return best ?? Object.keys(categories)[0];
	};

	$effect(() => {
		if (currentCategory) return;
		const detected = detectCategory();
		log(
			["dropdown", "init"],
			`root category: ${detected} (file: ${file?.name}, from: ${from})`,
		);
		currentCategory = detected;
		rootCategory = detected;
	});

	// other available categories based on current category (e.g. converting between video and audio)
	const availableCategories = $derived.by(() => {
		if (!rootCategory) return Object.keys(categories);

		let cats = Object.keys(categories).filter(
			(cat) =>
				cat === rootCategory ||
				categories[rootCategory!]?.canConvertTo?.includes(cat),
		);

		if (imageSequence) {
			// TODO: image sequence -> video on vertd?
			if (!cats.includes("video")) cats.push("video");
		} else {
			// handle special cases
			if (
				(from === ".gif" || from === ".webp") &&
				!cats.includes("video")
			)
				cats.push("video");
			if (from === ".apng") {
				//cats.push("image"); // -- buggy, magick can't convert from or to apng properly
				cats = cats.filter((cat) => cat !== "audio");
			}
			if (from === ".mpo") {
				cats = cats.filter((cat) => cat !== "audio");
			}

			// large videos can't be extracted to audio (browser/device limitations)
			if (file && file.isLarge() && rootCategory === "video")
				cats = cats.filter((cat) => cat !== "audio");
		}

		return cats.filter(
			(cat) => (categories[cat]?.formats?.length ?? 0) > 0,
		);
	});

	// TODO: better hiddenFormats logic lol
	const filteredData = $derived.by(() => {
		const activeCategory =
			currentCategory && availableCategories.includes(currentCategory)
				? currentCategory
				: availableCategories[0];

		// if no query, return formats for current category
		if (!searchQuery) {
			const formats = getFormats(activeCategory ?? "");

			// if no formats & categories for some reason, fall back and show all categories/formats
			if (formats.length === 0 && availableCategories.length === 0) {
				log(
					["dropdown", "filter"],
					`no formats or available categories found for file ${file?.name}, falling back to all categories and formats`,
				);
				return {
					categories: Object.keys(categories),
					formats: categories[currentCategory ?? ""]?.formats ?? [],
					isFallback: true,
					resolvedCategory: currentCategory,
				};
			}

			return {
				categories: availableCategories,
				formats,
				isFallback: false,
				resolvedCategory: activeCategory ?? currentCategory,
			};
		}

		const query = normalize(searchQuery);

		// disabled formats stay visible (greyed out), so only match on the query
		const matches = (f: string) => normalize(f).includes(query);

		const matchingCategories = availableCategories.filter((cat) =>
			(categories[cat]?.formats ?? []).some((f) => matches(f)),
		);

		if (matchingCategories.length === 0) {
			return {
				categories: availableCategories,
				formats: [],
				isFallback: false,
				resolvedCategory: currentCategory,
			};
		}

		// stay on current category if it matches, else move to first matched category
		const resolvedCategory =
			currentCategory && matchingCategories.includes(currentCategory)
				? currentCategory
				: matchingCategories[0];

		const formats = (categories[resolvedCategory ?? ""]?.formats ?? [])
			.filter((f) => matches(f))
			.sort((a, b) => {
				// exact matches first, then original order
				const aExact = normalize(a) === query;
				const bExact = normalize(b) === query;
				if (aExact !== bExact) return aExact ? -1 : 1;
				return 0;
			});

		// show categories with matches, formats from within resolved category
		return {
			categories: matchingCategories,
			formats,
			isFallback: false,
			resolvedCategory,
		};
	});

	$effect(() => {
		if (
			filteredData.resolvedCategory &&
			filteredData.resolvedCategory !== currentCategory
		)
			currentCategory = filteredData.resolvedCategory;
	});

	$effect(() => {
		// scroll automatically when opening dropdown so you don't have to scroll to see entire dropdown lol
		if (!open || !dropdownMenu) return;
		scrollView();
	});

	$effect(() => {
		// this thing checks if selected format is still valid with the current filters (imageSequence or search query) and falls back if not
		const allUnfilteredFormats = availableCategories
			.flatMap((cat) => getFormats(cat))
			.filter((format) => !isUnavailable(format));

		if (allowEmpty && !selected) return;

		if (!allUnfilteredFormats.includes(selected)) {
			if (allUnfilteredFormats.length > 0) {
				selected = allUnfilteredFormats[0];
				onselect?.(selected);
				return;
			}
		}
	});

	const selectOption = (option: string) => {
		if (isUnavailable(option)) return;
		selected = option;

		// save user's selection to dropdownStates for this session
		if (file) {
			dropdownStates.update((states) => ({
				...states,
				[file.name]: option,
			}));
		}

		onselect?.(option);
	};

	const selectCategory = (category: string) => {
		if (!categories[category]) return;
		currentCategory = category;
	};

	const handleSearch = (event: Event) => {
		searchQuery = (event.target as HTMLInputElement).value;
	};

	const onEnter = (event: KeyboardEvent) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		if (filteredData.formats.length > 0)
			selectOption(filteredData.formats[0]);
	};

	const scrollView = () => {
		if (!formatList) return;
		const selectedOption = formatList.querySelector(
			"[data-selected='true']",
		) as HTMLButtonElement | null;
		if (!selectedOption) return;

		const listRect = formatList.getBoundingClientRect();
		const optionRect = selectedOption.getBoundingClientRect();
		// only scroll if button isnt fully visible
		if (
			optionRect.top >= listRect.top &&
			optionRect.bottom <= listRect.bottom
		)
			return;
		formatList.scrollTop += optionRect.top - listRect.top;
	};

	const clickDropdown = async () => {
		open = !open;
		if (!open) return;

		// keep within viewport
		if (dropdown) {
			const rect = dropdown.getBoundingClientRect();
			const viewportWidth = window.innerWidth;

			let dropdownWidth: number;
			if (dropdownSize === "large") dropdownWidth = rect.width * 3.2;
			else if (dropdownSize === "default")
				dropdownWidth = rect.width * 2.5;
			else dropdownWidth = rect.width * 1.5;

			const centerX = rect.left + rect.width / 2;
			const leftEdge = centerX - dropdownWidth / 2;
			const rightEdge = centerX + dropdownWidth / 2;

			if (leftEdge < 0) dropdownPosition = "left";
			else if (rightEdge > viewportWidth) dropdownPosition = "right";
			else dropdownPosition = "center";
		}

		await tick();

		const searchInput = dropdownMenu?.querySelector(
			"#format-search",
		) as HTMLInputElement | null;

		searchInput?.focus();
		searchInput?.select();
		scrollView();
	};

	const extract = async () => {
		// extract all files in zip, then add all extracted files to files store
		if (!file) return;
		const { extractZip } = await import("#lib/util/file");
		const extractedFiles = await extractZip(file.file);

		if (!Array.isArray(extractedFiles) || extractedFiles.length === 0)
			return;

		const newFiles = extractedFiles
			.map(({ filename, data }) => {
				try {
					const f = new File([new Uint8Array(data)], filename, {
						type: "application/octet-stream",
					});
					const ext = filename.split(".").pop() ?? "";
					return new VertFile(f, ext);
				} catch {
					return null;
				}
			})
			.filter(Boolean);

		await files.remove(file);
		newFiles.forEach((f) => files.add(f));
	};

	onMount(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdown && !dropdown.contains(e.target as Node)) open = false;
		};

		const handleResize = () => {
			if (open) {
				// recalculate dropdown position on resize
				clickDropdown();
				open = true;
			}
		};

		window.addEventListener("click", handleClickOutside);
		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("click", handleClickOutside);
			window.removeEventListener("resize", handleResize);
		};
	});
</script>

<div
	class="relative w-full min-w-fit text-center text-xl font-medium"
	bind:this={dropdown}
>
	<button
		class={clsx(
			"relative flex w-full items-center justify-center overflow-hidden rounded-full bg-button px-3 py-3.5 font-display focus:!outline-none",
			disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
		)}
		onclick={() => clickDropdown()}
		{disabled}
	>
		<!-- <p>{selected}</p> -->
		<div
			class="grid max-h-[2.5rem] w-fit flex-grow-0 grid-cols-1 grid-rows-1 overflow-hidden"
		>
			{#key selected}
				<p
					in:fade={{
						duration,
						easing: quintOut,
					}}
					out:fade={{
						duration,
						easing: quintOut,
					}}
					class="col-start-1 row-start-1 max-w-[4rem] truncate text-center font-body font-medium"
				>
					{selected || "N/A"}
				</p>
			{/key}
			{#if currentCategory}
				{#each categories[currentCategory].formats as option (option)}
					<p
						class="pointer-events-none invisible col-start-1 row-start-1 max-w-[2.5rem] truncate"
					>
						{option}
					</p>
				{/each}
			{/if}
		</div>
		<ChevronDownIcon
			class="ml-3 mt-0.5 h-4 w-4 flex-shrink-0"
			style="transform: rotate({open
				? 180
				: 0}deg); transition: transform {duration}ms {transition};"
		/>
	</button>
	{#if open}
		<div
			bind:this={dropdownMenu}
			transition:fade={{
				duration,
				easing: quintOut,
			}}
			class={clsx(
				$isMobile
					? "fixed inset-x-0 bottom-0 z-[200] w-full overflow-hidden rounded-t-2xl bg-panel-alt shadow-xl shadow-black/25"
					: "absolute top-full z-50 mt-2 min-w-full overflow-hidden rounded-2xl bg-panel-alt shadow-xl shadow-black/25",
				!$isMobile && {
					"w-[320%]": dropdownSize === "large",
					"w-[250%]": dropdownSize === "default",
					"w-[150%]": dropdownSize === "small",
				},
				!$isMobile && {
					"left-1/2 -translate-x-1/2": dropdownPosition === "center",
					"left-0": dropdownPosition === "left",
					"right-0": dropdownPosition === "right",
				},
			)}
		>
			<!-- search box -->
			<div class="w-full p-3">
				<div class="relative">
					<input
						type="text"
						placeholder={m["convert.dropdown.placeholder"]()}
						class={clsx(
							"w-full flex-grow rounded-lg bg-panel !pl-11 !pr-3 text-foreground",
							filteredData.isFallback &&
								"cursor-not-allowed opacity-50",
						)}
						bind:value={searchQuery}
						oninput={handleSearch}
						onkeydown={onEnter}
						onfocus={() => {}}
						id="format-search"
						autocomplete="off"
						disabled={filteredData.isFallback}
					/>
					<span
						class={clsx(
							"absolute left-4 top-1/2 flex -translate-y-1/2 items-center",
							filteredData.isFallback && "opacity-50",
						)}
					>
						<SearchIcon class="h-4 w-4" />
					</span>
					{#if searchQuery}
						<span
							class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted"
							style="font-size: 0.7rem;"
						>
							{filteredData.formats.length}
							{filteredData.formats.length === 1
								? "result"
								: "results"}
						</span>
					{/if}
				</div>
			</div>
			<!-- fallback message -->
			{#if filteredData.isFallback}
				<div class="pb-4 text-center text-base text-muted">
					{m["convert.dropdown.fallback"]()}
				</div>
			{/if}
			<!-- available categories -->
			<div class="flex items-center justify-between">
				{#each filteredData.categories as category (category)}
					<button
						class={clsx(
							"hover:text-muted/20 flex-grow border-b-2 pb-2 text-lg capitalize",
							currentCategory === category
								? "border-b-accent text-accent"
								: "border-b-separator text-muted",
						)}
						onclick={() => selectCategory(category)}
					>
						<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
						{(m as any)[`convert.dropdown.${category}`]?.()}
					</button>
				{/each}
			</div>
			<!-- available formats -->
			<div use:animateHeight>
				{#key currentCategory}
					<div
						class="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto p-2"
						in:fade={{
							duration: duration,
							easing: quintOut,
						}}
						out:fade={{
							duration: duration,
							easing: quintOut,
						}}
						bind:this={formatList}
					>
						{#if filteredData.formats.length > 0}
							{#each filteredData.formats as format (format)}
								{@const unavailableReason =
									getUnavailableReason(format)}
								{#if unavailableReason}
									<Tooltip text={unavailableReason}>
										<button
											data-selected={format === selected}
											aria-disabled="true"
											class="w-full cursor-not-allowed rounded-xl p-2 text-center opacity-45"
											tabindex="0"
											onclick={(e) => e.preventDefault()}
											onkeydown={(e) =>
												e.preventDefault()}
										>
											{format}
										</button>
									</Tooltip>
								{:else}
									<button
										data-selected={format === selected}
										class={clsx(
											"w-full rounded-xl p-2 text-center",
											format === selected
												? "bg-accent text-black"
												: format === from
													? "bg-separator"
													: "hover:bg-panel",
										)}
										onclick={() => selectOption(format)}
									>
										{format}
									</button>
								{/if}
							{/each}
						{:else}
							<div class="col-span-3 p-4 text-center text-muted">
								{searchQuery
									? m["convert.dropdown.no_results"]()
									: m["convert.dropdown.no_formats"]()}
							</div>
						{/if}
					</div>
				{/key}
			</div>
			<!-- format options -->
			{#if file?.name.toLowerCase().endsWith(".zip")}
				<div
					class="flex flex-col gap-2 border-t border-separator p-2 text-base"
				>
					<button
						class="w-full rounded-lg bg-accent p-2 text-center text-black"
						onclick={() => extract()}
					>
						{m["convert.archive_file.extract"]()}
					</button>
					{#if file.sequenceKind !== "dash"}
						<!-- FIXME this is terrible -->
						<div class="flex flex-col flex-wrap gap-1">
							<!-- first row -->
							<div class="flex items-center gap-3">
								<div
									class="flex h-full min-w-0 flex-1 items-center gap-2"
								>
									<FancyInput
										type="checkbox"
										bind:checked={imageSequence}
									/>
									<label
										for="extract-sequence"
										class="text-sm"
									>
										{m[
											"convert.image_sequence.image_sequence"
										]()}
									</label>
								</div>
								<div class="w-[80px] shrink-0">
									<FancyInput
										thin
										inputClass="!h-9 !text-xs"
										type="number"
										extension="FPS"
										placeholder="15"
										bind:value={imageSequenceFPS}
										disabled={!imageSequence}
									/>
								</div>
							</div>

							<!-- second row -->
							<div class="flex items-center gap-3">
								<div
									class="flex h-full min-w-0 flex-1 items-center gap-2"
								>
									<FancyInput
										type="checkbox"
										bind:checked={imageSequenceTransparency}
										disabled={!imageSequence}
									/>
									<label
										for="extract-sequence"
										class="text-sm"
									>
										{m[
											"convert.image_sequence.transparency"
										]()}
									</label>
								</div>
								<!-- second thing -->
							</div>
						</div>
					{/if}
					{#if file.sequenceKind === "frameSequence" && imageSequence}
						<div class="flex flex-col border-t border-separator">
							<button
								class="mt-2 flex w-full justify-center gap-3 rounded-lg bg-accent p-2.5 text-center text-black"
								onclick={() => ($fileSettings = file)}
							>
								<SettingsIcon size="24" />
								{m["convert.settings.settings"]()}
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<div class="border-t border-separator p-2 text-base">
					<button
						class="flex w-full justify-center gap-3 rounded-lg bg-accent p-2.5 text-center text-black"
						onclick={() => {
							if (file) $fileSettings = file;
							else $fileSettings = undefined; // all files
						}}
					>
						<SettingsIcon size="24" />
						{m["convert.settings.settings"]()}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
