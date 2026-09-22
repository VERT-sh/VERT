<script lang="ts">
	import { duration, fade, transition } from "$lib/util/animation";
	import { ChevronDown } from "@lucide/svelte";
	import { quintOut } from "svelte/easing";
	import { clsx } from "clsx";

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
	let clickHandler: ((e: MouseEvent) => void) | null = null;
	let resizeHandler: (() => void) | null = null;
	let scrollHandler: (() => void) | null = null;

	const getValue = (option: string | { value: string; label: string }) =>
		typeof option === "string" ? option : option.value;

	const getLabel = (option: string | { value: string; label: string }) =>
		typeof option === "string" ? option : option.label;

	const select = (option: string | { value: string; label: string }) => {
		const selectedValue = getValue(option);
		selected = selectedValue;
		onselect?.(selectedValue);
		toggle();
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
		selectedButton.scrollIntoView({ block: "start" });
	};

	// outside clicks
	$effect(() => {
		clickHandler = (e: MouseEvent) => {
			if (dropdown && !dropdown.contains(e.target as Node)) open = false;
		};

		window.addEventListener("click", clickHandler);

		return () => {
			if (clickHandler) window.removeEventListener("click", clickHandler);
		};
	});

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
			"inline-flex w-[6.5rem] sm:w-[10.5rem] md:w-52 text-left",
		style === "default" && "text-xl font-medium",
		style === "settings" && "font-normal",
	)}
	bind:this={dropdown}
>
	<button
		bind:this={button}
		class={clsx(
			"font-display overflow-hidden relative w-full flex focus:!outline-none",
			style !== "inline" && "bg-button py-3.5 px-3",
			style === "inline" && "justify-start",
			style === "settings" && "justify-between px-4 rounded-xl",
			style === "default" && "justify-center rounded-full",
			disabled ? "opacity-50 cursor-auto" : "cursor-pointer",
		)}
		onclick={toggle}
		{disabled}
	>
		<div
			class={clsx(
				"grid grid-cols-1 grid-rows-1 min-w-0 flex-grow-1 truncate",
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
						style === "inline" && "truncate max-w-52 text-left",
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
			{#each options as option}
				<p
					class={clsx(
						"col-start-1 row-start-1 pointer-events-none",
						style === "inline" ? "hidden" : "invisible",
					)}
				>
					{getLabel(option)}
				</p>
			{/each}
		</div>
		<ChevronDown
			class="w-4 h-4 ml-3 mt-0.5 flex-shrink-0"
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
		class="shadow-xl bg-panel-alt shadow-black/25 overflow-hidden z-[9999] bg-background rounded-xl max-h-[23.5vh] overflow-y-auto"
	>
		{#each options as option}
			<button
				data-selected={getValue(option) === selected}
				class={`w-full p-2 px-4 text-left hover:bg-panel font-normal text-sm text-muted
				${getValue(option) === selected ? "bg-separator" : ""}`}
				onclick={() => select(option)}
			>
				{getLabel(option)}
			</button>
		{/each}
	</div>
{/if}
