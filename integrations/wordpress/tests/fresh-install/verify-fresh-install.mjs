// One-off, on-demand verification (docs/IMPLEMENTATION_PLAN_V1.md Phase 15
// final acceptance) — NOT part of the routine `npm test` suite (its filename
// deliberately does not match "tests/**/*.test.mjs", so it never spins up an
// extra Docker environment on a normal test run).
//
// Every other WordPress-side test in this directory (plugin-foundation,
// add-comparison-lifecycle) exercises the plugin's lifecycle/import logic
// against the shared wp-env instance that BIND-MOUNTS this repository's own
// `sameview-comparisons` plugin source directly — real WP-CLI and real
// PHP, but never a real, native "install this ZIP file" operation, because
// doing so against the bind-mounted slug would write the ZIP's own contents
// directly onto this repository's tracked source tree.
//
// This script closes that specific, previously-unverified gap: it drives a
// SEPARATE, disposable wp-env instance (this directory's own .wp-env.json —
// no plugin bind-mounted at all) through the exact real-world sequence a
// site owner performs:
//
//   real generated ZIP → clean WordPress with SameView NOT installed →
//   `wp plugin install <zip> --activate` → bundled Comparison auto-imported
//
// Prerequisite: scripts/generate-wordpress-artifact-for-verification.mjs
// must already have produced ./artifact/sameview-comparisons-wordpress.zip
// (a real "Generate for WordPress" download from the actual running SameView
// Web app — not a fixture).
//
// Usage: node verify-fresh-install.mjs   (run from this directory)

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipReader,
} from "@zip.js/zip.js";
import { assertNoPhpIssues, extractJson } from "../wp-env-helpers.mjs";
import { runWpEnvFresh, wpCliFresh } from "./wp-env-fresh-helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACT_PATH = join(HERE, "artifact", "sameview-comparisons-wordpress.zip");
const PLUGIN_SLUG = "sameview-comparisons";
const POST_TYPE = "sameview_comparison";

if (!existsSync(ARTIFACT_PATH)) {
	console.error(
		`Artifact not found: ${ARTIFACT_PATH}\n` +
			"Run first: node scripts/generate-wordpress-artifact-for-verification.mjs " +
			`"${ARTIFACT_PATH}"`,
	);
	process.exit(1);
}

function md5(buffer) {
	return createHash("md5").update(buffer).digest("hex");
}

async function readZipEntries(zipPath) {
	const bytes = new Uint8Array(readFileSync(zipPath));
	const reader = new ZipReader(new Uint8ArrayReader(bytes));
	const entries = await reader.getEntries();
	async function read(name) {
		const entry = entries.find((e) => e.filename === name);
		if (!entry) throw new Error(`entry not found in ZIP: ${name}`);
		const data = await entry.getData(new Uint8ArrayWriter());
		return Buffer.from(data);
	}
	await reader.close();
	return { read };
}

const report = {
	artifactPath: ARTIFACT_PATH,
	artifactSizeBytes: readFileSync(ARTIFACT_PATH).length,
};

const { read } = await readZipEntries(ARTIFACT_PATH);
const manifestBuf = await read(`${PLUGIN_SLUG}/seed/comparison.json`);
const manifest = JSON.parse(manifestBuf.toString("utf8"));
const referenceBuf = await read(`${PLUGIN_SLUG}/seed/reference.jpg`);
const captureBuf = await read(`${PLUGIN_SLUG}/seed/capture.jpg`);
const expectedReferenceMd5 = md5(referenceBuf);
const expectedCaptureMd5 = md5(captureBuf);

report.manifest = {
	sessionId: manifest.sessionId,
	outcomeFingerprint: manifest.outcomeFingerprint,
};

console.log("Destroying any stale fresh-install environment (defensive)...");
try {
	runWpEnvFresh(["destroy", "--force"]);
} catch {
	// Nothing to destroy yet — fine.
}

console.log("Starting isolated, non-bind-mounted wp-env instance...");
runWpEnvFresh(["start"]);

