// Phase 15 verification (docs/IMPLEMENTATION_PLAN_V1.md "WordPress First
// Installation and Comparison Lifecycle") — runs against the same real,
// disposable `wp-env` WordPress instance as test/plugin-foundation.test.mjs
// (docs/AI_ENGINEERING_GUIDE.md "Testing": never mocked).
//
// Two things this file deliberately does NOT do, and why:
//
// - It never runs a real `wp plugin install <zip> --force` against the
//   already-mounted `sameview-comparisons` slug: `wp-env` bind-mounts this
//   plugin directly from the host repository, so a real WordPress-native
//   plugin-install/overwrite of the *same* slug would write the ZIP's own
//   `seed/` folder (and potentially overwrite the PHP files) directly onto
//   this repository's own source tree. Whether the generated ZIP would be
//   *recognized* as an installable WordPress plugin is instead verified
//   structurally, in test/e2e/output-generation.spec.ts (SameView Web
//   side): a real WordPress Plugin Header ("Plugin Name:") is present in
//   the packaged `sameview-comparisons.php`, which is the exact criterion
//   WordPress core itself uses to detect an installable plugin.
// - It never simulates an actual HTTP file upload through
//   `admin-post.php`/`$_FILES`: that handler
//   (includes/admin-add-comparison.php) is a thin, mostly-WordPress-core
//   wrapper (nonce check, capability check, `ZipArchive`, temp-file
//   handling) around the one function that contains all of Phase 15's own
//   actual logic — includes/import.php `sameview_import_seed()` — which
//   this file calls directly via `wp eval`, exactly mirroring
//   test/plugin-foundation.test.mjs's own established pattern for
//   exercising real PHP logic without a browser. A literal browser-driven
//   upload-form test remains a manual/Phase-18-style real-platform check,
//   not automated here (see this repository's own Phase 15 report).
//
// Every seed directory this test creates lives inside the plugin's own
// mounted directory (the one guaranteed-shared path between the host and
// the `cli` container) and is deleted again in a `finally` block, so this
// repository's own tracked files are never left modified by a test run.

import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	assertNoPhpIssues,
	extractJson,
	integrationRoot,
	runWpEnv,
	wpCli,
} from "./wp-env-helpers.mjs";

const PLUGIN_SLUG = "sameview-comparisons";
const PLUGIN_DIR = join(integrationRoot, "sameview-comparisons");
const POST_TYPE = "sameview_comparison";

// A well-known, minimal valid 1x1 PNG. PHP's `getimagesize()` (this
// plugin's own asset sanity check, includes/import.php
// `sameview_validate_seed()`) inspects actual file content, not the file
// extension, so this is valid content for files literally named
// `reference.jpg`/`capture.jpg` too — real SameView Web output is always a
// genuine JPEG (docs/IMPLEMENTATION_PLAN_V1.md Phase 8); this is only a
// deterministic, always-valid stand-in for this PHP-side test.
const MINIMAL_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const MINIMAL_PNG_BYTES = Buffer.from(MINIMAL_PNG_BASE64, "base64");

function writeSeed(dirPath, manifest) {
	rmSync(dirPath, { recursive: true, force: true });
	mkdirSync(dirPath, { recursive: true });
	writeFileSync(join(dirPath, "comparison.json"), JSON.stringify(manifest));
	writeFileSync(join(dirPath, "reference.jpg"), MINIMAL_PNG_BYTES);
	writeFileSync(join(dirPath, "capture.jpg"), MINIMAL_PNG_BYTES);
}

function postsForSession(sessionId) {
	const output = wpCli([
		"post",
		"list",
		`--post_type=${POST_TYPE}`,
		"--post_status=any",
		"--meta_key=_sameview_session_id",
		`--meta_value=${sessionId}`,
		"--format=json",
	]);
	assertNoPhpIssues(output, `post list for session ${sessionId}`);
	return extractJson(output);
}

