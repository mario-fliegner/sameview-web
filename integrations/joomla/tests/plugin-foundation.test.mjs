// Real-instance verification of Phase 19 (docs/IMPLEMENTATION_PLAN_V1.md
// "Phase 19 – Joomla Extension Foundation"): installation, storage model
// (database table + media/ directory), the single native ACL permission,
// and full removal — against real, disposable Joomla instances for both
// supported major versions (docs/JOOMLA_INTEGRATION.md "Supported Joomla
// Versions"), per docs/JOOMLA_INTEGRATION.md "Testing".
//
// Prerequisites: the current-major and previous-major Docker instances
// must already be running (`docker compose -f docker-compose.current-major.yml
// up -d` / `docker compose -f docker-compose.previous-major.yml up -d`),
// and the package must be built (`node scripts/build-package.mjs`). This
// file does not manage the Docker lifecycle itself, mirroring
// integrations/wordpress/tests's own separation of concerns.
//
// No mocked environment: every assertion below queries the real database
// or the real filesystem inside the real container, or drives the real
// admin UI through Playwright — never a fixture or an approximation.

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
	extensionId,
	joomlaCli,
	joomlaExec,
	loginAsAdmin,
	resetExtensionState,
} from "./docker-helpers.mjs";

const PACKAGE_PATH = join(JOOMLA_DIR, "tests", "artifact", "sameview-comparisons-joomla.zip");
const CONTAINER_ZIP_PATH = "/var/www/html/tmp/sameview-comparisons-joomla.zip";

for (const [versionLabel, instance] of Object.entries(INSTANCES)) {
	test(`Phase 19 foundation lifecycle — Joomla ${versionLabel}`, async (t) => {
		const { composeFile, baseUrl } = instance;

		await t.test("starts from a clean slate", () => {
			resetExtensionState(composeFile);
			disableGuidedTours(composeFile);
			const id = extensionId(composeFile);
			assert.equal(id, "", "no leftover com_sameviewcomparisons extension row before install");
		});

		await t.test("installs via the native Extensions Manager (CLI equivalent)", () => {
			copyIntoContainer(composeFile, PACKAGE_PATH, CONTAINER_ZIP_PATH);
			const output = joomlaCli(composeFile, `extension:install --path=${CONTAINER_ZIP_PATH} -v`);
			assert.match(output, /Extension installed successfully/);
		});

		await t.test("creates the storage model: database table + media/ directory", () => {
			const tables = dbQuery(composeFile, "SHOW TABLES LIKE '%sameview%';");
			assert.match(tables, /sameview_comparisons/);

			const mediaLs = joomlaExec(
				composeFile,
				"ls -d /var/www/html/media/com_sameviewcomparisons",
			);
			assert.match(mediaLs, /com_sameviewcomparisons/);
		});

		await t.test("registers the single native ACL permission as an asset", () => {
			const assetRow = dbQuery(
				composeFile,
				"SELECT name FROM joom_assets WHERE name='com_sameviewcomparisons';",
			);
			assert.equal(assetRow, "com_sameviewcomparisons");
		});

		await t.test("exercises the storage model with a manually inserted test row, visible in the admin list view", async () => {
			dbQuery(
				composeFile,
				"INSERT INTO joom_sameview_comparisons " +
					"(session_id, outcome_fingerprint, title, manifest_json, created, modified) VALUES " +
					`('phase19-test-${versionLabel}', 'fp-test', 'Phase 19 Automated Test Row', '{}', NOW(), NOW());`,
			);

			const browser = await chromium.launch();
			try {
				const page = await browser.newPage();
				await loginAsAdmin(page, baseUrl);
				await page.goto(`${baseUrl}/administrator/index.php?option=com_sameviewcomparisons`);
				const bodyText = await page.locator("body").innerText();
				assert.match(bodyText, /Phase 19 Automated Test Row/);
				assert.match(bodyText, new RegExp(`phase19-test-${versionLabel}`));

				// docs/JOOMLA_INTEGRATION.md "Permissions and Security": the
				// permission must be assignable through Joomla's native
				// permissions interface.
				await page.goto(
					`${baseUrl}/administrator/index.php?option=com_config&view=component&component=com_sameviewcomparisons`,
				);
				const permissionsText = await page.locator("body").innerText();
				assert.match(permissionsText, /Access Administration Interface/);
			} finally {
				await browser.close();
			}
		});

		await t.test("full removal deletes all SameView-owned data, with no orphaned data", () => {
			const id = extensionId(composeFile);
			assert.ok(id, "extension must be installed before it can be removed");

			const output = joomlaCli(composeFile, `extension:remove ${id} -n -v`);
			assert.match(output, /Extension removed/);

			const remainingRow = extensionId(composeFile);
			assert.equal(remainingRow, "");

			const tables = dbQuery(composeFile, "SHOW TABLES LIKE '%sameview%';");
			assert.equal(tables, "");

			const assetRow = dbQuery(
				composeFile,
				"SELECT name FROM joom_assets WHERE name='com_sameviewcomparisons';",
			);
			assert.equal(assetRow, "");

			assert.throws(() =>
				joomlaExec(composeFile, "test -e /var/www/html/administrator/components/com_sameviewcomparisons"),
			);
			assert.throws(() =>
				joomlaExec(composeFile, "test -e /var/www/html/media/com_sameviewcomparisons"),
			);
		});
	});
}
