import { PUB_DISABLE_ALL_EXTERNAL_REQUESTS, PUB_ENV } from "$env/static/public";

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
export const CONTACT_EMAIL = "hello@vert.sh";

// i'm not entirely sure this should be in consts.ts, but is is technically a constant as .env is static for VERT
export const DISABLE_ALL_EXTERNAL_REQUESTS =
	PUB_DISABLE_ALL_EXTERNAL_REQUESTS === "true";
