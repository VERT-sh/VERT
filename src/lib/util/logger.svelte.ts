/* eslint-disable @typescript-eslint/no-explicit-any */
import { browser } from "$app/env";

export type LogLevel = "log" | "error";

export interface LogEntry {
	id: number;
	time: string; // HH:MM:SS.mmm, pre-formatted for display/export
	timestamp: number; // epoch ms
	level: LogLevel;
	prefixes: string[];
	message: string;
}

export const MAX_LOG_ENTRIES = 1000;

export const logs = $state<{ entries: LogEntry[] }>({ entries: [] });

let internalWrite = false;
let consoleInstalled = false;
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const originalConsole = new Map<string, (...args: any[]) => void>();

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

const formatTime = (date: Date) =>
	`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

const stripConsoleStyles = (args: unknown[]): unknown[] => {
	if (typeof args[0] === "string" && args[0].includes("%c")) {
		const format = args[0];
		const styleCount = (format.match(/%c/g) ?? []).length;
		const cleaned = format.replace(/%c/g, "").trim();
		return [cleaned, ...args.slice(1 + styleCount)];
	}
	return args;
};

const stringifyArg = (arg: unknown): string => {
	if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
	if (typeof arg === "string") return arg;
	if (arg === null) return "null";
	if (arg === undefined) return "undefined";
	try {
		if (typeof arg === "object") return JSON.stringify(arg);
		return String(arg);
	} catch {
		return String(arg);
	}
};

export const formatLogMessage = (args: unknown[]) =>
	args.map(stringifyArg).join(" ");

export const formatLogLine = (entry: LogEntry) =>
	`[${entry.time}]${entry.prefixes.map((p) => ` [${p}]`).join("")} ${entry.message}`;

export const addLog = (
	level: LogLevel,
	prefix: string | string[],
	...args: any[]
) => {
	if (!browser) return;
	const prefixes = Array.isArray(prefix) ? prefix : [prefix];
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const now = new Date();
	logs.entries.push({
		id: logs.entries.length
			? logs.entries[logs.entries.length - 1].id + 1
			: 1,
		time: formatTime(now),
		timestamp: now.getTime(),
		level,
		prefixes,
		message: formatLogMessage(args),
	});
	if (logs.entries.length > MAX_LOG_ENTRIES) {
		logs.entries.splice(0, logs.entries.length - MAX_LOG_ENTRIES);
	}
};

export const clearLogs = () => {
	logs.entries = [];
};

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

export const printToConsole = (
	level: LogLevel,
	prefix: string | string[],
	...args: any[]
) => {
	const prefixes = Array.isArray(prefix) ? prefix : [prefix];
	if (!browser)
		return level === "error"
			? console.error(prefixes.map((p) => `[${p}]`).join(" "), ...args)
			: console.log(prefixes.map((p) => `[${p}]`).join(" "), ...args);
	const prefixesWithMeta = prefixes.map((p) => ({
		prefix: p,
		bgColor: randomColorFromStr(p),
		textColor: whiteOrBlack(randomColorFromStr(p)),
	}));

	const write = level === "error" ? console.error : console.log;
	internalWrite = true;
	try {
		write(
			`%c${prefixesWithMeta.map(({ prefix }) => prefix).join(" %c")}`,
			...prefixesWithMeta.map(
				({ bgColor, textColor }, i) =>
					`color: ${textColor}; background-color: ${bgColor}; margin-left: ${i === 0 ? 0 : -6}px; padding: 0px 4px 0 4px; border-radius: 0px 9999px 9999px 0px;`,
			),
			...args,
		);
	} finally {
		internalWrite = false;
	}
};

export const installConsoleCapture = () => {
	if (!browser || consoleInstalled) return;
	consoleInstalled = true;

	const capture: Array<[keyof Console, LogLevel]> = [
		["log", "log"],
		["info", "log"],
		["debug", "log"],
		["warn", "log"],
		["error", "error"],
	];

	for (const [method, level] of capture) {
		const original = (console[method] as (...args: any[]) => void).bind(
			console,
		);
		originalConsole.set(method, original);

		(console as unknown as Record<string, unknown>)[method] = (
			...args: any[]
		) => {
			if (!internalWrite)
				addLog(level, ["console"], ...stripConsoleStyles(args));
			original(...args);
		};
	}
};

export const uninstallConsoleCapture = () => {
	if (!browser || !consoleInstalled) return;
	for (const [method, original] of originalConsole) {
		(console as unknown as Record<string, unknown>)[method] = original;
	}
	originalConsole.clear();
	consoleInstalled = false;
};

export const log = (prefix: string | string[], ...args: any[]) => {
	addLog("log", prefix, ...args);
	printToConsole("log", prefix, ...args);
};

export const error = (prefix: string | string[], ...args: any[]) => {
	addLog("error", prefix, ...args);
	printToConsole("error", prefix, ...args);
};
