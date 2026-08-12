// Copies the Phase 14 WordPress plugin's static PHP files
// (integrations/wordpress/sameview-comparisons/) into
// public/generated/wordpress-plugin/sameview-comparisons/ —
// docs/IMPLEMENTATION_PLAN_V1.md Phase 15's one approved coupling between
// this application and the isolated WordPress integration area
// (CLAUDE.md "Hard Constraints": build-time only, one-directional,
// content-only; no PHP/WordPress runtime dependency is introduced into the
// Astro/React application — this script only ever copies opaque bytes).
//
// A byte-for-byte copy only: PHP needs no bundling or transformation, unlike
// the TypeScript-built Presentation runtime script
// (scripts/build-presentation-runtime.mjs). Also writes a manifest.json
// listing every copied file's own zip-root-relative path, so
// src/lib/comparison-artifact-assets.ts's `fetchWordPressPluginFiles()`
// never has to hardcode that file list a second time — the two would
// otherwise be able to drift out of sync.
//
// Wired into both `pnpm dev` and `pnpm build` (package.json). Unlike the
// runtime script, no dev-time in-memory serving plugin is needed: these
// files need no build step at all, so a plain one-shot copy before Astro's
// dev server starts is sufficient — Astro already serves `public/**` as
// ordinary static files in dev, exactly as it does in production.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const PLUGIN_SLUG = "sameview-comparisons";
const SOURCE_DIR = join(
	projectRoot,
	"integrations",
	"wordpress",
	"sameview-comparisons",
);
const DEST_ROOT = join(projectRoot, "public", "generated", "wordpress-plugin");

async function collectFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectFiles(fullPath)));
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}
	return files;
}

// Zip-root-relative, forward-slash paths regardless of host OS — `join()`
// produces backslashes on Windows, which would otherwise leak into the
// manifest and, from there, into the generated ZIP's own entry names
// (src/lib/generate-wordpress-package.ts).
function toZipRelativePath(absolutePath) {
	return join(PLUGIN_SLUG, relative(SOURCE_DIR, absolutePath))
		.split("\\")
		.join("/");
}

export async function buildWordPressPluginAssets() {
	const sourceFiles = await collectFiles(SOURCE_DIR);
	const manifest = [];
	for (const sourceFile of sourceFiles) {
		const zipRelativePath = toZipRelativePath(sourceFile);
		const destPath = join(DEST_ROOT, zipRelativePath);
		await mkdir(dirname(destPath), { recursive: true });
		await writeFile(destPath, await readFile(sourceFile));
		manifest.push(zipRelativePath);
	}
	manifest.sort();
	await mkdir(DEST_ROOT, { recursive: true });
	await writeFile(
		join(DEST_ROOT, "manifest.json"),
		JSON.stringify(manifest, null, "\t"),
	);
	return manifest;
}

// CLI entry point — `pnpm build:wordpress-plugin-assets`, wired into both
// `pnpm dev` and `pnpm build` (package.json).
const isMainModule =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
	const manifest = await buildWordPressPluginAssets();
	console.log(
		`Copied ${manifest.length} WordPress plugin file(s) to public/generated/wordpress-plugin/`,
	);
}
