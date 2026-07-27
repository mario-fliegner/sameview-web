// Compatibility checks against the two committed canonical real-export
// fixtures under test/fixtures/android-export/ — both real, single-session
// schema-version-6 exports produced by the actual SameView Android app.
// These files are opened read-only; they must never be modified by any test.
//
// See test/fixtures/android-export/README.md for provenance, the purpose of
// each fixture, and handling rules.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateArchive } from "../../src/lib/import-archive.ts";
import { resolveImportedSession } from "../../src/lib/import-resolve.ts";

const androidExportDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
	"android-export",
);

async function readFixture(name) {
	return new Uint8Array(await readFile(join(androidExportDir, name)));
}

// Only the properties that actually differ between the two real exports are
// asserted per-fixture below, to avoid duplicating identical assertions.
const fixtures = [
	{
		file: "sample-v6-session_minimal.zip",
		sessionDirectory: "2026-07-27_16-13-22",
		// A fresh capture with no user-entered content/location and no
		// branding configured — the baseline valid v6 shape.
		expectBrandingHandle: false,
	},
	{
		file: "sample-v6-session_full.zip",
		sessionDirectory: "2026-07-27_13-54-15",
		// A capture with title/description/location entered and built-in
		// branding configured — exercises the optional branding file path.
		expectBrandingHandle: true,
	},
];

for (const fixture of fixtures) {
	describe(`real Android export fixture: ${fixture.file}`, () => {
		test("passes structural archive validation", async () => {
			const bytes = await readFixture(fixture.file);
			const result = await validateArchive(bytes);
			assert.equal(result.ok, true);
			assert.ok(
				result.entries.length >= 6,
				"expected at least 6 entries (5 required/known files + metadata.json)",
			);
		});

		test("resolves to exactly one valid session with its required files", async () => {
			const bytes = await readFixture(fixture.file);
			const archiveResult = await validateArchive(bytes);
			assert.equal(archiveResult.ok, true);

			const result = await resolveImportedSession(bytes, archiveResult.entries);
			assert.equal(result.ok, true);

			const session = result.value;
			assert.equal(session.metadata.version, 6);
			assert.equal(session.sessionDirectory, fixture.sessionDirectory);
			assert.equal(session.metadata.sessionId, fixture.sessionDirectory);
			assert.equal(
				session.referenceFilePath,
				`${fixture.sessionDirectory}/reference.jpg`,
			);
			assert.equal(
				session.captureFilePath,
				`${fixture.sessionDirectory}/capture.jpg`,
			);
			assert.ok(Number.isFinite(session.metadata.captureTimestampMs));
		});

		test("resolves the optional original files present in this real export", async () => {
			const bytes = await readFixture(fixture.file);
			const archiveResult = await validateArchive(bytes);
			const result = await resolveImportedSession(bytes, archiveResult.entries);
			assert.equal(result.ok, true);

			const session = result.value;
			assert.equal(
				session.referenceOriginalFilePath,
				`${fixture.sessionDirectory}/reference-original.jpg`,
			);
			assert.equal(
				session.captureOriginalFilePath,
				`${fixture.sessionDirectory}/capture-original.jpg`,
			);
			assert.ok(
				session.referenceSourceOriginalFilePath?.endsWith(".heic"),
				"expected a .heic reference source original in this real export",
			);
		});

		test(`branding handle resolution (${fixture.expectBrandingHandle ? "present" : "absent"})`, async () => {
			const bytes = await readFixture(fixture.file);
			const archiveResult = await validateArchive(bytes);
			const result = await resolveImportedSession(bytes, archiveResult.entries);
			assert.equal(result.ok, true);

			if (fixture.expectBrandingHandle) {
				assert.equal(
					result.value.brandingHandleFilePath,
					`${fixture.sessionDirectory}/branding-handle.png`,
				);
			} else {
				assert.equal(result.value.brandingHandleFilePath, undefined);
			}
		});
	});
}
