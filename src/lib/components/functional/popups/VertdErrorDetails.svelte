<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import type { DialogProps } from "$lib/store/DialogProvider";
	import { link, sanitize } from "$lib/store/index.svelte";

	interface VertdErrorDetailsProps {
		jobId: string;
		from: string;
		to: string;
		errorMessage: string;
	}

	type Props = DialogProps<VertdErrorDetailsProps>;

	let { additional }: Props = $props();
	let errorBlobUrl = $state("");

	$effect(() => {
		if (!additional.errorMessage) {
			errorBlobUrl = "";
			return;
		}

		const nextUrl = URL.createObjectURL(
			new Blob([additional.errorMessage], {
				type: "text/plain",
			}),
		);
		errorBlobUrl = nextUrl;

		return () => {
			URL.revokeObjectURL(nextUrl);
		};
	});
</script>

<div class="flex flex-col gap-2">
	<p>{@html sanitize(m["convert.errors.vertd.details.body"]())}</p>
	<p>
		<span class="text-black dynadark:text-white">
			{@html sanitize(m["convert.errors.vertd.details.job_id"]({
				jobId: additional.jobId,
			}))}
		</span>
	</p>
	<p>
		<span class="text-black dynadark:text-white">
			{@html sanitize(m["convert.errors.vertd.details.from"]({
				from: additional.from,
			}))}
		</span>
	</p>
	<p>
		<span class="text-black dynadark:text-white">
			{@html sanitize(m["convert.errors.vertd.details.to"]({ to: additional.to }))}
		</span>
	</p>
	<p>
		<span class="text-black dynadark:text-white">
			{@html sanitize(link(
				["view_link"],
				m["convert.errors.vertd.details.error_message"](),
				[errorBlobUrl || "#"],
				[true],
				["text-blue-500 font-normal"],
			))}
		</span>
	</p>
	<p>
		{@html sanitize(link(
			["privacy_link"],
			m["convert.errors.vertd.details.footer"](),
			"/privacy",
			[true],
		))}
	</p>
</div>
