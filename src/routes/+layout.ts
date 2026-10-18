import { browser } from "$app/env";

export const load = ({ data }) => {
	if (!browser) return data;
	window.plausible =
		window.plausible ||
		((_, opts) => {
			opts?.callback?.({
				status: 200,
			});
		});

	return data;
};

export const prerender = true;
export const trailingSlash = "always";
