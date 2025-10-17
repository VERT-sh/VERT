<script lang="ts">
	import { m } from "$lib/paraglide/messages";
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
			<h2 class="text-2xl mb-3">Summary</h2>
			<p class="mb-4">
				VERT's privacy policy is very simple: we do not collect or store
				any data on you at all. We don't use cookies or trackers,
				analytics are completely private, and all conversions (except
				videos) happen locally on your browser. Videos are deleted after
				being downloaded, or an hour, unless explicitly given permission
				by you to be stored; it will only be used for the purpose of
				troubleshooting. VERT self-hosts a Coolify instance for hosting
				the website and vertd (for video conversion), and a Plausible
				instance for completely anonymous and aggregated analytics.
				<br />
				<br />
				Note this may only apply to the official VERT instance at
				<a href="https://vert.sh" class="underline">vert.sh</a>;
				third-party instances may handle your data differently.
			</p>

			<h2 class="text-2xl mb-3">Conversions</h2>
			<p class="mb-4">
				Most conversions (images, documents, audio) happen entirely
				locally on your device using WebAssembly versions of the
				relevant tools (e.g. ImageMagick, Pandoc, FFmpeg). This means
				your files never leave your device and we will never have access
				to them.
				<br />
				<br />
				Video conversions are performed on our servers because they require
				more processing power and cannot be done very quickly on the browser
				yet. Videos you convert with VERT are deleted after being downloaded,
				or after one hour, unless you explicitly give permission for us to
				store them longer purely for troubleshooting purposes.
			</p>

			<h2 class="text-2xl mb-3">Conversion Errors</h2>
			<div class="mb-4">
				When a video conversion fails, we may collect some anonymous
				data to help us diagnose the issue. This data may include:
				<ul class="list-disc list-inside mt-2 mb-2">
					<li>The job ID, which is the anonymized file name</li>
					<li>The format you converted from</li>
					<li>The format you converted to</li>
					<li>
						The FFmpeg stderr output of your job (error message)
					</li>
					<li>
						The actual video file (if given explicit permission)
					</li>
				</ul>
				This information is used solely for the purpose of diagnosing conversion
				issues. The actual video file will only ever be collected if you
				give us permission to do so, where it will only be used for troubleshooting.
			</div>

			<h3 class="text-xl mt-4 mb-2">Analytics</h3>
			<p class="mb-4">
				We self-host a Plausible instance for completely anonymous and
				aggregated analytics. Plausible does not use cookies and
				complies with all major privacy regulations (GDPR/CCPA/PECR).
				You can opt out of analytics in the "Privacy & data" section in <a
					href="/settings"
					class="underline">settings</a
				>
				and read more about Plausible's privacy practices
				<a
					href="https://plausible.io/privacy-focused-web-analytics"
					class="underline">here</a
				>.
			</p>

			<h3 class="text-xl mt-4 mb-2">Local Storage</h3>
			<p class="mb-4">
				We use your browser's local storage to save your settings, and
				your browser's session storage to temporarily store the GitHub
				contributors list for the "About" section to reduce repeated
				GitHub API requests. No personal data is stored or transmitted.
				<br />
				<br />
				The WebAssembly versions of the conversion tools we use (FFmpeg,
				ImageMagick, Pandoc) are also stored locally on your browser when
				you first visit the website, so you don’t need to redownload them
				each visit. No personal data is stored or transmitted. You may view
				or delete this data at any time in the "Privacy & data" section in
				<a href="/settings" class="underline">settings</a>.
			</p>

			<h3 class="text-xl mt-4 mb-2">Contact</h3>
			<p class="mb-0">
				For questions, email us at: <a
					href="mailto:hello@vert.sh"
					class="underline">hello@vert.sh</a
				>. If you are using a third-party instance of VERT, please
				contact the hoster of that instance instead.
			</p>

			<p class="text-sm text-muted mt-6">Last updated: 2025-10-16</p>
		</div>
	</div>
</div>
