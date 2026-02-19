<script lang="ts">
	import { duration, fade, transition } from "$lib/util/animation";
	import { ChevronDown } from "lucide-svelte";
	import { quintOut } from "svelte/easing";

	type Props = {
		options: string[] | { value: string; label: string }[];
		selected?: string;
		onselect?: (option: string) => void;
		disabled?: boolean;
		settingsStyle?: boolean;
	};

	let {
		options,
		selected = $bindable(
			typeof options[0] === "string" ? options[0] : options[0].value,
		),
		onselect,
		disabled,
		settingsStyle,
	}: Props = $props();

	let open = $state(false);
	let hover = $state(false);
	let isUp = $state(false);
	let dropdown = $state<HTMLDivElement>();
	let menuElement = $state<HTMLDivElement>();
	let button = $state<HTMLButtonElement>();
	let clickHandler: ((e: MouseEvent) => void) | null = null;
	let resizeHandler: (() => void) | null = null;

	const getValue = (option: string | { value: string; label: string }) =>
		typeof option === "string" ? option : option.value;

	const getLabel = (option: string | { value: string; label: string }) =>
		typeof option === "string" ? option : option.label;

	const select = (option: string | { value: string; label: string }) => {
		const selectedValue = getValue(option);
		const oldIndex = options.findIndex((opt) => getValue(opt) === selected);
		const newIndex = options.findIndex(
			(opt) => getValue(opt) === selectedValue,
		);
		isUp = oldIndex > newIndex;
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
			window.addEventListener("resize", resizeHandler);
			document.body.appendChild(menuElement);
			menuElement.style.position = "fixed";
			updateMenuPosition();

			return () => {
				if (resizeHandler)
					window.removeEventListener("resize", resizeHandler);
				if (menuElement?.parentNode === document.body)
					document.body.removeChild(menuElement);
			};
		}
	});
</script>

<div
	class="relative w-full min-w-fit {settingsStyle
		? 'font-normal'
		: 'text-xl font-medium'} text-center"
	bind:this={dropdown}
>
	<button
		bind:this={button}
		class="font-display w-full {settingsStyle
			? 'justify-between'
			: 'justify-center'} overflow-hidden relative cursor-pointer {settingsStyle
			? 'px-4'
			: 'px-3'} py-3.5 bg-button {disabled
			? 'opacity-50 cursor-auto'
			: 'cursor-pointer'} flex items-center {settingsStyle
			? 'rounded-xl'
			: 'rounded-full'} focus:!outline-none"
		onclick={toggle}
		onmouseenter={() => (hover = true)}
		onmouseleave={() => (hover = false)}
		{disabled}
	>
		<div class="grid grid-cols-1 grid-rows-1 w-fit flex-grow-0">
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
					class="col-start-1 row-start-1 {settingsStyle
						? 'text-left'
						: 'text-center'} font-body {settingsStyle
						? 'font-normal'
						: 'font-medium'}"
				>
					{getLabel(
						options.find((opt) => getValue(opt) === selected) ||
							selected,
					)}
				</p>
			{/key}
			{#each options as option}
				<p
					class="col-start-1 row-start-1 invisible pointer-events-none"
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
				class="w-full p-2 px-4 text-left hover:bg-panel font-normal text-sm text-muted"
				onclick={() => select(option)}
			>
				{getLabel(option)}
			</button>
		{/each}
	</div>
{/if}
