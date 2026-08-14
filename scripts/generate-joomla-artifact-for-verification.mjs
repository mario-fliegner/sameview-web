// One-off, on-demand script (docs/IMPLEMENTATION_PLAN_V1.md Phase 21 real-
// instance verification) — NOT part of the routine test suite. Drives the
// REAL running SameView Web application via Playwright, the exact same
// production code path test/e2e/output-generation.spec.ts's own "generating
// for Joomla" test exercises, to produce a genuine "Generate for Joomla" ZIP
// artifact and save it to a given path — for
// integrations/joomla/tests/add-comparison-lifecycle.test.mjs to install and
// verify against a real Joomla instance. Mirrors
// scripts/generate-wordpress-artifact-for-verification.mjs; see that file's
// own header comment for the spawn/wait/kill pattern this reuses unchanged.
//
// Usage: node scripts/generate-joomla-artifact-for-verification.mjs <output-path> [fixture-name]
//
// `fixture-name` defaults to `sample-v6-session_full.zip` and is resolved
// under test/fixtures/android-export/ — any other fixture in that directory
// produces a package for a different session.id/title (needed to exercise
// "adding a second, different Comparison").

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const APP_URL = "http://localhost:4321";
const FIXTURE_NAME = process.argv[3] ?? "sample-v6-session_full.zip";
const FIXTURE_PATH = `${repoRoot}test/fixtures/android-export/${FIXTURE_NAME}`;

const outputPath = process.argv[2];
if (!outputPath) {
	console.error(
		"Usage: node scripts/generate-joomla-artifact-for-verification.mjs <output-path> [fixture-name]",
	);
	process.exit(1);
}
if (!existsSync(FIXTURE_PATH)) {
	console.error(`Fixture not found: ${FIXTURE_PATH}`);
	process.exit(1);
}

async function waitForServer(url, { timeoutMs = 90_000, intervalMs = 500 } = {}) {
	const deadline = Date.now() + timeoutMs;
	let lastError;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
			lastError = new Error(`unexpected status ${response.status}`);
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	throw new Error(
		`dev server never became available at ${url} within ${timeoutMs}ms: ${lastError}`,
	);
}

function killProcessTree(child) {
	if (!child.pid) return;
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
			stdio: "ignore",
		});
		return;
	}
	try {
		process.kill(-child.pid, "SIGTERM");
	} catch {
		// Already exited.
	}
}

const devServer = spawn("pnpm dev", {
	cwd: repoRoot,
	shell: true,
	env: { ...process.env, CLAUDECODE: "" },
	detached: process.platform !== "win32",
});
devServer.stdout?.on("data", () => {});
devServer.stderr?.on("data", () => {});

let browser;
try {
	await waitForServer(APP_URL);

	browser = await chromium.launch();
	const context = await browser.newContext({ acceptDownloads: true });
	const page = await context.newPage();

	await page.goto(APP_URL);
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);

	await page.locator("#import-zip-input").setInputFiles(FIXTURE_PATH);
	await page.waitForSelector('[data-testid="workspace-active"]');
	await page.waitForSelector('[data-testid="comparison-loading"]', {
		state: "detached",
		timeout: 20_000,
	});

	await page.getByTestId("create-output-button").click();
	await page.waitForSelector('[data-testid="output-inspector"]');
	await page.getByTestId("output-card-embed-in-website").click();
	await page.getByTestId("output-platform-joomla").click();

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);

	mkdirSync(dirname(outputPath), { recursive: true });
	await download.saveAs(outputPath);

	console.log(`suggestedFilename: ${download.suggestedFilename()}`);
	console.log(`savedTo: ${outputPath}`);

	await context.close();
} finally {
	if (browser) await browser.close();
	killProcessTree(devServer);
}
