import { isMobile, effects } from "#lib/store/index.svelte";
import type { AnimationConfig, FlipParams } from "svelte/animate";
import { cubicOut } from "svelte/easing";
import {
	fade as svelteFade,
	fly as svelteFly,
	type FadeParams,
	type FlyParams,
} from "svelte/transition";

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

type HeightTransitionOptions = {
	duration?: number;
	easing?: string;
};

export function animateHeight(
	node: HTMLElement,
	options: HeightTransitionOptions = {},
) {
	if (!effectsEnabled) return {};
	let transitionDuration = options.duration ?? duration;
	let easing = options.easing ?? transition;
	let observedChild: Element | null = null;
	let frame = 0;
	let releaseTimer = 0;
	let settledHeight: number | undefined;
	// eslint-disable-next-line prefer-const
	let resizeObserver: ResizeObserver | undefined;
	let mutationObserver: MutationObserver | undefined;

	const originalPosition = node.style.position;
	const originalOverflow = node.style.overflow;
	const originalTransition = node.style.transition;
	const originalHeight = node.style.height;
	node.style.position = "relative";
	node.style.overflow = "hidden";

	const setChildLayout = (activeChild: Element | null) => {
		for (const childElement of node.children) {
			const childStyle = childElement as HTMLElement;
			if (childElement === activeChild) {
				childStyle.style.position = "relative";
				childStyle.style.top = "";
				childStyle.style.left = "";
				childStyle.style.width = "";
			} else {
				childStyle.style.position = "absolute";
				childStyle.style.top = "0";
				childStyle.style.left = "0";
				childStyle.style.width = "100%";
			}
		}
	};

	const updateHeight = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			const activeChild = node.lastElementChild;
			setChildLayout(activeChild);

			if (!activeChild) {
				node.style.height = "";
				settledHeight = undefined;
				return;
			}

			const childChanged = activeChild !== observedChild;
			if (childChanged) {
				resizeObserver?.disconnect();
				observedChild = activeChild;
				resizeObserver?.observe(activeChild);
			}

			const nextHeightValue = activeChild.getBoundingClientRect().height;
			const currentHeight = node.getBoundingClientRect().height;
			const startHeight = childChanged
				? node.style.height === "auto"
					? (settledHeight ?? currentHeight)
					: currentHeight
				: currentHeight;
			if (Math.abs(startHeight - nextHeightValue) < 1) {
				settledHeight = nextHeightValue;
				node.style.height = "auto";
				return;
			}

			clearTimeout(releaseTimer);
			node.style.transition = `height ${transitionDuration}ms ${easing}`;
			node.style.height = `${startHeight}px`;
			requestAnimationFrame(() => {
				node.style.height = `${nextHeightValue}px`;
				releaseTimer = window.setTimeout(() => {
					settledHeight = nextHeightValue;
					node.style.height = "auto";
				}, transitionDuration);
			});
		});
	};

	resizeObserver = new ResizeObserver(updateHeight);
	// eslint-disable-next-line prefer-const
	mutationObserver = new MutationObserver(updateHeight);
	mutationObserver.observe(node, { childList: true });
	updateHeight();

	return {
		update(nextOptions: HeightTransitionOptions = {}) {
			transitionDuration = nextOptions.duration ?? duration;
			easing = nextOptions.easing ?? transition;
			updateHeight();
		},
		destroy() {
			cancelAnimationFrame(frame);
			clearTimeout(releaseTimer);
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			node.style.position = originalPosition;
			node.style.height = originalHeight;
			node.style.overflow = originalOverflow;
			node.style.transition = originalTransition;
			for (const child of node.children) {
				const childStyle = child as HTMLElement;
				childStyle.style.position = "";
				childStyle.style.top = "";
				childStyle.style.left = "";
				childStyle.style.width = "";
			}
		},
	};
}

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
