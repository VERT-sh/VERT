<script lang="ts">
	import { browser } from "$app/env";
	import { error, log } from "#lib/util/logger.svelte";
	import * as Settings from "#lib/sections/settings/index.svelte";
	import { SettingsIcon } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { m } from "#lib/paraglide/messages";
	import { ToastManager } from "#lib/util/toast.svelte";
	import { DISABLE_ALL_EXTERNAL_REQUESTS } from "#lib/util/consts";
	import { readSettings } from "#lib/util/settings";

	let settings = $state(Settings.Settings.instance.settings);

	let isInitial = $state(true);

	const readSavedSettings = () => {
		const parsed = readSettings<typeof settings>();
		return Object.keys(parsed).length ? parsed : null;
	};

	$effect(() => {
		if (!browser) return;
		if (isInitial) {
			isInitial = false;
			return;
		}

		const parsedSettings = readSavedSettings();
		if (
			parsedSettings &&
			JSON.stringify(parsedSettings) === JSON.stringify(settings)
		)
			return;

		try {
			Settings.Settings.instance.settings = settings;
			Settings.Settings.instance.save();
			log(["settings"], "saving settings");
		} catch (e) {
			error(["settings", "error"], `failed to save settings: ${e}`);
			ToastManager.add({
				type: "error",
				message: m["settings.errors.save_failed"](),
			});
		}
	});

	onMount(() => {
		const parsedSettings = readSavedSettings();
		if (parsedSettings) {
			Settings.Settings.instance.settings = {
				...Settings.Settings.instance.settings,
				...parsedSettings,
			};
			settings = Settings.Settings.instance.settings;
		}
	});
</script>

<div class="flex h-full flex-col items-center">
	<h1 class="mb-6 hidden text-[40px] leading-[72px] tracking-tight md:block">
		<SettingsIcon size="40" class="-mt-2 mr-2 inline-block" />
		{m["settings.title"]()}
	</h1>

	<div
		class="flex w-full max-w-[1280px] flex-col gap-4 p-4 md:flex-row md:px-4 md:py-0"
	>
		<div class="flex flex-1 flex-col gap-4">
			<Settings.Conversion bind:settings />
			{#if !DISABLE_ALL_EXTERNAL_REQUESTS}
				<Settings.Vertd bind:settings />
			{:else}
				<Settings.Privacy bind:settings />
			{/if}
		</div>

		<div class="flex flex-1 flex-col gap-4">
			<Settings.Appearance />
			{#if !DISABLE_ALL_EXTERNAL_REQUESTS}
				<Settings.Privacy bind:settings />
			{/if}
		</div>
	</div>
</div>
