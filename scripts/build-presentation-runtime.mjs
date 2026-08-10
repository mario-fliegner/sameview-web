// Bundles src/lib/comparison-presentation-runtime-entry.ts (and every module
// it imports) into one self-contained, dependency-free plain-JS file — the
// script Standalone HTML/Static Microsite embed/copy at generation time
// (src/lib/comparison-artifact-assets.ts).
//
// `buildPresentationRuntimeCode()` below is the *only* place this bundling
// happens — the single shared source for both consumers:
// - the CLI entry point further down (`pnpm build:runtime`, part of
//   `pnpm build`): writes the result to `public/generated/comparison-presentation-runtime.js`,
//   a real static asset for production, served by the Node adapter exactly
//   like `public/fonts/**`.
// - scripts/vite-plugin-presentation-runtime-dev.mjs (dev-only): serves the
//   same function's result directly from memory, so `astro dev` never
//   depends on that static file existing at all — see that plugin's own
//   header comment for why (a real incident: a deleted `public/generated/`
//   left an already-running dev server permanently 404ing on this exact
//   path, since nothing was watching that directory).
//
// `configFile: false` and a from-scratch config object (never Astro's own
// resolved Vite config) keep this a fully isolated, one-shot Rollup build —
// required so a nested call from inside the dev plugin (itself running
// inside Astro's own Vite dev server) can never recursively load
// astro.config.mjs or otherwise re-enter the outer server's own config.
//
// Uses Vite's own JS build API (already a project devDependency — no new
// package).

import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export async function buildPresentationRuntimeCode() {
	const result = await build({
		root: projectRoot,
		configFile: false,
		logLevel: "warn",
		// Disabled: `publicDir`'s default behavior copies the *entire* `public/`
		// directory into `outDir` on every run — irrelevant here (`write:
		// false` never touches `outDir` at all), but disabled regardless so
		// this stays a minimal, side-effect-free in-memory build no matter how
		// it is invoked.
		publicDir: false,
		build: {
			// In-memory only: the caller decides whether/where to persist the
			// result (the CLI writes a file below; the dev plugin never writes
			// one at all).
			write: false,
			lib: {
				entry: "src/lib/comparison-presentation-runtime-entry.ts",
				name: "SameViewComparisonPresentationRuntime",
				formats: ["iife"],
				fileName: () => "comparison-presentation-runtime.js",
			},
			// A tiny, focused script — readable output is more useful than the
			// last few bytes saved, and this never ships as part of the app's own
			// bundle (it is only ever fetched as inert text to re-embed).
			minify: false,
		},
	});
	const output = Array.isArray(result) ? result[0] : result;
	const chunk = output.output.find((entry) => entry.type === "chunk");
	if (!chunk || !("code" in chunk)) {
		throw new Error("Presentation runtime build produced no output chunk");
	}
	return chunk.code;
}

// CLI entry point — `pnpm build:runtime`, wired into `pnpm build` only (see
// package.json; `pnpm dev` no longer needs this, the dev plugin covers it).
const isMainModule =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
	const { mkdir, writeFile } = await import("node:fs/promises");
	const { join } = await import("node:path");
	const code = await buildPresentationRuntimeCode();
	const outDir = join(projectRoot, "public", "generated");
	await mkdir(outDir, { recursive: true });
	await writeFile(join(outDir, "comparison-presentation-runtime.js"), code);
}
