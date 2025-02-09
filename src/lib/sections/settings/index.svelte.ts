import type { ConversionSpeed } from "$lib/converters/vertd.svelte";

export { default as Appearance } from "./Appearance.svelte";
export { default as Conversion } from "./Conversion.svelte";
export { default as Vertd } from "./Vertd.svelte";

export interface ISettings {
	filenameFormat: string;
	vertdURL: string;
	vertdSpeed: ConversionSpeed;
}

export class Settings {
	public static instance = new Settings();

	public settings: ISettings = $state({
		filenameFormat: "VERT_%name%",
		vertdURL: "",
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
