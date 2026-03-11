<script lang="ts" module>
	export interface ServerUploadWarningProps {
		filename: string;
		onProceed: () => void;
		onCancel: () => void;
		onDontShowAgain: () => void;
	}
</script>

<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import type { ToastProps } from "$lib/util/toast.svelte";

	const toast: ToastProps<ServerUploadWarningProps> = $props();

	export const title = m["convert.external_warning.title"]();
</script>

<div class="flex flex-col gap-4">
	<p class="text-black">
		{m["convert.external_warning.text"]({
            filename: toast.additional.filename,
        })}
	</p>
	<div class="flex flex-col gap-2">
		<button
			onclick={toast.additional.onDontShowAgain}
			class="btn rounded-lg h-fit py-2 w-full bg-accent-blue text-black"
		>
			{m["convert.external_warning.dont_show_again"]()}
		</button>
		<div class="flex gap-4">
			<button
				onclick={toast.additional.onProceed}
				class="btn rounded-lg h-fit py-2 w-full bg-accent-red-alt text-white"
			>
				{m["convert.external_warning.yes"]()}
			</button>
			<button
				onclick={toast.additional.onCancel}
				class="btn rounded-lg h-fit py-2 w-full"
			>
				{m["convert.external_warning.no"]()}
			</button>
		</div>
	</div>
</div>
