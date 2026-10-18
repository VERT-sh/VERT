import { paraglideVitePlugin } from "@inlang/paraglide-js";
import svg from "@poppanator/sveltekit-svg";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { execSync } from "child_process";
import { resolve } from "node:path";
import { defineConfig, type PluginOption } from "vite";
import wasm from "vite-plugin-wasm";

const pandocPath = (path: string) => resolve("node_modules/pandoc-wasm", path);

// coolify removes the .git folder but exposes commit via SOURCE_COMMIT env variable
let commitHash = process.env.SOURCE_COMMIT
	? process.env.SOURCE_COMMIT.substring(0, 7) // shorten it lol
	: "unknown";

if (commitHash === "unknown") {
	try {
		commitHash = execSync("git rev-parse --short HEAD").toString().trim();
	} catch (e) {
		console.warn(`Could not determine Git commit hash: ${e}`);
		commitHash = "unknown";
	}
}

export default defineConfig(({ command }) => {
	const plugins: PluginOption[] = [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter(),
			paths: {
				relative: false,
			},
		}),
		paraglideVitePlugin({
			project: "./project.inlang",
			outdir: "./src/lib/paraglide",
			strategy: ["localStorage", "preferredLanguage", "baseLocale"],
		}),
		svg({
			includePaths: ["./src/lib/assets"],
			svgoOptions: {
				multipass: true,
				plugins: [
					{
						name: "preset-default",
					},
					{ name: "removeAttrs", params: { attrs: "(fill|stroke)" } },
				],
			},
		}),
	];

	if (command === "serve") {
		plugins.unshift(wasm());
	}

	return {
		plugins,
		resolve: {
			alias: [
				{
					find: "pandoc-wasm/core",
					replacement: pandocPath("src/core.js"),
				},
				{
					// regex so it also matches the "?url" query suffix (a plain string wouldn't)
					find: /^pandoc-wasm\/wasm/,
					replacement: pandocPath("src/pandoc.wasm"),
				},
			],
		},
		worker: {
			plugins: () => [wasm()],
			format: "es",
		},
		optimizeDeps: {
			exclude: [
				"@ffmpeg/core",
				"@ffmpeg/core-mt",
				"@ffmpeg/ffmpeg",
				"@ffmpeg/util",
				"wasm-vips",
			],
		},
		server: {
			headers: {
				"Cross-Origin-Embedder-Policy": "credentialless",
				"Cross-Origin-Opener-Policy": "same-origin",
			},
		},
		build: {
			target: "esnext",
		},
		define: {
			__COMMIT_HASH__: JSON.stringify(commitHash),
		},
	};
});
