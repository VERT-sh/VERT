<script lang="ts">
	import FancyTextInput from "$lib/components/functional/FancyInput.svelte";
	import Panel from "$lib/components/visual/Panel.svelte";
	import {
		PauseIcon,
		PlayIcon,
		RefreshCwIcon,
		ChevronDownIcon,
	} from "lucide-svelte";
	import type { ISettings } from "./index.svelte";
	import {
		CONVERSION_BITRATES,
		type ConversionBitrate,
		SAMPLE_RATES,
		type SampleRate,
	} from "$lib/converters/ffmpeg.svelte";
	import { m } from "$lib/paraglide/messages";
	import Dropdown from "$lib/components/functional/Dropdown.svelte";
	import FancyInput from "$lib/components/functional/FancyInput.svelte";
	import { effects, sanitize } from "$lib/store/index.svelte";
	import FormatDropdown from "$lib/components/functional/FormatDropdown.svelte";
	import { categories } from "$lib/converters";
	import clsx from "clsx";

	const { settings = $bindable() }: { settings: ISettings } = $props();
	let showAdvanced = $state(false);
</script>

<Panel class="flex flex-col gap-8 p-6">
	<div class="flex flex-col gap-3">
		<h2 class="text-2xl font-bold">
			<RefreshCwIcon
				size="40"
				class="inline-block -mt-1 mr-2 bg-accent p-2 rounded-full"
				color="black"
			/>
			{m["settings.conversion.title"]()}
		</h2>
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<p class="text-base font-bold">
						{m["settings.conversion.filename_format"]()}
					</p>
					<p class="text-sm text-muted font-normal">
						{@html sanitize(m["settings.conversion.filename_description"]())}
					</p>
				</div>
				<FancyTextInput
					placeholder="VERT_%name%"
					bind:value={settings.filenameFormat}
					extension={".ext"}
					type="text"
				/>
			</div>
			<div class="flex flex-col gap-4">
				<button
					onclick={() => (showAdvanced = !showAdvanced)}
					class="bg-button flex items-center justify-between p-4 rounded-lg text-black dynadark:text-white w-full"
				>
					<span class="text-base font-bold"
						>{m["settings.conversion.advanced_settings"]()}</span
					>
					<ChevronDownIcon
						size="20"
						class={clsx("transition-transform duration-300", {
							"rotate-180": showAdvanced,
						})}
					/>
				</button>
				<div
					class={clsx(
						"flex flex-col gap-8 transition-all duration-300 ease-in-out",
						{"max-h-[2000px] opacity-100 overflow-visible": showAdvanced},
						{"max-h-0 opacity-0 overflow-hidden -mb-4": !showAdvanced},
					)}
				>
					<div class="flex flex-col gap-8">
						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-2">
								<p class="text-base font-bold">
									{m["settings.conversion.default_format"]()}
								</p>
								<p class="text-sm text-muted font-normal">
									{m[
										"settings.conversion.default_format_description"
									]()}
								</p>
							</div>
							<div class="flex flex-col gap-3 w-full">
								<div class="flex gap-3 w-full">
									<button
										onclick={() =>
											(settings.useDefaultFormat = true)}
										class="btn {$effects
											? ''
											: '!scale-100'} {settings.useDefaultFormat
											? 'selected'
											: ''} flex-1 p-4 rounded-lg text-black dynadark:text-white flex items-center justify-center"
									>
										<PlayIcon
											size="24"
											class="inline-block mr-2"
										/>
										{m["settings.conversion.default_format_enable"]()}
									</button>

									<button
										onclick={() =>
											(settings.useDefaultFormat = false)}
										class="btn {$effects
											? ''
											: '!scale-100'} {settings.useDefaultFormat
											? ''
											: 'selected'} flex-1 p-4 rounded-lg text-black dynadark:text-white flex items-center justify-center"
									>
										<PauseIcon
											size="24"
											class="inline-block mr-2"
										/>
										{m["settings.conversion.default_format_disable"]()}
									</button>
								</div>
							</div>
							<div
								class="grid gap-3 grid-cols-2 md:grid-cols-4"
								class:opacity-50={!settings.useDefaultFormat}
							>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.default_format_image"
										]()}
									</p>
									<FormatDropdown
										categories={{ image: categories.image }}
										from={".png"}
										bind:selected={
											settings.defaultFormat.image
										}
										disabled={!settings.useDefaultFormat}
									/>
								</div>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.default_format_audio"
										]()}
									</p>
									<FormatDropdown
										categories={{ audio: categories.audio }}
										from={".mp3"}
										bind:selected={
											settings.defaultFormat.audio
										}
										disabled={!settings.useDefaultFormat}
									/>
								</div>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.default_format_video"
										]()}
									</p>
									<FormatDropdown
										categories={{ video: categories.video }}
										from={".mp4"}
										bind:selected={
											settings.defaultFormat.video
										}
										disabled={!settings.useDefaultFormat}
									/>
								</div>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.default_format_document"
										]()}
									</p>
									<FormatDropdown
										categories={{ doc: categories.doc }}
										from={".docx"}
										bind:selected={
											settings.defaultFormat.document
										}
										disabled={!settings.useDefaultFormat}
									/>
								</div>
							</div>
						</div>
						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-2">
								<p class="text-base font-bold">
									{m["settings.conversion.metadata"]()}
								</p>
								<p
									class="text-sm text-muted font-normal"
								>
									{m[
										"settings.conversion.metadata_description"
									]()}
								</p>
							</div>
							<div class="flex flex-col gap-3 w-full">
								<div class="flex gap-3 w-full">
									<button
										onclick={() =>
											(settings.metadata = true)}
										class="btn {$effects
											? ''
											: '!scale-100'} {settings.metadata
											? 'selected'
											: ''} flex-1 p-4 rounded-lg text-black dynadark:text-white flex items-center justify-center"
									>
										<PlayIcon
											size="24"
											class="inline-block mr-2"
										/>
										{m["settings.conversion.keep"]()}
									</button>

									<button
										onclick={() =>
											(settings.metadata = false)}
										class="btn {$effects
											? ''
											: '!scale-100'} {settings.metadata
											? ''
											: 'selected'} flex-1 p-4 rounded-lg text-black dynadark:text-white flex items-center justify-center"
									>
										<PauseIcon
											size="24"
											class="inline-block mr-2"
										/>
										{m["settings.conversion.remove"]()}
									</button>
								</div>
							</div>
						</div>
						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-2">
								<p class="text-base font-bold">
									{m["settings.conversion.quality"]()}
								</p>
								<p class="text-sm text-muted font-normal">
									{m[
										"settings.conversion.quality_description"
									]()}
								</p>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.quality_images"
										]()}
									</p>
									<FancyInput
										bind:value={
											settings.magickQuality as unknown as string
										}
										type="number"
										min={1}
										max={100}
										placeholder={"100"}
										extension={"%"}
									/>
								</div>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.quality_audio"
										]()}
									</p>
									<Dropdown
										options={CONVERSION_BITRATES.map((b) =>
											b.toString(),
										)}
										selected={settings.ffmpegQuality.toString()}
										onselect={(option: string) =>
											(settings.ffmpegQuality =
												option as ConversionBitrate)}
										settingsStyle
									/>
								</div>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m["settings.conversion.rate"]()}
									</p>
									<Dropdown
										options={SAMPLE_RATES.map((r) =>
											r.toString(),
										)}
										selected={settings.ffmpegSampleRate.toString()}
										onselect={(option: string) => {
											settings.ffmpegSampleRate =
												option as SampleRate;
										}}
										settingsStyle
									/>
								</div>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold select-none">
										&nbsp;&nbsp;
									</p>
									<FancyInput
										bind:value={
											settings.ffmpegCustomSampleRate as unknown as string
										}
										type="number"
										min={1}
										placeholder={"44100"}
										extension={"Hz"}
										disabled={settings.ffmpegSampleRate !==
											"custom"}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div></Panel
>
