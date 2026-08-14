// Copies the Phase 19 Joomla extension's static PHP/XML files
// (integrations/joomla/com_sameviewcomparisons/) into
// public/generated/joomla-extension/ — docs/IMPLEMENTATION_PLAN_V1.md
// Phase 21's approved coupling between this application and the isolated
// Joomla integration area (CLAUDE.md "Hard Constraints": build-time only,
// one-directional, content-only; no PHP/Joomla runtime dependency is
// introduced into the Astro/React application — this script only ever
// copies opaque bytes), mirroring scripts/build-wordpress-plugin-assets.mjs.
//
// Unlike that WordPress script, paths are copied WITHOUT a wrapping slug
// folder: confirmed against real Joomla 6.1.2/5.4.7 instances
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 19) that a Joomla install package
// needs its manifest XML and script.php at the package's own root — the
// same root-relative layout integrations/joomla/scripts/build-package.mjs
// already uses for its own (seed-less) test package.
//
// A byte-for-byte copy only — no bundling/transformation needed, exactly
// like the WordPress plugin's own PHP files. Also writes a manifest.json
// listing every copied file's own zip-root-relative path, so
// src/lib/comparison-artifact-assets.ts's `fetchJoomlaExtensionFiles()`
// never has to hardcode that file list a second time.
//
// Wired into both `pnpm dev` and `pnpm build` (package.json), exactly like
// `build:wordpress-plugin-assets`.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_DIR = join(
	projectRoot,
	"integrations",
	"joomla",
	"com_sameviewcomparisons",
);
const DEST_ROOT = join(projectRoot, "public", "generated", "joomla-extension");

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
// (src/lib/generate-joomla-package.ts).
function toZipRelativePath(absolutePath) {
	return relative(SOURCE_DIR, absolutePath).split("\\").join("/");
}

export async function buildJoomlaExtensionAssets() {
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

// CLI entry point — `pnpm build:joomla-extension-assets`, wired into both
// `pnpm dev` and `pnpm build` (package.json).
const isMainModule =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
	const manifest = await buildJoomlaExtensionAssets();
	console.log(
		`Copied ${manifest.length} Joomla extension file(s) to public/generated/joomla-extension/`,
	);
}
