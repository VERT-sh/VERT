<script lang="ts">
	import { SearchIcon } from "lucide-svelte";
	import Dropdown from "./Dropdown.svelte";
	import FancyInput from "./FancyInput.svelte";
	import Modal from "./Modal.svelte";
	import { m } from "$lib/paraglide/messages";
	import type { VertFile } from "$lib/types";
	import { sanitize } from "$lib/store/index.svelte";
	import { log } from "$lib/util/logger";
	import { type ConversionSettings } from "$lib/types/conversion-settings";

	type Props = {
		file: VertFile | null;
		onclose?: () => void;
	};

	let { file, onclose }: Props = $props();

	let settings = $state<ConversionSettings>({});

	const handleSettingChange = (key: string, value: any) => {
		if (!file) return;
		settings[key] = value;
	};

	const applySettings = async () => {
		onclose?.();
		if (!file) return;
		const converter = file.findConverter();
		if (!converter) {
			log(
				["settings", "modal"],
				`No converter found for ${file.name}, cannot apply settings`,
			);
			return;
		}
		// apply defaults, then existing settings, then new settings on top
		file.conversionSettings = {
			...(await converter.getDefaultSettings()),
			...file.conversionSettings,
			...settings,
		};
		log(
			["settings", "modal"],
			`Applied settings for ${file.name}: ${JSON.stringify(file.conversionSettings, null, 2)}`,
		);
	};
</script>

<Modal
	icon={SearchIcon}
	title={m["convert.settings.title"]()}
	color="purple"
	buttons={[
		{
			text: "Cancel",
			action: () => onclose?.(),
		},
		{
			text: "Apply",
			action: applySettings,
			primary: true,
		},
	]}
	onclose={() => onclose?.()}
>
	<div class="flex flex-col gap-8">
		{#if file}
			{#await file.getAvailableSettings() then settings}
				<div class="flex flex-col gap-4">
					<p class="text-base">
						{@html sanitize(
							m["convert.settings.description"]({
								converter:
									file.findConverter()?.name || "unknown",
								filename: file.name,
							}),
						)}
					</p>

					{#if settings.length === 0}
						<p class="text-sm text-muted">
							{m["convert.settings.none"]()}
						</p>
					{:else}
						<div class="grid grid-cols-2 gap-4">
							{#each settings as setting (setting.key)}
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{setting.label}
									</p>
									<!-- prob unneeded -->
									{#if setting.description}
										<p class="text-xs text-muted">
											{setting.description}
										</p>
									{/if}

									{#if setting.type === "select"}
										<Dropdown
											options={setting.options?.map(
												(opt) => opt.value,
											) || []}
											selected={file.conversionSettings[
												setting.key
											] ?? setting.default}
											settingsStyle
											onselect={(value) =>
												handleSettingChange(
													setting.key,
													value,
												)}
										/>
									{:else if setting.type === "boolean"}
										<FancyInput
											type="checkbox"
											checked={file.conversionSettings[
												setting.key
											] ?? setting.default}
											placeholder={setting.placeholder}
											onchange={(e) =>
												handleSettingChange(
													setting.key,
													e.currentTarget.checked,
												)}
										/>
									{:else}
										<FancyInput
											type={setting.type}
											value={file.conversionSettings[
												setting.key
											] ?? setting.default}
											placeholder={setting.placeholder}
											oninput={(e) =>
												handleSettingChange(
													setting.key,
													e.currentTarget.value,
												)}
										/>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/await}
		{/if}
	</div>
</Modal>
