import { PUB_ENV } from "$env/static/public";

export const GITHUB_URL_VERT = "https://github.com/VERT-sh/VERT";
export const GITHUB_URL_VERTD = "https://github.com/VERT-sh/vertd";
export const GITHUB_API_URL = "https://api.github.com/repos/VERT-sh/VERT";
export const DISCORD_URL = "https://discord.gg/kqevGxYPak";
export const VERT_NAME =
	PUB_ENV === "development"
		? "VERT Local"
		: PUB_ENV === "nightly"
			? "VERT Nightly"
			: "VERT.sh";
