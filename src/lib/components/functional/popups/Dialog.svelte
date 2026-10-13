<script lang="ts">
	import { duration, fade, fly } from "#lib/util/animation";
	import { removeDialog } from "#lib/store/DialogProvider";
	import {
		BanIcon,
		CheckIcon,
		InfoIcon,
		TriangleAlertIcon,
	} from "@lucide/svelte";
	import { quintOut } from "svelte/easing";
	import type { Dialog as DialogType } from "#lib/store/DialogProvider";
	import clsx from "clsx";

	type Props = DialogType;

	let props: Props = $props();
	// svelte-ignore state_referenced_locally
	const { id, title, message, buttons, type } = props;
	// svelte-ignore state_referenced_locally
	const additional = "additional" in props ? props.additional : undefined;

	const colors = {
		success: "purple",
		error: "red",
		info: "blue",
		warning: "pink",
	};

	const Icons = {
		success: CheckIcon,
		error: BanIcon,
		info: InfoIcon,
		warning: TriangleAlertIcon,
	};

	let color = $derived(colors[type]);
	let Icon = $derived(Icons[type]);
</script>

<div
	class="flex w-full max-w-md flex-col items-center justify-between gap-6 bg-panel p-4 border-accent-{color}-alt rounded-lg shadow-md"
	in:fly={{
		duration,
		easing: quintOut,
		x: 0,
		y: 100,
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
		</div>
	</div>
	<div class="flex w-full flex-col gap-1">
		{#if typeof message === "string"}
			<p class="whitespace-pre-wrap text-sm font-normal text-muted">
				{message}
			</p>
		{:else}
			{@const MessageComponent = message}
			<div class="text-sm font-normal text-muted">
				<MessageComponent {id} {title} {type} {buttons} {additional} />
			</div>
		{/if}
	</div>
	<div class="flex w-full flex-row items-center justify-between gap-4">
		{#each buttons as { text, action }, i (`${i}-${text}`)}
			<button
				class={clsx(
					"flex w-full items-center justify-center gap-2 rounded-md p-2 px-6 duration-200 hover:scale-105 active:scale-100",
					i === 1
						? `bg-accent-${color} text-black`
						: "bg-button text-black dynadark:text-white",
				)}
				onclick={() => {
					action();
					removeDialog(id);
				}}
			>
				{text}
			</button>
		{/each}
	</div>
</div>
