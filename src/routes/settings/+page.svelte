<script lang="ts">
	import { browser } from "$app/environment";
	import { log } from "$lib/logger";
	import * as Settings from "$lib/sections/settings/index.svelte";
	import { addToast } from "$lib/store/ToastProvider";
	import { PUB_PLAUSIBLE_URL } from "$env/static/public";
	import { SettingsIcon } from "lucide-svelte";
	import { onMount } from "svelte";

	let settings = $state(Settings.Settings.instance.settings);

	let isInitial = $state(true);

	$effect(() => {
		if (!browser) return;
		if (isInitial) {
			isInitial = false;
			return;
		}

		const savedSettings = localStorage.getItem("settings");
		if (savedSettings) {
			const parsedSettings = JSON.parse(savedSettings);
			if (JSON.stringify(parsedSettings) === JSON.stringify(settings))
				return;
		}

		try {
			Settings.Settings.instance.settings = settings;
			Settings.Settings.instance.save();
			log(["settings"], "saving settings");
		} catch (error) {
			log(["settings", "error"], `failed to save settings: ${error}`);
			addToast("error", "Failed to save settings!");
		}
	});

	onMount(() => {
		const savedSettings = localStorage.getItem("settings");
		if (savedSettings) {
			const parsedSettings = JSON.parse(savedSettings);
			Settings.Settings.instance.settings = {
				...Settings.Settings.instance.settings,
				...parsedSettings,
			};
		}
	});
</script>

<div class="flex flex-col h-full items-center">
	<h1 class="hidden md:block text-[40px] tracking-tight leading-[72px] mb-6">
		<SettingsIcon size="40" class="inline-block -mt-2 mr-2" />
		Settings
	</h1>

	<div
		class="w-full max-w-[1280px] flex flex-col md:flex-row gap-4 p-4 md:px-4 md:py-0"
	>
		<div class="flex flex-col gap-4 flex-1">
			<Settings.Conversion {settings} />
			<Settings.Vertd {settings} />
		</div>

		<div class="flex flex-col gap-4 flex-1">
			<Settings.Language />
			<Settings.Appearance />
			{#if PUB_PLAUSIBLE_URL}
				<Settings.Privacy {settings} />
			{/if}
		</div>
	</div>
</div>
