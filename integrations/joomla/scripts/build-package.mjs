// Builds a real installable Joomla extension package ZIP from
// com_sameviewcomparisons/ for real-instance verification
// (docs/JOOMLA_INTEGRATION.md "Testing"; docs/IMPLEMENTATION_PLAN_V1.md
// Phase 19 "Tests/manual").
//
// Phase 19 scope only: this zips the extension source as-is. It is not the
// SameView Web "Generate for Joomla" artifact (that is Phase 21) and never
// bundles a seed/ Comparison.
//
// Uses @zip.js/zip.js, an existing root dependency (see
// src/lib/generate-wordpress-package.ts for the same library used for the
// analogous WordPress artifact) — resolved via Node's parent-directory
// node_modules walk, exactly like @playwright/test in this directory's own
// tests. No new dependency is introduced.
//
// Usage: node scripts/build-package.mjs

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
	BlobWriter,
	Uint8ArrayReader,
	ZipWriter,
} from "@zip.js/zip.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(HERE, "..", "com_sameviewcomparisons");
const OUTPUT_DIR = join(HERE, "..", "tests", "artifact");
const OUTPUT_FILE = join(OUTPUT_DIR, "sameview-comparisons-joomla.zip");

async function collectFiles(dir, base = dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectFiles(fullPath, base)));
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}
	return files;
}

async function main() {
	const sourceStat = await stat(SOURCE_DIR).catch(() => null);
	if (!sourceStat || !sourceStat.isDirectory()) {
		throw new Error(`Extension source not found: ${SOURCE_DIR}`);
	}

	const files = await collectFiles(SOURCE_DIR);
	if (files.length === 0) {
		throw new Error(`No files found under ${SOURCE_DIR}`);
	}

	const zipWriter = new ZipWriter(new BlobWriter("application/zip"));
	for (const filePath of files) {
		const zipPath = relative(SOURCE_DIR, filePath).split("\\").join("/");
		const bytes = await readFile(filePath);
		await zipWriter.add(zipPath, new Uint8ArrayReader(new Uint8Array(bytes)));
	}
	const blob = await zipWriter.close();
	const buffer = Buffer.from(await blob.arrayBuffer());

	await mkdir(OUTPUT_DIR, { recursive: true });
	await writeFile(OUTPUT_FILE, buffer);

	console.log(`Built ${OUTPUT_FILE} (${files.length} files, ${buffer.length} bytes)`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
