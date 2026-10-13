<script lang="ts">
	import FancyTextInput from "#lib/components/functional/FancyInput.svelte";
	import Panel from "#lib/components/visual/Panel.svelte";
	import {
		PauseIcon,
		PlayIcon,
		RefreshCwIcon,
		ChevronDownIcon,
	} from "@lucide/svelte";
	import type { ISettings } from "./index.svelte";
	import { m } from "#lib/paraglide/messages";
	import FancyInput from "#lib/components/functional/FancyInput.svelte";
	import { effects, sanitize } from "#lib/store/index.svelte";
	import FormatDropdown from "#lib/components/functional/FormatDropdown.svelte";
	import { categories } from "#lib/converters";
	import clsx from "clsx";

	const { settings = $bindable() }: { settings: ISettings } = $props();
	let showAdvanced = $state(false);
</script>

<Panel class="flex flex-col gap-8 p-6">
	<div class="flex flex-col gap-4">
		<h2 class="text-2xl font-bold">
			<RefreshCwIcon
				size="40"
				class="-mt-1 mr-2 inline-block rounded-full bg-accent p-2"
				color="black"
			/>
			{m["settings.conversion.title"]()}
		</h2>
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<p class="text-base font-bold">
						{m["settings.conversion.filename.format"]()}
					</p>
					<p class="text-sm font-normal text-muted">
						{@html sanitize(
							m["settings.conversion.filename.description"](),
						)}
					</p>
				</div>
				<FancyTextInput
					placeholder="VERT_%name%"
					bind:value={settings.filenameFormat}
					extension=".ext"
					type="text"
				/>
			</div>
			<div class="flex flex-col gap-4">
				<button
					onclick={() => (showAdvanced = !showAdvanced)}
					class="flex w-full items-center justify-between rounded-lg bg-button p-4 text-black dynadark:text-white"
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
						{
							"max-h-[2000px] overflow-visible opacity-100":
								showAdvanced,
						},
						{
							"-mb-4 max-h-0 overflow-hidden opacity-0":
								!showAdvanced,
						},
					)}
				>
					<div class="flex flex-col gap-8">
						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-2">
								<p class="text-base font-bold">
									{m[
										"settings.conversion.default_format.label"
									]()}
								</p>
								<p class="text-sm font-normal text-muted">
									{m[
										"settings.conversion.default_format.description"
									]()}
								</p>
							</div>
							<div class="flex w-full flex-col gap-3">
								<div class="flex w-full gap-3">
									<button
										onclick={() =>
											(settings.useDefaultFormat = true)}
										class={clsx(
											"btn flex flex-1 items-center justify-center rounded-lg p-4 text-black dynadark:text-white",
											!$effects && "!scale-100",
											settings.useDefaultFormat &&
												"selected",
										)}
									>
										<PlayIcon
											size="24"
											class="mr-2 inline-block"
										/>
										{m[
											"settings.conversion.default_format.enable"
										]()}
									</button>

									<button
										onclick={() =>
											(settings.useDefaultFormat = false)}
										class={clsx(
											"btn flex flex-1 items-center justify-center rounded-lg p-4 text-black dynadark:text-white",
											!$effects && "!scale-100",
											!settings.useDefaultFormat &&
												"selected",
										)}
									>
										<PauseIcon
											size="24"
											class="mr-2 inline-block"
										/>
										{m[
											"settings.conversion.default_format.disable"
										]()}
									</button>
								</div>
							</div>
							<div
								class="grid grid-cols-2 gap-3 md:grid-cols-4"
								class:opacity-50={!settings.useDefaultFormat}
							>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.default_format.image"
										]()}
									</p>
									<FormatDropdown
										categories={{ image: categories.image }}
										from=".png"
										bind:selected={
											settings.defaultFormat.image
										}
										disabled={!settings.useDefaultFormat}
									/>
								</div>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.default_format.audio"
										]()}
									</p>
									<FormatDropdown
										categories={{ audio: categories.audio }}
										from=".mp3"
										bind:selected={
											settings.defaultFormat.audio
										}
										disabled={!settings.useDefaultFormat}
									/>
								</div>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.default_format.video"
										]()}
									</p>
									<FormatDropdown
										categories={{ video: categories.video }}
										from=".mp4"
										bind:selected={
											settings.defaultFormat.video
										}
										disabled={!settings.useDefaultFormat}
									/>
								</div>
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.default_format.document"
										]()}
									</p>
									<FormatDropdown
										categories={{ doc: categories.doc }}
										from=".docx"
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
									{m["settings.conversion.metadata.label"]()}
								</p>
								<p class="text-sm font-normal text-muted">
									{m[
										"settings.conversion.metadata.description"
									]()}
								</p>
							</div>
							<div class="flex w-full flex-col gap-3">
								<div class="flex w-full gap-3">
									<button
										onclick={() =>
											(settings.metadata = true)}
										class={clsx(
											"btn flex flex-1 items-center justify-center rounded-lg p-4 text-black dynadark:text-white",
											!$effects && "!scale-100",
											settings.metadata && "selected",
										)}
									>
										<PlayIcon
											size="24"
											class="mr-2 inline-block"
										/>
										{m[
											"settings.conversion.metadata.keep"
										]()}
									</button>

									<button
										onclick={() =>
											(settings.metadata = false)}
										class={clsx(
											"btn flex flex-1 items-center justify-center rounded-lg p-4 text-black dynadark:text-white",
											!$effects && "!scale-100",
											!settings.metadata && "selected",
										)}
									>
										<PauseIcon
											size="24"
											class="mr-2 inline-block"
										/>
										{m[
											"settings.conversion.metadata.remove"
										]()}
									</button>
								</div>
							</div>
						</div>
						<div class="flex flex-col gap-4">
							<div class="flex flex-col gap-2">
								<p class="text-base font-bold">
									{m["settings.conversion.quality.label"]()}
								</p>
								<p class="text-sm font-normal text-muted">
									{m[
										"settings.conversion.quality.description"
									]()}
								</p>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="flex flex-col gap-2">
									<p class="text-sm font-bold">
										{m[
											"settings.conversion.quality.images"
										]()}
									</p>
									<FancyInput
										bind:value={
											settings.magickQuality as unknown as string
										}
										type="number"
										min={1}
										max={100}
										placeholder="100"
										extension="%"
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
