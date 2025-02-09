import { browser } from "$app/environment";

export const load = ({ data }) => {
	if (!browser) return;
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
