#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

// yes, i used ai to make this but its extremely useful.
// sorry, i don't wanna migrate a million language files manually </3
// --maya

function parseArgs(argv) {
	const args = {
		base: "messages/en-original.json", // original source language file with old keys
		target: "messages/en.json", // new source language file with reorganized keys
		dir: "messages",
		dryRun: false,
		verbose: false,
		mapOut: "",
		files: ""
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--base") args.base = argv[++i];
		else if (arg === "--target") args.target = argv[++i];
		else if (arg === "--dir") args.dir = argv[++i];
		else if (arg === "--map-out") args.mapOut = argv[++i];
		else if (arg === "--files") args.files = argv[++i];
		else if (arg === "--dry-run") args.dryRun = true;
		else if (arg === "--verbose") args.verbose = true;
		else if (arg === "--help" || arg === "-h") {
			printHelp();
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return {
		...args,
		base: path.resolve(args.base),
		target: path.resolve(args.target),
		dir: path.resolve(args.dir)
	};
}

function printHelp() {
	console.log(`migrate-language-keys

Usage:
  node scripts/migrate-language-keys.mjs [options]

Options:
  --base <path>       Original source language file (default: messages/en-original.json)
  --target <path>     Reorganized source language file (default: messages/en.json)
  --dir <path>        Directory containing locale files to migrate (default: messages)
  --files <list>      Comma-separated list of files to migrate (relative or absolute paths)
  --dry-run           Preview changes without writing files
  --verbose           Print per-key migration details
  --map-out <path>    Write generated key map to JSON file
  -h, --help          Show help
`);
}

function readJson(filePath) {
	try {
		const text = fs.readFileSync(filePath, "utf8");
		return JSON.parse(text);
	} catch (err) {
		throw new Error(`Failed to read JSON from ${filePath}: ${err.message}`);
	}
}

function writeJson(filePath, data) {
	const content = `${JSON.stringify(data, null, "\t")}\n`;
	fs.writeFileSync(filePath, content, "utf8");
}

function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenLeaves(value, prefix = "", out = new Map()) {
	if (!isPlainObject(value)) {
		out.set(prefix, value);
		return out;
	}

	for (const [key, child] of Object.entries(value)) {
		if (key === "$schema") continue;
		const nextPath = prefix ? `${prefix}.${key}` : key;
		flattenLeaves(child, nextPath, out);
	}

	return out;
}

function groupByValue(leaves) {
	const byValue = new Map();
	for (const [keyPath, value] of leaves.entries()) {
		const valueKey = JSON.stringify(value);
		const list = byValue.get(valueKey) ?? [];
		list.push(keyPath);
		byValue.set(valueKey, list);
	}
	return byValue;
}

function pathTokens(keyPath) {
	return keyPath
		.split(".")
		.flatMap((part) => part.split("_"))
		.filter(Boolean);
}

function scorePathSimilarity(oldPath, newPath) {
	const oldParts = oldPath.split(".");
	const newParts = newPath.split(".");
	if (oldParts[0] !== newParts[0]) return -1000;

	const oldTokens = new Set(pathTokens(oldPath));
	const newTokens = new Set(pathTokens(newPath));
	let shared = 0;
	for (const token of oldTokens) {
		if (newTokens.has(token)) shared += 1;
	}

	const oldLast = oldParts[oldParts.length - 1];
	const newLast = newParts[newParts.length - 1];
	const oldParent = oldParts.slice(0, -1).join(".");
	const newParent = newParts.slice(0, -1).join(".");

	let score = shared * 3;
	if (oldLast === newLast) score += 6;
	if (newTokens.has(oldLast)) score += 3;
	if (oldParent && newParent && oldParent === newParent) score += 8;
	if (newPath.startsWith(oldParent)) score += 2;

	return score;
}

function matchGroup(oldPaths, newPaths) {
	const pairs = [];
	const usedNew = new Set();

	for (const oldPath of [...oldPaths].sort()) {
		const candidates = newPaths
			.filter((candidate) => !usedNew.has(candidate))
			.map((candidate) => ({
				candidate,
				score: scorePathSimilarity(oldPath, candidate)
			}))
			.sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate));

		if (candidates.length === 0) continue;
		const best = candidates[0];
		if (best.score < 0) continue;

		const second = candidates[1];
		if (second && second.score === best.score) continue;

		usedNew.add(best.candidate);
		pairs.push([oldPath, best.candidate]);
	}

	return pairs;
}

function buildMigrationMap(baseJson, targetJson) {
	const baseLeaves = flattenLeaves(baseJson);
	const targetLeaves = flattenLeaves(targetJson);
	const baseByValue = groupByValue(baseLeaves);
	const targetByValue = groupByValue(targetLeaves);

	const migrationMap = new Map();
	const unresolved = [];

	for (const [valueKey, oldPaths] of baseByValue.entries()) {
		const newPaths = targetByValue.get(valueKey);
		if (!newPaths || newPaths.length === 0) continue;

		if (oldPaths.length === 1 && newPaths.length === 1) {
			const oldPath = oldPaths[0];
			const newPath = newPaths[0];
			if (oldPath !== newPath) migrationMap.set(oldPath, newPath);
			continue;
		}

		const pairs = matchGroup(oldPaths, newPaths);
		const matchedOld = new Set(pairs.map(([oldPath]) => oldPath));

		for (const [oldPath, newPath] of pairs) {
			if (oldPath !== newPath) migrationMap.set(oldPath, newPath);
		}

		for (const oldPath of oldPaths) {
			if (!matchedOld.has(oldPath)) {
				unresolved.push({
					oldPath,
					value: JSON.parse(valueKey),
					candidateCount: newPaths.length
				});
			}
		}
	}

	return { migrationMap, unresolved };
}

