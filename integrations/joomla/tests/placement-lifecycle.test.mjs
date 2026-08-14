// Real-instance verification of Phase 22 (docs/IMPLEMENTATION_PLAN_V1.md
// "Phase 22 – Joomla Placement"): the pkg_sameviewcomparisons package
// (component + content plugin + editors-xtd plugin + module) installed as
// one unit, content placement via the editor button and its native
// {sameview session="SESSION_ID"} bracket-tag resolution, module placement
// via the SQL-driven session picker, missing-Comparison behavior, Delete,
// re-import reactivation, and full uninstall of all four bundled
// extensions — against real, disposable Joomla instances for both
// supported major versions, per docs/JOOMLA_INTEGRATION.md "Testing".
//
// Prerequisites: the current-major and previous-major Docker instances must
// already be running; the real package artifact must already be built
// (`node scripts/generate-joomla-artifact-for-verification.mjs
// integrations/joomla/tests/artifact/comparison-full-joomla.zip`, repo
// root) — the same unified pkg_sameviewcomparisons package used for first
// install and for the `Add comparison` upload
// (integrations/joomla/tests/add-comparison-lifecycle.test.mjs already
// covers that Add/Update/no-op/Delete lifecycle on its own; this file
// covers placement specifically, reusing the same artifact).

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
	invokePostflightRoute,
	joomlaCli,
	joomlaExec,
	loginAsAdmin,
	normalizeMediaOwnership,
	raiseUploadLimits,
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

