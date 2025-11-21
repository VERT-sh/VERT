/* eslint-disable @typescript-eslint/no-explicit-any */
import { browser } from "$app/environment";

const randomColorFromStr = (str: string) => {
	// generate a pleasant color from a string, using HSL
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	const h = hash % 360;
	return `hsl(${h}, 75%, 71%)`;
};

const whiteOrBlack = (hsl: string) => {
	// determine if the text should be white or black based on the background color
	const [, , l] = hsl
		.replace("hsl(", "")
		.replace(")", "")
		.split(",")
		.map((v) => parseInt(v));
	return l > 70 ? "black" : "white";
};

export const log = (prefix: string | string[], ...args: any[]) => {
	const prefixes = Array.isArray(prefix) ? prefix : [prefix];
	if (!browser)
		return console.log(prefixes.map((p) => `[${p}]`).join(" "), ...args);
	const prefixesWithMeta = prefixes.map((p) => ({
		prefix: p,
		bgColor: randomColorFromStr(p),
		textColor: whiteOrBlack(randomColorFromStr(p)),
	}));

	console.log(
		`%c${prefixesWithMeta.map(({ prefix }) => prefix).join(" %c")}`,
		...prefixesWithMeta.map(
			({ bgColor, textColor }, i) =>
				`color: ${textColor}; background-color: ${bgColor}; margin-left: ${i === 0 ? 0 : -6}px; padding: 0px 4px 0 4px; border-radius: 0px 9999px 9999px 0px;`,
		),
		...args,
	);
};

export const error = (prefix: string | string[], ...args: any[]) => {
	const prefixes = Array.isArray(prefix) ? prefix : [prefix];
	if (!browser)
		return console.error(prefixes.map((p) => `[${p}]`).join(" "), ...args);
	const prefixesWithMeta = prefixes.map((p) => ({
		prefix: p,
		bgColor: randomColorFromStr(p),
		textColor: whiteOrBlack(randomColorFromStr(p)),
	}));

	console.error(
		`%c${prefixesWithMeta.map(({ prefix }) => prefix).join(" %c")}`,
		...prefixesWithMeta.map(
			({ bgColor, textColor }, i) =>
				`color: ${textColor}; background-color: ${bgColor}; margin-left: ${i === 0 ? 0 : -6}px; padding: 0px 4px 0 4px; border-radius: 0px 9999px 9999px 0px;`,
		),
		...args,
	);
};
