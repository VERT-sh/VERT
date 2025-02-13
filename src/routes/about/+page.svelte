<script lang="ts">
	import { error, log } from "$lib/logger";
	import * as About from "$lib/sections/about";
	import { InfoIcon } from "lucide-svelte";
	import { onMount } from "svelte";
	import avatarNullptr from "$lib/assets/avatars/nullptr.jpg";
	import avatarRealmy from "$lib/assets/avatars/realmy.jpg";
	import avatarJovannMC from "$lib/assets/avatars/jovannmc.jpg";
	import { GITHUB_API_URL } from "$lib/consts";
	import { addToast } from "$lib/store/ToastProvider";

	/* interface Donator {
		name: string;
		amount?: string | number;
		avatar: string;
	} */

	interface Contributor {
		name: string;
		github: string;
		avatar: string;
		role?: string;
	}

	// const donors: Donator[] = [];

	const mainContribs: Contributor[] = [
		{
			name: "nullptr",
			github: "https://github.com/not-nullptr",
			role: "Lead developer; conversion backend, UI implementation",
			avatar: avatarNullptr,
		},
		{
			name: "Realmy",
			github: "https://github.com/RealmyTheMan",
			role: "Lead designer; logo and branding, user interface design",
			avatar: avatarRealmy,
		},
		{
			name: "JovannMC",
			github: "https://github.com/JovannMC",
			role: "Developer; UI implementation",
			avatar: avatarJovannMC,
		},
	];

	let ghContribs: Contributor[] = [];

	onMount(async () => {
		// Check if the data is already in sessionStorage
		const cachedContribs = sessionStorage.getItem("ghContribs");
		if (cachedContribs) {
			ghContribs = JSON.parse(cachedContribs);
			log(["about"], "loaded GitHub contributors from cache");
			return;
		}

		// Fetch GitHub contributors
		try {
			const response = await fetch(`${GITHUB_API_URL}/contributors`);
			if (!response.ok) {
				addToast("error", "Error fetching GitHub contributors");
				throw new Error(`HTTP error, status: ${response.status}`);
			}
			const allContribs = await response.json();

			// Filter out main contributors
			const mainContribNames = mainContribs.map((contrib) =>
				contrib.github.split("/").pop(),
			);
			const filteredContribs = allContribs.filter(
				(contrib: { login: string }) =>
					!mainContribNames.includes(contrib.login),
			);

			// Fetch and cache avatar images as Base64
			const fetchAvatar = async (url: string) => {
				const res = await fetch(url);
				const blob = await res.blob();
				return new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onloadend = () => resolve(reader.result as string);
					reader.onerror = reject;
					reader.readAsDataURL(blob);
				});
			};

			ghContribs = await Promise.all(
				filteredContribs.map(
					async (contrib: {
						login: string;
						avatar_url: string;
						html_url: string;
					}) => ({
						name: contrib.login,
						avatar: await fetchAvatar(contrib.avatar_url),
						github: contrib.html_url,
					}),
				),
			);

			// Cache the data in sessionStorage
			sessionStorage.setItem("ghContribs", JSON.stringify(ghContribs));
		} catch (e) {
			error(["general"], `Error fetching GitHub contributors: ${e}`);
		}
	});
</script>

<div class="flex flex-col h-full items-center">
	<h1 class="hidden md:block text-[40px] tracking-tight leading-[72px] mb-6">
		<InfoIcon size="40" class="inline-block -mt-2 mr-2" />
		About
	</h1>

	<div
		class="w-full max-w-[1280px] flex flex-col md:flex-row gap-4 p-4 md:px-4 md:py-0"
	>
		<!-- Why VERT? & Credits -->
		<div class="flex flex-col gap-4 flex-1">
			<About.Why />
			<About.Vertd />
		</div>

		<!-- Resources & Donate to VERT -->
		<div class="flex flex-col gap-4 flex-1">
			<About.Resources />
			<About.Credits {mainContribs} {ghContribs} />
			<!-- <About.Donate /> -->
		</div>
	</div>
</div>
