// Bundles src/lib/comparison-presentation-runtime-entry.ts (and every module
// it imports) into one self-contained, dependency-free plain-JS file — the
// script Standalone HTML/Static Microsite embed/copy at generation time
// (src/lib/comparison-artifact-assets.ts). Also builds the shared
// Presentation CSS (src/styles/comparison-presentation.css and
// src/styles/comparison-artifact-frame.css) into a minified variant used
// exclusively by Static Microsite — Standalone HTML keeps consuming those
// same two files unminified via its own existing `?raw` imports, untouched
// by this script.
//
// `buildPresentationRuntimeCode()` and `buildPresentationCssCode()` below are
// the *only* places this bundling happens — the single shared source for
// both consumers:
// - the CLI entry point further down (`pnpm build:runtime`, part of
//   `pnpm build`): writes the results to `public/generated/`, real static
//   assets for production, served by the Node adapter exactly like
//   `public/fonts/**`.
// - scripts/vite-plugin-presentation-runtime-dev.mjs (dev-only): serves the
//   same functions' results directly from memory, so `astro dev` never
//   depends on those static files existing at all — see that plugin's own
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
// Uses Vite's own JS/CSS build API (already a project devDependency — no new
// package). CSS minification goes through Vite's `cssMinify: "esbuild"`
// option — the same esbuild already resolved as Vite's own peer dependency
// for the JS build below, never imported directly by this project (verified:
// esbuild is not a direct dependency and is not otherwise reachable from
// application code — only Vite's own internal `build()` machinery uses it).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

// Rollup (via `minify: false` above) inserts its own `//#region <path>` /
// `//#endregion` module-boundary comments into the bundled output, one pair
// per source module it concatenates — the *original* .ts source files' own
// developer comments do not themselves survive this build at all. Left
// alone, these auto-inserted markers are the only comments in the output,
// and they reveal this project's internal `src/lib/*.ts` file layout inside
// a distributed artifact (this script's own result is embedded/copied
// verbatim by src/lib/comparison-artifact-assets.ts into both Standalone
// HTML and the Static Microsite). Anchored to the start of a line so it can
// never touch a genuine `//` occurring elsewhere (e.g. inside a string
// literal such as a URL) — actual code never starts a line with
// `//#region`/`//#endregion`.
function stripBundlerRegionMarkers(code) {
	return code.replace(/^[ \t]*\/\/#(?:region|endregion).*\n?/gm, "");
}

// `minify`: false (default) produces the existing readable variant embedded
// by Standalone HTML and copied unminified nowhere else; true produces the
// Static-Microsite-only minified variant — same entry, same module graph,
// the only difference is this one Vite/esbuild build option. No second
// runtime implementation exists.
export async function buildPresentationRuntimeCode({ minify = false } = {}) {
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
				fileName: () =>
					minify
						? "comparison-presentation-runtime.min.js"
						: "comparison-presentation-runtime.js",
			},
			// Readable by default — this is a tiny, focused script where readable
			// output is more useful than the last few bytes saved, and it never
			// ships as part of the app's own bundle (it is only ever fetched as
			// inert text to re-embed). `minify: true` is used exclusively to
			// produce the separate Static-Microsite-only variant above.
			minify,
		},
	});
	const output = Array.isArray(result) ? result[0] : result;
	const chunk = output.output.find((entry) => entry.type === "chunk");
	if (!chunk || !("code" in chunk)) {
		throw new Error("Presentation runtime build produced no output chunk");
	}
	return stripBundlerRegionMarkers(chunk.code);
}

// Builds the Static-Microsite-only minified variant of the two shared,
// unmodified Presentation CSS source files
// (src/styles/comparison-presentation.css, src/styles/comparison-artifact-frame.css)
// via the same isolated, `configFile: false` Vite build already used for the
// runtime script above, using Vite's own `cssMinify: "esbuild"` build option
// — empirically verified against these exact two files to produce minified,
// comment-free CSS text in memory (`write: false`), through the same esbuild
// Vite already resolves as its own peer dependency for the JS build, no new
// dependency. Standalone HTML never calls this function: it keeps reading
// these same two files unminified via its own existing `?raw` imports.
// Concatenated in the same fixed order `composeArtifactCss` already uses for
// these two sources: Presentation CSS, then Frame CSS. The dynamic, per-font
// `@font-face` rule is deliberately not part of this build — it does not
// exist as a file on disk, and is instead produced compactly at generation
// time by src/lib/presentation-font-assets.ts `buildFontFaceCss` (`compact:
// true`), then prepended by the Static Microsite generator.
export async function buildPresentationCssCode() {
	const result = await build({
		root: projectRoot,
		configFile: false,
		logLevel: "warn",
		publicDir: false,
		build: {
			write: false,
			cssMinify: "esbuild",
			rollupOptions: {
				input: {
					presentation: "src/styles/comparison-presentation.css",
					frame: "src/styles/comparison-artifact-frame.css",
				},
			},
		},
	});
	const output = Array.isArray(result) ? result[0] : result;
	// Keyed by `originalFileName` (Rollup's own record of the actual source
	// path each asset was built from — verified present on every emitted
	// asset for this exact two-entry CSS build) rather than the derived
	// `name`/`names` output-naming fields, so this stays correct even if
	// Vite's own entry-key-to-output-name derivation ever changes.
	const cssByOriginalFileName = new Map(
		output.output
			.filter((entry) => entry.type === "asset")
			.map((entry) => [
				entry.originalFileName,
				typeof entry.source === "string"
					? entry.source
					: Buffer.from(entry.source).toString("utf8"),
			]),
	);
	const presentationCss = cssByOriginalFileName.get(
		"src/styles/comparison-presentation.css",
	);
	const frameCss = cssByOriginalFileName.get(
		"src/styles/comparison-artifact-frame.css",
	);
	if (presentationCss === undefined || frameCss === undefined) {
		throw new Error(
			"Presentation CSS build did not produce the expected comparison-presentation.css/comparison-artifact-frame.css assets",
		);
	}
	return `${presentationCss}\n${frameCss}`;
}

