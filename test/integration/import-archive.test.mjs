// Real-ZIP coverage for src/lib/import-archive.ts: exercises actual zip.js
// parsing of committed synthetic fixtures under test/fixtures/archives/.
// Pure rule logic (no ZIP file involved) is covered under test/unit/.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateArchive } from "../../src/lib/import-archive.ts";

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
	"archives",
);

async function readFixture(name) {
	return new Uint8Array(await readFile(join(fixturesDir, name)));
}

describe("validateArchive (real ZIP bytes via zip.js)", () => {
	test("accepts a real, small, well-formed ZIP", async () => {
		const bytes = await readFixture("valid-small.zip");
		const result = await validateArchive(bytes);
		assert.equal(result.ok, true);
		assert.equal(result.entries.length, 3);
		assert.ok(
			result.entries.some(
				(e) => e.path === "2024-01-15_10-30-00/metadata.json",
			),
		);
	});

	test("rejects a real ZIP containing a nested ZIP entry", async () => {
		const bytes = await readFixture("nested-zip-entry.zip");
		const result = await validateArchive(bytes);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "nested-archive-entry");
	});

	test("returns unreadable-archive for bytes that are not a ZIP", async () => {
		const bytes = new TextEncoder().encode("this is not a zip file");
		const result = await validateArchive(bytes);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "unreadable-archive");
	});

	test("returns archive-too-large without attempting to read oversized bytes", async () => {
		const oversized = new Uint8Array(25 * 1024 * 1024 + 1);
		const result = await validateArchive(oversized);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "archive-too-large");
	});
});
