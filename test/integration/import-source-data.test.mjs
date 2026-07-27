// Real-ZIP coverage for src/lib/import-source-data.ts: exercises the actual
// archive/resolve pipeline against committed fixtures, with an injected fake
// image validator so this file stays Node-testable — real browser-based
// image decoding is already covered by test/e2e/import-pipeline.spec.ts and
// is not repeated here.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createSourceDataFromZip } from "../../src/lib/import-source-data.ts";

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
);

async function readArchiveFixture(name) {
	return new Uint8Array(await readFile(join(fixturesDir, "archives", name)));
}

async function readAndroidExportFixture(name) {
	return new Uint8Array(
		await readFile(join(fixturesDir, "android-export", name)),
	);
}

const alwaysValidImage = async () => ({ ok: true, width: 10, height: 10 });
const alwaysInvalidImage = async () => ({
	ok: false,
	error: { code: "undecodable-image" },
});

describe("createSourceDataFromZip — synthetic fixtures", () => {
	test("assembles Source Data from a valid archive", async () => {
		const bytes = await readArchiveFixture("valid-small.zip");
		const result = await createSourceDataFromZip(bytes, {
			validateImage: alwaysValidImage,
		});

		assert.equal(result.ok, true);
		assert.equal(result.value.sessionDirectory, "2024-01-15_10-30-00");
		assert.equal(result.value.files.referenceBytes.length > 0, true);
		assert.equal(result.value.files.captureBytes.length > 0, true);
	});

	test("propagates an archive-level failure as archive-invalid", async () => {
		const bytes = await readArchiveFixture("nested-zip-entry.zip");
		const result = await createSourceDataFromZip(bytes, {
			validateImage: alwaysValidImage,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error.code, "archive-invalid");
		assert.equal(result.error.error.code, "nested-archive-entry");
	});

	test("propagates a resolution-level failure as resolution-failed", async () => {
		const bytes = await readArchiveFixture("missing-required-file.zip");
		const result = await createSourceDataFromZip(bytes, {
			validateImage: alwaysValidImage,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error.code, "resolution-failed");
		assert.equal(result.error.error.code, "missing-reference-file");
	});

	test("propagates a multi-session archive as resolution-failed", async () => {
		const bytes = await readArchiveFixture("multi-session.zip");
		const result = await createSourceDataFromZip(bytes, {
			validateImage: alwaysValidImage,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error.code, "resolution-failed");
		assert.equal(result.error.error.code, "multiple-session-directories");
	});

	test("rejects when the reference image fails content validation", async () => {
		const bytes = await readArchiveFixture("valid-small.zip");
		const result = await createSourceDataFromZip(bytes, {
			validateImage: alwaysInvalidImage,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error.code, "reference-image-invalid");
	});

	test("rejects when the capture image fails content validation", async () => {
		const bytes = await readArchiveFixture("valid-small.zip");
		let calls = 0;
		const result = await createSourceDataFromZip(bytes, {
			validateImage: async () => {
				calls += 1;
				// First call is the reference image (succeeds); second is capture.
				return calls === 1
					? { ok: true, width: 10, height: 10 }
					: { ok: false, error: { code: "undecodable-image" } };
			},
		});

		assert.equal(result.ok, false);
		assert.equal(result.error.code, "capture-image-invalid");
	});

	test("resolves optional files that are declared and present", async () => {
		const bytes = await readArchiveFixture("valid-with-optional-files.zip");
		const result = await createSourceDataFromZip(bytes, {
			validateImage: alwaysValidImage,
		});

		assert.equal(result.ok, true);
		assert.notEqual(result.value.files.referenceOriginalBytes, undefined);
		assert.notEqual(result.value.files.captureOriginalBytes, undefined);
		assert.notEqual(result.value.files.referenceSourceOriginalBytes, undefined);
		assert.notEqual(result.value.files.brandingHandleBytes, undefined);
	});

	test("tolerates an optional file declared but missing from the archive", async () => {
		const bytes = await readArchiveFixture(
			"valid-with-missing-optional-file.zip",
		);
		const result = await createSourceDataFromZip(bytes, {
			validateImage: alwaysValidImage,
		});

		assert.equal(result.ok, true);
		assert.equal(result.value.files.referenceOriginalBytes, undefined);
	});
});

describe("createSourceDataFromZip — real Android export fixtures (read-only)", () => {
	test("assembles Source Data from the minimal real export (no branding)", async () => {
		const bytes = await readAndroidExportFixture(
			"sample-v6-session_minimal.zip",
		);
		const result = await createSourceDataFromZip(bytes, {
			validateImage: alwaysValidImage,
		});

		assert.equal(result.ok, true);
		assert.equal(result.value.sessionDirectory, "2026-07-27_16-13-22");
		assert.equal(result.value.files.referenceBytes.length > 0, true);
		assert.equal(result.value.files.captureBytes.length > 0, true);
		assert.notEqual(result.value.files.referenceOriginalBytes, undefined);
		assert.equal(result.value.files.brandingHandleBytes, undefined);
	});

	test("assembles Source Data from the full real export (with branding)", async () => {
		const bytes = await readAndroidExportFixture("sample-v6-session_full.zip");
		const result = await createSourceDataFromZip(bytes, {
			validateImage: alwaysValidImage,
		});

		assert.equal(result.ok, true);
		assert.equal(result.value.sessionDirectory, "2026-07-27_13-54-15");
		assert.notEqual(result.value.files.brandingHandleBytes, undefined);
	});
});
