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
</script>

<div class="flex flex-col gap-2">
	<p>{@html sanitize(m["convert.errors.vertd_details_body"]())}</p>
	<p>
		<span class="text-black dynadark:text-white">
			{@html sanitize(m["convert.errors.vertd_details_job_id"]({
				jobId: additional.jobId,
			}))}
		</span>
	</p>
	<p>
		<span class="text-black dynadark:text-white">
			{@html sanitize(m["convert.errors.vertd_details_from"]({
				from: additional.from,
			}))}
		</span>
	</p>
	<p>
		<span class="text-black dynadark:text-white">
			{@html sanitize(m["convert.errors.vertd_details_to"]({ to: additional.to }))}
		</span>
	</p>
	<p>
		<span class="text-black dynadark:text-white">
			{@html sanitize(link(
				["view_link"],
				m["convert.errors.vertd_details_error_message"](),
				[
					URL.createObjectURL(
						new Blob([additional.errorMessage], {
							type: "text/plain",
						}),
					),
				],
				[true],
				["text-blue-500 font-normal"],
			))}
		</span>
	</p>
	<p>
		{@html sanitize(link(
			["privacy_link"],
			m["convert.errors.vertd_details_footer"](),
			"/privacy",
			[true],
		))}
	</p>
</div>
