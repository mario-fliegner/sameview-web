// Playwright configuration for the import pipeline's browser tests.
// Introduced at Phase 2 (import file resolution) because image-decode
// validation genuinely requires real browser APIs (createImageBitmap has no
// Node equivalent) — see docs/AI_ENGINEERING_GUIDE.md "Testing" and
// docs/IMPLEMENTATION_PLAN_V1.md Section 6.
//
// Chromium-only, per the approved testing strategy's proportionality
// principle: no evidence yet of cross-engine behavior differences for this
// pipeline.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./test/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: "list",
	use: {
		baseURL: "http://localhost:4173",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "vite dev --config test/e2e/harness/vite.config.ts",
		url: "http://localhost:4173",
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