test(
	"WordPress Add/Update/no-op Comparison lifecycle: first-install bootstrap, add, no-op, atomic update, asset cleanup, rejection",
	{ timeout: 10 * 60 * 1000 },
	() => {
		runWpEnv(["start"]);
		// Defensive: test/plugin-foundation.test.mjs's own final step runs the
		// real uninstall logic, which revokes the capability and removes all
		// posts — reactivating here is always a safe, idempotent no-op
		// (includes/lifecycle.php) regardless of which order `node --test`
		// happens to run the two files in.
		assertNoPhpIssues(
			wpCli(["plugin", "activate", PLUGIN_SLUG]),
			"defensive reactivation before Phase 15 tests",
		);

		// Every plugin PHP file's content, hashed before any of this test's
		// own operations run — compared again at the very end to prove
		// "Importing a Comparison never replaces or updates installed plugin
		// code" (docs/WORDPRESS_INTEGRATION.md "Persistent Integration
		// Versioning").
		const pluginFileHashes = wpCli([
			"eval",
			"foreach (glob(WP_PLUGIN_DIR . '/sameview-comparisons/*.php') as $f) { echo basename($f) . ':' . md5_file($f) . \"\\n\"; } foreach (glob(WP_PLUGIN_DIR . '/sameview-comparisons/includes/*.php') as $f) { echo basename($f) . ':' . md5_file($f) . \"\\n\"; }",
		]);
		assertNoPhpIssues(pluginFileHashes, "plugin file hashing (before)");

		const bootstrapSeedDir = join(PLUGIN_DIR, "seed");
		const addSeedDir = join(PLUGIN_DIR, ".tmp-add-comparison-seed");
		const invalidSeedDir = join(PLUGIN_DIR, ".tmp-invalid-seed");

		// The path exactly as the `cli` container itself sees this same
		// bind-mounted directory — queried, never assumed, so this test does
		// not depend on `@wordpress/env`'s own internal mount-path convention.
		const containerPluginDir = wpCli([
			"eval",
			"echo WP_PLUGIN_DIR . '/sameview-comparisons';",
		]).trim();

		function importSeedViaPhp(hostSeedDir) {
			const containerSeedDir =
				containerPluginDir + "/" + hostSeedDir.slice(PLUGIN_DIR.length + 1);
			const output = wpCli([
				"eval",
				`echo json_encode( sameview_import_seed('${containerSeedDir}') );`,
			]);
			assertNoPhpIssues(output, `sameview_import_seed(${containerSeedDir})`);
			return extractJson(output);
		}

		try {
			// --- First installation: activation imports a bundled seed
			// (docs/WORDPRESS_INTEGRATION.md "First Installation"). ---
			const firstSessionId = `phase15-first-install-${Date.now()}`;
			writeSeed(bootstrapSeedDir, {
				formatVersion: 1,
				sessionId: firstSessionId,
				outcomeFingerprint: "fp-first-install",
				presentation: { title: "First Install Comparison" },
				visibility: {},
				configuration: {},
				initialSliderPosition: 0.5,
				branding: { kind: "none" },
			});
			assertNoPhpIssues(
				wpCli(["plugin", "deactivate", PLUGIN_SLUG]),
				"deactivate before first-install bootstrap",
			);
			assertNoPhpIssues(
				wpCli(["plugin", "activate", PLUGIN_SLUG]),
				"reactivation (first-install bootstrap)",
			);

			const firstPosts = postsForSession(firstSessionId);
			assert.equal(
				firstPosts.length,
				1,
				"activation must import exactly one Comparison for the bundled seed",
			);
			assert.equal(firstPosts[0].post_title, "First Install Comparison");

			// Reactivating again (no seed change) must not create a duplicate —
			// the same Add/Update/no-op decision applies uniformly to the
			// bootstrap path (docs/WORDPRESS_INTEGRATION.md: "SameView Web never
			// asks or infers whether this is the first Comparison").
			assertNoPhpIssues(
				wpCli(["plugin", "deactivate", PLUGIN_SLUG]),
				"deactivate before repeat bootstrap",
			);
			assertNoPhpIssues(
				wpCli(["plugin", "activate", PLUGIN_SLUG]),
				"repeat reactivation (bootstrap no-op)",
			);
			assert.equal(
				postsForSession(firstSessionId).length,
				1,
				"a repeated activation with the same bundled seed must not create a duplicate Comparison",
			);

			// --- A second, different Comparison via the same shared import
			// function `SameView → Add comparison` itself calls
			// (docs/EMBED_IN_WEBSITE.md "Comparison Lifecycle"). ---
			const secondSessionId = `phase15-second-${Date.now()}`;
			writeSeed(addSeedDir, {
				formatVersion: 1,
				sessionId: secondSessionId,
				outcomeFingerprint: "fp-v1",
				presentation: { title: "Second Comparison" },
				visibility: {},
				configuration: {},
				initialSliderPosition: 0.5,
				branding: { kind: "none" },
			});
			const addResult = importSeedViaPhp(addSeedDir);
			assert.equal(addResult.status, "added");
			const secondPostId = addResult.post_id;

			// --- Re-adding the exact same package is a true no-op. ---
			const noOpResult = importSeedViaPhp(addSeedDir);
			assert.equal(noOpResult.status, "no-op");
			assert.equal(noOpResult.post_id, secondPostId);
			assert.equal(
				postsForSession(secondSessionId).length,
				1,
				"a no-op re-add must never create a second post",
			);

			// --- Re-adding the same session.id with a changed fingerprint
			// performs an atomic update, preserving the post ID. ---
			writeSeed(addSeedDir, {
				formatVersion: 1,
				sessionId: secondSessionId,
				outcomeFingerprint: "fp-v2-changed",
				presentation: { title: "Second Comparison (updated)" },
				visibility: {},
				configuration: {},
				initialSliderPosition: 0.75,
				branding: { kind: "none" },
			});
			const updateResult = importSeedViaPhp(addSeedDir);
			assert.equal(updateResult.status, "updated");
			assert.equal(updateResult.post_id, secondPostId);
			assert.equal(
				postsForSession(secondSessionId).length,
				1,
				"an update must never create a second post for the same session.id",
			);

			const fingerprintAfterUpdate = wpCli([
				"post",
				"meta",
				"get",
				String(secondPostId),
				"_sameview_outcome_fingerprint",
			]);
			assertNoPhpIssues(fingerprintAfterUpdate, "meta get after update");
			assert.equal(fingerprintAfterUpdate.trim(), "fp-v2-changed");

			// --- Successful update removes superseded assets: exactly one
			// asset directory for this session.id, no leftover `.old-`/`.new-`
			// swap directories (docs/EMBED_IN_WEBSITE.md "Asset Replacement").
			const assetDirCheck = wpCli([
				"eval",
				`$dir = sameview_uploads_dir(); $hash = md5('${secondSessionId}'); $entries = array_filter(scandir($dir), function($e) use ($hash) { return 0 === strpos($e, $hash); }); echo json_encode(array_values($entries));`,
			]);
			assertNoPhpIssues(assetDirCheck, "asset directory listing after update");
			const assetEntries = extractJson(assetDirCheck);
			assert.equal(
				assetEntries.length,
				1,
				`expected exactly one asset directory for this session.id after update, found: ${JSON.stringify(assetEntries)}`,
			);
			assert.ok(
				!assetEntries[0].includes(".old-") && !assetEntries[0].includes(".new-"),
				`expected the final directory name, not a leftover swap directory: ${assetEntries[0]}`,
			);

			// --- privacy-processed image bytes are the bytes packaged/imported:
			// the stored reference.jpg's own content hash matches exactly what
			// this test wrote into the seed, byte for byte. ---
			const storedImageHashOutput = wpCli([
				"eval",
				`echo md5_file( sameview_comparison_assets_dir('${secondSessionId}') . '/reference.jpg' );`,
			]);
			assertNoPhpIssues(storedImageHashOutput, "stored image hash check");
			const expectedImageMd5 = createHash("md5")
				.update(MINIMAL_PNG_BYTES)
				.digest("hex");
			assert.equal(storedImageHashOutput.trim(), expectedImageMd5);

			// --- Invalid/corrupt/malformed package is rejected with zero
			// persistent side effects (docs/EMBED_IN_WEBSITE.md "Import
			// Validation"). ---
			const invalidSessionId = `phase15-invalid-${Date.now()}`;
			mkdirSync(invalidSeedDir, { recursive: true });
			writeFileSync(
				join(invalidSeedDir, "comparison.json"),
				JSON.stringify({
					formatVersion: 1,
					sessionId: invalidSessionId,
					// outcomeFingerprint deliberately missing — a malformed manifest.
				}),
			);
			// No reference.jpg/capture.jpg at all — also invalid on its own.
			const rejectResult = importSeedViaPhp(invalidSeedDir);
			assert.equal(rejectResult.status, "rejected");
			assert.equal(
				postsForSession(invalidSessionId).length,
				0,
				"a rejected import must never create a post",
			);

			// --- Plugin code itself is never touched by any of the above. ---
			const pluginFileHashesAfter = wpCli([
				"eval",
				"foreach (glob(WP_PLUGIN_DIR . '/sameview-comparisons/*.php') as $f) { echo basename($f) . ':' . md5_file($f) . \"\\n\"; } foreach (glob(WP_PLUGIN_DIR . '/sameview-comparisons/includes/*.php') as $f) { echo basename($f) . ':' . md5_file($f) . \"\\n\"; }",
			]);
			assertNoPhpIssues(pluginFileHashesAfter, "plugin file hashing (after)");
			assert.equal(pluginFileHashesAfter, pluginFileHashes);
		} finally {
			// This repository's own tracked plugin directory must never be left
			// modified by a test run.
			for (const dir of [bootstrapSeedDir, addSeedDir, invalidSeedDir]) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	},
);
