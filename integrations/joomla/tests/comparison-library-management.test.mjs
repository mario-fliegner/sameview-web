// Real-instance verification of Phase 24 Part A (docs/IMPLEMENTATION_PLAN_V1.md
// "Phase 24 – Joomla Real-Platform Integration and Release Readiness",
// docs/EMBED_IN_WEBSITE.md "Comparison Management"): the admin Comparison
// Library list now shows a thumbnail, the reference-to-capture period, a
// usage count and concrete, linked placements — mirroring
// integrations/wordpress/sameview-comparisons/includes/admin-library.php and
// includes/placements.php's own bounded, two-stage lookup, reused here with
// Joomla-native mechanisms (no new persistence, no site-wide scanner) — real
// against Joomla 6 and Joomla 5, per docs/JOOMLA_INTEGRATION.md "Testing".
//
// Prerequisites: the current-major and previous-major Docker instances must
// already be running; the real package artifact and the minimal second-
// Comparison artifact must already be built (see
// add-comparison-lifecycle.test.mjs's own header comment for the exact
// generation commands — both artifacts are shared, already-built fixtures).

import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { join } from "node:path";
import {
	INSTANCES,
	JOOMLA_DIR,
	copyIntoContainer,
	dbQuery,
	disableGuidedTours,
	joomlaCli,
	loginAsAdmin,
	normalizeMediaOwnership,
	raiseUploadLimits,
	resetExtensionState,
} from "./docker-helpers.mjs";

const FULL_ARTIFACT = join(JOOMLA_DIR, "tests", "artifact", "comparison-full-joomla.zip");
const MINIMAL_ARTIFACT = join(JOOMLA_DIR, "tests", "artifact", "comparison-minimal-joomla.zip");
const CONTAINER_ZIP_PATH = "/var/www/html/tmp/sameview-comparisons-joomla.zip";
const LIBRARY_URL_SUFFIX = "administrator/index.php?option=com_sameviewcomparisons&view=comparisons";

function installPackage(composeFile) {
	copyIntoContainer(composeFile, FULL_ARTIFACT, CONTAINER_ZIP_PATH);
	const output = joomlaCli(composeFile, `extension:install --path=${CONTAINER_ZIP_PATH} -v`);
	normalizeMediaOwnership(composeFile);
	return output;
}

async function uploadComparison(page, baseUrl, artifactPath) {
	await page.goto(`${baseUrl}/administrator/index.php?option=com_sameviewcomparisons&view=upload`);
	await page.setInputFiles('[data-testid="sameview-upload-file-input"]', artifactPath);
	await page.click('[data-testid="sameview-upload-submit"]');
	await page.waitForLoadState("networkidle").catch(() => {});
}

async function libraryRow(page, baseUrl, sessionId) {
	await page.goto(`${baseUrl}/${LIBRARY_URL_SUFFIX}`, { waitUntil: "networkidle" });
	return page.locator(`[data-testid="sameview-comparison-row"][data-session-id="${sessionId}"]`);
}

async function createArticle(composeFile, baseUrl, title, bodyText) {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		await loginAsAdmin(page, baseUrl);
		await page.goto(`${baseUrl}/administrator/index.php?option=com_content&task=article.add`);
		await page.waitForSelector("#jform_title");
		await page.fill("#jform_title", title);
		const frame = page.frameLocator("#jform_articletext_ifr");
		await frame.locator("body").click();
		await frame.locator("body").fill(bodyText);
		await page.evaluate(() => {
			const f = document.getElementById("adminForm") || document.forms[0];
			f.task.value = "article.save";
			Joomla.submitform("article.save", f);
		});
		await page.waitForLoadState("networkidle").catch(() => {});
	} finally {
		await browser.close();
	}
	const id = Number(dbQuery(composeFile, "SELECT id FROM joom_content ORDER BY id DESC LIMIT 1;"));
	dbQuery(
		composeFile,
		`UPDATE joom_content SET state=1, catid=(SELECT id FROM joom_categories WHERE extension='com_content' LIMIT 1) WHERE id=${id};`,
	);
	return id;
}

