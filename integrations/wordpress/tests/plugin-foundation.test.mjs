// Phase 14 verification (docs/IMPLEMENTATION_PLAN_V1.md "WordPress Plugin
// Foundation") — runs against a real, disposable `wp-env` WordPress
// instance via WP-CLI, never a mock (docs/AI_ENGINEERING_GUIDE.md
// "Testing": "A platform integration ... is not considered verified by
// unit tests, artifact tests or a mocked/approximated host environment
// alone"). Uses the same `node --test` runner already used throughout the
// sameview-web repository, invoked here from this isolated integration
// area's own `pnpm test` — never the repository root's.
//
// Deliberately does not use `wp plugin uninstall`/`wp plugin delete`:
// `wp-env` bind-mounts this plugin directory directly from the host
// repository, and WordPress's own plugin-delete machinery removes the
// plugin's files as part of that flow — which would delete this
// repository's own source files. Uninstall behavior is instead verified
// by directly executing uninstall.php's real logic in the real WordPress
// runtime (`wp eval`, defining `WP_UNINSTALL_PLUGIN` first, exactly the
// condition WordPress core itself sets before including it), which
// exercises the same code without touching the plugin's files.
//
// This test's own final step runs that real uninstall logic, which
// deliberately leaves the instance "logically uninstalled" (capability
// revoked, posts gone) — test/add-comparison-lifecycle.test.mjs
// (Phase 15) reactivates the plugin at its own start specifically to stay
// correct regardless of which order `node --test` happens to run the two
// files in.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	assertNoPhpIssues,
	extractJson,
	extractLastLine,
	runWpEnv,
	wpCli,
} from "./wp-env-helpers.mjs";

const PLUGIN_SLUG = "sameview-comparisons";
const POST_TYPE = "sameview_comparison";
const CAPABILITY = "manage_sameview_comparisons";
const SESSION_ID_META = "_sameview_session_id";
const OUTCOME_FINGERPRINT_META = "_sameview_outcome_fingerprint";

const TEST_SESSION_ID = "phase14-test-session-abc";
const TEST_OUTCOME_FINGERPRINT = "phase14-test-fingerprint-123";

