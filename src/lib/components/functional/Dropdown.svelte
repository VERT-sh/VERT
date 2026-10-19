<script lang="ts">
	import { duration, fade, transition } from "#lib/util/animation";
	import { ChevronDownIcon } from "@lucide/svelte";
	import { quintOut } from "svelte/easing";
	import { clsx } from "clsx";
	import { popOverlayLayer, pushOverlayLayer } from "#lib/util/overlay";

	type DropdownStyle = "default" | "settings" | "inline";

	type Props = {
		options: string[] | { value: string; label: string }[];
		selected?: string;
		onselect?: (option: string) => void;
		disabled?: boolean;
		style?: DropdownStyle;
	};

	let {
		options,
		selected = $bindable(
			typeof options[0] === "string" ? options[0] : options[0].value,
		),
		onselect,
		disabled,
		style = "default",
	}: Props = $props();

	let open = $state(false);
	let dropdown = $state<HTMLDivElement>();
	let menuElement = $state<HTMLDivElement>();
	let button = $state<HTMLButtonElement>();
	let resizeHandler: (() => void) | null = null;
	let scrollHandler: (() => void) | null = null;
	let overlayLayer: symbol | null = null;

	// the overlay stack dismisses this dropdown when a click lands outside of it
	$effect(() => {
		if (!open) return;

		const layer = pushOverlayLayer({
			// the menu is portaled to the body, so it isn't inside `dropdown`
			contains: (target) =>
				!!dropdown?.contains(target) || !!menuElement?.contains(target),
			dismiss: () => (open = false),
		});
		overlayLayer = layer;

		return () => {
			popOverlayLayer(layer);
			if (overlayLayer === layer) overlayLayer = null;
		};
	});

	const getValue = (option: string | { value: string; label: string }) =>
		typeof option === "string" ? option : option.value;

	const getLabel = (option: string | { value: string; label: string }) =>
		typeof option === "string" ? option : option.label;

	const select = (option: string | { value: string; label: string }) => {
		const selectedValue = getValue(option);
		selected = selectedValue;
		onselect?.(selectedValue);
		open = false;
	};

	const toggle = () => {
		open = !open;
	};

	const updateMenuPosition = () => {
		if (open && menuElement && button) {
			const rect = button.getBoundingClientRect();
			menuElement.style.top = `${rect.bottom + 4}px`;
			menuElement.style.left = `${rect.left}px`;
			menuElement.style.width = `${rect.width}px`;
		}
	};

	const scrollView = () => {
		if (!menuElement) return;
		const selectedButton = menuElement.querySelector(
			"[data-selected='true']",
		) as HTMLButtonElement | null;
		if (!selectedButton) return;

		const menuRect = menuElement.getBoundingClientRect();
		const buttonRect = selectedButton.getBoundingClientRect();
		if (
			buttonRect.top >= menuRect.top &&
			buttonRect.bottom <= menuRect.bottom
		)
			return;

		if (buttonRect.top < menuRect.top)
			menuElement.scrollTop -= menuRect.top - buttonRect.top;
		else menuElement.scrollTop += buttonRect.bottom - menuRect.bottom;
	};

	// dropdown menu positioning
	$effect(() => {
		if (open && menuElement && button) {
			resizeHandler = updateMenuPosition;
			scrollHandler = updateMenuPosition;
			window.addEventListener("resize", resizeHandler);
			window.addEventListener("scroll", scrollHandler, {
				capture: true,
				passive: true,
			});
			document.body.appendChild(menuElement);
			menuElement.style.position = "fixed";
			updateMenuPosition();
			requestAnimationFrame(scrollView);

			return () => {
				if (resizeHandler)
					window.removeEventListener("resize", resizeHandler);
				if (scrollHandler)
					window.removeEventListener("scroll", scrollHandler, true);
				if (menuElement?.parentNode === document.body)
					document.body.removeChild(menuElement);
			};
		}
	});
</script>

<div
	class={clsx(
		"min-w-fit text-center",
		style !== "inline" && "w-full",
		style === "inline" &&
			"inline-flex w-[6.5rem] text-left sm:w-[10.5rem] md:w-52",
		style === "default" && "text-xl font-medium",
		style === "settings" && "font-normal",
	)}
	bind:this={dropdown}
>
	<button
		bind:this={button}
		class={clsx(
			"relative flex w-full overflow-hidden font-display focus:!outline-none",
			style !== "inline" && "bg-button px-3 py-3.5",
			style === "inline" && "justify-start",
			style === "settings" && "justify-between rounded-xl px-4",
			style === "default" && "justify-center rounded-full",
			disabled ? "cursor-auto opacity-50" : "cursor-pointer",
		)}
		onclick={toggle}
		{disabled}
	>
		<div
			class={clsx(
				"flex-grow-1 grid min-w-0 grid-cols-1 grid-rows-1 truncate",
				style === "inline" && "max-w-full",
			)}
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
					class={clsx(
						"col-start-1 row-start-1 min-w-0 font-body",
						style === "inline" &&
							"underline-offset-3 w-full truncate text-left underline decoration-dotted md:max-w-52",
						style === "settings" && "text-left font-normal",
						style === "default" && "text-center",
						style !== "settings" && "font-medium",
					)}
				>
					{getLabel(
						options.find((opt) => getValue(opt) === selected) ||
							selected,
					)}
				</p>
			{/key}
			{#each options as option (getValue(option))}
				<p
					class={clsx(
						"pointer-events-none col-start-1 row-start-1",
						style === "inline" ? "hidden" : "invisible",
					)}
				>
					{getLabel(option)}
				</p>
			{/each}
		</div>
		<ChevronDownIcon
			class="ml-1.5 mt-0.5 h-4 w-4 flex-shrink-0"
			style="transform: rotate({open
				? 180
				: 0}deg); transition: transform {duration}ms {transition};"
		/>
	</button>
</div>

{#if open}
	<div
		bind:this={menuElement}
		transition:fade={{
			duration,
			easing: quintOut,
		}}
		class="bg-background z-[9999] max-h-[23.5vh] overflow-hidden overflow-y-auto rounded-xl bg-panel-alt shadow-xl shadow-black/25"
	>
		{#each options as option (getValue(option))}
			<button
				data-selected={getValue(option) === selected}
				class={clsx(
					"w-full p-2 px-4 text-left text-sm font-normal text-muted hover:bg-panel",
					getValue(option) === selected && "bg-separator",
				)}
				onclick={() => select(option)}
			>
				{getLabel(option)}
			</button>
		{/each}
	</div>
{/if}
