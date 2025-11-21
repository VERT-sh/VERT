import { isMobile, effects } from "$lib/store/index.svelte";
import type { AnimationConfig, FlipParams } from "svelte/animate";
import { cubicOut } from "svelte/easing";
import {
	fade as svelteFade,
	fly as svelteFly,
	type FadeParams,
	type FlyParams,
} from "svelte/transition";

// Subscribe to stores
let effectsEnabled = true;
let isMobileDevice = false;

export function initStores() {
	effects.subscribe((value) => {
		effectsEnabled = value;
	});
	isMobile.subscribe((value) => {
		isMobileDevice = value;
	});
}

export const transition =
	"linear(0,0.006,0.025 2.8%,0.101 6.1%,0.539 18.9%,0.721 25.3%,0.849 31.5%,0.937 38.1%,0.968 41.8%,0.991 45.7%,1.006 50.1%,1.015 55%,1.017 63.9%,1.001)";

export const duration = 500;

export function fade(node: HTMLElement, options: FadeParams) {
	if (!effectsEnabled) return {};
	const animation = svelteFade(node, options);
	return animation;
}

export function fly(node: HTMLElement, options: FlyParams) {
	if (!effectsEnabled || isMobileDevice) return {};
	const animation = svelteFly(node, options);
	return animation;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function is_function(thing: unknown): thing is Function {
	return typeof thing === "function";
}

type Params = FlipParams & {};

/**
 * The flip function calculates the start and end position of an element and animates between them, translating the x and y values.
 * `flip` stands for [First, Last, Invert, Play](https://aerotwist.com/blog/flip-your-animations/).
 *
 * https://svelte.dev/docs/svelte-animate#flip
 */
export function flip(
	node: HTMLElement,
	{ from, to }: { from: DOMRect; to: DOMRect },
	params: Params = {},
): AnimationConfig {
	const style = getComputedStyle(node);
	const transform = style.transform === "none" ? "" : style.transform;
	const [ox, oy] = style.transformOrigin.split(" ").map(parseFloat);
	const dx = from.left + (from.width * ox) / to.width - (to.left + ox);
	const dy = from.top + (from.height * oy) / to.height - (to.top + oy);
	const {
		delay = 0,
		duration = (d) => Math.sqrt(d) * 120,
		easing = cubicOut,
	} = params;
	return {
		delay,
		duration: is_function(duration)
			? duration(Math.sqrt(dx * dx + dy * dy))
			: duration,
		easing,
		css: (_t, u) => {
			const x = u * dx;
			const y = u * dy;
			// const sx = scale ? t + (u * from.width) / to.width : 1;
			// const sy = scale ? t + (u * from.height) / to.height : 1;
			return `transform: ${transform} translate(${x}px, ${y}px);`;
		},
	};
}
