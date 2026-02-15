<script lang="ts">
	import { SearchIcon } from "lucide-svelte";
	import Dropdown from "./Dropdown.svelte";
	import FancyInput from "./FancyInput.svelte";
	import Modal from "./Modal.svelte";
	import { m } from "$lib/paraglide/messages";
	import type { VertFile } from "$lib/types";

	type Props = {
		file: VertFile | null;
		onclose?: () => void;
	};

	let { file, onclose }: Props = $props();

	let settings = $state<Record<string, any>>({});

	const handleSettingChange = (key: string, value: any) => {
		if (!file) return;
		settings[key] = value;
		console.log(
			`Changed settings for ${file.name}: ${JSON.stringify(settings, null, 2)}`,
		);
	};

	const applySettings = () => {
		onclose?.();
		if (!file) return;
		file.conversionSettings = { ...file.conversionSettings, ...settings };
		console.log(
			`Applied settings for ${file.name}: ${JSON.stringify(file.conversionSettings, null, 2)}`,
		);
	};
</script>

<Modal
	icon={SearchIcon}
	title="Conversion Settings"
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
		{#if !file}
			<p class="text-sm text-muted">No file selected</p>
		{:else}
			{@const settings = file.getAvailableSettings()}
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<p class="text-base font-bold">
						{m["settings.conversion.title"]?.() ||
							"Conversion Settings"}
					</p>
					<p class="text-sm text-muted font-normal">
						{m["settings.conversion.description"]?.() ||
							`Configure conversion options for ${file.name}`}
					</p>
				</div>

				{#if settings.length === 0}
					<p class="text-sm text-muted">
						{m["settings.conversion.no_settings"]?.() ||
							"No settings available for this converter"}
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
		{/if}
	</div>
</Modal>
