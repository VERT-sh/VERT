<script lang="ts">
	import { duration, fade, transition } from "$lib/util/animation";
	import { m } from "$lib/paraglide/messages";
	import { isMobile, files, dropdownStates } from "$lib/store/index.svelte";
	import type { Categories } from "$lib/types";
	import clsx from "clsx";
	import { ChevronDown, SearchIcon } from "lucide-svelte";
	import { onMount } from "svelte";
	import { quintOut } from "svelte/easing";
	import { VertFile } from "$lib/types";
	import SettingsModal from "./popups/SettingsModal.svelte";
	import { log } from "$lib/util/logger";

	type Props = {
		categories: Categories;
		from?: string;
		selected?: string;
		onselect?: (option: string) => void;
		disabled?: boolean;
		dropdownSize?: "default" | "large" | "small";
		file?: VertFile;
	};

	let {
		categories,
		from,
		selected = $bindable(""),
		onselect,
		disabled,
		dropdownSize = "default",
		file,
	}: Props = $props();

	let open = $state(false);
	let dropdown = $state<HTMLDivElement>();
	let dropdownMenu: HTMLElement | undefined = $state();
	let dropdownPosition = $state<"left" | "center" | "right">("center");
	let showSettingsModal = $state(false);
	let currentCategory = $state<string | null>(null);
	let searchQuery = $state("");
	let rootCategory: string | null = null;

	const normalize = (str: string) => str.replace(/^\./, "").toLowerCase();

	const shouldExclude = (format: string): boolean =>
		!!(
			categories["audio"]?.formats.includes(from ?? "") &&
			format === ".gif"
		);

	const getFormats = (cat: string) =>
		(categories[cat]?.formats ?? []).filter((f) => !shouldExclude(f));

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

		// handle special cases
		if (from === ".gif" || from === ".webp") cats.push("video");
		if (from === ".apng") {
			//cats.push("image"); // -- buggy, magick can't convert from or to apng properly
			cats = cats.filter((cat) => cat !== "audio");
		}

		// large videos can't be extracted to audio (browser/device limitations)
		if (file && file.isLarge() && rootCategory === "video")
			cats = cats.filter((cat) => cat !== "audio");

		return cats.filter(
			(cat) => (categories[cat]?.formats?.length ?? 0) > 0,
		);
	});

	const filteredData = $derived.by(() => {
		// if no query, return formats for current category
		if (!searchQuery) {
			const formats = getFormats(currentCategory ?? "");

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
				resolvedCategory: currentCategory,
			};
		}

		const query = normalize(searchQuery);
		const matches = (f: string) =>
			normalize(f).includes(query) && !shouldExclude(f);

		const matchingCategories = availableCategories.filter((cat) =>
			(categories[cat]?.formats ?? []).some(matches),
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
			.filter(matches)
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

	const selectOption = (option: string) => {
		selected = option;
		open = false;

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

	const clickDropdown = () => {
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

		setTimeout(() => {
			if (!dropdownMenu) return;
			const searchInput = dropdownMenu.querySelector(
				"#format-search",
			) as HTMLInputElement;
			if (searchInput) {
				searchInput.focus();
				searchInput.select();
			}
		}, 0); // let dropdown open first
	};

	const extract = async () => {
		// extract all files in zip, then add all extracted files to files store
		if (!file) return;
		const { extractZip } = await import("$lib/util/file");
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

		files.files = files.files.filter((f) => f !== file);
		newFiles.forEach((f) => files.add(f));
	};

	const settings = () => {
		log(
			["dropdown", "settings"],
			`opening settings modal for ${file?.name ?? "all files"}`,
		);
		showSettingsModal = true;
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

{#if showSettingsModal}
	<SettingsModal {file} onclose={() => (showSettingsModal = false)} />
{/if}

<div
	class="relative w-full min-w-fit text-xl font-medium text-center"
	bind:this={dropdown}
>
	<button
		class="relative flex items-center justify-center w-full font-display px-3 py-3.5 bg-button rounded-full overflow-hidden cursor-pointer focus:!outline-none
		{disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
		onclick={() => clickDropdown()}
		{disabled}
	>
		<!-- <p>{selected}</p> -->
		<div
			class="grid grid-cols-1 grid-rows-1 w-fit flex-grow-0 max-h-[2.5rem] overflow-hidden"
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
					class="col-start-1 row-start-1 text-center font-body font-medium truncate max-w-[4rem]"
				>
					{selected || "N/A"}
				</p>
			{/key}
			{#if currentCategory}
				{#each categories[currentCategory].formats as option}
					<p
						class="col-start-1 row-start-1 invisible pointer-events-none truncate max-w-[2.5rem]"
					>
						{option}
					</p>
				{/each}
			{/if}
		</div>
		<ChevronDown
			class="w-4 h-4 ml-3 mt-0.5 flex-shrink-0"
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
					? "fixed inset-x-0 bottom-0 w-full z-[200] shadow-xl bg-panel-alt shadow-black/25 rounded-t-2xl overflow-hidden"
					: "min-w-full shadow-xl bg-panel-alt shadow-black/25 absolute top-full mt-2 z-50 rounded-2xl overflow-hidden",
				!$isMobile && {
					"w-[320%]": dropdownSize === "large",
					"w-[250%]": dropdownSize === "default",
					"w-[150%]": dropdownSize === "small",
				},
				!$isMobile && {
					"-translate-x-1/2 left-1/2": dropdownPosition === "center",
					"left-0": dropdownPosition === "left",
					"right-0": dropdownPosition === "right",
				},
			)}
		>
			<!-- search box -->
			<div class="p-3 w-full">
				<div class="relative">
					<input
						type="text"
						placeholder={m["convert.dropdown.placeholder"]()}
						class="flex-grow w-full !pl-11 !pr-3 rounded-lg bg-panel text-foreground {filteredData.isFallback
							? 'opacity-50 cursor-not-allowed'
							: ''}"
						bind:value={searchQuery}
						oninput={handleSearch}
						onkeydown={onEnter}
						onfocus={() => {}}
						id="format-search"
						autocomplete="off"
						disabled={filteredData.isFallback}
					/>
					<span
						class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center {filteredData.isFallback
							? 'opacity-50'
							: ''}"
					>
						<SearchIcon class="w-4 h-4" />
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
				<div class="pb-4 text-center text-muted text-base">
					{m["convert.dropdown.fallback"]()}
				</div>
			{/if}
			<!-- available categories -->
			<div class="flex items-center justify-between">
				{#each filteredData.categories as category}
					<button
						class="flex-grow text-lg hover:text-muted/20 border-b-[1px] pb-2 capitalize
                        {currentCategory === category
							? 'text-accent border-b-accent'
							: 'border-b-separator text-muted'}"
						onclick={() => selectCategory(category)}
					>
						<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
						{(m as any)[`convert.dropdown.${category}`]?.()}
					</button>
				{/each}
			</div>
			<!-- available formats -->
			<div class="max-h-80 overflow-y-auto grid grid-cols-3 gap-2 p-2">
				{#if filteredData.formats.length > 0}
					{#each filteredData.formats as format}
						<button
							class="w-full p-2 text-center rounded-xl
							{format === selected
								? 'bg-accent text-black'
								: format === from
									? 'bg-separator'
									: 'hover:bg-panel'}"
							onclick={() => selectOption(format)}
						>
							{format}
						</button>
					{/each}
				{:else}
					<div class="col-span-3 text-center p-4 text-muted">
						{searchQuery
							? m["convert.dropdown.no_results"]()
							: m["convert.dropdown.no_formats"]()}
					</div>
				{/if}
			</div>
			<!-- format options -->
			<!-- TODO: extract zip, image sequence & fps -->
			{#if file?.name.toLowerCase().endsWith(".zip")}
				<div class="border-t border-separator text-base p-2">
					<button
						class="w-full p-2 text-center rounded-lg bg-accent text-black"
						onclick={() => extract()}
					>
						{m["convert.archive_file.extract"]()}
					</button>
				</div>
			{:else}
				<div class="border-t border-separator text-base p-2">
					<button
						class="w-full p-2 text-center rounded-lg bg-accent text-black"
						onclick={() => settings()}
					>
						{m["convert.settings.settings"]()}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
