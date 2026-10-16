<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import { SearchIcon } from "@lucide/svelte";
	import Dropdown from "../Dropdown.svelte";
	import FancyInput from "../FancyInput.svelte";
	import Modal from "./Modal.svelte";
	import { m } from "$lib/paraglide/messages";
	import type { VertFile } from "$lib/types";
	import { effects, files } from "$lib/store/index.svelte";
	import { converterCategories } from "$lib/converters";
	import { log, error } from "$lib/util/logger.svelte";
	import type {
		ConversionSettings,
		SettingCategories,
	} from "$lib/types/conversion-settings";
	import clsx from "clsx";
	import { animateHeight, duration, fade } from "$lib/util/animation";
	import { quintOut } from "svelte/easing";

	type Props = {
		file: VertFile | undefined;
		onclose?: () => void;
	};

	let { file, onclose }: Props = $props();
	const allFilesValue = "all-files";
	let selectedFileId = $derived<string>(file?.id ?? allFilesValue);
	let targetFile = $derived(
		selectedFileId === allFilesValue
			? files.files[0]
			: files.files.find((f) => f.id === selectedFileId),
	);

	$effect(() => {
		if (file) selectedFileId = file.id;
		else selectedFileId = allFilesValue;
	});

	const fileOptions = $derived([
		{
			value: allFilesValue,
			label: m["convert.settings.all_files"](),
		},
		...files.files.map((f: VertFile) => ({
			value: f.id,
			label: f.name,
		})),
	]);

	const getAvailableConverters = (vertFile: VertFile) => {
		const availableConverters = vertFile.converters.filter(
			(converter) => !vertFile.unavailableConverters[converter.name],
		);
		const supportedConverters = vertFile.findConverters(
			[vertFile.from, vertFile.to],
			vertFile.unavailableConverters,
		);

		return vertFile.isZip() ? availableConverters : supportedConverters;
	};

	const getValidConverter = (vertFile: VertFile, converterName?: string) => {
		const available = getAvailableConverters(vertFile);
		const name = converterName || vertFile.conversionSettings.converter;
		return available.find((c) => c.name === name) || available[0];
	};

	const converterCategoryByName = new Map(
		Object.entries(converterCategories).flatMap(([category, names]) =>
			names.map((name) => [name, category] as const),
		),
	);

	const getFileType = (vertFile: VertFile) => {
		const converter = vertFile.converters.find(
			({ name, supportedFormats }) =>
				converterCategoryByName.has(name) &&
				supportedFormats.some(
					(format) =>
						format.name === vertFile.from && format.isNative,
				),
		);

		return converter
			? converterCategoryByName.get(converter.name)!
			: vertFile.from;
	};

	let settings = $state<ConversionSettings>({});
	let activeTab = $state("Converter");
	let availableCategories = $state<SettingCategories>({});

	const settingTabs = $derived.by((): SettingCategories => {
		const categories = Object.fromEntries(
			Object.entries(availableCategories).filter(
				([, settings]) => settings.length > 0,
			),
		);

		return {
			...(targetFile && getAvailableConverters(targetFile).length > 1
				? { Converter: [] }
				: {}),
			...categories,
		};
	});

	const getTabLabel = (tab: string) => {
		const key = tab.toLowerCase();
		if (key === "converter") return m["convert.settings.tabs.converter"]();
		if (key === "general") return m["convert.settings.tabs.general"]();
		if (key === "video") return m["convert.settings.tabs.video"]();
		if (key === "audio") return m["convert.settings.tabs.audio"]();
		if (key === "image") return m["convert.settings.tabs.image"]();
		return tab;
	};

	$effect(() => {
		const currentFile = targetFile;
		const currentConverter = settings.converter;
		let cancelled = false;

		if (!currentFile) {
			availableCategories = {};
			return;
		}

		void currentFile
			.getAvailableSettings(currentFile, currentConverter)
			.then((categories) => {
				if (cancelled) return;

				availableCategories = categories;
				const hasConverterTab =
					getAvailableConverters(currentFile).length > 1;
				if (
					(!hasConverterTab && activeTab === "Converter") ||
					(activeTab !== "Converter" && !categories[activeTab])
				)
					activeTab = Object.keys(categories)[0] ?? "Converter";
			})
			.catch((cause: unknown) => {
				if (cancelled) return;
				error(
					["settings", "modal"],
					`failed to load settings for ${currentFile.name}: ${cause}`,
				);
			});

		return () => {
			cancelled = true;
		};
	});

	const handleSettingChange = (key: string, value: any) => {
		settings[key] = value;
	};

	const applySettings = async (converterName: string) => {
		const referenceFile = targetFile;
		const targetFiles =
			selectedFileId === allFilesValue && referenceFile
				? files.files.filter(
						(f) => getFileType(f) === getFileType(referenceFile),
					)
				: files.files.filter((f) => f.id === selectedFileId);
		if (targetFiles.length === 0) {
			error(
				["settings", "modal"],
				"no files available to apply settings to",
			);
			return;
		}

		for (const targetFile of targetFiles) {
			try {
				const converter = getValidConverter(
					targetFile,
					converterName || targetFile.conversionSettings.converter,
				);
				if (!converter) {
					error(
						["settings", "modal"],
						`no converter found for ${targetFile.name}, can't apply settings`,
					);
					continue;
				}

				const categories =
					await converter.getAvailableSettings(targetFile);
				const supportedKeys = new Set(
					Object.values(categories)
						.flat()
						.map((setting) => setting.key),
				);
				const applicableSettings = Object.fromEntries(
					Object.entries(settings).filter(([key]) =>
						supportedKeys.has(key),
					),
				);
				const defaultSettings = Object.fromEntries(
					Object.values(categories)
						.flat()
						.map((setting) => [setting.key, setting.default]),
				);

				// apply defaults, then existing settings, then new settings on top
				targetFile.conversionSettings = {
					...defaultSettings,
					...targetFile.conversionSettings,
					...applicableSettings,
					converter: converter.name,
				};
				log(
					["settings", "modal"],
					`applied settings for ${targetFile.name}: ${JSON.stringify(targetFile.conversionSettings, null, 2)}`,
				);
			} catch (e) {
				error(
					["settings", "modal"],
					`failed to apply settings for ${targetFile.name}: ${e}`,
				);
			}
		}
	};

	$effect(() => {
		if (!targetFile) return;
		if (settings.converter) return;

		settings.converter =
			targetFile.conversionSettings.converter ||
			getValidConverter(targetFile)?.name;
	});
