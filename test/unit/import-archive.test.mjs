// Pure rule-logic coverage for src/lib/import-archive.ts against the archive
// rules in docs/ARCHITECTURE.md ("Upload Limits", "Export Structure"). Tested
// against plain literal entry-metadata arrays only — no ZIP file needed. Real
// ZIP parsing through zip.js is covered under test/integration/.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	MAX_ARCHIVE_FILE_COUNT,
	MAX_UNCOMPRESSED_TOTAL_BYTES,
	validateArchiveEntries,
} from "../../src/lib/import-archive.ts";

describe("validateArchiveEntries (pure rule logic)", () => {
	test("accepts a small, well-formed entry list", () => {
		const result = validateArchiveEntries([
			{ path: "2024-01-15_10-30-00/metadata.json", uncompressedSize: 200 },
			{ path: "2024-01-15_10-30-00/capture.jpg", uncompressedSize: 50_000 },
			{ path: "2024-01-15_10-30-00/reference.jpg", uncompressedSize: 50_000 },
		]);
		assert.equal(result.ok, true);
		assert.equal(result.entries.length, 3);
	});

	test("returns too-many-files when the file count exceeds the limit", () => {
		const entries = Array.from(
			{ length: MAX_ARCHIVE_FILE_COUNT + 1 },
			(_, i) => ({
				path: `session/file-${i}.bin`,
				uncompressedSize: 1,
			}),
		);
		const result = validateArchiveEntries(entries);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "too-many-files");
	});

	test("returns uncompressed-total-too-large when declared sizes sum beyond the limit", () => {
		const result = validateArchiveEntries([
			{
				path: "session/huge.bin",
				uncompressedSize: MAX_UNCOMPRESSED_TOTAL_BYTES + 1,
			},
		]);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "uncompressed-total-too-large");
	});

	test("returns nested-archive-entry for a ZIP-in-ZIP entry", () => {
		const result = validateArchiveEntries([
			{ path: "session/metadata.json", uncompressedSize: 10 },
			{ path: "session/inner.ZIP", uncompressedSize: 10 },
		]);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "nested-archive-entry");
		assert.equal(result.error.path, "session/inner.ZIP");
	});

	test("does not flag other archive-like extensions (JAR/RAR/7z are out of scope)", () => {
		const result = validateArchiveEntries([
			{ path: "session/metadata.json", uncompressedSize: 10 },
			{ path: "session/something.jar", uncompressedSize: 10 },
			{ path: "session/something.rar", uncompressedSize: 10 },
			{ path: "session/something.7z", uncompressedSize: 10 },
		]);
		assert.equal(result.ok, true);
	});

	test("returns unsafe-entry-path for an absolute path", () => {
		const result = validateArchiveEntries([
			{ path: "/etc/passwd", uncompressedSize: 10 },
		]);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "unsafe-entry-path");
	});

	test("returns unsafe-entry-path for a path-traversal segment", () => {
		const result = validateArchiveEntries([
			{ path: "session/../../../etc/passwd", uncompressedSize: 10 },
		]);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "unsafe-entry-path");
	});

	test("returns duplicate-entry-path when the same path appears twice", () => {
		const result = validateArchiveEntries([
			{ path: "session/metadata.json", uncompressedSize: 10 },
			{ path: "session/metadata.json", uncompressedSize: 20 },
		]);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "duplicate-entry-path");
		assert.equal(result.error.path, "session/metadata.json");
	});
});
