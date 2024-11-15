import { log } from "$lib/logger";
import { VertFile } from "$lib/types";
import JSCookie from "js-cookie";

class Files {
	public files = $state<VertFile[]>([]);
}

class Theme {
	public dark = $state(false);
	public toggle = () => {
		this.dark = !this.dark;
		JSCookie.set("theme", this.dark ? "dark" : "light", {
			path: "/",
			sameSite: "lax",
			expires: 2147483647,
		});
		log(["theme"], `set to ${this.dark ? "dark" : "light"}`);
	};
}

export const files = new Files();

export const theme = new Theme();

export const outputFilenameOption = ["default", "original", "custom"];
