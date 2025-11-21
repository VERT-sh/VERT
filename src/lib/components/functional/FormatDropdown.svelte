<script lang="ts">
	import { duration, fade, transition } from "$lib/util/animation";
	import { m } from "$lib/paraglide/messages";
	import { isMobile, files, dropdownStates } from "$lib/store/index.svelte";
	import type { Categories } from "$lib/types";
	import clsx from "clsx";
	import { ChevronDown, SearchIcon } from "lucide-svelte";
	import { onMount } from "svelte";
	import { quintOut } from "svelte/easing";
	import type { VertFile } from "$lib/types";

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
	let currentCategory = $state<string | null>();
	let searchQuery = $state("");
	let dropdownMenu: HTMLElement | undefined = $state();
	let rootCategory: string | null = null;
	let dropdownPosition = $state<"left" | "center" | "right">("center");

	// initialize current category
	$effect(() => {
		if (currentCategory) return;
		let foundCat: string | undefined;

		if (selected) {
			foundCat = Object.keys(categories).find((cat) =>
				categories[cat].formats.includes(selected),
			);
		} else {
			// find category based on file types
			const fileFormats = files.files.map((f) => f.from);
			foundCat = Object.keys(categories).find((cat) =>
				fileFormats.some((format) =>
					categories[cat].formats.includes(format),
				),
			);
		}

		currentCategory = foundCat || Object.keys(categories)[0] || null;
		rootCategory = currentCategory;
	});

	// other available categories based on current category (e.g. converting between video and audio)
	const availableCategories = $derived.by(() => {
		if (!rootCategory) return Object.keys(categories);

		let finalCategories = Object.keys(categories).filter(
			(cat) =>
				cat === rootCategory ||
				categories[rootCategory!]?.canConvertTo?.includes(cat),
		);
		if (from === ".gif") finalCategories.push("video");

		// filter out categories that can't handle large files (due to browser/device limitations)
		if (file && file.isLarge()) {
			// if file is large video, disable audio conversion
			if (rootCategory === "video")
				finalCategories = finalCategories.filter(
					(cat) => cat !== "audio",
				);
		}

		return finalCategories;
	});

	const shouldInclude = (format: string, category: string): boolean => {
		// if converting from audio to video, dont show gifs
		if (
			categories["audio"]?.formats.includes(from ?? "") &&
			format === ".gif"
		) {
			return false;
		}

		return true;
	};

	const filteredData = $derived.by(() => {
		const normalize = (str: string) => str.replace(/^\./, "").toLowerCase();

		// if no query, return formats for current category
		if (!searchQuery) {
			let formats = currentCategory
				? categories[currentCategory].formats.filter((format) =>
						shouldInclude(format, currentCategory!),
					)
				: [];

			return {
				categories: availableCategories,
				formats,
			};
		}
		const searchLower = normalize(searchQuery);

		// find all categories that have formats matching the search query
		const matchingCategories = availableCategories.filter((cat) =>
			categories[cat].formats.some(
				(format) =>
					normalize(format).includes(searchLower) &&
					shouldInclude(format, cat),
			),
		);
		if (matchingCategories.length === 0) {
			return {
				categories: availableCategories,
				formats: [],
			};
		}

		// if current category has no matches, switch to first category that does
		const currentCategoryHasMatches =
			currentCategory &&
			matchingCategories.some((cat) => cat === currentCategory);
		if (!currentCategoryHasMatches && matchingCategories.length > 0) {
			const newCategory = matchingCategories[0];
			currentCategory = newCategory;
		}

		// return formats only from the current category that match the search
		let filteredFormats = currentCategory
			? categories[currentCategory].formats.filter(
					(format) =>
						normalize(format).includes(searchLower) &&
						shouldInclude(format, currentCategory!),
				)
			: [];

		// sorting exact match first, then others
		filteredFormats = filteredFormats.sort((a, b) => {
			const aExact = normalize(a) === searchLower;
			const bExact = normalize(b) === searchLower;
			if (aExact && !bExact) return -1;
			if (!aExact && bExact) return 1;
			return 0;
		});

		return {
			categories:
				matchingCategories.length > 0
					? matchingCategories
					: availableCategories,
			formats: filteredFormats,
		};
	});

	const selectOption = (option: string) => {
		selected = option;
		open = false;

		// save user's selection to dropdownStates for this session
		if (file) {
			dropdownStates.update((states) => {
				const updated = { ...states, [file.name]: option };
				return updated;
			});
		}

		// find the category of this option if it's not in the current category
		if (
			currentCategory &&
			!categories[currentCategory].formats.includes(option)
		) {
			const formatCategory = Object.keys(categories).find((cat) =>
				categories[cat].formats.includes(option),
			);

			if (formatCategory) {
				currentCategory = formatCategory;
			}
		}

		onselect?.(option);
	};

	const selectCategory = (category: string) => {
		if (!categories[category]) return;
		currentCategory = category;
	};

	const handleSearch = (event: Event) => {
		const query = (event.target as HTMLInputElement).value;
		searchQuery = query;

		// find which categories have matching formats & switch
		if (query) {
			const queryLower = query.toLowerCase();
			const categoriesWithMatches = availableCategories.filter((cat) =>
				categories[cat].formats.some((format) =>
					format.toLowerCase().includes(queryLower),
				),
			);

			if (categoriesWithMatches.length > 0) {
				const currentHasMatches =
					currentCategory &&
					categories[currentCategory].formats.some((format) =>
						format.toLowerCase().includes(queryLower),
					);

				if (!currentHasMatches) {
					currentCategory = categoriesWithMatches[0];
				}
			}
		}
	};

	const onEnter = (event: KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			if (filteredData.formats.length > 0) {
				selectOption(filteredData.formats[0]);
			}
		}
	};

	const clickDropdown = () => {
		open = !open;
		if (!open) return;

		// keep within viewport
		if (dropdown) {
			const rect = dropdown.getBoundingClientRect();
			const viewportWidth = window.innerWidth;

			let dropdownWidth: number;
			if (dropdownSize === "large") {
				dropdownWidth = rect.width * 3.2;
			} else if (dropdownSize === "default") {
				dropdownWidth = rect.width * 2.5;
			} else {
				dropdownWidth = rect.width * 1.5;
			}

			const centerX = rect.left + rect.width / 2;
			const leftEdge = centerX - dropdownWidth / 2;
			const rightEdge = centerX + dropdownWidth / 2;

			if (leftEdge < 0) {
				dropdownPosition = "left";
			} else if (rightEdge > viewportWidth) {
				dropdownPosition = "right";
			} else {
				dropdownPosition = "center";
			}
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

	onMount(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdown && !dropdown.contains(e.target as Node)) {
				open = false;
			}
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
						class="flex-grow w-full !pl-11 !pr-3 rounded-lg bg-panel text-foreground"
						bind:value={searchQuery}
						oninput={handleSearch}
						onkeydown={onEnter}
						onfocus={() => {}}
						id="format-search"
						autocomplete="off"
					/>
					<span
						class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center"
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
							? "No formats match your search"
							: "No formats available"}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
