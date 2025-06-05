<script lang="ts">
	import Dropdown from "$lib/components/functional/Dropdown.svelte";
	import Panel from "$lib/components/visual/Panel.svelte";
	import { language, setLanguage } from "$lib/store/language";
	import { LanguagesIcon } from "lucide-svelte";
	import { type Locales } from "$lib/types/locales";
	import { t } from "$lib/locales";

	export const supportedLanguages = {
		en: "English",
		it: "Italiano",
	};

	const handleSelect = (option: string) => {
		console.log(option);
		const lang = Object.keys(supportedLanguages)[
			Object.values(supportedLanguages).findIndex(
				(value) => value === option,
			)
		] as Locales;
		if (lang) setLanguage(lang);
	};
</script>

<Panel class="flex flex-col gap-8 p-6">
	<div class="flex flex-col gap-3">
		<h2 class="text-2xl font-bold">
			<LanguagesIcon
				size="40"
				class="inline-block -mt-1 mr-2 bg-accent-purple p-2 rounded-full"
				color="black"
			/>
			{$t("settings.languageTitle")}
		</h2>
		<div class="flex flex-col gap-8">
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<p class="text-base font-bold">
						{$t("settings.chooseLanguage")}
					</p>
					<p class="text-sm text-muted font-normal italic"></p>
				</div>
				<div class="flex flex-col gap-3 w-full">
					<Dropdown
						options={Object.values(supportedLanguages)}
						onselect={(option) => handleSelect(option)}
						selected={(()=>supportedLanguages[$language])()}
					/>
				</div>
			</div>
		</div>
	</div>
</Panel>
