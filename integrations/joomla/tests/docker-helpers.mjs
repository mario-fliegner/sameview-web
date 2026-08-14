// Shared helpers for driving a real Dockerized Joomla instance from Node
// test/verification scripts (docs/JOOMLA_INTEGRATION.md "Testing":
// Docker + Playwright is the primary and default verification mechanism;
// no dedicated PHP-level test harness without a demonstrated need).

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const JOOMLA_DIR = join(HERE, "..");

export const INSTANCES = {
	"current-major": {
		composeFile: "docker-compose.current-major.yml",
		baseUrl: "http://localhost:8892",
	},
	"previous-major": {
		composeFile: "docker-compose.previous-major.yml",
		baseUrl: "http://localhost:8893",
	},
};

export const ADMIN_USER = "admin";
export const ADMIN_PASSWORD = "sameview-test-1234";

function compose(composeFile, args) {
	return execFileSync(
		"docker",
		["compose", "-f", composeFile, ...args],
		{ cwd: JOOMLA_DIR, encoding: "utf8" },
	);
}

export function dbQuery(composeFile, sql) {
	return execFileSync(
		"docker",
		[
			"compose",
			"-f",
			composeFile,
			"exec",
			"-T",
			"db",
			"mysql",
			"-ujoomla",
			"-pjoomla",
			"joomla",
			"-N",
			"-e",
			sql,
		],
		{ cwd: JOOMLA_DIR, encoding: "utf8" },
	).trim();
}

export function joomlaExec(composeFile, command) {
	return execFileSync(
		"docker",
		["compose", "-f", composeFile, "exec", "-T", "joomla", "bash", "-c", command],
		{ cwd: JOOMLA_DIR, encoding: "utf8" },
	);
}

export function joomlaCli(composeFile, args) {
	return joomlaExec(
		composeFile,
		`cd /var/www/html && php cli/joomla.php ${args}`,
	);
}

export function copyIntoContainer(composeFile, hostPath, containerPath) {
	compose(composeFile, ["cp", hostPath, `joomla:${containerPath}`]);
}

// Confirmed against a real Joomla 6.1.2 and Joomla 5.4.7 instance: any
// leftover directory under administrator/components, components, api/
// components or media for this element blocks a genuinely fresh install
// (route gets forced to "update", or install is rejected outright,
// depending on which paths still exist) — see
// docs/JOOMLA_INTEGRATION.md-adjacent findings recorded in
// sameviewcomparisons.xml's own comments. A full reset must remove all of
// them, not only the administrator-side one.
export function resetExtensionState(composeFile) {
	joomlaExec(
		composeFile,
		"find /var/www/html -maxdepth 4 -iname '*sameviewcomparisons*' -exec rm -rf {} + 2>/dev/null; true",
	);
	try {
		dbQuery(
			composeFile,
			"DELETE FROM joom_extensions WHERE element='com_sameviewcomparisons'; " +
				"DELETE FROM joom_assets WHERE name='com_sameviewcomparisons'; " +
				"DROP TABLE IF EXISTS joom_sameview_comparisons;",
		);
	} catch {
		// A completely clean instance has nothing to delete; DELETE/DROP are
		// no-ops either way, this just tolerates a transient connection hiccup.
	}
}

// Confirmed against both real instances: a freshly booted Joomla core has
// plg_system_guidedtours enabled, which redirects every admin view except
// the dashboard back to the dashboard until dismissed — a genuine
// onboarding feature of Joomla itself, not a defect. Disabling it is a
// test-harness accommodation only, never part of the shipped extension.
export function disableGuidedTours(composeFile) {
	dbQuery(
		composeFile,
		"UPDATE joom_extensions SET enabled=0 WHERE element='guidedtours' AND folder='system';",
	);
}

export function extensionId(composeFile) {
	return dbQuery(
		composeFile,
		"SELECT extension_id FROM joom_extensions WHERE element='com_sameviewcomparisons';",
	);
}

export async function loginAsAdmin(page, baseUrl) {
	await page.goto(`${baseUrl}/administrator/`);
	await page.fill("#mod-login-username", ADMIN_USER);
	await page.fill("#mod-login-password", ADMIN_PASSWORD);
	await Promise.all([
		page.waitForNavigation(),
		page.click("#form-login button[type=submit]"),
	]);
}
