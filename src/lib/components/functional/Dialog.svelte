<script lang="ts">
	import { duration, fade, fly } from "$lib/util/animation";
	import { removeDialog } from "$lib/store/DialogProvider";
	import { BanIcon, CheckIcon, InfoIcon, TriangleAlert } from "lucide-svelte";
	import { quintOut } from "svelte/easing";
	import type { Dialog as DialogType } from "$lib/store/DialogProvider";

	type Props = DialogType;

	let props: Props = $props();
	const { id, title, message, buttons, type } = props;
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
		warning: TriangleAlert,
	};

	let color = $derived(colors[type]);
	let Icon = $derived(Icons[type]);
</script>

<div
	class="flex flex-col items-center justify-between w-full max-w-sm p-4 gap-6 bg-panel border-accent-{color}-alt rounded-lg shadow-md"
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
	<div class="flex flex-col gap-1 w-full">
		{#if typeof message === "string"}
			<p class="text-sm font-normal text-muted whitespace-pre-wrap">{message}</p>
		{:else}
			{@const MessageComponent = message}
			<div class="text-sm font-normal text-muted">
				<MessageComponent {id} {title} {type} {buttons} {additional} />
			</div>
		{/if}
	</div>
	<div class="flex flex-row items-center gap-4 w-full">
		{#each buttons as { text, action }, i}
			<button
				class="hover:scale-105 active:scale-100 duration-200 flex items-center gap-2 p-2 rounded-md {i ===
				1
					? `bg-accent-${color} text-black`
					: 'bg-button text-black dynadark:text-white'} px-6"
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
