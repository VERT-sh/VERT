import { readFile } from "node:fs/promises";
import ts from "typescript";
export async function moduleUrl(url) {
	const { outputText } = ts.transpileModule(await readFile(url, "utf8"), {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
		},
	});
	let source = outputText;
	for (const match of outputText.matchAll(/from "([^"]+)"/g)) {
		const name = match[1];
		const target = name.startsWith(".")
			? await moduleUrl(new URL(name + ".ts", url))
			: import.meta.resolve(name);
		source = source.replace(JSON.stringify(name), JSON.stringify(target));
	}
	return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
