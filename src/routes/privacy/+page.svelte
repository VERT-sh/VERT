<script lang="ts">
	import { m } from "#lib/paraglide/messages";
	import { link, sanitize } from "#lib/store/index.svelte";
	import { ShieldCheckIcon } from "@lucide/svelte";
</script>

<div class="flex h-full flex-col items-center">
	<h1 class="mb-6 hidden text-[40px] leading-[72px] tracking-tight md:block">
		<ShieldCheckIcon size="40" class="-mt-2 mr-2 inline-block" />
		{m["privacy.title"]()}
	</h1>

	<div
		class="flex w-full max-w-[1280px] flex-col gap-4 p-4 md:flex-row md:px-4 md:py-0"
	>
		<div class="rounded-2xl bg-panel p-6 text-lg font-normal shadow-panel">
			<h2 class="mb-3 text-2xl">{m["privacy.summary.title"]()}</h2>
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

			<h2 class="mb-3 text-2xl">{m["privacy.conversions.title"]()}</h2>
			<p class="mb-4">
				{@html sanitize(m["privacy.conversions.description"]())}
			</p>

			<h2 class="mb-3 text-2xl">{m["privacy.donations.title"]()}</h2>
			<p class="mb-4">
				{@html sanitize(
					link(
						["about_link", "stripe_link"],
						m["privacy.donations.description"](),
						[
							"/about",
							"https://stripe.com/docs/disputes/prevention/advanced-fraud-detection",
						],
						[false, true],
					),
				)}
			</p>

			<h2 class="mb-3 text-2xl">
				{m["privacy.conversion_errors.title"]()}
			</h2>
			<div class="mb-4">
				{m["privacy.conversion_errors.description"]()}
				<ul class="mb-2 mt-2 list-inside list-disc">
					<li>{m["privacy.conversion_errors.list_job_id"]()}</li>
					<li>{m["privacy.conversion_errors.list_format_from"]()}</li>
					<li>{m["privacy.conversion_errors.list_format_to"]()}</li>
					<li>{m["privacy.conversion_errors.list_stderr"]()}</li>
					<li>{m["privacy.conversion_errors.list_video"]()}</li>
				</ul>
				{m["privacy.conversion_errors.footer"]()}
			</div>

			<h2 class="mb-2 mt-4 text-2xl">{m["privacy.analytics.title"]()}</h2>
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

			<h2 class="mb-2 mt-4 text-2xl">{m["privacy.debugging.title"]()}</h2>
			<p class="mb-4">
				{@html link(
					["settings_link"],
					m["privacy.debugging.description"](),
					["/settings"],
					[false],
				)}
			</p>

			<h2 class="mb-2 mt-4 text-2xl">
				{m["privacy.local_storage.title"]()}
			</h2>
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

			<h2 class="mb-2 mt-4 text-2xl">{m["privacy.contact.title"]()}</h2>
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

			<p class="mt-6 text-sm text-muted">{m["privacy.last_updated"]()}</p>
		</div>
	</div>
</div>
