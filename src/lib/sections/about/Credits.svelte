<script lang="ts">
	import Panel from "#lib/components/visual/Panel.svelte";
	import { HeartHandshakeIcon } from "@lucide/svelte";
	import {
		DISABLE_ALL_EXTERNAL_REQUESTS,
		GITHUB_URL_VERT,
	} from "#lib/util/consts";
	import { m } from "#lib/paraglide/messages";
	import { link, sanitize } from "#lib/store/index.svelte";
	import { clsx } from "clsx";

	let { mainContribs, notableContribs, ghContribs } = $props();
</script>

{#snippet contributor(
	name: string,
	github: string,
	avatar: string,
	role?: string,
	smaller?: boolean,
)}
	<div class="flex items-center gap-4" class:gap-1={smaller}>
		<a
			href={github}
			target="_blank"
			rel="noopener noreferrer"
			class="flex-shrink-0"
		>
			<img
				src={avatar}
				alt={name}
				title={name}
				class={clsx(
					smaller
						? "hoverable h-12 w-12"
						: role
							? "hoverable-md h-14 w-14"
							: "hoverable-lg h-10 w-10",
					"rounded-full",
				)}
			/>
		</a>
		{#if role}
			<div class="flex flex-col gap-1">
				<p
					class="font-semibold"
					class:text-xl={!smaller}
					class:text-base={smaller}
				>
					{name}
				</p>
				<p class="text-sm font-normal text-muted">{role}</p>
			</div>
		{/if}
	</div>
{/snippet}

<Panel class="flex flex-col gap-8 p-6">
	<h2 class="flex items-center text-2xl font-bold">
		<div class="mr-3 inline-block h-10 w-10 rounded-full bg-blue-300 p-2">
			<HeartHandshakeIcon color="black" />
		</div>
		{m["about.credits.title"]()}
	</h2>

	<p class="-mb-3 -mt-4 text-lg font-black">
		{m["about.credits.contact_team"]()}
	</p>

	<!-- Main contributors -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-col flex-wrap gap-2">
			{#each mainContribs as contrib (contrib.github)}
				{@const { name, github, avatar, role } = contrib}
				{@render contributor(name, github, avatar, role)}
			{/each}
		</div>
	</div>

	<!-- Notable contributors -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1">
			<h2 class="text-base font-bold">
				{m["about.credits.notable_contributors"]()}
			</h2>
			<div class="flex flex-col gap-2">
				<p class="text-base font-normal text-muted">
					{m["about.credits.notable_description"]()}
				</p>
				<div class="flex flex-col gap-2">
					{#each notableContribs as contrib (contrib.github)}
						{@const { name, github, avatar, role } = contrib}
						{@render contributor(name, github, avatar, role, true)}
					{/each}
				</div>
			</div>
		</div>

		<!-- GitHub contributors -->
		{#if !DISABLE_ALL_EXTERNAL_REQUESTS}
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-1">
					<h2 class="text-base font-bold">
						{m["about.credits.github_contributors"]()}
					</h2>
					{#if ghContribs && ghContribs.length > 0}
						<p class="text-base font-normal text-muted">
							{@html sanitize(
								link(
									"github_link",
									m["about.credits.github_description"](),
									GITHUB_URL_VERT,
									true,
								),
							)}
						</p>
					{:else}
						<p class="text-base font-normal italic text-muted">
							{@html sanitize(
								link(
									"contribute_link",
									m["about.credits.no_contributors"](),
									GITHUB_URL_VERT,
									true,
								),
							)}
						</p>
					{/if}
				</div>

				{#if ghContribs && ghContribs.length > 0}
					<div class="flex flex-row flex-wrap gap-2">
						{#each ghContribs as contrib (contrib.github)}
							{@const { name, github, avatar } = contrib}
							{@render contributor(name, github, avatar)}
						{/each}
					</div>
				{/if}
			</div>

			<h2 class="-mb-2 mt-2">{m["about.credits.libraries"]()}</h2>
			<p class="font-normal">
				{m["about.credits.libraries_description"]()}
			</p>
		{/if}
	</div>
</Panel>