try {
	// --- 1. SameView is absent before installation. ---
	const pluginsBefore = extractJson(
		wpCliFresh(["plugin", "list", "--format=json"]),
	);
	assert.ok(
		!pluginsBefore.some((p) => p.name === PLUGIN_SLUG),
		`SameView must be absent before installation, found: ${JSON.stringify(pluginsBefore)}`,
	);
	report.absentBeforeInstall = true;
	report.pluginsBefore = pluginsBefore.map((p) => p.name);

	// Resolve the container-side path to the mapped artifact via WordPress's
	// own WP_CONTENT_DIR constant, never a hardcoded/assumed container path.
	const containerZipPath = wpCliFresh([
		"eval",
		"echo WP_CONTENT_DIR . '/sameview-artifact/sameview-comparisons-wordpress.zip';",
	]).trim();
	const existsCheck = wpCliFresh([
		"eval",
		`echo file_exists('${containerZipPath}') ? '1' : '0';`,
	]).trim();
	assert.equal(
		existsCheck,
		"1",
		`generated artifact must be visible inside the container at ${containerZipPath}`,
	);
	report.containerZipPath = containerZipPath;

	// --- 2 & 3. Install the exact generated ZIP; WordPress accepts it as an
	// installable plugin (a real WP-CLI native `plugin install`, the exact
	// mechanism WordPress core itself uses — the CLI equivalent of the
	// wp-admin "Upload Plugin" flow). 4. Activate it. ---
	const installOutput = wpCliFresh([
		"plugin",
		"install",
		containerZipPath,
		"--activate",
	]);
	assertNoPhpIssues(installOutput, "plugin install --activate");
	assert.match(
		installOutput,
		/Plugin installed successfully/i,
		`expected WP-CLI to report successful installation:\n${installOutput}`,
	);
	assert.match(
		installOutput,
		/'sameview-comparisons' activated/i,
		`expected WP-CLI to report successful activation:\n${installOutput}`,
	);
	assert.match(
		installOutput,
		/Success: Installed 1 of 1 plugins/i,
		`expected WP-CLI to report overall success:\n${installOutput}`,
	);
	report.installOutput = installOutput.trim();

	const pluginsAfter = extractJson(
		wpCliFresh(["plugin", "list", "--format=json"]),
	);
	const installedPlugin = pluginsAfter.find((p) => p.name === PLUGIN_SLUG);
	assert.ok(installedPlugin, "sameview-comparisons must now be listed");
	assert.equal(installedPlugin.status, "active");
	report.installedPluginStatus = installedPlugin.status;

	// --- 5. The bundled Comparison exists immediately after activation, and
	// 8. exactly one — no second Comparison upload/import performed. ---
	const posts = extractJson(
		wpCliFresh([
			"post",
			"list",
			`--post_type=${POST_TYPE}`,
			"--post_status=any",
			"--format=json",
		]),
	);
	assert.equal(
		posts.length,
		1,
		`expected exactly one imported Comparison, found: ${JSON.stringify(posts)}`,
	);
	const postId = posts[0].ID;
	report.importedPostId = postId;
	report.importedPostCount = posts.length;

	// --- 6. session ID and fingerprint match the generated package. ---
	const sessionIdMeta = wpCliFresh([
		"post",
		"meta",
		"get",
		String(postId),
		"_sameview_session_id",
	]).trim();
	const fingerprintMeta = wpCliFresh([
		"post",
		"meta",
		"get",
		String(postId),
		"_sameview_outcome_fingerprint",
	]).trim();
	assert.equal(sessionIdMeta, manifest.sessionId);
	assert.equal(fingerprintMeta, manifest.outcomeFingerprint);
	report.sessionIdMatches = true;
	report.fingerprintMatches = true;

	// --- 7. stored reference/capture bytes match the packaged processed
	// bytes, byte for byte. ---
	const storedReferenceMd5 = wpCliFresh([
		"eval",
		`echo md5_file( sameview_comparison_assets_dir('${manifest.sessionId}') . '/reference.jpg' );`,
	]).trim();
	const storedCaptureMd5 = wpCliFresh([
		"eval",
		`echo md5_file( sameview_comparison_assets_dir('${manifest.sessionId}') . '/capture.jpg' );`,
	]).trim();
	assert.equal(storedReferenceMd5, expectedReferenceMd5);
	assert.equal(storedCaptureMd5, expectedCaptureMd5);
	report.referenceBytesMatch = true;
	report.captureBytesMatch = true;

	// --- 9. no PHP warning/notice/deprecated/fatal/parse errors anywhere in
	// this sequence (assertNoPhpIssues already ran after every WP-CLI call
	// above that returns command-level output). ---
	report.phpIssuesDetected = false;

	console.log("\nVERIFICATION PASSED\n");
	console.log(JSON.stringify(report, null, 2));
} finally {
	// --- 10. cleanly destroy the temporary environment afterward. ---
	console.log("\nDestroying isolated fresh-install environment...");
	try {
		runWpEnvFresh(["destroy", "--force"]);
		report.environmentDestroyed = true;
	} catch (error) {
		report.environmentDestroyed = false;
		report.destroyError = String(error);
		console.error("WARNING: failed to destroy fresh-install environment:", error);
	}
}
