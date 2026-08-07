// Playwright configuration for the import pipeline's browser tests.
// Introduced at Phase 2 (import file resolution) because image-decode
// validation genuinely requires real browser APIs (createImageBitmap has no
// Node equivalent) — see docs/AI_ENGINEERING_GUIDE.md "Testing" and
// docs/IMPLEMENTATION_PLAN_V1.md Section 6.
//
// Two projects, each scoped to its own spec file and its own server:
// - "harness": the isolated, test-only page (test/e2e/harness/) for
//   library-level capability checks that don't need the real app.
// - "app": the real Astro application (via `astro dev` — no database
//   dependency exists on this path, so a dev server is sufficient; Passenger
//   -specific serving is already covered separately by
//   test/passenger-boot.test.mjs), for real user-facing workflow behavior
//   (docs/IMPLEMENTATION_PLAN_V1.md Phase 3).
//
// Chromium-only, per the approved testing strategy's proportionality
// principle: no evidence yet of cross-engine behavior differences for this
// pipeline.

import { defineConfig, devices } from "@playwright/test";

const HARNESS_URL = "http://localhost:4173";
const APP_URL = "http://localhost:4321";

export default defineConfig({
	testDir: "./test/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: "list",
	projects: [
		{
			name: "harness",
			testMatch:
				/(import-pipeline|xmp-location-removal|jpeg-location-metadata)\.spec\.ts/,
			use: { ...devices["Desktop Chrome"], baseURL: HARNESS_URL },
		},
		{
			name: "app",
			testMatch:
				/(workspace-creation|app-shell|comparison-viewer|comparison-editing|comparison-slider-handle-geometry|branding-normalization)\.spec\.ts/,
			use: { ...devices["Desktop Chrome"], baseURL: APP_URL },
		},
	],
	webServer: [
		{
			command: "vite dev --config test/e2e/harness/vite.config.ts",
			url: HARNESS_URL,
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
		},
		{
			command: "astro dev",
			url: APP_URL,
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
			// Astro 7 auto-detects an AI coding agent (via the CLAUDECODE env var,
			// see am-i-vibing) and silently runs `astro dev` as a background
			// daemon in that case — the launching process then exits immediately,
			// which Playwright reports as "exited early" even though the server
			// is actually still running in the background. Clearing the var for
			// this one spawned process makes Astro run in the plain foreground
			// mode Playwright's webServer expects; it does not affect this agent
			// session or any other process.
			env: { CLAUDECODE: "" },
		},
	],
});
