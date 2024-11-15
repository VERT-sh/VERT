<script lang="ts">
	import { goto } from "$app/navigation";
	import { blur, duration, flip } from "$lib/animation";
	import Dropdown from "$lib/components/functional/Dropdown.svelte";
	import ProgressiveBlur from "$lib/components/visual/effects/ProgressiveBlur.svelte";
	import ProgressBar from "$lib/components/visual/ProgressBar.svelte";
	import { converters } from "$lib/converters";
	import type { Converter } from "$lib/converters/converter.svelte";
	import { log } from "$lib/logger";
	import { files, outputFilenameOption } from "$lib/store/index.svelte";
	import type { VertFile } from "$lib/types";
	import clsx from "clsx";
	import { FileAudioIcon, XIcon } from "lucide-svelte";
	import { onMount } from "svelte";
	import { quintOut } from "svelte/easing";
	import {
		type EasingFunction,
		type TransitionConfig,
	} from "svelte/transition";

	const { data } = $props();

	const reversedFiles = $derived(files.files.slice().reverse());

	let finisheds = $state(
		Array.from({ length: files.files.length }, () => false),
	);

	let processings = $state<boolean[]>([]);

	const convertersRequired = $derived.by(() => {
		const required: Converter[] = [];
		for (let i = 0; i < files.files.length; i++) {
			const file = files.files[i];
			const converter = converters.find(
				(c) =>
					c.supportedFormats.includes(file.from) &&
					c.supportedFormats.includes(file.to),
			);
			if (!converter) throw new Error("No converter found");
			required.push(converter);
		}
		return Array.from(new Set(required));
	});

	const multipleConverters = $derived(convertersRequired.length > 1);

	const noMultConverter = $derived(
		multipleConverters ? null : convertersRequired[0],
	);

	const allConvertersReady = $derived(
		convertersRequired.every((c) => c.ready),
	);

	// Options
	let outputFilename = $state(
		localStorage.getItem("outputFilename") || "default",
	);
	let findPattern = $state(localStorage.getItem("findPattern") || "");
	let replacePattern = $state(localStorage.getItem("replacePattern") || "");
	let findRegex = $state(
		localStorage.getItem("findRegex") === "true" || false,
	);
	let replaceRegex = $state(
		localStorage.getItem("replaceRegex") === "true" || false,
	);

	let disabled = $derived(files.files.some((f) => !f.result));

	onMount(() => {
		finisheds.forEach((_, i) => {
			const duration = 575 + i * 50 - 32;
			setTimeout(() => {
				finisheds[i] = true;
			}, duration);
		});
	});

	const convertAll = async () => {
		const perf = performance.now();
		files.files.forEach((f) => (f.result = null));
		const promises: Promise<void>[] = [];
		for (let i = 0; i < files.files.length; i++) {
			promises.push(
				(async (i) => {
					await convert(files.files[i], i);
				})(i),
			);
		}

		await Promise.all(promises);
		const ms = performance.now() - perf;
		const seconds = (ms / 1000).toFixed(2);
		log(["converter"], `converted all files in ${seconds}s`);
	};

	const convert = async (file: VertFile, index: number) => {
		file.progress = 0;
		processings[index] = true;
		await file.convert();
		processings[index] = false;
	};

	const downloadAll = async () => {
		const date = new Date().toISOString();
		const dlFiles: any[] = [];
		for (let i = 0; i < files.files.length; i++) {
			const file = files.files[i];
			const result = file.result;
			if (!result) {
				console.error("No result found");
				continue;
			}
			dlFiles.push({
				name: file.file.name.replace(/\.[^/.]+$/, "") + file.to,
				lastModified: Date.now(),
				input: await result.file.arrayBuffer(),
			});
		}
		if (files.files.length === 0) return;
		if (files.files.length === 1) {
			// download the image only
			const filename =
				outputFilename === "default"
					? `VERT-Converted_${date}`
					: files.files[0].file.name.replace(/\.[^/.]+$/, "");
			const blob = URL.createObjectURL(
				new Blob([dlFiles[0].input], {
					type: files.files[0].to.slice(1),
				}),
			);
			const a = document.createElement("a");
			a.href = blob;
			a.download = `${filename}${files.files[0].to}`;
			a.click();
			URL.revokeObjectURL(blob);
			a.remove();
			return;
		}
		const { downloadZip } = await import("client-zip");
		const blob = await downloadZip(dlFiles, "converted.zip").blob();
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `VERT-Converted_${date}.zip`;
		a.click();
		URL.revokeObjectURL(url);
		a.remove();
	};

	const deleteAll = () => {
		files.files = [];
		goto("/");
	};

	export const progBlur = (
		_: HTMLElement,
		config:
			| Partial<{
					duration: number;
					easing: EasingFunction;
			  }>
			| undefined,
		dir: {
			direction: "in" | "out" | "both";
		},
	): TransitionConfig => {
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (!config) config = {};
		if (!config.duration) config.duration = 300;
		if (!config.easing) config.easing = quintOut;
		return {
			duration: prefersReducedMotion ? 0 : config?.duration || 300,
			css: (t) => {
				return "--blur-amount: " + (dir.direction !== "in" ? t : 1 - t);
			},
			easing: config?.easing,
		};
	};
