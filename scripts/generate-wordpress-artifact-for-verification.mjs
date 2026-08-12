// One-off, on-demand script (docs/IMPLEMENTATION_PLAN_V1.md Phase 15 final
// verification) — NOT part of the routine test suite. Drives the REAL
// running SameView Web application via Playwright, the exact same
// production code path test/e2e/output-generation.spec.ts's own
// "generating for WordPress" test exercises, to produce a genuine
// "Generate for WordPress" ZIP artifact and save it to a given path — for
// integrations/wordpress/tests/fresh-install/verify-fresh-install.mjs (a
// separate, isolated WordPress-side script) to install and verify against a
// clean disposable WordPress instance that never had SameView pre-mounted.
//
// Spawns its own `pnpm dev` (mirroring test/build-presentation-runtime.test.mjs's
// own already-proven spawn/wait/kill pattern) rather than relying on
// Playwright's own webServer config, since this script is invoked standalone,
// outside `playwright test`.
//
// Usage: node scripts/generate-wordpress-artifact-for-verification.mjs <output-path>

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const APP_URL = "http://localhost:4321";
const FIXTURE_PATH = `${repoRoot}test/fixtures/android-export/sample-v6-session_full.zip`;

const outputPath = process.argv[2];
if (!outputPath) {
	console.error(
		"Usage: node scripts/generate-wordpress-artifact-for-verification.mjs <output-path>",
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

// Mirrors test/build-presentation-runtime.test.mjs's own `killProcessTree` —
// see that file's header comment for why the whole process tree (not just
// the immediate shell wrapper) must be signaled.
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
	// Astro 7 auto-detects an AI coding agent and runs as a background
	// daemon in that case (playwright.config.ts's own webServer entry
	// documents this identical workaround) — cleared here for the same
	// reason, so this spawned process runs in plain foreground mode.
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
