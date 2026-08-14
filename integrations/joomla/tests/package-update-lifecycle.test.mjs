// Real-instance verification of the Phase 22 update-lifecycle fix
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 22, "Joomla-Update-Lifecycle-Fix"):
// pkg_sameviewcomparisons and all of its bundled extensions now carry
// method="upgrade", so a genuine code-only reinstall of the already-
// installed package through Joomla's own native Extensions Manager
// succeeds via Joomla's own update() route, instead of aborting before it
// is ever reached. This file covers exactly the two scenarios that fix
// addresses — the normal reinstall-while-installed lifecycle, and the one
// confirmed edge case (target directory present, persistent Comparison
// table missing) — against real, disposable Joomla instances for both
// supported major versions, per docs/JOOMLA_INTEGRATION.md "Testing".
//
// docs/IMPLEMENTATION_PLAN_V1.md Phase 19's own "installs via the native
// Extensions Manager (CLI equivalent)" precedent (plugin-foundation.test.mjs)
// is followed here for every package (re)install: `extension:install` drives
// the exact same `Joomla\CMS\Installer\Installer::install()` code path the
// web-UI upload form uses, so it exercises the real install/update-route
// decision under test identically. Login/module/front-end verification
// steps still go through the real admin UI via Playwright. Using CLI only
// for the package (re)installs also avoids a root-vs-www-data file
// ownership mismatch between a CLI-installed component's files and a
// web-UI-driven reinstall attempt — a real but purely CLI-container
// artifact of mixing installer transports within one test run, confirmed
// during this fix's own analysis and unrelated to the product itself (a
// real customer's every action goes through the same web server user).
//
// Prerequisites: the current-major and previous-major Docker instances must
// already be running; the real package artifact must already be built
// (`node scripts/generate-joomla-artifact-for-verification.mjs
// integrations/joomla/tests/artifact/comparison-full-joomla.zip`, repo
// root) — the same unified pkg_sameviewcomparisons package used by
// add-comparison-lifecycle.test.mjs and placement-lifecycle.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import {
	INSTANCES,
	JOOMLA_DIR,
	copyIntoContainer,
	dbQuery,
	disableGuidedTours,
	joomlaCli,
	joomlaExec,
	loginAsAdmin,
	normalizeMediaOwnership,
	resetExtensionState,
} from "./docker-helpers.mjs";

const ARTIFACT = join(JOOMLA_DIR, "tests", "artifact", "comparison-full-joomla.zip");
const CONTAINER_ZIP_PATH = "/var/www/html/tmp/sameview-comparisons-joomla.zip";

async function readManifestSessionId(artifactPath) {
	const buffer = await readFile(artifactPath);
	const reader = new ZipReader(new BlobReader(new Blob([buffer])));
	const entries = await reader.getEntries();
	const manifestEntry = entries.find(
		(entry) => entry.filename === "com_sameviewcomparisons/seed/comparison.json",
	);
	const text = await manifestEntry.getData(new TextWriter());
	await reader.close();
	return JSON.parse(text).sessionId;
}

function installPackage(composeFile) {
	copyIntoContainer(composeFile, ARTIFACT, CONTAINER_ZIP_PATH);
	const output = joomlaCli(composeFile, `extension:install --path=${CONTAINER_ZIP_PATH} -v`);
	normalizeMediaOwnership(composeFile);
	return output;
}

