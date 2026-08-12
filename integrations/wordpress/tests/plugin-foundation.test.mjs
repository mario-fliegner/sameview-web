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

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const integrationRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_SLUG = "sameview-comparisons";
const POST_TYPE = "sameview_comparison";
const CAPABILITY = "manage_sameview_comparisons";
const SESSION_ID_META = "_sameview_session_id";
const OUTCOME_FINGERPRINT_META = "_sameview_outcome_fingerprint";

const TEST_SESSION_ID = "phase14-test-session-abc";
const TEST_OUTCOME_FINGERPRINT = "phase14-test-fingerprint-123";

const PHP_ISSUE_PATTERN =
	/PHP (Warning|Notice|Deprecated|Fatal error|Parse error)/i;

// Windows-specific, both confirmed empirically: `npx` is a `.cmd` shim, so
// plain `execFileSync("npx", ...)` cannot resolve it without a shell
// (`spawnSync npx ENOENT`); but invoking the shim's real `.cmd` extension
// directly, without a shell, is itself rejected by `spawnSync`
// (`EINVAL` — Windows requires `.cmd`/`.bat` files to run through a
// shell). `shell: true` is therefore required either way — which in turn
// does not reliably keep a multi-word argument (e.g.
// `--post_title=Phase 14 Test Comparison`) as one token unless quoted
// explicitly, so every argument containing whitespace is quoted here
// before being handed to the shell.
function quoteArgForShell(arg) {
	return /\s/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

function runWpEnv(args, options = {}) {
	return execFileSync("npx", ["wp-env", ...args].map(quoteArgForShell), {
		cwd: integrationRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		shell: true,
		...options,
	});
}

// Every WP-CLI invocation goes through `wp-env run cli wp ...` — the real
// WordPress instance's own command-line interface, never a mock. Combines
// stdout+stderr into one string so `assertNoPhpIssues` below can inspect
// everything the command actually printed.
function wpCli(args) {
	try {
		return execFileSync(
			"npx",
			["wp-env", "run", "cli", "wp", ...args].map(quoteArgForShell),
			{
				cwd: integrationRoot,
				encoding: "utf8",
				shell: true,
			},
		);
	} catch (error) {
		// `execFileSync` throws on non-zero exit; surface the real combined
		// output either way so a genuine WP-CLI failure is diagnosable, not
		// swallowed into a bare "Command failed" message.
		const stdout = error.stdout ?? "";
		const stderr = error.stderr ?? "";
		throw new Error(
			`wp ${args.join(" ")} failed:\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
		);
	}
}

function assertNoPhpIssues(output, context) {
	assert.doesNotMatch(
		output,
		PHP_ISSUE_PATTERN,
		`unexpected PHP warning/notice/error during ${context}:\n${output}`,
	);
}

// `wp-env run` itself may print an informational banner line before the
// real WP-CLI output; this locates the actual JSON payload rather than
// assuming the command's stdout is nothing else.
function extractJson(output) {
	const match = output.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
	if (!match) {
		throw new Error(`no JSON found in WP-CLI output:\n${output}`);
	}
	return JSON.parse(match[0]);
}

// The porcelain post ID is the only thing `wp post create --porcelain`
// prints on its own successful line; take the last non-empty line to stay
// robust against any banner line `wp-env run` itself may add before it.
function extractLastLine(output) {
	const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
	const last = lines.at(-1);
	if (!last) {
		throw new Error(`no output line found:\n${output}`);
	}
	return last;
}

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
