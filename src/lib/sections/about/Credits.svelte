<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import { HeartHandshakeIcon } from "lucide-svelte";
	import { GITHUB_URL_VERT } from "$lib/consts";

	let { mainContribs, ghContribs } = $props();
</script>

{#snippet contributor(
	name: string,
	github: string,
	avatar: string,
	role?: string,
)}
	<div class="flex items-center gap-4">
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
				class="{role
					? 'w-14 h-14 hoverable-md'
					: 'w-10 h-10 hoverable-lg'} rounded-full"
			/>
		</a>
		{#if role}
			<div class="flex flex-col gap-1">
				<p class="text-xl font-semibold">{name}</p>
				<p class="text-sm font-normal text-muted">{role}</p>
			</div>
		{/if}
	</div>
{/snippet}

<Panel class="flex flex-col gap-8 p-6">
	<h2 class="text-2xl font-bold flex items-center">
		<div class="rounded-full bg-blue-300 p-2 inline-block mr-3 w-10 h-10">
			<HeartHandshakeIcon color="black" />
		</div>
		Credits
	</h2>

	<!-- Main contributors -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-row flex-wrap gap-2">
			{#each mainContribs as contrib}
				{@const { name, github, avatar, role } = contrib}
				{@render contributor(name, github, avatar, role)}
			{/each}
		</div>
	</div>

	<!-- GitHub contributors -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1">
			<h2 class="text-base font-bold">GitHub contributors</h2>
			{#if ghContribs && ghContribs.length > 0}
				<p class="text-base text-muted font-normal">
					Big thanks to all these people for helping out!
					<a
						class="text-blue-500 font-normal hover:underline"
						href={GITHUB_URL_VERT}
						target="_blank"
						rel="noopener noreferrer"
					>
						Want to help too?
					</a>
				</p>
			{:else}
				<p class="text-base text-muted font-normal italic">
					Seems like no one has contributed yet...
					<a
						class="text-blue-500 font-normal hover:underline"
						href={GITHUB_URL_VERT}
						target="_blank"
						rel="noopener noreferrer"
					>
						be the first to contribute!
					</a>
				</p>
			{/if}
		</div>

		{#if ghContribs && ghContribs.length > 0}
			<div class="flex flex-row flex-wrap gap-2">
				{#each ghContribs as contrib}
					{@const { name, github, avatar } = contrib}
					{@render contributor(name, github, avatar)}
				{/each}
			</div>
		{/if}
	</div>
</Panel>
