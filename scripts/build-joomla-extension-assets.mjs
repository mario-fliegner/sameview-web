// Copies the Joomla `pkg_sameviewcomparisons` package's static PHP/XML
// files into public/generated/joomla-extension/ —
// docs/IMPLEMENTATION_PLAN_V1.md Phase 21's approved coupling between this
// application and the isolated Joomla integration area (CLAUDE.md "Hard
// Constraints": build-time only, one-directional, content-only; no
// PHP/Joomla runtime dependency is introduced into the Astro/React
// application — this script only ever copies opaque bytes), mirroring
// scripts/build-wordpress-plugin-assets.mjs.
//
// docs/IMPLEMENTATION_PLAN_V1.md Phase 22: the generated package is now a
// real native Joomla package extension (pkg_sameviewcomparisons) bundling
// the component together with its companion content plugin, Editors-XTD
// plugin and module, per docs/JOOMLA_INTEGRATION.md "Persistent
// Integration". The package manifest sits at the package zip's own root;
// each bundled extension is copied into its own same-named subfolder
// (confirmed against real Joomla core,
// libraries/src/Installer/Adapter/PackageAdapter.php `copyBaseFiles()`:
// each `<file>` entry in pkg_sameviewcomparisons.xml is a plain folder, not
// a nested zip) — never a wrapping slug folder around the whole package,
// the same root-relative convention Phase 19 already established for the
// bare component zip integrations/joomla/scripts/build-package.mjs still
// produces for its own (seed-less, package-less) foundation test.
//
// A byte-for-byte copy only — no bundling/transformation needed, exactly
// like the WordPress plugin's own PHP files. Also writes a manifest.json
// listing every copied file's own zip-root-relative path, so
// src/lib/comparison-artifact-assets.ts's `fetchJoomlaExtensionFiles()`
// never has to hardcode that file list a second time.
//
// Wired into both `pnpm dev` and `pnpm build` (package.json), exactly like
// `build:wordpress-plugin-assets`.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const JOOMLA_DIR = join(projectRoot, "integrations", "joomla");
const DEST_ROOT = join(projectRoot, "public", "generated", "joomla-extension");

// Each bundled extension's own source folder name — identical to its
// zip-root-relative destination folder name and to the matching `<file>`
// entry in pkg_sameviewcomparisons.xml. `pkg_sameviewcomparisons` itself is
// copied flattened (its manifest/language files land directly at the
// package zip's own root, never nested under a `pkg_sameviewcomparisons/`
// subfolder), since it IS the package, not a bundled child extension.
const FLATTENED_SOURCE_DIRS = ["pkg_sameviewcomparisons"];
const NESTED_SOURCE_DIRS = [
	"com_sameviewcomparisons",
	"plg_content_sameview",
	"plg_editors-xtd_sameview",
	"mod_sameview_comparison",
];

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
function toZipRelativePath(sourceDir, absolutePath) {
	return relative(sourceDir, absolutePath).split("\\").join("/");
}

export async function buildJoomlaExtensionAssets() {
	// Rebuilt from scratch every run: without this, a stale file from a
	// previous layout (e.g. the pre-Phase-22 flat single-component copy)
	// would silently linger alongside the new nested package layout, since
	// the copy loop below only ever adds/overwrites files, never removes
	// ones no longer produced by the current source tree.
	await rm(DEST_ROOT, { recursive: true, force: true });

	const manifest = [];

	async function copyDir(sourceDir, zipRelativePrefix) {
		const sourceFiles = await collectFiles(sourceDir);
		for (const sourceFile of sourceFiles) {
			const zipRelativePath = zipRelativePrefix
				? `${zipRelativePrefix}/${toZipRelativePath(sourceDir, sourceFile)}`
				: toZipRelativePath(sourceDir, sourceFile);
			const destPath = join(DEST_ROOT, zipRelativePath);
			await mkdir(dirname(destPath), { recursive: true });
			await writeFile(destPath, await readFile(sourceFile));
			manifest.push(zipRelativePath);
		}
	}

	for (const name of FLATTENED_SOURCE_DIRS) {
		await copyDir(join(JOOMLA_DIR, name), "");
	}
	for (const name of NESTED_SOURCE_DIRS) {
		await copyDir(join(JOOMLA_DIR, name), name);
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
