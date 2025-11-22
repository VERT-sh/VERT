<script lang="ts">
	import { fade } from "$lib/util/animation";
	interface Props {
		children: () => any;
		text: string;
		className?: string;
		position?: "top" | "bottom" | "left" | "right";
	}

	let { children, text, className, position = "top" }: Props = $props();
	let showTooltip = $state(false);
	let timeout: NodeJS.Timeout | null = null;
	let triggerElement: HTMLElement;
	let tooltipElement = $state<HTMLElement>();
	let tooltipPosition = $state({ x: 0, y: 0 });

	function show() {
		timeout = setTimeout(() => {
			if (!triggerElement) return;
			const rect = triggerElement.getBoundingClientRect();

			switch (position) {
				case "top":
					tooltipPosition = {
						x: rect.left + rect.width / 2,
						y: rect.top - 10,
					};
					break;
				case "bottom":
					tooltipPosition = {
						x: rect.left + rect.width / 2,
						y: rect.bottom + 10,
					};
					break;
				case "left":
					tooltipPosition = {
						x: rect.left - 10,
						y: rect.top + rect.height / 2,
					};
					break;
				case "right":
					tooltipPosition = {
						x: rect.right + 10,
						y: rect.top + rect.height / 2,
					};
					break;
			}
			showTooltip = true;
		}, 500);
	}

	function hide() {
		showTooltip = false;
		if (timeout) clearTimeout(timeout);
	}

	function handleGlobalMouseMove(e: MouseEvent) {
		if (!showTooltip || !triggerElement) return;

		const triggerRect = triggerElement.getBoundingClientRect();
		const isOverTrigger =
			e.clientX >= triggerRect.left &&
			e.clientX <= triggerRect.right &&
			e.clientY >= triggerRect.top &&
			e.clientY <= triggerRect.bottom;

		if (!isOverTrigger) hide();
	}

	$effect(() => {
		if (showTooltip && tooltipElement) {
			document.body.appendChild(tooltipElement);
			document.addEventListener("mousemove", handleGlobalMouseMove);
		}

		return () => {
			if (tooltipElement && tooltipElement.parentNode === document.body) {
				document.body.removeChild(tooltipElement);
			}
			document.removeEventListener("mousemove", handleGlobalMouseMove);
		};
	});
</script>

<span
	bind:this={triggerElement}
	class="relative inline-block {className}"
	onmouseenter={show}
	onmouseleave={hide}
	onfocusin={show}
	onfocusout={hide}
	ontouchstart={show}
	ontouchend={hide}
	role="tooltip"
>
	{@render children()}
</span>

{#if showTooltip}
	<span
		bind:this={tooltipElement}
		class="tooltip tooltip-{position}"
		style="left: {tooltipPosition.x}px; top: {tooltipPosition.y}px;"
		transition:fade={{
			duration: 100,
		}}
	>
		{text}
	</span>
{/if}

<style lang="postcss">
	.tooltip {
		--border-size: 1px;
		@apply fixed bg-panel-alt text-foreground border border-stone-400 dynadark:border-white drop-shadow-lg text-xs rounded-full pointer-events-none z-[999] max-w-xs break-words whitespace-normal;
		@apply px-5 py-2.5;
	}

	.tooltip-top {
		transform: translate(-50%, -100%);
	}

	.tooltip-top::after {
		@apply content-[""] absolute top-full left-1/2 -translate-x-1/2 border-8 border-x-transparent border-b-transparent;
	}

	.tooltip-top::before {
		border-width: calc(var(--border-size) + 8px);
		margin-left: calc(-1 * (var(--border-size) + 8px));
		@apply content-[""] absolute top-full left-1/2 border-x-transparent border-b-transparent border-t-inherit;
	}

	.tooltip-bottom {
		transform: translate(-50%, 20%);
	}

	.tooltip-bottom::after {
		@apply content-[""] absolute bottom-full left-1/2 -ml-2 border-8 border-x-transparent border-t-transparent;
	}

	.tooltip-bottom::before {
		border-width: calc(var(--border-size) + 8px);
		margin-left: calc(-1 * (var(--border-size) + 8px));
		@apply content-[""] absolute bottom-full left-1/2 border-x-transparent border-t-transparent border-b-inherit;
	}

	.tooltip-left {
		transform: translate(-100%, -50%);
	}

	.tooltip-left::after {
		@apply content-[""] absolute top-1/2 left-full -mt-2 border-8 border-y-transparent border-r-transparent border-l-inherit;
	}

	.tooltip-right {
		transform: translate(0%, -50%);
	}

	.tooltip-right::after {
		margin-right: -2px;
		@apply content-[""] absolute top-1/2 right-full -mt-2 border-8 border-y-transparent border-l-transparent;
	}

	.tooltip-right::before {
		margin-right: -2px;
		border-width: calc(var(--border-size) + 8px);
		margin-top: calc(-1 * (var(--border-size) + 8px));
		@apply content-[""] absolute top-1/2 right-full border-y-transparent border-l-transparent border-r-inherit;
	}
</style>
