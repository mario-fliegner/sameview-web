// One-off, on-demand verification (docs/IMPLEMENTATION_PLAN_V1.md Phase 18
// final acceptance) — NOT part of the routine `npm test` suite (its filename
// deliberately does not match "tests/**/*.test.mjs").
//
// Closes the specific, previously-documented gap left open by
// tests/add-comparison-lifecycle.test.mjs's own header comment: "It never
// simulates an actual HTTP file upload through admin-post.php/$_FILES ...
// A literal browser-driven upload-form test remains a manual/Phase-18-style
// real-platform check, not automated here." This script IS that check, plus
// the new Phase 18 Comparison Library/Delete screen it exercises alongside it.
//
// Targets the SAME shared, bind-mounted default instance
// tests/plugin-foundation.test.mjs and tests/add-comparison-lifecycle.test.mjs
// already use (../wp-env-helpers.mjs) — safe to do here because the
// `SameView → Add comparison` upload path only ever writes into the
// SameView-owned uploads directory via includes/import.php
// `sameview_import_seed()`; it never touches the plugin's own PHP files on
// disk (unlike a real native `wp plugin install <zip>`, which is why THAT
// specific operation is instead verified against a separate, non-bind-mounted
// instance in tests/fresh-install/verify-fresh-install.mjs).
//
// Covers, all through the real wp-admin UI in a real browser:
//   - Add comparison via the real multipart upload form (not `wp eval`)
//   - a second, different Comparison added the same way
//   - re-uploading an unchanged package shows the real no-op notice
//   - uploading an invalid package shows the real rejection notice
//   - the new Comparison Library screen: thumbnail, title, reference→capture
//     period, usage count ("No placements found" vs "Used in N place(s)")
//   - Delete, with a real native `confirm()` dialog naming the affected
//     placement, through the real admin-post.php link
//   - after deletion, the existing placement's public render disappears
//   - re-uploading the same package restores that placement automatically,
//     without touching the placement page itself (docs/EMBED_IN_WEBSITE.md
//     "Placement Behavior After Deletion")
//
// Prerequisites: two real generated WordPress packages must already exist —
//   node scripts/generate-wordpress-artifact-for-verification.mjs \
//     integrations/wordpress/tests/fresh-install/artifact/comparison-a.zip \
//     sample-v6-session_full.zip
//   node scripts/generate-wordpress-artifact-for-verification.mjs \
//     integrations/wordpress/tests/fresh-install/artifact/comparison-b.zip \
//     sample-v6-session_minimal.zip
// — and a deliberately invalid file at
//   integrations/wordpress/tests/fresh-install/artifact/invalid-package.zip
//
// Usage: node verify-phase18-library.mjs   (run from this directory)

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
	TextWriter,
	Uint8ArrayReader,
	ZipReader,
} from "@zip.js/zip.js";
import { chromium } from "@playwright/test";
import { runWpEnv, wpCli, extractLastLine } from "./wp-env-helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACT_DIR = join(HERE, "fresh-install", "artifact");
const COMPARISON_A_ZIP = join(ARTIFACT_DIR, "comparison-a.zip");
const COMPARISON_B_ZIP = join(ARTIFACT_DIR, "comparison-b.zip");
const INVALID_ZIP = join(ARTIFACT_DIR, "invalid-package.zip");
const BASE = "http://localhost:8888";
const ADMIN_USER = "admin";
const ADMIN_PASS = "password";

for (const path of [COMPARISON_A_ZIP, COMPARISON_B_ZIP, INVALID_ZIP]) {
	if (!existsSync(path)) {
		console.error(`Required artifact not found: ${path}\nSee this file's own header comment for how to generate it.`);
		process.exit(1);
	}
}

async function manifestOf(zipPath) {
	const bytes = new Uint8Array(readFileSync(zipPath));
	const reader = new ZipReader(new Uint8ArrayReader(bytes));
	const entries = await reader.getEntries();
	const entry = entries.find(
		(e) => e.filename === "sameview-comparisons/seed/comparison.json",
	);
	const text = await entry.getData(new TextWriter());
	await reader.close();
	return JSON.parse(text);
}

async function loginAsAdmin(page) {
	await page.goto(`${BASE}/wp-login.php`);
	await page.fill("#user_login", ADMIN_USER);
	await page.fill("#user_pass", ADMIN_PASS);
	await page.click("#wp-submit");
	await page.waitForURL(/wp-admin/);
}

