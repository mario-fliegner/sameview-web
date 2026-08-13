// Shared real-`wp-env` test helpers (docs/AI_ENGINEERING_GUIDE.md "Testing":
// a platform integration is never considered verified by mocks alone).
// Extracted from the original Phase 14 test (docs/IMPLEMENTATION_PLAN_V1.md)
// once a second test file (Phase 15) needed the exact same, empirically
// hard-won Windows process-spawning behavior — see `quoteArgForShell` below
// for why neither the naive nor the "obvious" fix actually works on Windows.
//
// Every file importing this module targets the *same* shared wp-env
// instance and must never run concurrently with another such file: Node's
// test runner otherwise runs separate test files in parallel by default,
// and two concurrent `wp-env start` calls race on the same Docker
// containers (confirmed empirically: "Conflict. The container name ... is
// already in use"). package.json's own `test` script passes
// `--test-concurrency=1` for exactly this reason — do not remove it while
// more than one test file here still calls `wp-env start`.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

export const integrationRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
);

export const PHP_ISSUE_PATTERN =
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
export function quoteArgForShell(arg) {
	return /\s/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

// docs/IMPLEMENTATION_PLAN_V1.md Phase 18 "Supported WordPress Versions":
// the routine suite always targets this directory's own default
// .wp-env.json (unpinned, tracks whatever `wp-env` treats as latest) unless
// SAMEVIEW_WP_ENV_CONFIG names a specific pinned config file — set by the
// Phase 18 version-matrix runner, never by everyday `npm test`. Purely
// additive: every existing call site below is unaffected when the variable
// is unset.
const WP_ENV_CONFIG = process.env.SAMEVIEW_WP_ENV_CONFIG
	? join(integrationRoot, process.env.SAMEVIEW_WP_ENV_CONFIG)
	: undefined;

function withConfigArgs(args) {
	return WP_ENV_CONFIG ? ["wp-env", "--config", WP_ENV_CONFIG, ...args] : ["wp-env", ...args];
}

export function runWpEnv(args, options = {}) {
	return execFileSync("npx", withConfigArgs(args).map(quoteArgForShell), {
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
export function wpCli(args) {
	try {
		return execFileSync(
			"npx",
			withConfigArgs(["run", "cli", "wp", ...args]).map(quoteArgForShell),
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

export function assertNoPhpIssues(output, context) {
	assert.doesNotMatch(
		output,
		PHP_ISSUE_PATTERN,
		`unexpected PHP warning/notice/error during ${context}:\n${output}`,
	);
}

// docs/IMPLEMENTATION_PLAN_V1.md Phase 18: "prove which WordPress version is
// actually running after startup, rather than merely trusting the config" —
// `core` pins a download source, not a guarantee; this asks the live
// instance itself via `wp core version` (docs/WORDPRESS_INTEGRATION.md
// "Supported WordPress Versions") before any further verification proceeds.
export function assertRunningWordPressMajor(expectedMajorPrefix) {
	const version = wpCli(["core", "version"]).trim();
	assert.ok(
		version.startsWith(expectedMajorPrefix),
		`expected a running WordPress ${expectedMajorPrefix}.x instance, but "wp core version" reported: ${version}`,
	);
	return version;
}

// `wp-env run` itself may print an informational banner line before the
// real WP-CLI output; this locates the actual JSON payload rather than
// assuming the command's stdout is nothing else.
export function extractJson(output) {
	const match = output.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
	if (!match) {
		throw new Error(`no JSON found in WP-CLI output:\n${output}`);
	}
	return JSON.parse(match[0]);
}

// The porcelain post ID is the only thing `wp post create --porcelain`
// prints on its own successful line; take the last non-empty line to stay
// robust against any banner line `wp-env run` itself may add before it.
export function extractLastLine(output) {
	const lines = output
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const last = lines.at(-1);
	if (!last) {
		throw new Error(`no output line found:\n${output}`);
	}
	return last;
}
