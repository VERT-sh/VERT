<script lang="ts">
	import { UploadIcon } from "lucide-svelte";
	import Panel from "../visual/Panel.svelte";
	import clsx from "clsx";
	import { onMount } from "svelte";
	import { effects, files } from "$lib/store/index.svelte";
	import { converters } from "$lib/converters";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { m } from "$lib/paraglide/messages";

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

	const handleFileChange = (e: Event) => {
		if (!fileInput) return;
		const oldLength = files.files.length;
		files.add(fileInput.files);
		if (oldLength !== files.files.length) goto("/convert");
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
		`hover:scale-105 active:scale-100 ${$effects ? "" : "!scale-100"} duration-200 ${classList}`,
	)}
>
	<Panel
		class="flex justify-center items-center w-full h-full flex-col pointer-events-none"
	>
		<div
			class="w-16 h-16 bg-accent rounded-full flex items-center justify-center p-4"
		>
			<UploadIcon class="w-full h-full text-on-accent" />
		</div>
		<h2 class="text-center text-2xl font-semibold mt-4">
			{m["upload.uploader.text"]({
				action: m["upload.uploader.convert"]()
			})}
		</h2>
	</Panel>
</button>
