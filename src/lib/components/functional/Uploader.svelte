<script lang="ts">
	import { UploadIcon } from "@lucide/svelte";
	import Panel from "../visual/Panel.svelte";
	import clsx from "clsx";
	import { onMount } from "svelte";
	import { effects, files } from "#lib/store/index.svelte";
	import { goto } from "$app/navigation";
	import { m } from "#lib/paraglide/messages";

	type Props = {
		class?: string;
	};

	const { class: classList }: Props = $props();

	let uploaderButton = $state<HTMLButtonElement>();
	let fileInput = $state<HTMLInputElement>();

	const uploadFiles = async () => {
		if (!fileInput) return;
		fileInput.click();
	};

	const handleFileChange = async () => {
		if (!fileInput) return;
		const oldLength = files.files.length;
		await files.addAsync(fileInput.files);
		if (files.files.length !== oldLength) goto("/convert");
	};

	onMount(() => {
		const handler = (e: Event) => {
			e.preventDefault();
			return false;
		};

		uploaderButton?.addEventListener("dragover", handler);
		uploaderButton?.addEventListener("dragenter", handler);
		uploaderButton?.addEventListener("dragleave", handler);
		uploaderButton?.addEventListener("drop", handler);

		return () => {
			uploaderButton?.removeEventListener("dragover", handler);
			uploaderButton?.removeEventListener("dragenter", handler);
			uploaderButton?.removeEventListener("dragleave", handler);
			uploaderButton?.removeEventListener("drop", handler);
		};
	});
</script>

<input
	bind:this={fileInput}
	type="file"
	multiple
	class="hidden"
	onchange={handleFileChange}
/>

<button
	onclick={uploadFiles}
	bind:this={uploaderButton}
	class={clsx(
		"duration-200 hover:scale-105 active:scale-100",
		!$effects && "!scale-100",
		classList,
	)}
>
	<Panel
		class="pointer-events-none flex h-full w-full flex-col items-center justify-center"
	>
		<div
			class="flex h-16 w-16 items-center justify-center rounded-full bg-accent p-4"
		>
			<UploadIcon class="h-full w-full text-on-accent" />
		</div>
		<h2 class="mt-4 text-center text-2xl font-semibold">
			{m["upload.uploader.text"]({
				action: m["upload.uploader.convert"](),
			})}
		</h2>
	</Panel>
</button>
