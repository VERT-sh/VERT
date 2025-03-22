import { PUB_VERTD_URL } from "$env/static/public";
import type { ConversionSpeed } from "$lib/converters/vertd.svelte";

export { default as Appearance } from "./Appearance.svelte";
export { default as Conversion } from "./Conversion.svelte";
export { default as Vertd } from "./Vertd.svelte";
export { default as Privacy } from "./Privacy.svelte";

export interface ISettings {
	filenameFormat: string;
	plausible: boolean;
	vertdURL: string;
	vertdSpeed: ConversionSpeed;
}

export class Settings {
	public static instance = new Settings();

	public settings: ISettings = $state({
		filenameFormat: "VERT_%name%",
		plausible: true,
		vertdURL: PUB_VERTD_URL,
		vertdSpeed: "slow",
	});

	public save() {
		localStorage.setItem("settings", JSON.stringify(this.settings));
	}

	public load() {
		const ls = localStorage.getItem("settings");
		if (!ls) return;
		const settings: ISettings = JSON.parse(ls);
		this.settings = {
			...this.settings,
			...settings,
		};
	}
}