async function createModulePlacement(composeFile, baseUrl, sessionId, title) {
	const eid = dbQuery(composeFile, "SELECT extension_id FROM joom_extensions WHERE name='mod_sameview_comparison';");
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		await loginAsAdmin(page, baseUrl);
		await page.goto(`${baseUrl}/administrator/index.php?option=com_modules&task=module.add&client_id=0&eid=${eid}`);
		await page.waitForSelector("#jform_title", { timeout: 10000 });
		await page.fill("#jform_title", title);
		await page.locator("select[name='jform[params][session_id]']").selectOption(sessionId);
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
	} finally {
		await browser.close();
	}
	return Number(dbQuery(composeFile, "SELECT id FROM joom_modules ORDER BY id DESC LIMIT 1;"));
}

for (const [versionLabel, instance] of Object.entries(INSTANCES)) {
	test(`Phase 24 Part A comparison library management — Joomla ${versionLabel}`, async (t) => {
		const { composeFile, baseUrl } = instance;
		let fullSessionId;
		let minimalSessionId;
		let articleId;
		let moduleId;

		await t.test("prepares a clean instance with the bundled seed Comparison", () => {
			resetExtensionState(composeFile);
			disableGuidedTours(composeFile);
			raiseUploadLimits(composeFile);

			const output = installPackage(composeFile);
			assert.match(output, /Extension installed successfully/);

			fullSessionId = dbQuery(composeFile, "SELECT session_id FROM joom_sameview_comparisons LIMIT 1;");
			assert.ok(fullSessionId, "the bundled seed Comparison must be available after first install");
		});

		await t.test("thumbnail: present and resolves to the real, already-stored reference.jpg", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				const row = await libraryRow(page, baseUrl, fullSessionId);
				const img = row.locator('[data-testid="sameview-comparison-thumbnail"]');
				await assert.doesNotReject(img.waitFor({ state: "attached", timeout: 5000 }));
				const src = await img.getAttribute("src");
				assert.match(src, /\/media\/com_sameviewcomparisons\/comparisons\/[a-f0-9]{32}\/reference\.jpg$/);

				const response = await page.request.get(src);
				assert.equal(response.ok(), true, "the thumbnail URL must actually resolve, not 404");
				const bytes = await response.body();
				assert.ok(bytes.length > 1000, "the thumbnail must be the real image, not an empty/placeholder file");
			} finally {
				await browser.close();
			}
		});

		await t.test("period: shows the real, already-computed reference-to-capture label", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				const row = await libraryRow(page, baseUrl, fullSessionId);
				const period = await row.locator('[data-testid="sameview-comparison-period"]').innerText();
				assert.match(period, /\S/, "the period label must not be empty for a Comparison with reference/capture labels");
			} finally {
				await browser.close();
			}
		});

		await t.test("usage: a freshly added, never-placed Comparison shows zero placements", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				await uploadComparison(page, baseUrl, MINIMAL_ARTIFACT);
			} finally {
				await browser.close();
			}

			minimalSessionId = dbQuery(
				composeFile,
				"SELECT session_id FROM joom_sameview_comparisons WHERE session_id != '" + fullSessionId + "' LIMIT 1;",
			);
			assert.ok(minimalSessionId && minimalSessionId !== fullSessionId);

			const browser2 = await chromium.launch();
			try {
				const page = await browser2.newPage();
				await loginAsAdmin(page, baseUrl);
				const row = await libraryRow(page, baseUrl, minimalSessionId);
				const usage = await row.locator('[data-testid="sameview-comparison-usage"]').innerText();
				assert.equal(usage, "No placements found");
				const placementCount = await row.locator('[data-testid="sameview-comparison-placement"]').count();
				assert.equal(placementCount, 0);
			} finally {
				await browser2.close();
			}
		});

		await t.test("content placement: a real article reference is detected and linked correctly", async () => {
			articleId = await createArticle(
				composeFile,
				baseUrl,
				`Phase 24 Library Content Placement — ${versionLabel}`,
				`{sameview session="${minimalSessionId}"}`,
			);

			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				const row = await libraryRow(page, baseUrl, minimalSessionId);
				const usage = await row.locator('[data-testid="sameview-comparison-usage"]').innerText();
				assert.equal(usage, "Used in 1 place");

				const placement = row.locator('[data-testid="sameview-comparison-placement"][data-placement-type="article"]');
				await assert.doesNotReject(placement.first().waitFor({ state: "attached", timeout: 5000 }));
				assert.equal(await placement.count(), 1);
				const href = await placement.locator("a").getAttribute("href");
				assert.match(href, new RegExp(`option=com_content&task=article\\.edit&id=${articleId}(&|$)`));
			} finally {
				await browser.close();
			}
		});

		await t.test("module placement: a real module instance is detected and linked correctly, usage becomes plural", async () => {
			moduleId = await createModulePlacement(
				composeFile,
				baseUrl,
				minimalSessionId,
				`Phase 24 Library Module Placement — ${versionLabel}`,
			);

			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				const row = await libraryRow(page, baseUrl, minimalSessionId);
				const usage = await row.locator('[data-testid="sameview-comparison-usage"]').innerText();
				assert.equal(usage, "Used in 2 places");

				const modulePlacement = row.locator('[data-testid="sameview-comparison-placement"][data-placement-type="module"]');
				await assert.doesNotReject(modulePlacement.first().waitFor({ state: "attached", timeout: 5000 }));
				assert.equal(await modulePlacement.count(), 1);
				const href = await modulePlacement.locator("a").getAttribute("href");
				assert.match(href, new RegExp(`option=com_modules&task=module\\.edit&id=${moduleId}(&|$)`));

				const articlePlacement = row.locator('[data-testid="sameview-comparison-placement"][data-placement-type="article"]');
				assert.equal(await articlePlacement.count(), 1, "the earlier article placement must still be listed");
			} finally {
				await browser.close();
			}
		});

		await t.test("no false positives: text that only resembles the SameView tag is never counted as a placement", async () => {
			await createArticle(
				composeFile,
				baseUrl,
				`Phase 24 Library Decoy Article — ${versionLabel}`,
				// Deliberately NOT a real match: a malformed tag missing its
				// closing brace, plain text mentioning the pattern without
				// braces at all, and a syntactically valid tag for a
				// completely different (nonexistent) session.id — none of
				// these may be confirmed as a placement of minimalSessionId.
				`{sameview session="${minimalSessionId}" (missing closing brace) ` +
					`some text about sameview session="${minimalSessionId}" without braces ` +
					`{sameview session="not-${minimalSessionId}"}`,
			);

			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				const row = await libraryRow(page, baseUrl, minimalSessionId);
				const usage = await row.locator('[data-testid="sameview-comparison-usage"]').innerText();
				assert.equal(usage, "Used in 2 places", "decoy text must not be counted as a third placement");
				assert.equal(await row.locator('[data-testid="sameview-comparison-placement"]').count(), 2);
			} finally {
				await browser.close();
			}
		});

		await t.test("delete: the existing delete experience already shows usage/placements before the operator confirms", async () => {
			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				const row = await libraryRow(page, baseUrl, minimalSessionId);

				// The usage/placement info is already visible in the very same
				// row that carries the delete checkbox — no separate dialog or
				// architecture needed for the operator to see it before acting.
				assert.equal(await row.locator('[data-testid="sameview-comparison-usage"]').innerText(), "Used in 2 places");

				await row.locator('input[name="cid[]"]').check();
				const deleteButton = page.locator("#toolbar-delete button");
				await deleteButton.click();
				await Promise.all([
					page.waitForNavigation(),
					page.locator("dialog[open] [data-button-ok]").click(),
				]);

				const remaining = dbQuery(
					composeFile,
					`SELECT session_id FROM joom_sameview_comparisons WHERE session_id='${minimalSessionId}';`,
				);
				assert.equal(remaining, "", "the Comparison itself must be gone after delete");

				// docs/EMBED_IN_WEBSITE.md "Placement Behavior After Deletion":
				// deleting a Comparison never removes or rewrites its
				// placements — the article/module rows themselves survive
				// untouched.
				const articleStillExists = dbQuery(composeFile, `SELECT id FROM joom_content WHERE id=${articleId};`);
				assert.equal(articleStillExists, String(articleId));
				const moduleStillExists = dbQuery(composeFile, `SELECT id FROM joom_modules WHERE id=${moduleId};`);
				assert.equal(moduleStillExists, String(moduleId));
			} finally {
				await browser.close();
			}
		});
	});
}
