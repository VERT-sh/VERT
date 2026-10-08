import { paraglideVitePlugin } from "@inlang/paraglide-js";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, type PluginOption } from "vite";
import svg from "@poppanator/sveltekit-svg";
import wasm from "vite-plugin-wasm";
import { execSync } from "child_process";

// coollify removes the .git folder but exposes commit via SOURCE_COMMIT env variable
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
			],
		},
		build: {
			target: "esnext",
		},
		define: {
			__COMMIT_HASH__: JSON.stringify(commitHash),
		},
	};
});