</script>

<Modal
	icon={SearchIcon}
	title={m["convert.settings.title"]()}
	color="purple"
	badge={{
		text: m["convert.settings.badge.text"](),
		color: "accent-pink",
	}}
	buttons={[
		{
			text: m["convert.settings.cancel"](),
			action: () => onclose?.(),
		},
		{
			text: m["convert.settings.apply"](),
			action: async () => {
				await applySettings(settings.converter);
				onclose?.();
			},
			primary: true,
		},
	]}
	onclose={() => onclose?.()}
>
	<div class="flex flex-col gap-8 max-h-[calc(100vh-225px)] overflow-y-auto">
		{#if targetFile}
			{@const availableConverters = getAvailableConverters(targetFile)}
			{@const validConverter = getValidConverter(
				targetFile,
				settings.converter,
			)}
			<div class="w-full text-base">
				{m["convert.settings.description"]()}
				<Dropdown
					options={fileOptions}
					selected={selectedFileId}
					style={"inline"}
					onselect={(value) => {
						selectedFileId = value;
						settings = {};
					}}
				/>
			</div>

			<div class="flex items-center justify-between">
				{#each Object.keys(settingTabs) as tab}
					<button
						class={clsx(
							"flex-grow text-lg hover:text-muted/20 border-b-2 pb-2 capitalize",
							activeTab === tab
								? "text-accent border-b-accent"
								: "border-b-separator text-muted",
						)}
						onclick={() => (activeTab = tab)}
					>
						{getTabLabel(tab)}
					</button>
				{/each}
			</div>
			<div use:animateHeight>
				{#key activeTab}
					<div
						class="pb-2"
						in:fade={{ duration, easing: quintOut }}
						out:fade={{ duration, easing: quintOut }}
					>
						{#if activeTab === "Converter"}
							<div class="flex flex-col gap-2">
								{#each availableConverters as converter}
									<button
										class={clsx(
											"w-full p-3 text-left rounded-xl border-2 border-button",
											converter.name ===
												validConverter?.name &&
												"bg-accent-purple text-black",
											$effects && "transition",
										)}
										onclick={() => {
											settings.converter = converter.name;
										}}
									>
										{converter.name}
									</button>
								{/each}
							</div>
						{:else if availableCategories[activeTab]?.length}
							<div class="grid grid-cols-2 gap-4">
								{#each availableCategories[activeTab] as setting (setting.key)}
									{@const fullWidth =
										setting.forceFullWidth ||
										setting.type === "boolean"}
									<div
										class={clsx(
											"flex min-w-0 gap-2",
											fullWidth && "col-span-2",
											setting.type === "boolean"
												? "flex-row justify-between"
												: "flex-col",
										)}
									>
										<p class="text-sm font-bold">
											{setting.label}
										</p>
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
													targetFile
														.conversionSettings[
														setting.key
													] ??
													setting.default}
												style="settings"
												onselect={(value) =>
													handleSettingChange(
														setting.key,
														value,
													)}
												disabled={setting.disabled}
											/>
										{:else if setting.type === "boolean"}
											<FancyInput
												type="checkbox"
												checked={settings[
													setting.key
												] ??
													targetFile
														.conversionSettings[
														setting.key
													] ??
													setting.default}
												onchange={(e: any) =>
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
												targetFile.conversionSettings[
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
													oninput={(e) =>
														handleSettingChange(
															setting.key,
															e.currentTarget
																.valueAsNumber,
														)}
													disabled={setting.disabled}
												/>
												<span
													class="text-sm max-w-28 w-full text-right"
													>{rangeLabel}</span
												>
											</div>
										{:else}
											<FancyInput
												type={setting.type}
												value={settings[setting.key] ??
													targetFile
														.conversionSettings[
														setting.key
													] ??
													setting.default}
												placeholder={setting.placeholder}
												oninput={(e: any) =>
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
						{:else}
							<p class="text-sm text-muted">
								{m["convert.settings.none"]()}
							</p>
						{/if}
					</div>
				{/key}
			</div>
		{/if}
	</div>
</Modal>
