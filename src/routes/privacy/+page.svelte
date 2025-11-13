<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import { link, sanitize } from "$lib/store/index.svelte";
	import { ShieldCheckIcon } from "lucide-svelte";
</script>

<div class="flex flex-col h-full items-center">
	<h1 class="hidden md:block text-[40px] tracking-tight leading-[72px] mb-6">
		<ShieldCheckIcon size="40" class="inline-block -mt-2 mr-2" />
		{m["privacy.title"]()}
	</h1>

	<div
		class="w-full max-w-[1280px] flex flex-col md:flex-row gap-4 p-4 md:px-4 md:py-0"
	>
		<div class="bg-panel rounded-2xl p-6 shadow-panel text-lg font-normal">
			<h2 class="text-2xl mb-3">{m["privacy.summary.title"]()}</h2>
			<p class="mb-4">
				{@html sanitize(
					link(
						["vert_link"],
						m["privacy.summary.description"](),
						["https://vert.sh"],
						[true],
					),
				)}
			</p>

			<h2 class="text-2xl mb-3">{m["privacy.conversions.title"]()}</h2>
			<p class="mb-4">
				{@html sanitize(m["privacy.conversions.description"]())}
			</p>

			<h2 class="text-2xl mb-3">{m["privacy.donations.title"]()}</h2>
			<p class="mb-4">
				{@html sanitize(
					link(
						["about_link", "stripe_link"],
						m["privacy.donations.description"](),
						["/about", "https://stripe.com/docs/disputes/prevention/advanced-fraud-detection"],
						[false, true],
					),
				)}
			</p>

			<h2 class="text-2xl mb-3">
				{m["privacy.conversion_errors.title"]()}
			</h2>
			<div class="mb-4">
				{m["privacy.conversion_errors.description"]()}
				<ul class="list-disc list-inside mt-2 mb-2">
					<li>{m["privacy.conversion_errors.list_job_id"]()}</li>
					<li>{m["privacy.conversion_errors.list_format_from"]()}</li>
					<li>{m["privacy.conversion_errors.list_format_to"]()}</li>
					<li>{m["privacy.conversion_errors.list_stderr"]()}</li>
					<li>{m["privacy.conversion_errors.list_video"]()}</li>
				</ul>
				{m["privacy.conversion_errors.footer"]()}
			</div>

			<h3 class="text-xl mt-4 mb-2">{m["privacy.analytics.title"]()}</h3>
			<p class="mb-4">
				{@html sanitize(
					link(
						["settings_link", "plausible_link"],
						m["privacy.analytics.description"](),
						[
							"/settings",
							"https://plausible.io/privacy-focused-web-analytics",
						],
						[false, true],
					),
				)}
			</p>

			<h3 class="text-xl mt-4 mb-2">
				{m["privacy.local_storage.title"]()}
			</h3>
			<p class="mb-4">
				{@html sanitize(
					link(
						["settings_link"],
						m["privacy.local_storage.description"](),
						["/settings"],
						[false],
					),
				)}
			</p>

			<h3 class="text-xl mt-4 mb-2">{m["privacy.contact.title"]()}</h3>
			<p class="mb-0">
				{@html sanitize(
					link(
						["email_link"],
						m["privacy.contact.description"](),
						["mailto:hello@vert.sh"],
						[false],
					),
				)}
			</p>

			<p class="text-sm text-muted mt-6">{m["privacy.last_updated"]()}</p>
		</div>
	</div>
</div>