function getAtPath(obj, keyPath) {
	const parts = keyPath.split(".");
	let cursor = obj;
	for (const part of parts) {
		if (!isPlainObject(cursor) || !(part in cursor)) return undefined;
		cursor = cursor[part];
	}
	return cursor;
}

function setAtPath(obj, keyPath, value) {
	const parts = keyPath.split(".");
	let cursor = obj;
	for (let i = 0; i < parts.length - 1; i += 1) {
		const part = parts[i];
		if (!isPlainObject(cursor[part])) cursor[part] = {};
		cursor = cursor[part];
	}
	cursor[parts[parts.length - 1]] = value;
}

function deleteAtPath(obj, keyPath) {
	const parts = keyPath.split(".");
	let cursor = obj;
	for (let i = 0; i < parts.length - 1; i += 1) {
		const part = parts[i];
		if (!isPlainObject(cursor[part])) return false;
		cursor = cursor[part];
	}

	const last = parts[parts.length - 1];
	if (!(last in cursor)) return false;
	delete cursor[last];

	for (let i = parts.length - 2; i >= 0; i -= 1) {
		const parentPath = parts.slice(0, i).join(".");
		const parent = i === 0 ? obj : getAtPath(obj, parentPath);
		const childKey = parts[i];
		if (!isPlainObject(parent?.[childKey])) break;
		if (Object.keys(parent[childKey]).length > 0) break;
		delete parent[childKey];
	}

	return true;
}

function resolveTargetFiles(args) {
	if (args.files.trim().length > 0) {
		return args.files
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean)
			.map((entry) => path.resolve(entry));
	}

	const files = fs
		.readdirSync(args.dir)
		.filter((name) => name.endsWith(".json"))
		.map((name) => path.join(args.dir, name));

	return files.filter((filePath) => filePath !== args.base && filePath !== args.target);
}

function migrateLocaleFile(filePath, migrationMap, options) {
	const json = readJson(filePath);
	const original = JSON.parse(JSON.stringify(json));
	let moved = 0;
	let skippedConflicts = 0;
	let unchanged = 0;

	const entries = [...migrationMap.entries()].sort((a, b) => b[0].split(".").length - a[0].split(".").length);
	const planned = [];
	const plannedNewPaths = [];

	for (const [oldPath, newPath] of entries) {
		const oldValue = getAtPath(original, oldPath);
		if (oldValue === undefined) {
			unchanged += 1;
			continue;
		}

		const existingNew = getAtPath(original, newPath);
		if (existingNew !== undefined) {
			if (JSON.stringify(existingNew) === JSON.stringify(oldValue)) {
				planned.push({ oldPath, newPath, oldValue, targetAlreadyMatched: true });
				plannedNewPaths.push(newPath);
				continue;
			}

			skippedConflicts += 1;
			if (options.verbose) console.warn(`[conflict] ${path.basename(filePath)}: ${oldPath} -> ${newPath}`);
			continue;
		}

		planned.push({ oldPath, newPath, oldValue, targetAlreadyMatched: false });
		plannedNewPaths.push(newPath);
	}

	for (const plan of planned) {
		if (!plan.targetAlreadyMatched) {
			setAtPath(json, plan.newPath, plan.oldValue);
			if (options.verbose) console.log(`[move] ${path.basename(filePath)}: ${plan.oldPath} -> ${plan.newPath}`);
		}

		const becomesParentCategory = plannedNewPaths.some((newPath) => newPath.startsWith(`${plan.oldPath}.`));
		if (becomesParentCategory) {
			moved += 1;
			continue;
		}

		deleteAtPath(json, plan.oldPath);
		moved += 1;
	}

	if (moved > 0 && !options.dryRun) writeJson(filePath, json);

	return { moved, skippedConflicts, unchanged, changed: moved > 0 };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const baseJson = readJson(args.base);
	const targetJson = readJson(args.target);

	const { migrationMap, unresolved } = buildMigrationMap(baseJson, targetJson);

	if (args.mapOut) {
		const output = {
			base: args.base,
			target: args.target,
			generatedAt: new Date().toISOString(),
			mapping: Object.fromEntries([...migrationMap.entries()].sort(([a], [b]) => a.localeCompare(b))),
			unresolved
		};
		writeJson(path.resolve(args.mapOut), output);
	}

	const files = resolveTargetFiles(args);
	if (files.length === 0) {
		console.log("No locale files to migrate.");
		return;
	}

	let totalMoved = 0;
	let totalConflicts = 0;
	let filesChanged = 0;

	for (const filePath of files) {
		const result = migrateLocaleFile(filePath, migrationMap, args);
		totalMoved += result.moved;
		totalConflicts += result.skippedConflicts;
		if (result.changed) filesChanged += 1;
		console.log(`${path.basename(filePath)}: moved=${result.moved}, conflicts=${result.skippedConflicts}`);
	}

	console.log(`\nGenerated mapping entries: ${migrationMap.size}`);
	console.log(`Unresolved mapping entries: ${unresolved.length}`);
	console.log(`Files changed: ${filesChanged}/${files.length}`);
	console.log(`Total keys moved: ${totalMoved}`);
	console.log(`Conflicts skipped: ${totalConflicts}`);
	if (args.dryRun) console.log("Dry run mode enabled: no files were written.");
}

try {
	main();
} catch (err) {
	console.error(`[migration] ${err.message}`);
	process.exit(1);
}
