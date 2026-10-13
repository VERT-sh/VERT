<script lang="ts">
	type Props = {
		iterations: number;
		endIntensity: number;
		direction: "top" | "left" | "bottom" | "right";
		fadeTo?: string;
	};

	let {
		iterations,
		endIntensity,
		direction,
		fadeTo = "transparent",
	}: Props = $props();

	const getGradientDirection = () => {
		switch (direction) {
			case "top":
				return "to top";
			case "left":
				return "to left";
			case "bottom":
				return "to bottom";
			case "right":
				return "to right";
		}
	};

	const blurSteps = $derived(
		Array.from({ length: iterations }, (_, i) => {
			const blurIntensity =
				(endIntensity / 2 ** (iterations - 1)) * 2 ** i;
			const gradientStart = (i / iterations) * 100;
			const gradientEnd = ((i + 1) / iterations) * 100;

			return {
				blurIntensity,
				mask: `linear-gradient(${getGradientDirection()}, rgba(0, 0, 0, 0) ${gradientStart}%, rgba(0, 0, 0, 1) ${gradientEnd}%)`,
			};
		}),
	);
</script>

<div class="relative h-full w-full">
	{#each blurSteps as { blurIntensity, mask }, index (index)}
		<div
			class="absolute h-full w-full"
			style="
        z-index: {index + 2};
        backdrop-filter: blur( calc({blurIntensity}px * var(--blur-amount, 1)) );
        mask: {mask};
      "
		></div>
	{/each}
	<div
		style="
      z-index: {iterations + 2};
      backdrop-filter: blur({endIntensity}px);
      mask: linear-gradient({getGradientDirection()}, rgba(0, 0, 0, 0) ${(iterations /
			(iterations + 1)) *
			100}%, rgba(0, 0, 0, 1) 100%);
    "
	></div>
	<div
		class="absolute left-0 top-0 z-50 h-full w-full"
		style="background: linear-gradient({getGradientDirection()}, transparent 0%, {fadeTo} 100%); opacity: var(--blur-amount, 1);"
	></div>
</div>
