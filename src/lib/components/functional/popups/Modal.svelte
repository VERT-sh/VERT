<script lang="ts">
	import Tooltip from "#lib/components/visual/Tooltip.svelte";
	import { duration, fade } from "#lib/util/animation";
	import type { SearchIcon } from "@lucide/svelte";
	import { quintOut } from "svelte/easing";
	import clsx from "clsx";

	export interface ModalButton {
		text: string;
		action: () => void;
		primary?: boolean;
		disabled?: boolean;
	}

	export interface ModalBadge {
		text: string;
		tooltip?: string;
		color: string;
	}

	export interface Props {
		icon: typeof SearchIcon;
		title: string;
		color: string;
		badge?: ModalBadge | null;
		buttons: ModalButton[];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		children: () => any;
		onclose?: () => void;
	}

	let {
		icon: Icon,
		title,
		color,
		badge,
		buttons,
		children,
		onclose,
	}: Props = $props();

	let backdropElement = $state<HTMLDivElement>();

	const handleOutsideClick = () => {
		onclose?.();
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === "Escape") onclose?.();
	};

	$effect(() => {
		if (backdropElement) {
			document.body.appendChild(backdropElement);
			return () => {
				if (backdropElement?.parentNode === document.body) {
					document.body.removeChild(backdropElement);
				}
			};
		}
	});
</script>

<div
	bind:this={backdropElement}
	class="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm"
	onclick={handleOutsideClick}
	onkeydown={handleKeydown}
	role="dialog"
	tabindex="0"
	aria-modal="true"
	in:fade={{
		duration,
		easing: quintOut,
	}}
	out:fade={{
		duration,
		easing: quintOut,
	}}
>
	<div
		onclick={(e) => e.stopPropagation()}
		onkeydown={() => {}}
		tabindex="0"
		role="dialog"
		class="flex w-full max-w-lg flex-col items-center justify-between gap-6 rounded-lg bg-panel p-5 shadow-md"
		in:fade={{
			duration,
			easing: quintOut,
		}}
		out:fade={{
			duration,
			easing: quintOut,
		}}
	>
		<div class="flex w-full items-center justify-between">
			<div class="flex items-center gap-3">
				<div
					class="rounded-full bg-accent-{color} inline-block h-8 w-8 p-2"
				>
					<Icon size="16" color="black" />
				</div>
				<p class="text-lg font-semibold">{title}</p>
				{#if badge && badge.text}
					{#if badge.tooltip}
						<Tooltip text={badge.tooltip} position="bottom">
							<div
								class="rounded-md bg-{badge.color} px-1.5 py-0.5 font-display text-sm text-white"
							>
								{badge.text}
							</div>
						</Tooltip>
					{:else}
						<div
							class="rounded-md bg-{badge.color} px-1.5 py-0.5 font-display text-sm text-white"
						>
							{badge.text}
						</div>
					{/if}
				{/if}
			</div>
		</div>

		<div class="flex w-full flex-col gap-1 text-sm font-normal text-muted">
			{@render children()}
		</div>

		<div class="flex w-full flex-row flex-wrap items-center gap-2">
			{#each buttons as { text, action, primary, disabled }, i (`${i}-${text}`)}
				<button
					{disabled}
					class={clsx(
						"flex items-center gap-2 rounded-md p-2 px-6 duration-200",
						"enabled:hover:scale-105 enabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50",
						primary || i === 1
							? `text-black bg-accent-${color}`
							: "bg-button text-black dynadark:text-white",
					)}
					onclick={() => action()}
				>
					{text}
				</button>
			{/each}
		</div>
	</div>
</div>
