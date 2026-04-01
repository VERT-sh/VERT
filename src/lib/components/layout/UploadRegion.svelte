<script lang="ts">
	import { duration, fade } from "$lib/util/animation";
	import { dropping, effects } from "$lib/store/index.svelte";
	import { quintOut } from "svelte/easing";
</script>

{#if $dropping}
	<div
		class="fixed w-screen h-screen opacity-40 dynadark:opacity-20 z-[100] pointer-events-none blur-2xl {$effects
			? 'dragoverlay'
			: 'bg-accent-blue'}"
		class:_dragover={dropping && $effects}
		transition:fade={{
			duration,
			easing: quintOut,
		}}
	></div>
{/if}

<style>
	.dragoverlay {
		animation: dragoverlay-animation 3s infinite linear;
	}

	@keyframes dragoverlay-animation {
		0% {
			background-color: var(--accent-pink);
		}

		25% {
			background-color: var(--accent-blue);
		}

		50% {
			background-color: var(--accent-purple);
		}

		75% {
			background-color: var(--accent-red);
		}

		100% {
			background-color: var(--accent-pink);
		}
	}
</style>
