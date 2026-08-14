// Shared helpers for driving a real Dockerized Joomla instance from Node
// test/verification scripts (docs/JOOMLA_INTEGRATION.md "Testing":
// Docker + Playwright is the primary and default verification mechanism;
// a dedicated PHP-level test harness is introduced only where a concrete,
// demonstrated need cannot be met that way — see `invokePostflightRoute()`
// below and tests/verify-postflight-route.php's own header comment for the
// one such case in this integration).

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

// Confirmed against a real Joomla 6.1.2 instance (docs/IMPLEMENTATION_PLAN_V1.md
// Phase 21): `docker compose exec` runs as root by default, so a CLI-driven
// `extension:install` (joomlaCli above) creates media/com_sameviewcomparisons/
// as root-owned — while Apache/the real web-driven Add-comparison upload
// runs as www-data, which then cannot create new subdirectories under a
// root-owned parent. A real customer's install and every later upload both
// go through the same web request path (always www-data), so this
// never occurs in production; it is purely an artifact of this test
// harness's own CLI shortcut for fast setup. Called after every CLI-driven
// install so later web-driven steps see the same ownership a real install
// would have produced.
export function normalizeMediaOwnership(composeFile) {
	joomlaExec(
		composeFile,
		"chown -R www-data:www-data /var/www/html/media/com_sameviewcomparisons 2>/dev/null; true",
	);
}

export function copyIntoContainer(composeFile, hostPath, containerPath) {
	compose(composeFile, ["cp", hostPath, `joomla:${containerPath}`]);
}

// docs/IMPLEMENTATION_PLAN_V1.md Phase 22 (UX follow-up): directly invokes
// pkg_sameviewcomparisons's own real, already-installed postflight() with a
// given $route — a fast, isolated way to exercise both route branches
// without a full package reinstall. Every bundled manifest now carries
// method="upgrade" (Phase 22 update-lifecycle fix), so a real end-to-end
// reinstall-while-installed path does exist and does reach
// `$route === 'update'` — see package-update-lifecycle.test.mjs, which
// exercises that real path directly through the Extensions Manager. This
// helper remains useful as a targeted, lower-overhead check of the same
// postflight() guard.
export function invokePostflightRoute(composeFile, route) {
	copyIntoContainer(
		composeFile,
		join(JOOMLA_DIR, "tests", "verify-postflight-route.php"),
		"/tmp/verify-postflight-route.php",
	);
	return joomlaExec(composeFile, `php /tmp/verify-postflight-route.php ${route}`);
}

// Confirmed against a real Joomla 6.1.2 and Joomla 5.4.7 instance: any
// leftover directory under administrator/components, components, api/
// components or media for this element blocks a genuinely fresh install
// (route gets forced to "update", or install is rejected outright,
// depending on which paths still exist) — see
// docs/JOOMLA_INTEGRATION.md-adjacent findings recorded in
// sameviewcomparisons.xml's own comments. A full reset must remove all of
// them, not only the administrator-side one.
//
// docs/IMPLEMENTATION_PLAN_V1.md Phase 22: the package now bundles three
// more extensions (plg_content_sameview, plg_editors-xtd_sameview,
// mod_sameview_comparison) alongside the component, each its own row in
// #__extensions — confirmed empirically that leaving any of their rows
// behind (this helper originally only ever deleted the component's own
// row) makes Joomla's own InstallerAdapter::checkExistingExtension() abort
// a later, otherwise-clean install with "JLIB_INSTALLER_ABORT_ALREADY_EXISTS",
// even though the component's own row was correctly removed. `element`
// alone cannot disambiguate the two plugins (both are named `sameview`,
// only `folder` differs between the `content` and `editors-xtd` groups).
export function resetExtensionState(composeFile) {
	joomlaExec(
		composeFile,
		"find /var/www/html -maxdepth 5 \\( " +
			"-iname '*sameviewcomparisons*' " +
			"-o -ipath '*plugins/content/sameview*' " +
			"-o -ipath '*plugins/editors-xtd/sameview*' " +
			"-o -iname '*sameview_comparison*' " +
			"\\) -exec rm -rf {} + 2>/dev/null; true",
	);
	try {
		dbQuery(
			composeFile,
			"DELETE FROM joom_modules WHERE module='mod_sameview_comparison'; " +
				"DELETE FROM joom_extensions WHERE element='com_sameviewcomparisons' " +
				"OR element='pkg_sameviewcomparisons' " +
				// Confirmed empirically that the module's own
				// #__extensions.element is NOT consistently one fixed form
				// across every install path exercised in this repository's own
				// testing (standalone vs. package-bundled installs were each
				// observed leaving a differently-named row: with and without
				// the "mod_" prefix) — matching both keeps this reset reliable
				// regardless of which path most recently ran.
				"OR element='sameview_comparison' " +
				"OR element='mod_sameview_comparison' " +
				"OR (element='sameview' AND folder IN ('content', 'editors-xtd')); " +
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

// Confirmed against a real Joomla 6.1.2 instance (docs/IMPLEMENTATION_PLAN_V1.md
// Phase 22): the official `joomla` Docker image's own default PHP
// `upload_max_filesize` (2M) is smaller than the generated Joomla package
// artifact once it bundles the shared Embed runtime/CSS and every
// Presentation Font (Phase 22) — a real ~2MB comparison package silently
// fails Joomla's own `Add comparison` upload with no server-side error
// logged at all (PHP drops an over-limit upload before `$_FILES` is ever
// populated). This is a test-container default, not a SameView Web or
// Joomla product limit — a real hosting environment's own PHP configuration
// is a hosting-specific concern already covered by
// docs/EMBED_IN_WEBSITE.md "Package and Upload Limits" ("Hosting-specific
// limits SameView Web cannot know in advance are handled clearly by the
// target integration during installation/import"), not something this test
// harness should work around by shrinking fixtures. Raises the limit once
// per container so `Add comparison` upload tests reflect a realistic
// hosting configuration instead of this particular base image's own
// conservative default.
export function raiseUploadLimits(composeFile) {
	joomlaExec(
		composeFile,
		"printf 'upload_max_filesize=32M\\npost_max_size=32M\\n' > /usr/local/etc/php/conf.d/sameview-test-uploads.ini",
	);
	// A new conf.d file is only picked up by Apache/mod_php on (re)start, not
	// per-request — confirmed against the real joomla:6/joomla:5 base images.
	joomlaExec(composeFile, "apache2ctl graceful");
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