for (const [versionLabel, instance] of Object.entries(INSTANCES)) {
	test(`Phase 22 placement lifecycle — Joomla ${versionLabel}`, async (t) => {
		const { composeFile, baseUrl } = instance;
		let sessionId;
		let articleId;

		await t.test("installs the full pkg_sameviewcomparisons package", () => {
			resetExtensionState(composeFile);
			disableGuidedTours(composeFile);
			raiseUploadLimits(composeFile);
			sessionId = undefined;

			copyIntoContainer(composeFile, ARTIFACT, CONTAINER_ZIP_PATH);
			const output = joomlaCli(composeFile, `extension:install --path=${CONTAINER_ZIP_PATH} -v`);
			assert.match(output, /Extension installed successfully/);
			normalizeMediaOwnership(composeFile);

			const rows = dbQuery(
				composeFile,
				"SELECT type FROM joom_extensions WHERE element='com_sameviewcomparisons' " +
					"OR element='pkg_sameviewcomparisons' " +
					"OR (element='sameview' AND folder IN ('content', 'editors-xtd')) " +
					"OR element='mod_sameview_comparison' OR element='sameview_comparison';",
			);
			assert.match(rows, /component/);
			assert.match(rows, /package/);
			assert.match(rows, /module/);
			assert.equal((rows.match(/plugin/g) || []).length, 2);
		});

		// docs/IMPLEMENTATION_PLAN_V1.md Phase 22 (UX follow-up): a genuine
		// first install must leave both placement plugins already enabled —
		// no hidden manual step — via pkg_sameviewcomparisons's own
		// postflight() (integrations/joomla/pkg_sameviewcomparisons/script.php).
		// mod_sameview_comparison is deliberately not asserted here: modules
		// already register enabled by default, unrelated to this change.
		await t.test("the package's own postflight enables both placement plugins automatically on first install", () => {
			const rows = dbQuery(
				composeFile,
				"SELECT folder, enabled FROM joom_extensions WHERE element='sameview' AND type='plugin' ORDER BY folder;",
			);
			assert.equal(rows, "content\t1\neditors-xtd\t1");
		});

		await t.test("real Joomla module/plugin filesystem structure is fully present", () => {
			const listing = joomlaExec(
				composeFile,
				"ls /var/www/html/modules/mod_sameview_comparison/ " +
					"/var/www/html/plugins/content/sameview/ " +
					"/var/www/html/plugins/editors-xtd/sameview/ " +
					"/var/www/html/media/com_sameviewcomparisons/js/",
			);
			assert.match(listing, /mod_sameview_comparison\.xml/);
			assert.match(listing, /sameview\.xml/);
			assert.match(listing, /comparison-embed-runtime\.js/);
		});

		await t.test("the bundled seed Comparison is available from first install", () => {
			sessionId = dbQuery(composeFile, "SELECT session_id FROM joom_sameview_comparisons LIMIT 1;");
			assert.ok(sessionId, "a Comparison must already be stored after first install");
		});

		await t.test("content placement: inserting {sameview session=...} via a real article renders the interactive Comparison", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				const pageErrors = [];
				page.on("pageerror", (error) => pageErrors.push(error));
				await loginAsAdmin(page, baseUrl);

				await page.goto(`${baseUrl}/administrator/index.php?option=com_content&task=article.add`);
				await page.waitForSelector("#jform_title");
				await page.fill("#jform_title", `SameView Placement Test — ${versionLabel}`);
				const frame = page.frameLocator("#jform_articletext_ifr");
				await frame.locator("body").click();
				await frame.locator("body").fill(`{sameview session="${sessionId}"}`);

				await page.evaluate(() => {
					const f = document.getElementById("adminForm") || document.forms[0];
					f.task.value = "article.save";
					Joomla.submitform("article.save", f);
				});
				await page.waitForLoadState("networkidle").catch(() => {});

				const idText = dbQuery(
					composeFile,
					"SELECT id FROM joom_content ORDER BY id DESC LIMIT 1;",
				);
				articleId = Number(idText);
				assert.ok(Number.isInteger(articleId) && articleId > 0);
				dbQuery(
					composeFile,
					`UPDATE joom_content SET state=1, catid=(SELECT id FROM joom_categories WHERE extension='com_content' LIMIT 1) WHERE id=${articleId};`,
				);

				await page.goto(`${baseUrl}/index.php?option=com_content&view=article&id=${articleId}`);
				await page.waitForTimeout(1000);
				assert.equal(await page.locator("[data-sameview-embed]").count(), 1);
				const shadowMounted = await page
					.locator("[data-sameview-embed]")
					.first()
					.evaluate((el) => Boolean(el.shadowRoot));
				assert.equal(shadowMounted, true, "the Embed runtime must mount a Shadow Root for the placement");
				assert.deepEqual(pageErrors, []);
			} finally {
				await browser.close();
			}
		});

		await t.test("editor button: the native picker inserts the reference using Joomla's own postMessage mechanism, no custom JS", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				await page.goto(`${baseUrl}/administrator/index.php?option=com_content&task=article.add`);
				await page.waitForSelector("#jform_title");
				await page.waitForTimeout(1000);

				// The "Core Buttons" menu button that hosts every XTD button
				// (including ours): selected by its own fixed icon SVG rather
				// than `data-mce-name="jxtdbuttons"`, which the older TinyMCE
				// bundled with Joomla 5 does not set (confirmed empirically —
				// the button itself, and the entire mechanism, is otherwise
				// identical on both supported major versions).
				await page.locator('button:has(svg path[d*="M8.313 8.646c1.026-1.026"])').click();
				await page.waitForTimeout(300);
				const items = await page.locator(".tox-collection__item-label").allTextContents();
				assert.ok(items.includes("SameView Comparison"), "the SameView button must appear in Joomla's own Core Buttons menu");
				await page.locator(".tox-collection__item").filter({ hasText: "SameView" }).click();
				await page.waitForTimeout(800);

				const modalFrame = page.frameLocator("iframe").last();
				const rowCount = await modalFrame.locator('[data-testid="sameview-picker-row"]').count();
				assert.ok(rowCount >= 1, "the picker must list at least the stored Comparison");
				await modalFrame.locator('[data-testid="sameview-picker-insert"]').first().click();
				await page.waitForTimeout(500);

				const editorText = await page.frameLocator("#jform_articletext_ifr").locator("body").innerText();
				assert.match(editorText, /\{sameview session="[^"]+"\}/);
			} finally {
				await browser.close();
			}
		});

		await t.test("module placement: the native SQL-field picker selects a Comparison by title and renders it", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);

				const eid = dbQuery(composeFile, "SELECT extension_id FROM joom_extensions WHERE name='mod_sameview_comparison';");

				// Regression: the native "New Module" picker must show the real
				// translated module title, never the raw element name (root
				// cause was a manifest `<files><folder module="...">` attribute
				// mismatch that made Joomla's own file-copy step abort for this
				// module's entire <files> section, including its language files
				// — already fixed in mod_sameview_comparison.xml; confirmed
				// empirically that the fix also resolves this display).
				await page.goto(`${baseUrl}/administrator/index.php?option=com_modules&view=select&client_id=0`);
				const cardTitle = await page
					.locator(`a[href*="eid=${eid}"] .new-module-title`)
					.innerText();
				assert.equal(cardTitle, "SameView Comparison");

				await page.goto(`${baseUrl}/administrator/index.php?option=com_modules&task=module.add&client_id=0&eid=${eid}`);
				await page.waitForSelector("#jform_title", { timeout: 10000 });
				await page.fill("#jform_title", `SameView Test Module — ${versionLabel}`);

				const sessionSelect = page.locator("select[name='jform[params][session_id]']");
				const options = await sessionSelect.locator("option").allTextContents();
				assert.ok(options.length > 1, "the SQL field must list the stored Comparison, not only its header option");
				await sessionSelect.selectOption({ index: 1 });

				// The module position field is a Choices.js-enhanced select
				// whose underlying <select> starts with no template-position
				// <option>s at all on Joomla 5 (populated only through the
				// widget's own search UI) — confirmed empirically that a plain
				// selectOption() call there hangs waiting for an option that
				// never exists. Setting the real <select> value directly (what
				// the form actually submits) works identically and reliably on
				// both supported major versions.
				await page.evaluate(() => {
					const select = document.getElementById("jform_position");
					let option = Array.from(select.options).find((candidate) => candidate.value === "sidebar-right");
					if (!option) {
						option = document.createElement("option");
						option.value = "sidebar-right";
						option.textContent = "Sidebar Right";
						select.appendChild(option);
					}
					select.value = "sidebar-right";
					select.dispatchEvent(new Event("change", { bubbles: true }));
				});

				await page.evaluate(() => {
					const f = document.getElementById("adminForm") || document.forms[0];
					f.task.value = "module.save";
					Joomla.submitform("module.save", f);
				});
				await page.waitForLoadState("networkidle").catch(() => {});

				const bodyText = await page.locator("body").innerText();
				assert.doesNotMatch(bodyText, /Module XML data not available/i);

				await page.goto(`${baseUrl}/`);
				await page.waitForTimeout(1000);
				assert.equal(await page.locator("[data-sameview-embed]").count(), 1);
			} finally {
				await browser.close();
			}
		});

		await t.test("missing Comparison: an unresolved session.id renders nothing and reserves no space", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				const pageErrors = [];
				page.on("pageerror", (error) => pageErrors.push(error));

				await page.goto(`${baseUrl}/administrator/`);
				// Point the module at a session.id that does not exist.
				dbQuery(
					composeFile,
					`UPDATE joom_modules SET params = REPLACE(params, '${sessionId}', 'nonexistent-${versionLabel}') WHERE module='mod_sameview_comparison';`,
				);

				await page.goto(`${baseUrl}/`);
				await page.waitForTimeout(1000);
				assert.equal(await page.locator("[data-sameview-embed]").count(), 0);
				assert.deepEqual(pageErrors, []);

				// Restore it for the delete/reimport steps below.
				dbQuery(
					composeFile,
					`UPDATE joom_modules SET params = REPLACE(params, 'nonexistent-${versionLabel}', '${sessionId}') WHERE module='mod_sameview_comparison';`,
				);
			} finally {
				await browser.close();
			}
		});

		await t.test("deleting the placed Comparison removes it from both the content and module placements", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				await page.goto(`${baseUrl}/administrator/index.php?option=com_sameviewcomparisons&view=comparisons`);
				await page.locator('input[name="cid[]"]').first().check();
				const deleteButton = page.locator("#toolbar-delete button");
				await deleteButton.click();
				await Promise.all([
					page.waitForNavigation(),
					page.locator("dialog[open] [data-button-ok]").click(),
				]);

				await page.goto(`${baseUrl}/index.php?option=com_content&view=article&id=${articleId}`);
				await page.waitForTimeout(1000);
				assert.equal(await page.locator("[data-sameview-embed]").count(), 0);

				await page.goto(`${baseUrl}/`);
				await page.waitForTimeout(1000);
				assert.equal(await page.locator("[data-sameview-embed]").count(), 0);
			} finally {
				await browser.close();
			}
		});

		await t.test("re-importing the same session.id automatically reactivates both existing placements", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				await page.goto(`${baseUrl}/administrator/index.php?option=com_sameviewcomparisons&view=upload`);
				await page.setInputFiles('[data-testid="sameview-upload-file-input"]', ARTIFACT);
				await page.click('[data-testid="sameview-upload-submit"]');
				await page.waitForLoadState("networkidle").catch(() => {});

				const row = dbQuery(composeFile, `SELECT session_id FROM joom_sameview_comparisons WHERE session_id='${sessionId}';`);
				assert.equal(row, sessionId);

				await page.goto(`${baseUrl}/index.php?option=com_content&view=article&id=${articleId}`);
				await page.waitForTimeout(1000);
				assert.ok((await page.locator("[data-sameview-embed]").count()) >= 1);

				await page.goto(`${baseUrl}/`);
				await page.waitForTimeout(1000);
				assert.equal(await page.locator("[data-sameview-embed]").count(), 1);
			} finally {
				await browser.close();
			}
		});

		// docs/IMPLEMENTATION_PLAN_V1.md Phase 22 (UX follow-up): an operator
		// who has deliberately disabled a placement plugin keeps that choice
		// across a future update/reinstall — postflight() only auto-enables on
		// $route === 'install', never 'update'. Exercised directly via
		// invokePostflightRoute() here as a fast, isolated check of both route
		// branches; package-update-lifecycle.test.mjs additionally exercises
		// this same guard end-to-end through a real whole-package reinstall via
		// the Extensions Manager (Phase 22 update-lifecycle fix: every bundled
		// manifest now carries method="upgrade", so that real path exists).
		// This still exercises the real, actually-installed postflight() code,
		// only via a direct call instead of the full Installer pipeline.
		await t.test("a deliberately disabled placement plugin is not re-enabled by the update route, only by a genuine first install", () => {
			dbQuery(
				composeFile,
				"UPDATE joom_extensions SET enabled=0 WHERE element='sameview' AND folder='content';",
			);
			assert.equal(
				dbQuery(composeFile, "SELECT enabled FROM joom_extensions WHERE element='sameview' AND folder='content';"),
				"0",
			);

			invokePostflightRoute(composeFile, "update");
			assert.equal(
				dbQuery(composeFile, "SELECT enabled FROM joom_extensions WHERE element='sameview' AND folder='content';"),
				"0",
				"the update route must never re-enable a deliberately disabled plugin",
			);
			// The untouched plugin is unaffected either way.
			assert.equal(
				dbQuery(composeFile, "SELECT enabled FROM joom_extensions WHERE element='sameview' AND folder='editors-xtd';"),
				"1",
			);

			invokePostflightRoute(composeFile, "install");
			assert.equal(
				dbQuery(composeFile, "SELECT enabled FROM joom_extensions WHERE element='sameview' AND folder='content';"),
				"1",
				"a genuine first install must (re-)enable the placement plugins",
			);
		});

		await t.test("full uninstall removes all four bundled extensions and their files, with no orphaned data", () => {
			const packageId = dbQuery(composeFile, "SELECT extension_id FROM joom_extensions WHERE element='pkg_sameviewcomparisons';");
			assert.ok(packageId, "the package must be installed before it can be removed");

			const output = joomlaCli(composeFile, `extension:remove ${packageId} -n -v`);
			assert.match(output, /Extension removed/);

			const remaining = dbQuery(
				composeFile,
				"SELECT COUNT(*) FROM joom_extensions WHERE element='com_sameviewcomparisons' " +
					"OR element='pkg_sameviewcomparisons' " +
					"OR (element='sameview' AND folder IN ('content', 'editors-xtd')) " +
					"OR element='mod_sameview_comparison' OR element='sameview_comparison';",
			);
			assert.equal(remaining, "0");

			const tables = dbQuery(composeFile, "SHOW TABLES LIKE '%sameview%';");
			assert.equal(tables, "");

			for (const path of [
				"/var/www/html/administrator/components/com_sameviewcomparisons",
				"/var/www/html/modules/mod_sameview_comparison",
				"/var/www/html/plugins/content/sameview",
				"/var/www/html/plugins/editors-xtd/sameview",
				"/var/www/html/media/com_sameviewcomparisons",
			]) {
				assert.throws(() => joomlaExec(composeFile, `test -e ${path}`));
			}
		});
	});
}
