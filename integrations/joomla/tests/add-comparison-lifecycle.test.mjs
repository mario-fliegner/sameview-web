// Real-instance verification of Phase 21 (docs/IMPLEMENTATION_PLAN_V1.md
// "Phase 21 – Joomla First Installation and Comparison Lifecycle"): first
// installation with a bundled seed, Add/Update/no-op via the real
// `Add comparison` admin upload, Delete, and rejected-import atomicity —
// against real, disposable Joomla instances for both supported major
// versions, per docs/JOOMLA_INTEGRATION.md "Testing".
//
// Prerequisites: the current-major and previous-major Docker instances must
// already be running; the real verification artifacts must already be built
// (`node scripts/generate-joomla-artifact-for-verification.mjs
// integrations/joomla/tests/artifact/comparison-full-joomla.zip` and
// `...comparison-minimal-joomla.zip ... sample-v6-session_minimal.zip`,
// repo root). This file does not manage the Docker lifecycle or drive the
// SameView Web app itself — it only installs/uploads already-generated real
// packages and verifies real Joomla-side behavior, mirroring
// integrations/wordpress/tests/add-comparison-lifecycle.test.mjs's own role
// split.
//
// The Add-comparison upload itself is driven through the real admin UI via
// Playwright, not a PHP-eval shortcut: unlike wp-env, none of this
// directory's Docker instances bind-mount the extension source, so a real
// "install/upload this ZIP" operation never risks corrupting this
// repository's own tracked files (see integrations/joomla/README.md
// "Testing notes").

import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	BlobReader,
	BlobWriter,
	TextReader,
	TextWriter,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipReader,
	ZipWriter,
} from "@zip.js/zip.js";
import {
	INSTANCES,
	JOOMLA_DIR,
	copyIntoContainer,
	dbQuery,
	disableGuidedTours,
	extensionId,
	joomlaCli,
	joomlaExec,
	loginAsAdmin,
	normalizeMediaOwnership,
	resetExtensionState,
} from "./docker-helpers.mjs";

const ARTIFACT_DIR = join(JOOMLA_DIR, "tests", "artifact");
const FULL_ARTIFACT = join(ARTIFACT_DIR, "comparison-full-joomla.zip");
const MINIMAL_ARTIFACT = join(ARTIFACT_DIR, "comparison-minimal-joomla.zip");
const UPDATED_ARTIFACT = join(ARTIFACT_DIR, "comparison-full-updated-joomla.zip");
const INVALID_ARTIFACT = join(ARTIFACT_DIR, "comparison-invalid-joomla.zip");
const CONTAINER_ZIP_PATH = "/var/www/html/tmp/sameview-comparisons-joomla.zip";

// Derives a same-session, different-fingerprint variant of the full
// artifact for the atomic-update case — mirrors the WordPress lifecycle
// test's own hand-crafted "changed fingerprint" fixture approach rather
// than needing the real app to somehow produce a second, different-content
// package for the identical session.id.
async function buildUpdatedArtifact() {
	const buffer = await readFile(FULL_ARTIFACT);
	const reader = new ZipReader(new BlobReader(new Blob([buffer])));
	const entries = await reader.getEntries();
	const writer = new ZipWriter(new BlobWriter("application/zip"));

	for (const entry of entries) {
		if (entry.filename === "seed/comparison.json") {
			const text = await entry.getData(new TextWriter());
			const manifest = JSON.parse(text);
			manifest.outcomeFingerprint = `${manifest.outcomeFingerprint}-updated-variant`;
			manifest.presentation.title = `${manifest.presentation.title ?? "Comparison"} (updated)`;
			await writer.add("seed/comparison.json", new TextReader(JSON.stringify(manifest, null, "\t")));
			continue;
		}
		const bytes = await entry.getData(new Uint8ArrayWriter());
		await writer.add(entry.filename, new Uint8ArrayReader(bytes));
	}

	const blob = await writer.close();
	await writeFile(UPDATED_ARTIFACT, Buffer.from(await blob.arrayBuffer()));
	await reader.close();
}

