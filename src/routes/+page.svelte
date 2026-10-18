<script lang="ts">
	import Uploader from "#lib/components/functional/Uploader.svelte";
	import Tooltip from "#lib/components/visual/Tooltip.svelte";
	import { converters, categoryStatus } from "#lib/converters";
	import { vertdLoaded } from "#lib/store/index.svelte";
	import clsx from "clsx";
	import {
		AudioLinesIcon,
		BookTextIcon,
		CheckIcon,
		FilmIcon,
		ImageIcon,
	} from "@lucide/svelte";
	import { m } from "#lib/paraglide/messages";
	import { OverlayScrollbarsComponent } from "overlayscrollbars-svelte";
	import { browser } from "$app/env";
	import "overlayscrollbars/overlayscrollbars.css";
	import { onMount } from "svelte";
	import type { WorkerStatus } from "#lib/converters/converter.svelte";
	import { sanitize } from "#lib/store/index.svelte";
	import { DISABLE_ALL_EXTERNAL_REQUESTS } from "#lib/util/consts";

	const getSupportedFormats = (name: string) =>
		converters
			.find((c) => c.name === name)
			?.supportedFormats.map(
				(f) =>
					`${f.name}${f.fromSupported && f.toSupported ? "" : "*"}`,
			)
			.join(", ") || "none";

	const getImageFormats = () =>
		Array.from(
			new Set(
				converters
					.filter((c) => ["imagemagick", "libvips"].includes(c.name))
					.flatMap((c) =>
						c.supportedFormats.map(
							(f) =>
								`${f.name}${f.fromSupported && f.toSupported ? "" : "*"}`,
						),
					),
			),
		).join(", ");

	const worker: {
		[key: string]: {
			formats: string;
			icon: typeof ImageIcon;
			title: string;
			status: WorkerStatus;
		};
	} = $derived.by(() => {
		const output: {
			[key: string]: {
				formats: string;
				icon: typeof ImageIcon;
				title: string;
				status: WorkerStatus;
			};
		} = {
			Images: {
				formats: getImageFormats(),
				icon: ImageIcon,
				title: m["upload.cards.images"](),
				status: categoryStatus("image"),
			},
			Audio: {
				formats: getSupportedFormats("ffmpeg"),
				icon: AudioLinesIcon,
				title: m["upload.cards.audio"](),
				status: categoryStatus("audio") || "idle",
			},
			Documents: {
				formats: getSupportedFormats("pandoc"),
				icon: BookTextIcon,
				title: m["upload.cards.documents"](),
				status: categoryStatus("doc") || "idle",
			},
		};

		if (!DISABLE_ALL_EXTERNAL_REQUESTS) {
			const formats = Array.from(
				new Set([
					...getSupportedFormats("vertd").split(", "),
					...getSupportedFormats("mediabunny").split(", "),
				]),
			)
				.filter((f) => f !== "none")
				.join(", ");

			const mediabunnyAvailable = converters
				.find((c) => c.name === "mediabunny")
				?.isAvailable();
			const vertdReady = $vertdLoaded === true;
			const videoStatus =
				vertdReady && mediabunnyAvailable
					? "ready"
					: vertdReady || mediabunnyAvailable
						? "partially-ready"
						: "error";

			output.Video = {
				formats,
				icon: FilmIcon,
				title: m["upload.cards.video"](),
				status: videoStatus as WorkerStatus,
			};
		}

		return output;
	});

	const getTooltip = (format: string) => {
		const converter = converters.find((c) =>
			c.supportedFormats.some((sf) => sf.name === format),
		);

		const formatInfo = converter?.supportedFormats.find(
			(sf) => sf.name === format,
		);

		if (formatInfo) {
			const direction = formatInfo.fromSupported
				? m["upload.tooltip.direction_input"]()
				: m["upload.tooltip.direction_output"]();
			return m["upload.tooltip.partial_support"]({ direction });
		}
		return "";
	};

	const getStatusText = (status: WorkerStatus) => {
		switch (status) {
			case "downloading":
				return m["upload.cards.status.downloading"]();
			case "initializing":
				return m["upload.cards.status.initializing"]();
			case "partially-ready":
				return m["upload.cards.status.partially_ready"]();
			case "ready":
				return m["upload.cards.status.ready"]();
			case "idle":
				return m["upload.cards.status.not_initialized"]();
			default:
				// "error" and other statuses (somehow)
				return m["upload.cards.status.not_ready"]();
		}
	};

	let scrollContainers: HTMLElement[] = $state([]);
	// svelte-ignore state_referenced_locally
	let showBlur = $state(Array(Object.keys(worker).length).fill(false));

	onMount(() => {
		const handleResize = () => {
			for (let i = 0; i < scrollContainers.length; i++) {
				// show bottom blur if scrollable
				const container = scrollContainers[i];
				if (!container) return;
				showBlur[i] = container.scrollHeight > container.clientHeight;
			}
		};

		handleResize();
		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
		};
	});
