// Coverage for src/lib/import-metadata.ts against the current/legacy
// fallback rules and Import Validity requirements defined in
// docs/IMPORTED_COMPARISON_V1.md. Fixtures under test/fixtures/metadata are
// synthetic, built strictly from the contract confirmed against the real
// SameView Android source (SessionStorage.kt, SessionScanner.kt,
// SessionScannerTest.kt) — not from unverified assumptions.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseImportedMetadata } from "../src/lib/import-metadata.ts";

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures",
	"metadata",
);

function readFixture(name) {
	return readFileSync(join(fixturesDir, name), "utf8");
}

describe("parseImportedMetadata", () => {
	test("resolves a valid current-field metadata example and preserves unknown fields", () => {
		const result = parseImportedMetadata(readFixture("valid-current.json"));
		assert.equal(result.ok, true);
		assert.deepEqual(result.value, {
			version: 6,
			sessionId: "session-current-001",
			captureTimestampMs: 1700000000000,
			referenceFile: "reference.jpg",
			captureFile: "capture.jpg",
			raw: {
				version: 6,
				session: { id: "session-current-001", createdAtMs: 1699999990000 },
				capture: { timestampMs: 1700000000000 },
				files: { reference: "reference.jpg", capture: "capture.jpg" },
				content: { title: "Current Field Example" },
				reference: { date: "2020-05" },
				location: { city: "Berlin" },
				additional: { isFavorite: true },
				unknownTopLevelField: "should be preserved",
				unknownNestedBlock: { nestedUnknown: 42, deep: { value: true } },
			},
		});
	});

	test("resolves a valid legacy example via the session.createdAtMs timestamp fallback", () => {
		const result = parseImportedMetadata(readFixture("valid-legacy.json"));
		assert.equal(result.ok, true);
		assert.equal(result.value.version, 2);
		assert.equal(result.value.sessionId, undefined);
		assert.equal(result.value.captureTimestampMs, 1600000000000);
		assert.equal(result.value.referenceFile, "reference.jpg");
		assert.equal(result.value.captureFile, "capture.jpg");
	});

	test("prefers the current field over its legacy fallback when both are present", () => {
		const result = parseImportedMetadata(readFixture("precedence.json"));
		assert.equal(result.ok, true);
		assert.equal(result.value.sessionId, "current-session-id");
		assert.equal(result.value.captureTimestampMs, 1700000000000);
		assert.equal(result.value.referenceFile, "current-reference.jpg");
		assert.equal(result.value.captureFile, "current-capture.jpg");
	});

	test("returns malformed-json for text that is not valid JSON", () => {
		const result = parseImportedMetadata(readFixture("malformed.json"));
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "malformed-json");
	});

	test("returns root-not-object for a non-object JSON root", () => {
		const result = parseImportedMetadata(readFixture("non-object-root.json"));
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "root-not-object");
	});

	test("returns missing-version when no version field is declared", () => {
		const result = parseImportedMetadata(readFixture("missing-version.json"));
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "missing-version");
	});

	test("returns invalid-version-type when the version field is not a number", () => {
		const result = parseImportedMetadata(
			readFixture("invalid-version-type.json"),
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "invalid-version-type");
	});

	test("returns unsupported-version for a version outside 2 through 6", () => {
		const result = parseImportedMetadata(
			readFixture("unsupported-version.json"),
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "unsupported-version");
	});

	test("returns invalid-capture-timestamp when neither capture.timestampMs nor session.createdAtMs resolve", () => {
		const result = parseImportedMetadata(
			readFixture("invalid-capture-timestamp.json"),
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "invalid-capture-timestamp");
	});

	test("returns invalid-reference-file when no reference file declaration can be resolved", () => {
		const result = parseImportedMetadata(
			readFixture("missing-reference-file.json"),
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "invalid-reference-file");
	});

	test("returns invalid-capture-file when no capture file declaration can be resolved", () => {
		const result = parseImportedMetadata(
			readFixture("missing-capture-file.json"),
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "invalid-capture-file");
	});

	test("succeeds with sessionId undefined when no session identity field is present", () => {
		const result = parseImportedMetadata(
			readFixture("no-session-identity.json"),
		);
		assert.equal(result.ok, true);
		assert.equal(result.value.sessionId, undefined);
	});

	test("succeeds without a session block when capture.timestampMs is present", () => {
		const result = parseImportedMetadata(
			readFixture("no-session-block-with-capture-timestamp.json"),
		);
		assert.equal(result.ok, true);
		assert.equal(result.value.captureTimestampMs, 1700000000000);
	});
});
