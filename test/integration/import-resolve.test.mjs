// Real-ZIP coverage for resolveImportedSession in src/lib/import-resolve.ts:
// each fixture here is a real, synthetic ZIP read through actual zip.js
// parsing (via validateArchive) before being handed to the resolver. Pure
// rule logic against plain entry lists is covered under test/unit/.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateArchive } from "../../src/lib/import-archive.ts";
import { resolveImportedSession } from "../../src/lib/import-resolve.ts";

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
	"archives",
);

async function readFixture(name) {
	return new Uint8Array(await readFile(join(fixturesDir, name)));
}

async function resolveFixture(name) {
	const bytes = await readFixture(name);
	const archiveResult = await validateArchive(bytes);
	assert.equal(
		archiveResult.ok,
		true,
		`expected ${name} to pass archive validation`,
	);
	return resolveImportedSession(bytes, archiveResult.entries);
}

describe("resolveImportedSession (real ZIP bytes)", () => {
	test("resolves the single session in valid-small.zip", async () => {
		const result = await resolveFixture("valid-small.zip");
		assert.equal(result.ok, true);
		assert.equal(result.value.sessionDirectory, "2024-01-15_10-30-00");
		assert.equal(
			result.value.referenceFilePath,
			"2024-01-15_10-30-00/reference.jpg",
		);
		assert.equal(
			result.value.captureFilePath,
			"2024-01-15_10-30-00/capture.jpg",
		);
	});

	test("resolves required and optional files in valid-with-optional-files.zip", async () => {
		const result = await resolveFixture("valid-with-optional-files.zip");
		assert.equal(result.ok, true);
		const dir = "2024-04-01_09-00-00";
		assert.equal(result.value.referenceFilePath, `${dir}/reference.jpg`);
		assert.equal(result.value.captureFilePath, `${dir}/capture.jpg`);
		assert.equal(
			result.value.referenceOriginalFilePath,
			`${dir}/reference-original.jpg`,
		);
		assert.equal(
			result.value.captureOriginalFilePath,
			`${dir}/capture-original.jpg`,
		);
		assert.equal(
			result.value.referenceSourceOriginalFilePath,
			`${dir}/reference-source-original.heic`,
		);
		assert.equal(
			result.value.brandingHandleFilePath,
			`${dir}/branding-handle.png`,
		);
	});

	test("tolerates a declared but missing optional file", async () => {
		const result = await resolveFixture("valid-with-missing-optional-file.zip");
		assert.equal(result.ok, true);
		assert.equal(result.value.referenceOriginalFilePath, undefined);
	});

	test("rejects an archive with two valid session directories", async () => {
		const result = await resolveFixture("multi-session.zip");
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "multiple-session-directories");
		assert.deepEqual(result.error.directories, [
			"2024-01-15_10-30-00",
			"2024-01-16_11-45-00",
		]);
	});

	test("rejects an archive whose declared reference file is missing", async () => {
		const result = await resolveFixture("missing-required-file.zip");
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "missing-reference-file");
	});

	test("rejects a session whose session.id does not match its directory", async () => {
		const result = await resolveFixture("mismatched-session-id.zip");
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "no-session-found");
	});

	test("returns no-session-found for an archive with no metadata.json", async () => {
		const result = await resolveFixture("no-session.zip");
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "no-session-found");
	});

	test("surfaces the specific metadata error for a single invalid session", async () => {
		const result = await resolveFixture("invalid-single-session.zip");
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "invalid-session-metadata");
		assert.equal(result.error.metadataError.code, "unsupported-version");
	});
});