test(
	"WordPress plugin foundation: install, activate, storage round-trip, deactivate/reactivate preserve data, uninstall removes everything",
	{ timeout: 10 * 60 * 1000 },
	() => {
		// --- Environment up (idempotent: a no-op if already running). ---
		runWpEnv(["start"]);

		// --- Plugin recognized by WordPress. ---
		const pluginListOutput = wpCli(["plugin", "list", "--format=json"]);
		assertNoPhpIssues(pluginListOutput, "plugin list");
		const plugins = extractJson(pluginListOutput);
		assert.ok(
			plugins.some((plugin) => plugin.name === PLUGIN_SLUG),
			`expected "${PLUGIN_SLUG}" in plugin list, got: ${JSON.stringify(plugins)}`,
		);

		// --- Activation succeeds. ---
		const activateOutput = wpCli(["plugin", "activate", PLUGIN_SLUG]);
		assertNoPhpIssues(activateOutput, "activation");

		// --- CPT is registered. ---
		const postTypeListOutput = wpCli(["post-type", "list", "--format=json"]);
		assertNoPhpIssues(postTypeListOutput, "post-type list");
		const postTypes = extractJson(postTypeListOutput);
		assert.ok(
			postTypes.some((postType) => postType.name === POST_TYPE),
			`expected "${POST_TYPE}" in post-type list, got: ${JSON.stringify(postTypes)}`,
		);

		// --- Manually inserted Comparison test row + Post Meta round-trip. ---
		const createOutput = wpCli([
			"post",
			"create",
			`--post_type=${POST_TYPE}`,
			"--post_title=Phase 14 Test Comparison",
			"--post_status=publish",
			"--porcelain",
		]);
		assertNoPhpIssues(createOutput, "post create");
		const postId = extractLastLine(createOutput);
		assert.match(postId, /^\d+$/, `expected a numeric post ID, got: ${postId}`);

		assertNoPhpIssues(
			wpCli(["post", "meta", "update", postId, SESSION_ID_META, TEST_SESSION_ID]),
			"meta update (session id)",
		);
		assertNoPhpIssues(
			wpCli([
				"post",
				"meta",
				"update",
				postId,
				OUTCOME_FINGERPRINT_META,
				TEST_OUTCOME_FINGERPRINT,
			]),
			"meta update (outcome fingerprint)",
		);

		const readSessionId = wpCli([
			"post",
			"meta",
			"get",
			postId,
			SESSION_ID_META,
		]);
		assertNoPhpIssues(readSessionId, "meta get (session id)");
		assert.equal(readSessionId.trim(), TEST_SESSION_ID);

		const readOutcomeFingerprint = wpCli([
			"post",
			"meta",
			"get",
			postId,
			OUTCOME_FINGERPRINT_META,
		]);
		assertNoPhpIssues(readOutcomeFingerprint, "meta get (outcome fingerprint)");
		assert.equal(readOutcomeFingerprint.trim(), TEST_OUTCOME_FINGERPRINT);

		// --- SameView uploads directory exists. ---
		function uploadsDirExists() {
			const output = wpCli([
				"eval",
				"echo is_dir( wp_upload_dir()['basedir'] . '/sameview-comparisons' ) ? 'yes' : 'no';",
			]);
			assertNoPhpIssues(output, "uploads dir check");
			return output.trim().endsWith("yes");
		}
		assert.equal(uploadsDirExists(), true, "uploads directory must exist after activation");

		// --- Deactivation preserves Comparison data and uploads directory. ---
		assertNoPhpIssues(wpCli(["plugin", "deactivate", PLUGIN_SLUG]), "deactivation");

		const postAfterDeactivate = wpCli(["post", "get", postId, "--field=post_title"]);
		assertNoPhpIssues(postAfterDeactivate, "post get after deactivation");
		assert.equal(postAfterDeactivate.trim(), "Phase 14 Test Comparison");
		assert.equal(
			uploadsDirExists(),
			true,
			"uploads directory must survive deactivation",
		);

		// --- Reactivation succeeds and preserves data. ---
		assertNoPhpIssues(wpCli(["plugin", "activate", PLUGIN_SLUG]), "reactivation");

		const postAfterReactivate = wpCli(["post", "get", postId, "--field=post_title"]);
		assertNoPhpIssues(postAfterReactivate, "post get after reactivation");
		assert.equal(postAfterReactivate.trim(), "Phase 14 Test Comparison");

		const sessionIdAfterReactivate = wpCli([
			"post",
			"meta",
			"get",
			postId,
			SESSION_ID_META,
		]);
		assertNoPhpIssues(sessionIdAfterReactivate, "meta get after reactivation");
		assert.equal(sessionIdAfterReactivate.trim(), TEST_SESSION_ID);
		assert.equal(
			uploadsDirExists(),
			true,
			"uploads directory must survive reactivation",
		);

		// --- Uninstall removes SameView posts/meta, the uploads directory and
		// the capability — by directly executing uninstall.php's real logic
		// against the real instance (see this file's own header comment for
		// why `wp plugin uninstall`/`delete` is not used here). ---
		const uninstallOutput = wpCli([
			"eval",
			"define('WP_UNINSTALL_PLUGIN', true); include WP_PLUGIN_DIR . '/sameview-comparisons/uninstall.php'; echo 'uninstall-script-completed';",
		]);
		assertNoPhpIssues(uninstallOutput, "uninstall script execution");
		assert.match(uninstallOutput, /uninstall-script-completed/);

		const postsAfterUninstall = wpCli([
			"post",
			"list",
			`--post_type=${POST_TYPE}`,
			"--post_status=any",
			"--format=json",
		]);
		assertNoPhpIssues(postsAfterUninstall, "post list after uninstall");
		assert.deepEqual(extractJson(postsAfterUninstall), []);

		assert.equal(
			uploadsDirExists(),
			false,
			"uploads directory must be removed by uninstall",
		);

		const capabilityAfterUninstall = wpCli([
			"eval",
			`echo get_role('administrator')->has_cap('${CAPABILITY}') ? 'yes' : 'no';`,
		]);
		assertNoPhpIssues(capabilityAfterUninstall, "capability check after uninstall");
		assert.ok(capabilityAfterUninstall.trim().endsWith("no"));
	},
);