</script>

<svelte:head>
	<title>Your Conversions</title>
	<meta name="title" content="Your Conversions — VERT.sh" />
	<meta property="og:title" content="Your Conversions — VERT.sh" />
	<meta property="twitter:title" content="Your Conversions — VERT.sh" />
</svelte:head>

<div class="grid grid-cols-1 grid-rows-1 w-full">
	{#if files.files.length === 0}
		<p class="text-foreground-muted col-start-1 row-start-1 text-center">
			No files uploaded. Head to the Upload tab to begin!
		</p>
	{:else}
		<div
			class="flex flex-col gap-4 w-full col-start-1 row-start-1"
			out:blur={{
				duration,
				easing: quintOut,
				blurMultiplier: 16,
			}}
		>
			<div
				class="w-full p-4 max-w-screen-lg border-solid flex-col border-2 rounded-2xl border-foreground-muted-alt flex flex-shrink-0"
			>
				<h2 class="font-bold text-xl mb-1">Options</h2>
				<div class="flex flex-col w-full gap-4 mt-2">
					<div class="flex flex-col gap-3">
						<div class="flex flex-col gap-3 w-fit">
							<h3>Output filename</h3>
							<div class="grid grid-rows-1 grid-cols-1">
								<div
									transition:blur={{
										blurMultiplier: 8,
										duration,
										easing: quintOut,
									}}
									class="row-start-1 col-start-1 w-fit"
								>
									<Dropdown
										options={outputFilenameOption}
										bind:selected={outputFilename}
										onselect={() => {
											localStorage.setItem(
												"outputFilename",
												outputFilename,
											);
										}}
									/>
								</div>
							</div>
						</div>

						<!-- Find/replace patterns -->
						<div class="flex flex-col sm:flex-row gap-4">
							<div class="flex flex-col gap-2 w-full md:w-fit">
								<h3>Find pattern</h3>
								<div class="flex gap-4 items-center">
									<input
										type="text"
										class="px-3 py-2 bg-background border border-foreground-muted rounded-md flex-1 md:flex-none"
										placeholder="Text to find"
										bind:value={findPattern}
										oninput={() =>
											localStorage.setItem(
												"findPattern",
												findPattern,
											)}
									/>
									<label
										class="flex items-center gap-2 cursor-pointer whitespace-nowrap"
									>
										<input
											type="checkbox"
											class="w-4 h-4"
											bind:checked={findRegex}
											onchange={() =>
												localStorage.setItem(
													"findRegex",
													findRegex.toString(),
												)}
										/>
										<span>Regex</span>
									</label>
								</div>
							</div>

							<div class="flex flex-col gap-2 w-full md:w-fit">
								<h3>Replace pattern</h3>
								<div class="flex gap-4 items-center">
									<input
										type="text"
										class="px-3 py-2 bg-background border border-foreground-muted rounded-md flex-1 md:flex-none"
										placeholder="Text to replace with"
										bind:value={replacePattern}
										oninput={() =>
											localStorage.setItem(
												"replacePattern",
												replacePattern,
											)}
									/>
									<label
										class="flex items-center gap-2 cursor-pointer whitespace-nowrap"
									>
										<input
											type="checkbox"
											class="w-4 h-4"
											bind:checked={replaceRegex}
											onchange={() =>
												localStorage.setItem(
													"replaceRegex",
													replaceRegex.toString(),
												)}
										/>
										<span>Regex</span>
									</label>
								</div>
							</div>
						</div>
					</div>
					<div class="flex flex-col gap-3 w-fit">
						<h3>Set all target formats</h3>
						<div class="grid grid-rows-1 grid-cols-1">
							{#if !multipleConverters && noMultConverter}
								<div
									transition:blur={{
										blurMultiplier: 8,
										duration,
										easing: quintOut,
									}}
									class="row-start-1 col-start-1 w-fit"
								>
									<Dropdown
										options={noMultConverter.supportedFormats}
										onselect={(o) => {
											// files.conversionTypes = Array.from(
											// 	{ length: files.files.length },
											// 	() => o,
											// );

											files.files.forEach((file) => {
												file.result = null;
												file.to = o;
											});
										}}
									/>
								</div>
							{:else}
								<div
									class="italic w-fit text-foreground-muted-alt flex items-center row-start-1 col-start-1"
									transition:blur={{
										blurMultiplier: 8,
										duration,
										easing: quintOut,
									}}
								>
									The listed files require different
									converters, so you can't set them in bulk.
								</div>
							{/if}
						</div>
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-3 mt-4">
					<button
						onclick={convertAll}
						class={clsx("btn flex-grow", {
							"btn-highlight":
								disabled && !processings.some((p) => p),
						})}
						disabled={!allConvertersReady ||
							processings.some((p) => p)}
					>
						{#if allConvertersReady}
							Convert {files.files.length > 1 ? "All" : ""}
						{:else}
							Loading...
						{/if}
					</button>
					<button
						onclick={downloadAll}
						class={clsx("btn flex-grow", {
							"btn-highlight": !disabled,
						})}
						{disabled}
						>Download {files.files.length > 1 ? "All" : ""}</button
					>
					<button
						onclick={deleteAll}
						disabled={processings.some((p) => p)}
						class="btn flex-grow"
					>
						Delete All
					</button>
				</div>
			</div>
			<div class="w-full gap-4 grid md:grid-cols-2">
				{#each reversedFiles as file, i (file.id)}
					{@const converter = (() => {
						return converters.find((c) =>
							c.supportedFormats.includes(file.from),
						);
					})()}
					<div
						class="relative"
						animate:flip={{ duration, easing: quintOut }}
						out:blur={{
							duration,
							easing: quintOut,
							blurMultiplier: 16,
						}}
					>
						<div
							class={clsx(
								"flex relative flex-shrink-0 items-center w-full rounded-xl h-72",
								{
									"initial-fade": !finisheds[i],
								},
							)}
							style="--delay: {i * 50}ms; z-index: {files.files
								.length - i}; border: solid 2px {file.result
								? 'var(--accent-bg)'
								: 'var(--fg-muted-alt)'}; transition: border 1000ms ease; transition: filter {duration}ms var(--transition), transform {duration}ms var(--transition);"
						>
							<div
								class="flex h-full flex-col items-center w-full z-50 relative"
							>
								<div class="w-full flex-shrink-0">
									<div
										class={clsx(
											"py-3 dynadark:[--transparency:50%] [--transparency:25%] px-4 w-full flex transition-colors duration-300 flex-shrink text-left border-b-2 border-solid border-foreground-muted-alt rounded-tl-[9.5px] rounded-tr-[10px] overflow-hidden",
											{
												"text-accent-foreground":
													file.result,
												"text-foreground": !file.result,
											},
										)}
										style="background-color: color-mix(in srgb, var(--{file.result
											? 'accent-bg'
											: 'bg'}), transparent var(--transparency)); backdrop-filter: blur({data.isFirefox
											? 0
											: 18}px);"
									>
										<div
											class="w-full grid grid-cols-1 grid-rows-1"
										>
											{#if processings[files.files.length - i - 1]}
												<div
													class="w-full row-start-1 col-start-1 h-full flex items-center pr-4"
													transition:blur={{
														blurMultiplier: 6,
														duration,
														easing: quintOut,
														scale: {
															start: 0.9,
															end: 1,
														},
													}}
												>
													<ProgressBar
														min={0}
														max={100}
														progress={file.converter
															?.reportsProgress
															? file.result
																? 100
																: file.progress
															: null}
													/>
												</div>
											{:else}
												<h3
													class="row-start-1 col-start-1 whitespace-nowrap overflow-hidden text-ellipsis font-medium"
													transition:blur={{
														blurMultiplier: 6,
														duration,
														easing: quintOut,
														scale: {
															start: 0.9,
															end: 1,
														},
													}}
												>
													{file.file.name}
												</h3>
											{/if}
										</div>
										<button
											onclick={() => {
												// delete the file from the list
												files.files =
													files.files.filter(
														(f) => f !== file,
													);
												if (files.files.length === 0)
													goto("/");
											}}
											class="ml-2 mr-1 flex-shrink-0"
										>
											<XIcon size="24" />
										</button>
									</div>
								</div>
								<div
									class="flex gap-3 justify-normal flex-grow w-full h-full"
								>
									<div
										class="flex flex-col items-end gap-3 w-full"
									>
										<div
											class="flex items-end gap-3 w-full h-full px-5"
										>
											<div
												class="flex items-center justify-center gap-3 w-full pb-4"
											>
												{#if converter && converter.supportedFormats.includes(file.from)}
													<span>from</span>
													<span
														class="py-2 px-3 font-display bg-foreground text-background rounded-xl"
														>{file.from}</span
													>
													<span>to</span>
													<div class="inline-flex">
														<Dropdown
															options={converter.supportedFormats}
															bind:selected={files
																.files[
																files.files
																	.length -
																	i -
																	1
															].to}
															onselect={() => {
																file.result =
																	null;
															}}
														/>
													</div>
												{:else}
													<span
														class="py-2 px-3 font-display bg-foreground-failure text-white rounded-xl"
														>{file.from}</span
													>

													<span
														class="text-foreground-failure"
													>
														is not supported!
													</span>
												{/if}
											</div>
										</div>
										<!-- <div
											class="hidden lg:flex gap-4 w-full"
										>
											<button
												class="btn flex-grow flex-shrink-0"
												onclick={() => convert(file)}
											>
												Convert
											</button>
											<button
												class="btn flex-grow flex-shrink-0"
												disabled={!file.result}
												onclick={file.download}
											>
												Download
											</button>
										</div> -->
									</div>
								</div>
							</div>
							{#if converter && converter.supportedFormats.includes(file.from)}
								<!-- god knows why, but setting opacity > 0.98 causes a z-ordering issue in firefox ??? -->
								<div
									class="absolute top-[0px] -z-50 left-0 w-full h-full opacity-[0.98] rounded-xl overflow-hidden"
								>
									{#if file.blobUrl}
										<div
											class="bg-cover bg-center w-full h-full"
											style="background-image: url({file.blobUrl})"
											in:blur={{
												blurMultiplier: 24,
												scale: {
													start: 1.1,
													end: 1,
												},
												duration,
												easing: quintOut,
											}}
										></div>
										<div
											class="absolute left-0 top-0 pt-[50px] h-full w-full"
											transition:progBlur={{
												duration,
												easing: quintOut,
											}}
										>
											<ProgressiveBlur
												direction="bottom"
												endIntensity={64}
												iterations={8}
												fadeTo="var(--bg-transparent)"
											/>
										</div>
									{:else}
										<div
											class="w-full h-full flex items-center justify-center"
										>
											<FileAudioIcon
												size="96"
												strokeWidth="1.5"
												color="var(--fg)"
												opacity="0.9"
											/>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes initial-transition {
		0% {
			transform: translateY(50px);
			filter: blur(16px);
			opacity: 0;
		}

		100% {
			transform: translateY(0);
			filter: blur(0);
			opacity: 1;
		}
	}

	.initial-fade {
		animation: initial-transition 600ms var(--delay) var(--transition);
		opacity: 0;
	}

	.initial-fade.finished {
		animation: none;
		opacity: 1 !important;
	}

	@keyframes processing {
		0% {
			transform: scale(1);
			filter: blur(0px);
			animation-timing-function: ease-in-out;
		}

		50% {
			transform: scale(1.05);
			filter: blur(4px);
			animation-timing-function: ease-in-out;
		}

		100% {
			transform: scale(1);
			filter: blur(0px);
			animation-timing-function: ease-in-out;
		}
	}

	.processing {
		animation: processing 2000ms infinite;
		pointer-events: none;
	}

	.file-list {
		transition:
			filter 500ms var(--transition),
			transform 500ms var(--transition);
	}
</style>