for (const [versionLabel, instance] of Object.entries(INSTANCES)) {
	test(`Phase 22 update-lifecycle fix — Joomla ${versionLabel}`, async (t) => {
		const { composeFile, baseUrl } = instance;
		let sessionId;
		let articleId;

		await t.test("normal lifecycle: fresh install creates the table and imports the bundled seed", () => {
			resetExtensionState(composeFile);
			disableGuidedTours(composeFile);

			const output = installPackage(composeFile);
			assert.match(output, /Extension installed successfully/);

			const tables = dbQuery(composeFile, "SHOW TABLES LIKE '%sameview_comparisons%';");
			assert.match(tables, /sameview_comparisons/);

			sessionId = dbQuery(composeFile, "SELECT session_id FROM joom_sameview_comparisons LIMIT 1;");
			assert.ok(sessionId, "the bundled seed Comparison must be available after first install");
		});

		await t.test("normal lifecycle: a content placement is present and renders", async () => {
			const manifestSessionId = await readManifestSessionId(ARTIFACT);
			assert.equal(sessionId, manifestSessionId);

			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);

				await page.goto(`${baseUrl}/administrator/index.php?option=com_content&task=article.add`);
				await page.waitForSelector("#jform_title");
				await page.fill("#jform_title", `Phase 22 Update-Lifecycle Test — ${versionLabel}`);
				const frame = page.frameLocator("#jform_articletext_ifr");
				await frame.locator("body").click();
				await frame.locator("body").fill(`{sameview session="${sessionId}"}`);

				await page.evaluate(() => {
					const f = document.getElementById("adminForm") || document.forms[0];
					f.task.value = "article.save";
					Joomla.submitform("article.save", f);
				});
				await page.waitForLoadState("networkidle").catch(() => {});

				const idText = dbQuery(composeFile, "SELECT id FROM joom_content ORDER BY id DESC LIMIT 1;");
				articleId = Number(idText);
				assert.ok(Number.isInteger(articleId) && articleId > 0);
				dbQuery(
					composeFile,
					`UPDATE joom_content SET state=1, catid=(SELECT id FROM joom_categories WHERE extension='com_content' LIMIT 1) WHERE id=${articleId};`,
				);

				await page.goto(`${baseUrl}/index.php?option=com_content&view=article&id=${articleId}`);
				await page.waitForTimeout(1000);
				assert.equal(await page.locator("[data-sameview-embed]").count(), 1);
			} finally {
				await browser.close();
			}
		});

		await t.test("normal lifecycle: deliberately disable one of the auto-enabled placement plugins", () => {
			// Deliberately the editors-xtd (editor-button) plugin, not the
			// content-rendering plugin: disabling the button that *inserts* a
			// new reference must not be conflated with disabling the plugin
			// that *renders* an already-placed one — the placement-still-
			// renders check below must stay meaningful and independent of
			// this choice.
			dbQuery(
				composeFile,
				"UPDATE joom_extensions SET enabled=0 WHERE element='sameview' AND folder='editors-xtd';",
			);
			assert.equal(
				dbQuery(composeFile, "SELECT enabled FROM joom_extensions WHERE element='sameview' AND folder='editors-xtd';"),
				"0",
			);
		});

		let beforeModified;
		await t.test("normal lifecycle: reinstalling the same package while already installed succeeds via the update route", () => {
			beforeModified = dbQuery(
				composeFile,
				`SELECT modified FROM joom_sameview_comparisons WHERE session_id='${sessionId}';`,
			);

			const output = installPackage(composeFile);
			// Joomla's own extension:install command prints this identical
			// success message for both the install and the update route — the
			// route itself is asserted indirectly below (table/plugin/seed
			// state), matching how a real site operator would observe this.
			assert.match(output, /Extension installed successfully/);
		});

		await t.test("normal lifecycle: the existing Comparison is unchanged (no re-seed)", () => {
			const row = dbQuery(
				composeFile,
				`SELECT session_id, modified FROM joom_sameview_comparisons WHERE session_id='${sessionId}';`,
			);
			assert.match(row, new RegExp(sessionId));
			const afterModified = dbQuery(
				composeFile,
				`SELECT modified FROM joom_sameview_comparisons WHERE session_id='${sessionId}';`,
			);
			assert.equal(afterModified, beforeModified, "update() must never rewrite an existing Comparison");

			const count = dbQuery(composeFile, "SELECT COUNT(*) FROM joom_sameview_comparisons;");
			assert.equal(count, "1", "reinstalling must never duplicate the bundled seed Comparison");
		});

		await t.test("normal lifecycle: the existing placement still renders after the update", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await page.goto(`${baseUrl}/index.php?option=com_content&view=article&id=${articleId}`);
				await page.waitForTimeout(1000);
				assert.equal(await page.locator("[data-sameview-embed]").count(), 1);
			} finally {
				await browser.close();
			}
		});

		await t.test("normal lifecycle: the deliberately disabled plugin is still disabled after the update", () => {
			assert.equal(
				dbQuery(composeFile, "SELECT enabled FROM joom_extensions WHERE element='sameview' AND folder='editors-xtd';"),
				"0",
				"a genuine code-update reinstall must never re-enable an operator-disabled placement plugin",
			);
			assert.equal(
				dbQuery(composeFile, "SELECT enabled FROM joom_extensions WHERE element='sameview' AND folder='content';"),
				"1",
				"the untouched plugin must remain enabled",
			);
		});

		await t.test("edge case: target directory present but the Comparison table missing is restored by the update route, without destructive side effects", () => {
			// Simulates a previously interrupted install/uninstall: the
			// component/plugin/module files and the media/ directory are still
			// on disk, but neither their #__extensions registration nor the
			// persistent Comparison table exists. Confirmed empirically
			// (docs/IMPLEMENTATION_PLAN_V1.md Phase 22 update-lifecycle fix)
			// that Joomla's own ComponentAdapter::checkExtensionInFilesystem()
			// still forces this component onto the update() route in this
			// state, since it does not gate on a matching #__extensions row —
			// only on the target directory already existing on disk.
			dbQuery(
				composeFile,
				"DELETE FROM joom_extensions WHERE element='com_sameviewcomparisons' " +
					"OR element='pkg_sameviewcomparisons' " +
					"OR element='mod_sameview_comparison' " +
					"OR (element='sameview' AND folder IN ('content', 'editors-xtd'));" +
					"DROP TABLE IF EXISTS joom_sameview_comparisons;",
			);
			assert.equal(dbQuery(composeFile, "SHOW TABLES LIKE '%sameview_comparisons%';"), "");

			const mediaBefore = joomlaExec(composeFile, "test -d /var/www/html/media/com_sameviewcomparisons && echo yes").trim();
			assert.equal(mediaBefore, "yes", "the media/ directory must still be present going into this edge case");

			const output = installPackage(composeFile);
			assert.match(output, /Extension installed successfully/);

			const tables = dbQuery(composeFile, "SHOW TABLES LIKE '%sameview_comparisons%';");
			assert.match(tables, /sameview_comparisons/, "the update route must recreate the missing table");

			// No destructive side effect: the media/ directory (and whatever it
			// held) is untouched by update()/ensureComparisonsTable(), which
			// only ever runs CREATE TABLE IF NOT EXISTS.
			const mediaAfter = joomlaExec(composeFile, "test -d /var/www/html/media/com_sameviewcomparisons && echo yes").trim();
			assert.equal(mediaAfter, "yes");

			// The restored table is genuinely usable (correct columns), not an
			// empty stub — insert and read back a row through it.
			dbQuery(
				composeFile,
				"INSERT INTO joom_sameview_comparisons " +
					"(session_id, outcome_fingerprint, title, manifest_json, created, modified) VALUES " +
					`('edge-case-restored-${versionLabel}', 'fp-edge', 'Edge Case Restored Row', '{}', NOW(), NOW());`,
			);
			const restoredRow = dbQuery(
				composeFile,
				`SELECT session_id FROM joom_sameview_comparisons WHERE session_id='edge-case-restored-${versionLabel}';`,
			);
			assert.equal(restoredRow, `edge-case-restored-${versionLabel}`);
		});
	});
}
