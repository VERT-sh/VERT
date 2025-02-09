<script lang="ts">
	type Props = {
		progress: number | null;
		min: number;
		max: number;
	};

	let { progress, min, max }: Props = $props();

	const percent = $derived(
		progress ? ((progress - min) / (max - min)) * 100 : null,
	);
</script>

<div class="w-full h-1 bg-panel-alt rounded-full overflow-hidden relative">
	<div
		class="h-full bg-accent absolute left-0 top-0"
		class:percentless-animation={progress === null}
		style={percent
			? `width: ${percent}%; transition: 500ms linear width;`
			: ""}
	></div>
</div>

<style>
	.percentless-animation {
		width: 100%;
		animation:
			percentless-animation 1s ease infinite,
			left-right 1s ease infinite;
	}

	@keyframes percentless-animation {
		0% {
			width: 0%;
		}

		50% {
			width: 100%;
		}

		100% {
			width: 0%;
		}
	}

	@keyframes left-right {
		49% {
			left: 0;
			right: auto;
		}

		50% {
			left: auto;
			right: 0;
		}

		100% {
			left: auto;
			right: 0;
		}
	}
</style>