// docs/IMPLEMENTATION_PLAN_V1.md Phase 16 ("WordPress Block Editor
// Placement"): the smallest possible bundle pairing
// src/lib/comparison-artifact-markup.ts `buildComparisonArtifactMarkup` with
// src/lib/comparison-presentation-runtime.ts `initComparisonPresentation` —
// see src/lib/comparison-embed-runtime-entry.ts's own header comment for why
// this is a new *entry point* around two unmodified, already-shared modules,
// never a second renderer. Uses the exact same isolated Vite `build()` shape
// as `buildPresentationRuntimeCode` above (only the entry file and library
// name differ) so this can never recursively load astro.config.mjs either.
// Fetched by src/lib/comparison-artifact-assets.ts and packaged into the
// generated WordPress ZIP by src/lib/generate-wordpress-package.ts — this
// compiled output is never committed inside integrations/wordpress/ itself
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 16 Decision 72).
export async function buildComparisonEmbedRuntimeCode() {
	const result = await build({
		root: projectRoot,
		configFile: false,
		logLevel: "warn",
		publicDir: false,
		build: {
			write: false,
			lib: {
				entry: "src/lib/comparison-embed-runtime-entry.ts",
				name: "SameViewComparisonEmbed",
				formats: ["iife"],
				fileName: () => "comparison-embed-runtime.js",
			},
			minify: false,
		},
	});
	const output = Array.isArray(result) ? result[0] : result;
	const chunk = output.output.find((entry) => entry.type === "chunk");
	if (!chunk || !("code" in chunk)) {
		throw new Error("Comparison embed runtime build produced no output chunk");
	}
	return stripBundlerRegionMarkers(chunk.code);
}

// The WordPress Embed CSS: the same src/styles/comparison-presentation.css
// every other output already shares, plus the `@font-face` rule(s) for
// *every* Presentation Font (never just one, unlike Standalone HTML/Static
// Microsite: a WordPress site's stored Comparisons may each use a different
// font, and Phase 16 does not implement Phase 17's per-page conditional
// asset selection) — resolved via src/lib/presentation-font-assets.ts
// `buildFontFaceCss`, the same function every other output already uses,
// never a second font-packaging implementation. Deliberately excludes
// src/styles/comparison-artifact-frame.css: that stylesheet's only rule is
// scoped to the single-instance-only `#sameview-canvas` id
// (src/lib/comparison-artifact-markup.ts never emits it in "multi-instance"
// mode — see that module's own header comment), so it has nothing to select
// in a WordPress embed context. No Vite build needed here — unlike the JS
// runtime above, this is a plain-text composition of already-plain-text
// sources via src/lib/comparison-artifact-scaffold.ts `composeArtifactCss`
// (which already strips developer comments at exactly this distribution
// boundary), so it reuses that function directly rather than introducing a
// second CSS composition path.
export async function buildComparisonEmbedCssCode() {
	const [{ buildFontFaceCss }, { PRESENTATION_FONT_IDS }, { composeArtifactCss }] =
		await Promise.all([
			import("../src/lib/presentation-font-assets.ts"),
			import("../src/lib/presentation-fonts.ts"),
			import("../src/lib/comparison-artifact-scaffold.ts"),
		]);
	const presentationCss = await readFile(
		join(projectRoot, "src/styles/comparison-presentation.css"),
		"utf8",
	);
	// Relative to this CSS file's own eventual location inside the generated
	// WordPress package (`sameview-comparisons/assets/embed/comparison-embed.css`),
	// resolved against the font files' own location there
	// (`sameview-comparisons/assets/fonts/...` —
	// src/lib/generate-wordpress-package.ts places both under a fixed,
	// known-at-build-time relative layout, so no site-specific URL
	// substitution is ever needed inside this CSS text itself).
	const fontFaceCss = PRESENTATION_FONT_IDS.map((id) =>
		buildFontFaceCss(id, (file) => `../fonts/${file.path}`),
	).join("\n\n");
	return composeArtifactCss(fontFaceCss, presentationCss, "");
}

// CLI entry point — `pnpm build:runtime`, wired into `pnpm build` only (see
// package.json; `pnpm dev` no longer needs this, the dev plugin covers it).
const isMainModule =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
	const { mkdir, writeFile } = await import("node:fs/promises");
	const { join } = await import("node:path");
	const [readableCode, minifiedCode, cssCode, embedRuntimeCode, embedCssCode] =
		await Promise.all([
			buildPresentationRuntimeCode(),
			buildPresentationRuntimeCode({ minify: true }),
			buildPresentationCssCode(),
			buildComparisonEmbedRuntimeCode(),
			buildComparisonEmbedCssCode(),
		]);
	const outDir = join(projectRoot, "public", "generated");
	await mkdir(outDir, { recursive: true });
	await Promise.all([
		writeFile(
			join(outDir, "comparison-presentation-runtime.js"),
			readableCode,
		),
		writeFile(
			join(outDir, "comparison-presentation-runtime.min.js"),
			minifiedCode,
		),
		writeFile(join(outDir, "comparison-presentation.min.css"), cssCode),
		writeFile(join(outDir, "comparison-embed-runtime.js"), embedRuntimeCode),
		writeFile(join(outDir, "comparison-embed.css"), embedCssCode),
	]);
}
