<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import { GITHUB_URL_VERTD } from "$lib/consts";
	import { ServerIcon } from "lucide-svelte";
	import type { ISettings } from "./index.svelte";
	import clsx from "clsx";
	import Dropdown from "$lib/components/functional/Dropdown.svelte";

	let vertdCommit = $state<string | null>(null);
	let abortController: AbortController | null = null;

	const { settings }: { settings: ISettings } = $props();

	$effect(() => {
		if (settings.vertdURL) {
			if (abortController) abortController.abort();
			abortController = new AbortController();
			const { signal } = abortController;

			vertdCommit = "loading";
			fetch(`${settings.vertdURL}/api/version`, { signal })
				.then((res) => {
					if (!res.ok) throw new Error("bad response");
					return res.json();
				})
				.then((data) => {
					vertdCommit = data.data;
				})
				.catch((err) => {
					if (err.name !== "AbortError") vertdCommit = null;
				});
		} else {
			if (abortController) abortController.abort();
			vertdCommit = null;
		}

		return () => {
			if (abortController) abortController.abort();
		};
	});
</script>

<Panel class="flex flex-col gap-8 p-6">
	<div class="flex flex-col gap-3">
		<h2 class="text-2xl font-bold">
			<ServerIcon
				size="40"
				class="inline-block -mt-1 mr-2 bg-accent-red p-2 rounded-full overflow-visible"
				color="black"
			/>
			Converting Video
		</h2>
		<p
			class={clsx("text-sm font-normal", {
				"text-failure": vertdCommit === null,
				"text-green-700 dynadark:text-green-300": vertdCommit !== null,
				"!text-muted": vertdCommit === "loading",
			})}
		>
			status: {vertdCommit
				? vertdCommit === "loading"
					? "loading..."
					: `available, commit id ${vertdCommit}`
				: "unavailable (is the url right?)"}
		</p>
		<div class="flex flex-col gap-8">
			<div class="flex flex-col gap-4">
				<p class="text-sm text-muted font-normal">
					The <code>vertd</code> project is a server wrapper for FFmpeg.
					This allows you to convert videos through the convenience of
					VERT's web interface, while still being able to harness the power
					of your GPU to do it as quickly as possible.
				</p>
				<p class="text-sm text-muted font-normal">
					We currently don't provide a hosted instance due to the
					upkeep costs. However, it's quite easy to host one on your
					own PC or server if you know what you're doing. You can
					download the server binaries <a
						href={GITHUB_URL_VERTD}
						target="_blank">here</a
					>. The process of setting this up will become easier in the
					future, so stay tuned!
				</p>
				<div class="flex flex-col gap-2">
					<p class="text-base font-bold">Instance URL</p>
					<input
						type="text"
						placeholder="Example: http://localhost:24153"
						bind:value={settings.vertdURL}
					/>
				</div>
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<p class="text-base font-bold">Conversion speed</p>
						<p class="text-sm text-muted font-normal">
							This describes the tradeoff between speed and
							quality. Faster speeds will result in lower quality,
							but will get the job done quicker.
						</p>
					</div>
					<Dropdown
						options={[
							"Very Slow",
							"Slower",
							"Slow",
							"Medium",
							"Fast",
							"Ultra Fast",
						]}
						settingsStyle
						selected={(() => {
							switch (settings.vertdSpeed) {
								case "verySlow":
									return "Very Slow";
								case "slower":
									return "Slower";
								case "slow":
									return "Slow";
								case "medium":
									return "Medium";
								case "fast":
									return "Fast";
								case "ultraFast":
									return "Ultra Fast";
							}
						})()}
						onselect={(selected) => {
							switch (selected) {
								case "Very Slow":
									settings.vertdSpeed = "verySlow";
									break;
								case "Slower":
									settings.vertdSpeed = "slower";
									break;
								case "Slow":
									settings.vertdSpeed = "slow";
									break;
								case "Medium":
									settings.vertdSpeed = "medium";
									break;
								case "Fast":
									settings.vertdSpeed = "fast";
									break;
								case "Ultra Fast":
									settings.vertdSpeed = "ultraFast";
									break;
							}
						}}
					/>
				</div>
			</div>
		</div>
	</div>
</Panel>