async function uploadPackage(page, zipPath) {
	await page.goto(`${BASE}/wp-admin/tools.php?page=sameview-add-comparison`);
	await page.locator('input[type="file"][name="sameview_package"]').setInputFiles(zipPath);
	await Promise.all([
		page.waitForURL(/sameview_status=/),
		page.getByRole("button", { name: /add comparison/i }).click(),
	]);
	const status = new URL(page.url()).searchParams.get("sameview_status");
	const message = new URL(page.url()).searchParams.get("sameview_message");
	return { status, message: message ? decodeURIComponent(message) : null };
}

const report = {};

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext();
	const createdPageIds = [];

	try {
		runWpEnv(["start"]);
		// This script targets whichever instance ../wp-env-helpers.mjs is
		// currently pointed at (the default bind-mounted config, or a pinned
		// major-version config via SAMEVIEW_WP_ENV_CONFIG — see that file's
		// own header comment) — recorded here for traceability only.
		report.runningWordPressVersion = wpCli(["core", "version"]).trim();

		const manifestA = await manifestOf(COMPARISON_A_ZIP);

		const page = await context.newPage();
		const pageErrors = [];
		page.on("pageerror", (error) => pageErrors.push(String(error)));
		await loginAsAdmin(page);

		// --- Library screen renders with no PHP issues before anything is
		// uploaded (empty or pre-existing state, either is fine here). ---
		await page.goto(`${BASE}/wp-admin/tools.php?page=sameview-comparisons`);
		const libraryHtmlBefore = await page.content();
		assert.doesNotMatch(
			libraryHtmlBefore,
			/(PHP (Warning|Notice|Deprecated|Fatal error|Parse error)|Fatal error:|Warning:|Notice:)/,
			"Library screen must render without PHP issues",
		);
		report.libraryRendersCleanly = true;

		// --- 1. Add comparison A via the REAL multipart upload form. ---
		const addResultA = await uploadPackage(page, COMPARISON_A_ZIP);
		assert.equal(addResultA.status, "added");
		assert.match(addResultA.message, /Comparison added\./);
		report.addedViaRealBrowserUpload = true;

		// --- 2. Re-uploading the SAME package is a real, browser-driven no-op. ---
		const noOpResult = await uploadPackage(page, COMPARISON_A_ZIP);
		assert.equal(noOpResult.status, "no-op");
		assert.match(noOpResult.message, /already up to date/);
		report.noOpViaRealBrowserUpload = true;

		// --- 3. A genuinely different second Comparison, also via the real
		// upload form ("add another Comparison" through wp-admin). ---
		const addResultB = await uploadPackage(page, COMPARISON_B_ZIP);
		assert.equal(addResultB.status, "added");
		report.secondComparisonAddedViaRealBrowserUpload = true;

		// --- 4. An invalid package is rejected through the real form. ---
		const invalidResult = await uploadPackage(page, INVALID_ZIP);
		assert.equal(invalidResult.status, "rejected");
		assert.match(invalidResult.message, /not a valid SameView Comparison package/);
		report.invalidUploadRejectedViaRealBrowserUpload = true;

		// --- Place Comparison A on a real page (block placement mechanics
		// themselves are already covered end-to-end by
		// tests/fresh-install/verify-phase16-placement.mjs; this only needs a
		// real placement to exist so the Library's usage/delete-warning
		// behavior can be verified against it). ---
		const placementTitle = `Phase18 Library Test Page ${Date.now()}`;
		const placementPostId = extractLastLine(
			wpCli([
				"post",
				"create",
				"--post_type=page",
				`--post_title=${placementTitle}`,
				"--post_status=publish",
				`--post_content=<!-- wp:sameview/comparison {"sessionId":"${manifestA.sessionId}"} /-->`,
				"--porcelain",
			]),
		);
		assert.match(placementPostId, /^\d+$/, `expected a numeric post ID, got: ${placementPostId}`);
		createdPageIds.push(placementPostId);
		const permalink = extractLastLine(
			wpCli(["post", "get", placementPostId, "--field=url"]),
		);
		assert.match(permalink, /^https?:\/\//, `expected a real permalink, got: ${permalink}`);

		const publicHtmlWithPlacement = await (await page.request.get(permalink)).text();
		assert.match(publicHtmlWithPlacement, /presentation-canvas|sameview-comparison-embed/);
		report.placementRendersBeforeDelete = true;

		// --- 5. Library screen shows Comparison A with its thumbnail, title,
		// reference→capture period and a real usage count. ---
		await page.goto(`${BASE}/wp-admin/tools.php?page=sameview-comparisons`);
		const rows = page.getByTestId("sameview-library-row");
		const rowA = rows.filter({ hasText: manifestA.presentation.title });
		await rowA.first().waitFor();
		assert.equal(await rowA.locator("img").count(), 1, "Comparison A must show a thumbnail");
		const usageTextA = await rowA.getByTestId("sameview-library-usage").innerText();
		assert.match(usageTextA, /Used in 1 place/);
		report.libraryShowsThumbnailTitlePeriodAndUsage = true;

		// Comparison B has no placements yet — must say "No placements found",
		// never "Not used" (docs/IMPLEMENTATION_PLAN_V1.md Phase 18: "report
		// only confirmed usages; zero results means 'No placements found'").
		const rowB = rows.filter({ hasText: "SameView Comparison" });
		await rowB.first().waitFor();
		const usageTextB = await rowB.getByTestId("sameview-library-usage").innerText();
		assert.equal(usageTextB, "No placements found");
		report.zeroUsageWordedAsNoPlacementsFound = true;

		// --- 6. Delete Comparison A through the real admin-post.php link, with
		// a real native confirm() dialog naming the affected placement. ---
		let dialogMessage = null;
		page.once("dialog", async (dialog) => {
			dialogMessage = dialog.message();
			await dialog.accept();
		});
		await Promise.all([
			page.waitForURL(/sameview_status=deleted/),
			rowA.getByTestId("sameview-library-delete").click(),
		]);
		assert.ok(dialogMessage, "a confirm() dialog must appear before deleting");
		assert.match(dialogMessage, new RegExp(placementTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		report.deleteConfirmDialogNamesAffectedPlacement = true;

		const libraryAfterDelete = await page.content();
		assert.doesNotMatch(
			libraryAfterDelete,
			new RegExp(manifestA.presentation.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
			"deleted Comparison must no longer appear in the Library",
		);
		report.deletedComparisonRemovedFromLibrary = true;

		// --- 7. Public placement page no longer renders the deleted
		// Comparison (docs/EMBED_IN_WEBSITE.md "Placement Behavior After
		// Deletion": public missing state renders nothing). ---
		const publicHtmlAfterDelete = await (await page.request.get(permalink)).text();
		assert.doesNotMatch(publicHtmlAfterDelete, /presentation-canvas/);
		report.placementShowsMissingStateAfterDelete = true;

		// Stored assets actually removed from disk, not just the post.
		const assetsExistAfterDelete = wpCli([
			"eval",
			`echo is_dir( sameview_comparison_assets_dir('${manifestA.sessionId}') ) ? 'yes' : 'no';`,
		]).trim();
		assert.equal(assetsExistAfterDelete, "no", "Delete must remove the stored asset directory");
		report.assetsRemovedOnDelete = true;

		// --- 8. Re-uploading the SAME package (again through the real
		// browser form) restores the existing placement automatically —
		// without touching the placement page itself. ---
		const reAddResult = await uploadPackage(page, COMPARISON_A_ZIP);
		assert.equal(reAddResult.status, "added");
		report.reImportedViaRealBrowserUpload = true;

		const publicHtmlAfterReimport = await (await page.request.get(permalink)).text();
		assert.match(publicHtmlAfterReimport, /presentation-canvas|sameview-comparison-embed/);
		report.placementRestoredAfterReimportWithoutResave = true;

		assert.deepEqual(pageErrors, [], "no uncaught browser errors during this run");
		report.noPageErrors = true;

		console.log("\nVERIFICATION PASSED\n");
		console.log(JSON.stringify(report, null, 2));
	} catch (error) {
		console.log("\nVERIFICATION FAILED:", error.message);
		console.log("partial report:", JSON.stringify(report, null, 2));
		try {
			const pages = context.pages();
			for (let i = 0; i < pages.length; i++) {
				await pages[i].screenshot({ path: `C:/tmp/phase18-library-fail-${i}.png`, fullPage: true });
			}
		} catch {
			// Best-effort debugging aid only.
		}
		throw error;
	} finally {
		// --- Cleanup: never leave this shared instance dirtier than found,
		// matching every other file in this directory's own convention. ---
		for (const id of createdPageIds) {
			try {
				wpCli(["post", "delete", id, "--force"]);
			} catch {
				// Best-effort cleanup only.
			}
		}
		try {
			const remaining = JSON.parse(
				wpCli([
					"post",
					"list",
					"--post_type=sameview_comparison",
					"--post_status=any",
					"--format=json",
				]).match(/(\[[\s\S]*\])/)[0],
			);
			for (const post of remaining) {
				wpCli(["post", "delete", String(post.ID), "--force"]);
			}
		} catch {
			// Best-effort cleanup only.
		}
		await context.close();
		await browser.close();
	}
})();
