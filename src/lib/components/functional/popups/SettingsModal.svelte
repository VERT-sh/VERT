<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import { SearchIcon } from "lucide-svelte";
	import Dropdown from "../Dropdown.svelte";
	import FancyInput from "../FancyInput.svelte";
	import Modal from "./Modal.svelte";
	import { m } from "$lib/paraglide/messages";
	import type { VertFile } from "$lib/types";
	import { sanitize } from "$lib/store/index.svelte";
	import { log } from "$lib/util/logger";
	import { type ConversionSettings } from "$lib/types/conversion-settings";
	import { onMount } from "svelte";

	type Props = {
		file: VertFile | null;
		onclose?: () => void;
	};

	let { file, onclose }: Props = $props();

	const getAvailableConverters = (vertFile: VertFile) => {
		return vertFile.isZip()
			? vertFile.converters
			: vertFile.findConverters([vertFile.from, vertFile.to]);
	};

	const getValidConverter = (vertFile: VertFile, converterName?: string) => {
		const available = getAvailableConverters(vertFile);
		const name = converterName || vertFile.conversionSettings.converter;
		return available.find((c) => c.name === name) || available[0];
	};

	let settings = $state<ConversionSettings>({});

	const handleSettingChange = (key: string, value: any) => {
		if (!file) return;
		settings[key] = value;
	};

	const applySettings = async (converterName: string) => {
		if (!file) return;
		const converter = getValidConverter(file, converterName);
		if (!converter) {
			log(
				["settings", "modal"],
				`No converter found for ${file.name}, cannot apply settings`,
			);
			return;
		}
		// apply defaults, then existing settings, then new settings on top
		file.conversionSettings = {
			...(await converter.getDefaultSettings(file)),
			...file.conversionSettings,
			...settings,
		};
		log(
			["settings", "modal"],
			`Applied settings for ${file.name}: ${JSON.stringify(file.conversionSettings, null, 2)}`,
		);
	};

	onMount(() => {
		if (!file) return;

		// always have a converter initialized so we can show its settings
		settings.converter = getValidConverter(file)?.name;
	});
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
			action: () => {
				applySettings(settings.converter!);
				onclose?.();
			},
			primary: true,
		},
	]}
	onclose={() => onclose?.()}
>
	<div class="flex flex-col gap-8 max-h-[calc(100vh-225px)] overflow-y-auto">
		{#if file}
			{@const availableConverters = getAvailableConverters(file)}
			{@const validConverter = getValidConverter(
				file,
				settings.converter,
			)}
			<p class="text-base">
				{@html sanitize(
					m["convert.settings.description"]({
						converter: validConverter?.name || "unknown",
						filename: file.name,
					}),
				)}
			</p>

			<div class="flex flex-col gap-2">
				<p class="text-sm font-bold mb-1">
					{m["convert.settings.converter"]()}
				</p>
				<Dropdown
					options={availableConverters.map((converter) => ({
						value: converter.name,
						label: converter.name,
					}))}
					selected={validConverter?.name}
					settingsStyle
					onselect={(value) => {
						settings.converter = value;
					}}
				/>
			</div>
			{#key settings}
				{#await file.getAvailableSettings(file, settings.converter) then availableSettings}
					<div class="flex flex-col gap-4">
						{#if availableSettings.length === 0}
							<p class="text-sm text-muted">
								{m["convert.settings.none"]()}
							</p>
						{:else}
							<div class="grid grid-cols-2 gap-4">
								{#each availableSettings as setting (setting.key)}
									<div
										class={setting.forceFullWidth
											? "col-span-2"
											: "flex flex-col gap-2"}
									>
										<p class="text-sm font-bold">
											{setting.label}
										</p>
										<!-- prob unneeded -->
										{#if setting.description}
											<p class="text-xs text-muted mt-1">
												{setting.description}
											</p>
										{/if}

										{#if setting.type === "select"}
											<Dropdown
												options={setting.options?.map(
													(opt) =>
														typeof opt === "string"
															? {
																	value: opt,
																	label: opt,
																}
															: opt,
												) || []}
												selected={settings[
													setting.key
												] ??
													file.conversionSettings[
														setting.key
													] ??
													setting.default}
												settingsStyle
												onselect={(value) =>
													handleSettingChange(
														setting.key,
														value,
													)}
												disabled={setting.disabled}
											/>
											{#if setting.hasCustomInput}
												{@const disabled =
													(settings[setting.key] ??
														file.conversionSettings[
															setting.key
														]) !== "custom"}
												<FancyInput
													type="text"
													value={settings[
														setting.customInputKey!
													] ??
														file.conversionSettings[
															setting
																.customInputKey!
														] ??
														""}
													placeholder={setting.placeholder}
													disabled={disabled ||
														setting.disabled}
													oninput={(e) =>
														handleSettingChange(
															setting.customInputKey!,
															e.currentTarget
																.value,
														)}
												/>
											{/if}
										{:else if setting.type === "boolean"}
											<FancyInput
												type="checkbox"
												checked={settings[
													setting.key
												] ??
													file.conversionSettings[
														setting.key
													] ??
													setting.default}
												placeholder={setting.placeholder}
												onchange={(e) =>
													handleSettingChange(
														setting.key,
														e.currentTarget.checked,
													)}
												disabled={setting.disabled}
											/>
										{:else if setting.type === "range"}
											{@const rangeValue = (settings[
												setting.key
											] ??
												file.conversionSettings[
													setting.key
												] ??
												setting.default ??
												setting.min ??
												0) as number}
											{@const rangeLabel =
												setting.options?.[rangeValue]
													?.label ?? rangeValue}
											<div
												class="flex items-center mt-2 gap-2"
											>
												<input
													type="range"
													min={setting.min}
													max={setting.max}
													step={setting.step}
													value={rangeValue}
													class="range-slider w-full"
													oninput={(e) => {
														const nextValue =
															e.currentTarget
																.valueAsNumber;
														handleSettingChange(
															setting.key,
															nextValue,
														);
													}}
													disabled={setting.disabled}
												/>
												<span
													class="text-sm max-w-28 w-full text-right"
												>
													{rangeLabel}
												</span>
											</div>
										{:else}
											<FancyInput
												type={setting.type}
												value={settings[setting.key] ??
													file.conversionSettings[
														setting.key
													] ??
													setting.default}
												placeholder={setting.placeholder}
												oninput={(e) =>
													handleSettingChange(
														setting.key,
														e.currentTarget.value,
													)}
												disabled={setting.disabled}
											/>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/await}
			{/key}
		{/if}
	</div>
</Modal>
