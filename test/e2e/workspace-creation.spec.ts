// Real-application coverage for the No Workspace -> Workspace Active
// transition (docs/IMPLEMENTATION_PLAN_V1.md Phase 3, first iteration:
// creation only — replacing an already-active workspace is a separate,
// later iteration and is not covered here since it isn't implemented yet).
//
// Runs against the actual Astro app (see the "app" project in
// playwright.config.ts), not the isolated harness — this is the first
// iteration with real, user-facing DOM to drive. The native OS file picker
// is never invoked; the file input is driven directly via setInputFiles.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
);

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	// The import UI is a client:load React island (see Workspace.astro).
	// Waiting for `load` alone can resolve just before Astro's hydration
	// script attaches React's event listeners, so an immediate
	// setInputFiles() risks firing the native change event into a still-
	// unhydrated input, silently losing it. Waiting for the astro-island's
	// own hydration-complete marker avoids that race.
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
});

// Uses valid-with-real-images.zip, not valid-small.zip: valid-small.zip's
// reference/capture entries are placeholder text (sufficient for the
// archive-structure-only tests in test/integration/), which real browser
// image decoding correctly rejects. This is the first test that exercises
// the full real pipeline, including real decode, so it needs genuinely
// decodable image content.
test("selecting a valid ZIP creates a workspace", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: "Import Comparison" }),
	).toBeVisible();

	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));

	await expect(
		page.getByRole("heading", { name: "Comparison imported" }),
	).toBeVisible();
	await expect(page.getByText("Session 2024-01-15_10-30-00")).toBeVisible();
});

// Also proves a workspace is created only after complete acceptance: the
// "Comparison imported" heading must never appear for a rejected import.
test("an invalid ZIP leaves no workspace and shows a clear failure message", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "missing-required-file.zip"));

	await expect(
		page.getByRole("heading", { name: "Import Comparison" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Comparison imported" }),
	).toHaveCount(0);
	await expect(page.getByText(/could not be imported/i)).toBeVisible();
});

test("no file selected leaves the workspace state unchanged", async ({
	page,
}) => {
	await expect(
		page.getByRole("heading", { name: "Import Comparison" }),
	).toBeVisible();
	await expect(page.getByText(/could not be imported/i)).toHaveCount(0);
});

test("creates a workspace from the real minimal Android export fixture", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);

	await expect(
		page.getByRole("heading", { name: "Comparison imported" }),
	).toBeVisible();
	await expect(page.getByText("Session 2026-07-27_16-13-22")).toBeVisible();
});
