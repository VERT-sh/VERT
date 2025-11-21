<script lang="ts" module>
	export interface VertdErrorProps {
		jobId: string;
		auth: string;
		from?: string;
		to?: string;
		errorMessage?: string;
		fileName?: string;
	}
</script>

<script lang="ts">
	import { vertdFetch } from "$lib/converters/vertd.svelte";

	import { m } from "$lib/paraglide/messages";
	import { ToastManager, type ToastProps } from "$lib/util/toast.svelte";
	import { addDialog } from "$lib/store/DialogProvider";
	import VertdErrorDetails from "./VertdErrorDetails.svelte";

	const toast: ToastProps<VertdErrorProps> = $props();

	let submitting = $state(false);

	export const title = "An error occurred";

	const remove = () => {
		ToastManager.remove(toast.id);
	};

	const submit = async () => {
		submitting = true;
		try {
			await submitInner();
		} catch (e) {}
		submitting = false;
	};

	const submitInner = async () => {
		try {
			await vertdFetch(
				"/api/keep",
				{
					method: "POST",
				},
				{
					token: toast.additional.auth,
					id: toast.additional.jobId,
				},
			);
		} catch (e) {
			ToastManager.add({
				type: "error",
				message: m["convert.errors.vertd_failed_to_keep"]({
					error: (e as Error).message || e || "Unknown error",
				}),
			});
		}

		ToastManager.remove(toast.id);
	};

	const showDetails = () => {
		addDialog(
			m["convert.errors.vertd_details"](),
			VertdErrorDetails as any,
			[
				{
					text: "Close",
					action: () => {},
				},
			],
			"info",
			{
				jobId: toast.additional.jobId || "Unknown",
				from: toast.additional.from || "Unknown",
				to: toast.additional.to || "Unknown",
				errorMessage: toast.additional.errorMessage || "Unknown error",
			},
		);
	};
</script>

<div class="flex flex-col gap-4">
	<p class="text-black">{m["convert.errors.vertd_generic_body"]()}</p>
	<div class="flex flex-col gap-2">
		<button
			onclick={showDetails}
			class="btn rounded-lg h-fit py-2 w-full bg-accent-blue text-black"
			disabled={submitting}
			>{m["convert.errors.vertd_generic_view"]()}</button
		>
		<div class="flex gap-4">
			<button
				onclick={submit}
				class="btn rounded-lg h-fit py-2 w-full bg-accent-red-alt text-white"
				disabled={submitting}
				>{m["convert.errors.vertd_generic_yes"]()}</button
			>
			<button
				onclick={remove}
				class="btn rounded-lg h-fit py-2 w-full"
				disabled={submitting}
				>{m["convert.errors.vertd_generic_no"]()}</button
			>
		</div>
	</div>
</div>
