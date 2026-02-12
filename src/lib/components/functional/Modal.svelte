<script lang="ts">
	import { duration, fade } from "$lib/util/animation";
	import { quintOut } from "svelte/easing";
	import type { Icon as IconType } from "lucide-svelte";

	interface ModalButton {
		text: string;
		action: () => void;
		primary?: boolean;
	}

	interface Props {
		icon: typeof IconType;
		title: string;
		color: string;
		buttons: ModalButton[];
		children: () => any;
		onclose?: () => void;
	}

	let {
		icon: Icon,
		title,
		color,
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
	class="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[400]"
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
		class="flex flex-col items-center justify-between w-full max-w-lg p-5 gap-6 bg-panel rounded-lg shadow-md"
		in:fade={{
			duration,
			easing: quintOut,
		}}
		out:fade={{
			duration,
			easing: quintOut,
		}}
	>
		<div class="flex justify-between w-full items-center">
			<div class="flex items-center gap-3">
				<div
					class="rounded-full bg-accent-{color} p-2 inline-block w-8 h-8"
				>
					<Icon size="16" color="black" />
				</div>
				<p class="text-lg font-semibold">{title}</p>
			</div>
		</div>

		<div class="flex flex-col gap-1 w-full text-sm font-normal text-muted">
			{@render children()}
		</div>

		<div class="flex flex-row items-center gap-4 w-full">
			{#each buttons as { text, action, primary }, i}
				<button
					class="hover:scale-105 active:scale-100 duration-200 flex items-center gap-2 p-2 rounded-md {primary ||
					i === 1
						? `text-black bg-accent-${color}`
						: 'bg-button text-black dynadark:text-white'} px-6"
					onclick={() => action()}
				>
					{text}
				</button>
			{/each}
		</div>
	</div>
</div>
