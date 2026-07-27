// Pure rule-logic coverage for resolveSessionFromCandidates in
// src/lib/import-resolve.ts: valid-session counting, the session.id
// mismatch rule, and required/optional file resolution against a plain
// entry list — no ZIP or real metadata.json parsing involved. The real-ZIP
// orchestrator (resolveImportedSession) is covered under test/integration/.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveSessionFromCandidates } from "../../src/lib/import-resolve.ts";

function okMetadata(overrides = {}) {
	return {
		ok: true,
		value: {
			version: 6,
			sessionId: undefined,
			captureTimestampMs: 1700000000000,
			referenceFile: "reference.jpg",
			captureFile: "capture.jpg",
			raw: {},
			...overrides,
		},
	};
}

const entries = [
	{ path: "session-a/metadata.json", uncompressedSize: 10 },
	{ path: "session-a/reference.jpg", uncompressedSize: 10 },
	{ path: "session-a/capture.jpg", uncompressedSize: 10 },
];

describe("resolveSessionFromCandidates", () => {
	test("resolves the one valid candidate's required files", () => {
		const result = resolveSessionFromCandidates(
			[{ directory: "session-a", metadataResult: okMetadata() }],
			entries,
		);
		assert.equal(result.ok, true);
		assert.equal(result.value.sessionDirectory, "session-a");
		assert.equal(result.value.referenceFilePath, "session-a/reference.jpg");
		assert.equal(result.value.captureFilePath, "session-a/capture.jpg");
	});

	test("accepts a candidate whose sessionId matches its directory", () => {
		const result = resolveSessionFromCandidates(
			[
				{
					directory: "session-a",
					metadataResult: okMetadata({ sessionId: "session-a" }),
				},
			],
			entries,
		);
		assert.equal(result.ok, true);
	});

	test("rejects a candidate whose sessionId does not match its directory", () => {
		const result = resolveSessionFromCandidates(
			[
				{
					directory: "session-a",
					metadataResult: okMetadata({ sessionId: "a-different-id" }),
				},
			],
			entries,
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "no-session-found");
	});

	test("returns no-session-found when there are zero candidates", () => {
		const result = resolveSessionFromCandidates([], []);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "no-session-found");
	});

	test("surfaces the specific metadata error for a single invalid candidate", () => {
		const result = resolveSessionFromCandidates(
			[
				{
					directory: "session-a",
					metadataResult: { ok: false, error: { code: "unsupported-version" } },
				},
			],
			[],
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "invalid-session-metadata");
		assert.equal(result.error.sessionDirectory, "session-a");
		assert.equal(result.error.metadataError.code, "unsupported-version");
	});

	test("rejects more than one valid candidate as multiple-session-directories", () => {
		const result = resolveSessionFromCandidates(
			[
				{ directory: "session-a", metadataResult: okMetadata() },
				{ directory: "session-b", metadataResult: okMetadata() },
			],
			[
				...entries,
				{ path: "session-b/metadata.json", uncompressedSize: 10 },
				{ path: "session-b/reference.jpg", uncompressedSize: 10 },
				{ path: "session-b/capture.jpg", uncompressedSize: 10 },
			],
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "multiple-session-directories");
		assert.deepEqual(result.error.directories, ["session-a", "session-b"]);
	});

	test("returns missing-reference-file when the declared reference file is not an entry", () => {
		const result = resolveSessionFromCandidates(
			[{ directory: "session-a", metadataResult: okMetadata() }],
			[
				{ path: "session-a/metadata.json", uncompressedSize: 10 },
				{ path: "session-a/capture.jpg", uncompressedSize: 10 },
			],
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "missing-reference-file");
	});

	test("returns missing-capture-file when the declared capture file is not an entry", () => {
		const result = resolveSessionFromCandidates(
			[{ directory: "session-a", metadataResult: okMetadata() }],
			[
				{ path: "session-a/metadata.json", uncompressedSize: 10 },
				{ path: "session-a/reference.jpg", uncompressedSize: 10 },
			],
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "missing-capture-file");
	});

	test("resolves a declared and present optional file", () => {
		const result = resolveSessionFromCandidates(
			[
				{
					directory: "session-a",
					metadataResult: okMetadata({
						raw: { files: { referenceOriginal: "reference-original.jpg" } },
					}),
				},
			],
			[
				...entries,
				{ path: "session-a/reference-original.jpg", uncompressedSize: 10 },
			],
		);
		assert.equal(result.ok, true);
		assert.equal(
			result.value.referenceOriginalFilePath,
			"session-a/reference-original.jpg",
		);
	});

	test("tolerates a declared but missing optional file (no error, resolves to undefined)", () => {
		const result = resolveSessionFromCandidates(
			[
				{
					directory: "session-a",
					metadataResult: okMetadata({
						raw: { files: { referenceOriginal: "reference-original.jpg" } },
					}),
				},
			],
			entries,
		);
		assert.equal(result.ok, true);
		assert.equal(result.value.referenceOriginalFilePath, undefined);
	});
});