async function buildInvalidArtifact() {
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	await writer.add(
		"seed/comparison.json",
		new TextReader(JSON.stringify({ formatVersion: 1 })),
	);
	// Deliberately no reference.jpg/capture.jpg and no sessionId/fingerprint —
	// must be rejected by ComparisonImportHelper::validateSeed().
	const blob = await writer.close();
	await writeFile(INVALID_ARTIFACT, Buffer.from(await blob.arrayBuffer()));
}

async function readManifestSessionId(artifactPath) {
	const buffer = await readFile(artifactPath);
	const reader = new ZipReader(new BlobReader(new Blob([buffer])));
	const entries = await reader.getEntries();
	const manifestEntry = entries.find((entry) => entry.filename === "seed/comparison.json");
	const text = await manifestEntry.getData(new TextWriter());
	await reader.close();
	return JSON.parse(text).sessionId;
}

async function uploadPackage(page, baseUrl, artifactPath) {
	await page.goto(`${baseUrl}/administrator/index.php?option=com_sameviewcomparisons&view=upload`);
	await page.setInputFiles('[data-testid="sameview-upload-file-input"]', artifactPath);
	await page.click('[data-testid="sameview-upload-submit"]');
	await page.waitForLoadState("networkidle").catch(() => {});
}

for (const [versionLabel, instance] of Object.entries(INSTANCES)) {
	test(`Phase 21 Add/Update/no-op/Delete lifecycle — Joomla ${versionLabel}`, async (t) => {
		const { composeFile, baseUrl } = instance;
		let fullSessionId;
		let minimalSessionId;

		await t.test("prepares real artifacts and a clean instance", async () => {
			await buildUpdatedArtifact();
			await buildInvalidArtifact();
			fullSessionId = await readManifestSessionId(FULL_ARTIFACT);
			minimalSessionId = await readManifestSessionId(MINIMAL_ARTIFACT);
			assert.notEqual(fullSessionId, minimalSessionId);

			resetExtensionState(composeFile);
			disableGuidedTours(composeFile);
		});

		await t.test("first installation makes the bundled Comparison available with no second import step", () => {
			copyIntoContainer(composeFile, FULL_ARTIFACT, CONTAINER_ZIP_PATH);
			const output = joomlaCli(composeFile, `extension:install --path=${CONTAINER_ZIP_PATH} -v`);
			assert.match(output, /Extension installed successfully/);
			normalizeMediaOwnership(composeFile);

			const row = dbQuery(
				composeFile,
				`SELECT session_id, outcome_fingerprint FROM joom_sameview_comparisons WHERE session_id='${fullSessionId}';`,
			);
			assert.match(row, new RegExp(fullSessionId));
		});

		await t.test("adding a second, different Comparison via Add comparison succeeds", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				await uploadPackage(page, baseUrl, MINIMAL_ARTIFACT);

				const row = dbQuery(
					composeFile,
					`SELECT session_id FROM joom_sameview_comparisons WHERE session_id='${minimalSessionId}';`,
				);
				assert.equal(row, minimalSessionId);

				const count = dbQuery(composeFile, "SELECT COUNT(*) FROM joom_sameview_comparisons;");
				assert.equal(count, "2");
			} finally {
				await browser.close();
			}
		});

		await t.test("re-adding an unchanged Comparison is a no-op that rewrites nothing", async () => {
			const before = dbQuery(
				composeFile,
				`SELECT modified FROM joom_sameview_comparisons WHERE session_id='${fullSessionId}';`,
			);

			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				await uploadPackage(page, baseUrl, FULL_ARTIFACT);
			} finally {
				await browser.close();
			}

			const after = dbQuery(
				composeFile,
				`SELECT modified FROM joom_sameview_comparisons WHERE session_id='${fullSessionId}';`,
			);
			assert.equal(after, before);

			const count = dbQuery(composeFile, "SELECT COUNT(*) FROM joom_sameview_comparisons;");
			assert.equal(count, "2");
		});

		await t.test("re-adding a changed Comparison atomically updates it", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				await uploadPackage(page, baseUrl, UPDATED_ARTIFACT);
			} finally {
				await browser.close();
			}

			const row = dbQuery(
				composeFile,
				`SELECT outcome_fingerprint, title FROM joom_sameview_comparisons WHERE session_id='${fullSessionId}';`,
			);
			assert.match(row, /updated-variant/);
			assert.match(row, /\(updated\)/);

			const count = dbQuery(composeFile, "SELECT COUNT(*) FROM joom_sameview_comparisons;");
			assert.equal(count, "2");
		});

		await t.test("an invalid/incompatible artifact is rejected without side effects", async () => {
			const countBefore = dbQuery(composeFile, "SELECT COUNT(*) FROM joom_sameview_comparisons;");

			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				await uploadPackage(page, baseUrl, INVALID_ARTIFACT);
			} finally {
				await browser.close();
			}

			const countAfter = dbQuery(composeFile, "SELECT COUNT(*) FROM joom_sameview_comparisons;");
			assert.equal(countAfter, countBefore);
		});

		await t.test("deleting a stored Comparison removes its database row and stored assets", async () => {
			const assetDirCheck = () =>
				joomlaExec(
					composeFile,
					`test -d /var/www/html/media/com_sameviewcomparisons/comparisons/$(echo -n '${minimalSessionId}' | md5sum | cut -d' ' -f1) && echo yes || echo no`,
				).trim();
			assert.equal(assetDirCheck(), "yes");

			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				const pageErrors = [];
				page.on("pageerror", (error) => pageErrors.push(error));

				await loginAsAdmin(page, baseUrl);
				await page.goto(`${baseUrl}/administrator/index.php?option=com_sameviewcomparisons&view=comparisons`);

				// Regression coverage for the Delete-toolbar-button bug: Joomla's
				// own bundled joomla-toolbar-button.js custom element threw an
				// uncaught error in connectedCallback() when the list's checkboxes
				// weren't produced by the native Grid helper (missing boxchecked
				// field / .js-grid-item-is-checked class), which also left the
				// button permanently disabled. Asserting zero pageerror events here
				// catches a regression back to hand-written checkboxes even if the
				// disabled-state assertions below somehow did not.
				assert.equal(
					pageErrors.length,
					0,
					`unexpected pageerror(s): ${pageErrors.map((error) => error.message).join("; ")}`,
				);

				const row = page.locator(`[data-testid="sameview-comparison-row"][data-session-id="${minimalSessionId}"]`);
				const deleteButton = page.locator("#toolbar-delete button");
				assert.equal(
					await deleteButton.isDisabled(),
					true,
					"Delete button must be disabled before any row is selected",
				);

				// The real, native Joomla list-selection checkbox — rendered via
				// HTMLHelper::_('grid.id', ...), not a custom element of ours.
				await row.locator('input[name="cid[]"]').check();
				assert.equal(
					await deleteButton.isDisabled(),
					false,
					"Delete button must become enabled once a row is selected",
				);

				// Joomla's own <joomla-dialog> confirm modal: the `open` attribute
				// lands on the nested native <dialog>, not on <joomla-dialog>
				// itself — confirmed against the real rendered markup.
				await deleteButton.click();
				await Promise.all([
					page.waitForNavigation(),
					page.locator("dialog[open] [data-button-ok]").click(),
				]);
			} finally {
				await browser.close();
			}

			const row = dbQuery(
				composeFile,
				`SELECT session_id FROM joom_sameview_comparisons WHERE session_id='${minimalSessionId}';`,
			);
			assert.equal(row, "");
			assert.equal(assetDirCheck(), "no");

			const count = dbQuery(composeFile, "SELECT COUNT(*) FROM joom_sameview_comparisons;");
			assert.equal(count, "1");
		});
	});
}