</script>

<div class="mx-auto w-full max-w-6xl px-6 md:px-8">
	<div class="flex items-center justify-center pb-10 md:py-16">
		<div
			class="flex h-auto flex-col items-center gap-12 md:flex-row md:gap-24"
		>
			<div class="w-full flex-grow text-center md:text-left">
				<h1
					class="mb-4 flex-wrap px-12 text-4xl leading-tight tracking-tight md:mb-6 md:p-0 md:text-6xl md:leading-[72px]"
				>
					{m["upload.title"]()}
				</h1>
				<p
					class="px-5 text-lg font-normal text-black text-muted dynadark:text-muted md:p-0 md:text-xl"
				>
					{m["upload.subtitle"]()}
				</p>
			</div>
			<div class="h-72 w-full flex-grow">
				<Uploader class="h-full w-full" />
			</div>
		</div>
	</div>

	<hr />

	<div class="mt-10 md:mt-16">
		<h2 class="text-center text-4xl">{m["upload.cards.title"]()}</h2>

		<div class="mt-8 flex flex-col gap-4 md:flex-row">
			{#if browser}
				{#each Object.entries(worker) as [key, s], i (key)}
					{@const Icon = s.icon}
					<div class="file-category-card flex w-full flex-col gap-4">
						<div class="file-category-card-inner">
							<div
								class={clsx("icon-container", {
									"bg-accent-blue": key === "Images",
									"bg-accent-purple": key === "Audio",
									"bg-accent-green": key === "Documents",
									"bg-accent-red": key === "Video",
								})}
							>
								<Icon size="20" />
							</div>
							<span>{s.title}</span>
						</div>

						<div
							class="file-category-card-content relative flex-grow"
						>
							<OverlayScrollbarsComponent
								options={{
									scrollbars: {
										autoHide: "move",
										autoHideDelay: 1500,
									},
								}}
								defer
							>
								<div
									class="relative flex h-[12.25rem] flex-col gap-4"
									bind:this={scrollContainers[i]}
								>
									{#if key === "Video"}
										<p
											class="tems-center flex justify-center gap-2"
										>
											<CheckIcon size="20" />
											<Tooltip
												text={m[
													"upload.tooltip.video_server_processing"
												]()}
											>
												<span>
													<a
														href="https://github.com/VERT-sh/VERT/blob/main/docs/VIDEO_CONVERSION.md"
														target="_blank"
														rel="noopener noreferrer"
													>
														{m[
															"upload.cards.video_server_processing"
														]()}
													</a>
													<span
														class="-ml-0.5 text-red-500"
														>*</span
													>
												</span>
											</Tooltip>
										</p>
									{:else}
										<p
											class="tems-center flex justify-center gap-2"
										>
											<CheckIcon size="20" />
											{m[
												"upload.cards.local_supported"
											]()}
										</p>
									{/if}
									<p>
										{@html sanitize(
											m["upload.cards.status.text"]({
												status: getStatusText(s.status),
											}),
										)}
									</p>
									<div
										class="relative flex flex-col items-center"
									>
										<b
											>{m[
												"upload.cards.supported_formats"
											]()}&nbsp;</b
										>
										<p
											class="flex flex-wrap justify-center px-2 leading-tight"
										>
											{#each s.formats.split(", ") as format, index (format)}
												{@const isPartial =
													format.endsWith("*")}
												{@const formatName = isPartial
													? format.slice(0, -1)
													: format}
												<span
													class="relative flex items-center text-sm font-normal"
												>
													{#if isPartial}
														<Tooltip
															text={getTooltip(
																formatName,
															)}
														>
															{formatName}<span
																class="text-red-500"
																>*</span
															>
														</Tooltip>
													{:else}
														{formatName}
													{/if}
													{#if index < s.formats.split(", ").length - 1}
														<span>,&nbsp;</span>
													{/if}
												</span>
											{/each}
										</p>
										<p><br /></p>
									</div>
								</div>
							</OverlayScrollbarsComponent>
							<!-- bottom blur if scrollable -->
							{#if showBlur[i]}
								<div
									class="pointer-events-none absolute bottom-0 left-0 h-10 w-full"
									style="background: linear-gradient(to top, var(--bg-panel), transparent 65%);"
								></div>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	.file-category-card {
		@apply relative rounded-2xl bg-panel p-5 shadow-panel;
	}

	.file-category-card p {
		@apply text-center text-sm font-normal;
	}

	.file-category-card-inner {
		@apply flex items-center justify-center gap-3 text-xl;
	}

	.file-category-card-content {
		@apply flex flex-col justify-between text-center;
	}

	.icon-container {
		@apply rounded-full p-2 text-on-accent;
	}
</style>
