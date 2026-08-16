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
// A second, distinct Comparison — only needed for the deliberate-reselection
// regression below (Phase 24 Part B), reusing the same prebuilt fixture
// add-comparison-lifecycle.test.mjs already relies on elsewhere.
const MINIMAL_ARTIFACT = join(JOOMLA_DIR, "tests", "artifact", "comparison-minimal-joomla.zip");
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
		let moduleId;

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
				// Waits for the actual mount-complete signal, not just the
				// server-rendered [data-sameview-embed] host (present before the
				// runtime ever runs): src/lib/comparison-presentation-runtime.ts
				// `initInstance()` only sets `data-sameview-runtime-initialized`
				// on `.presentation-canvas` once the Shadow Root is attached, its
				// CSS has loaded, the markup is injected and every required
				// descendant element has resolved — exactly the state the
				// assertions below require. Playwright's locator engine pierces
				// an open Shadow Root automatically, so this selector reaches
				// through it without any special handling.
				await page
					.locator("[data-sameview-embed] [data-sameview-runtime-initialized='true']")
					.waitFor({ state: "attached" });
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

				// Phase 24 audit follow-up: the second column header must name what
				// its cells actually show (the reference-to-capture period label),
				// not "Session ID" — a mislabelled header found during the Phase 24
				// documentation audit.
				const secondColumnHeader = await modalFrame
					.locator('[data-testid="sameview-picker-list"] thead th')
					.nth(1)
					.innerText();
				assert.equal(secondColumnHeader, "Reference → Capture");

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

				// Phase 24 audit follow-up: docs/JOOMLA_INTEGRATION.md "No Editor
				// Preview" requires a regular option to identify its Comparison by
				// title AND reference-to-capture period label, the same bar the
				// Editors-XTD picker already meets via its own table column —
				// derive the expected combined text the same way
				// ComparisonRenderHelper::periodLabelFor() does, from the stored
				// Comparison's own title/manifest_json, rather than hard-coding it.
				// Extracted via MySQL's own JSON operator rather than round-
				// tripping the raw (pretty-printed, tab/newline-formatted)
				// manifest_json blob through dbQuery()/JSON.parse(): the mysql
				// CLI escapes those literal control characters into visible
				// backslash sequences in its text output, which breaks JSON.parse
				// on the JS side — unrelated to the fix under test.
				const expectedTitle = dbQuery(composeFile, `SELECT title FROM joom_sameview_comparisons WHERE session_id='${sessionId}';`);
				const [referenceLabel, captureLabel] = dbQuery(
					composeFile,
					`SELECT manifest_json->>'$.presentation.referenceLabel', manifest_json->>'$.presentation.captureLabel' FROM joom_sameview_comparisons WHERE session_id='${sessionId}';`,
				)
					.split("\t")
					.map((label) => (label === "NULL" ? "" : label));
				const expectedPeriod = [referenceLabel, captureLabel].filter((label) => label !== "").join(" – ");
				const expectedOptionText = expectedPeriod ? `${expectedTitle} (${expectedPeriod})` : expectedTitle;
				assert.ok(
					options.includes(expectedOptionText),
					`the module picker must show title and reference-to-capture period label together (expected "${expectedOptionText}", got ${JSON.stringify(options)})`,
				);

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

				moduleId = Number(
					dbQuery(
						composeFile,
						"SELECT id FROM joom_modules WHERE module IN ('sameview_comparison', 'mod_sameview_comparison') ORDER BY id DESC LIMIT 1;",
					),
				);
				assert.ok(Number.isInteger(moduleId) && moduleId > 0);

				await page.goto(`${baseUrl}/`);
				await page.waitForTimeout(1000);
				assert.equal(await page.locator("[data-sameview-embed]").count(), 1);
			} finally {
				await browser.close();
			}
		});

		// Real manual-acceptance finding, confirmed against real Joomla
		// 6.1.2/5.4.7 core source: ModuleModel::preprocessForm()
		// (administrator/components/com_modules/src/Model/ModuleModel.php)
		// only ever loads the module's regular .ini via
		// Language::load($module, $client->path) — never .sys.ini — when
		// building the module edit form. A name/description defined only in
		// .sys.ini therefore rendered as a raw, untranslated key on this one
		// screen (administrator/components/com_modules/tmpl/module/edit.php
		// echoes $this->item->xml->name/->description through Text::_()),
		// even though the same strings already resolved correctly elsewhere
		// (Extensions Manage list, New Module selection card), which load
		// language via a separate, sys.ini-based extension-discovery
		// mechanism. Fixed by duplicating both keys into the regular .ini.
		await t.test("module admin form: the edit screen's own name/description are translated, not raw XML keys", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);

				await page.goto(`${baseUrl}/administrator/index.php?option=com_modules&task=module.edit&id=${moduleId}&client_id=0`);
				await page.waitForSelector("#jform_title", { timeout: 10000 });

				const heading = await page.locator(".col-lg-9 h2").first().innerText();
				assert.equal(
					heading,
					"SameView Comparison",
					"the module edit form heading must show the translated name, not the raw mod_sameview_comparison XML element name",
				);

				const bodyText = await page.locator("body").innerText();
				assert.doesNotMatch(
					bodyText,
					/MOD_SAMEVIEW_COMPARISON_XML_DESCRIPTION/,
					"the module edit form must never show the raw, untranslated description key",
				);
				assert.match(
					bodyText,
					/Displays one existing SameView Comparison in this module position/,
					"the module edit form must show the real translated English description text",
				);

				// The German regular .ini must carry the same two keys with the
				// same values already established in the German .sys.ini —
				// verified directly against the source file rather than driving
				// the admin UI in German, since no existing test path switches
				// the admin language and doing so here would be new scope.
				const deIni = await readFile(
					join(JOOMLA_DIR, "mod_sameview_comparison", "language", "de-DE", "mod_sameview_comparison.ini"),
					"utf8",
				);
				assert.match(deIni, /^MOD_SAMEVIEW_COMPARISON="SameView-Vergleich"$/m);
				assert.match(
					deIni,
					/^MOD_SAMEVIEW_COMPARISON_XML_DESCRIPTION="Zeigt einen vorhandenen SameView-Vergleich in dieser Modulposition an\. Wählen Sie den Vergleich nach Titel aus; hier wird keine Vorschau angezeigt\."$/m,
				);
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

		// Phase 24 Part B regression (real manual-sandbox finding, not caught
		// by the automated suite before this fix): with the module above now
		// genuinely pointing at a deleted Comparison (the previous test just
		// deleted it through the real admin delete action), opening the
		// module's own real admin edit form and saving it again — changing
		// only an unrelated field — must succeed. Before the fix in
		// fields/sameviewcomparison.php, Joomla's own OptionsRule rejected
		// this exact, unmodified resubmission with "Invalid field: Comparison"
		// (root cause: Joomla core validates module saves against a Form
		// deliberately bound to no data — FormController::save() calls
		// getForm($data, false) — so the field instance OptionsRule inspects
		// always saw an empty value, and the missing-option override never
		// fired). This must go through the real `module.save` submit path,
		// never a direct DB shortcut — that is exactly what let this bug
		// through undetected previously (see the "missing Comparison" test
		// above, which only ever manipulates `params` via SQL).
		await t.test("module admin form: Missing Comparison is shown, and an independent title-only re-save preserves the exact session_id", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);

				await page.goto(`${baseUrl}/administrator/index.php?option=com_modules&task=module.edit&id=${moduleId}&client_id=0`);
				await page.waitForSelector("#jform_title", { timeout: 10000 });

				const sessionSelect = page.locator("select[name='jform[params][session_id]']");
				const selectedTextBefore = await sessionSelect.locator("option:checked").innerText();
				const selectedValueBefore = await sessionSelect.inputValue();
				assert.match(selectedTextBefore, /Missing Comparison/, "the deleted Comparison must render as a selectable Missing option");
				assert.equal(selectedValueBefore, sessionId, "the Missing option must still carry the real, original session_id");
				// Phase 24 audit follow-up: the module picker's period-label
				// enrichment (added for the regular-option case below) must never
				// reach the missing option — it stays exactly the defined
				// title/session_id-only Missing state, per
				// docs/JOOMLA_INTEGRATION.md's own carve-out for this case.
				assert.equal(
					selectedTextBefore,
					`Missing Comparison (${sessionId})`,
					"the missing option must show only the session_id, never a period-label suffix",
				);

				// Only the unrelated module title is changed — the Comparison
				// selection itself is left untouched, exactly as in the manual
				// reproduction. Plain ASCII only: docker-helpers.mjs `dbQuery()`
				// invokes the mysql CLI without an explicit UTF-8 client
				// charset, which mangles multi-byte characters (e.g. an em dash)
				// on readback — unrelated to the fix under test, so avoided here
				// rather than worked around.
				const resavedTitle = `SameView Test Module ${versionLabel} (resaved while missing)`;
				await page.fill("#jform_title", resavedTitle);

				await page.evaluate(() => {
					const f = document.getElementById("adminForm") || document.forms[0];
					f.task.value = "module.save";
					Joomla.submitform("module.save", f);
				});
				await page.waitForLoadState("networkidle").catch(() => {});

				const bodyText = await page.locator("body").innerText();
				assert.doesNotMatch(
					bodyText,
					/Invalid field/i,
					"an independent re-save of an already-missing module must not be rejected by Joomla's own field validation",
				);

				const titleAfter = dbQuery(composeFile, `SELECT title FROM joom_modules WHERE id=${moduleId};`);
				assert.equal(titleAfter, resavedTitle, "the save must have genuinely gone through, not merely redirected without persisting");

				const paramsAfter = dbQuery(composeFile, `SELECT params FROM joom_modules WHERE id=${moduleId};`);
				assert.ok(paramsAfter.includes(sessionId), "the module's session_id must round-trip completely unchanged");
			} finally {
				await browser.close();
			}
		});

		await t.test("module admin form: reopening after the independent re-save still shows the missing state", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);

				await page.goto(`${baseUrl}/administrator/index.php?option=com_modules&task=module.edit&id=${moduleId}&client_id=0`);
				await page.waitForSelector("#jform_title", { timeout: 10000 });

				const sessionSelect = page.locator("select[name='jform[params][session_id]']");
				const selectedText = await sessionSelect.locator("option:checked").innerText();
				const selectedValue = await sessionSelect.inputValue();
				assert.match(selectedText, /Missing Comparison/);
				assert.equal(selectedValue, sessionId);
				assert.equal(
					selectedText,
					`Missing Comparison (${sessionId})`,
					"the missing option must still show only the session_id, never a period-label suffix",
				);
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

		await t.test("module admin form: shows the normal Comparison label again after re-import, no longer Missing", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);

				const restoredTitle = dbQuery(composeFile, `SELECT title FROM joom_sameview_comparisons WHERE session_id='${sessionId}';`);
				// The module picker's period-label enrichment (Phase 24 audit
				// follow-up) applies to this now-restored, regular option exactly
				// like any other — expect "Title (Period)", not title alone.
				const [restoredReferenceLabel, restoredCaptureLabel] = dbQuery(
					composeFile,
					`SELECT manifest_json->>'$.presentation.referenceLabel', manifest_json->>'$.presentation.captureLabel' FROM joom_sameview_comparisons WHERE session_id='${sessionId}';`,
				)
					.split("\t")
					.map((label) => (label === "NULL" ? "" : label));
				const restoredPeriod = [restoredReferenceLabel, restoredCaptureLabel].filter((label) => label !== "").join(" – ");
				const restoredOptionText = restoredPeriod ? `${restoredTitle} (${restoredPeriod})` : restoredTitle;

				await page.goto(`${baseUrl}/administrator/index.php?option=com_modules&task=module.edit&id=${moduleId}&client_id=0`);
				await page.waitForSelector("#jform_title", { timeout: 10000 });

				const sessionSelect = page.locator("select[name='jform[params][session_id]']");
				const selectedText = await sessionSelect.locator("option:checked").innerText();
				const selectedValue = await sessionSelect.inputValue();
				assert.doesNotMatch(selectedText, /Missing Comparison/);
				assert.equal(selectedText, restoredOptionText);
				assert.equal(selectedValue, sessionId);
			} finally {
				await browser.close();
			}
		});

		// Phase 24 Part B regression: the fix must only ever re-admit the
		// module's own already-persisted value as a synthetic option — a
		// genuine, deliberate reselection of a different, currently-existing
		// Comparison (the normal case, unrelated to the missing-state bug)
		// must keep working exactly as before.
		await t.test("module admin form: deliberately reselecting a different existing Comparison still works", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);

				await page.goto(`${baseUrl}/administrator/index.php?option=com_sameviewcomparisons&view=upload`);
				await page.setInputFiles('[data-testid="sameview-upload-file-input"]', MINIMAL_ARTIFACT);
				await page.click('[data-testid="sameview-upload-submit"]');
				await page.waitForLoadState("networkidle").catch(() => {});

				const minimalSessionId = await readManifestSessionId(MINIMAL_ARTIFACT);
				const row = dbQuery(composeFile, `SELECT session_id FROM joom_sameview_comparisons WHERE session_id='${minimalSessionId}';`);
				assert.equal(row, minimalSessionId, "the second Comparison must be genuinely imported before it can be selected");

				await page.goto(`${baseUrl}/administrator/index.php?option=com_modules&task=module.edit&id=${moduleId}&client_id=0`);
				await page.waitForSelector("#jform_title", { timeout: 10000 });

				const sessionSelect = page.locator("select[name='jform[params][session_id]']");
				await sessionSelect.selectOption({ value: minimalSessionId });

				await page.evaluate(() => {
					const f = document.getElementById("adminForm") || document.forms[0];
					f.task.value = "module.save";
					Joomla.submitform("module.save", f);
				});
				await page.waitForLoadState("networkidle").catch(() => {});

				const bodyText = await page.locator("body").innerText();
				assert.doesNotMatch(bodyText, /Invalid field/i);

				const paramsAfter = dbQuery(composeFile, `SELECT params FROM joom_modules WHERE id=${moduleId};`);
				assert.ok(paramsAfter.includes(minimalSessionId), "the newly, deliberately selected session_id must be persisted");
				assert.ok(!paramsAfter.includes(sessionId), "the old session_id must no longer be stored after a deliberate reselection");
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
