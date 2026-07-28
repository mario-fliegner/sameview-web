// Real-application coverage for the No Workspace -> Workspace Active
// transition, and for atomically replacing an already-active workspace
// (docs/IMPLEMENTATION_PLAN_V1.md Iteration 7; docs/FEATURE_SPECIFICATION.md
// F-001 step 2).
//
// Runs against the actual Astro app (see the "app" project in
// playwright.config.ts), not the isolated harness — this is the first
// iteration with real, user-facing DOM to drive. The native OS file picker
// is never invoked in the replacement-behavior tests either; the shared
// hidden file input (`#import-zip-input`, now owned by src/components/App.tsx
// for both the first import and any later replacement) is driven directly via
// setInputFiles, exactly as for the first import below.
//
// This file is purely functional coverage and deliberately never locates
// anything by visible copy or translated text — only by the stable
// `data-testid` attributes defined in src/components/ImportSection.tsx. This
// screen's wording has changed in nearly every iteration; a functional test
// that happened to use copy as a selector broke every time, even though the
// underlying behavior it covered never changed. Copy/translation itself is
// covered separately in test/e2e/app-shell.spec.ts, in tests whose explicit
// purpose is verifying wording rather than behavior.

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
	await expect(page.getByTestId("import-stage")).toBeVisible();

	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));

	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);
});

// Also proves a workspace is created only after complete acceptance: the
// workspace-active state must never appear for a rejected import.
test("an invalid ZIP leaves no workspace and shows a clear failure message", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "missing-required-file.zip"));

	await expect(page.getByTestId("import-stage")).toBeVisible();
	await expect(page.getByTestId("workspace-active")).toHaveCount(0);
	await expect(page.getByTestId("import-error")).toBeVisible();
});

test("no file selected leaves the workspace state unchanged", async ({
	page,
}) => {
	await expect(page.getByTestId("import-stage")).toBeVisible();
	await expect(page.getByTestId("import-error")).toHaveCount(0);
});

// Import Succeeded (docs/APPLICATION_LAYOUT.md): the transient green
// confirmation appears before the workspace is committed, and no further
// user action is required to reach it.
test("a successful initial import shows a transient green success state before the workspace appears", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));

	await expect(page.getByTestId("import-stage")).toHaveClass(
		/import-stage--succeeded/,
	);

	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("import-stage")).toHaveCount(0);
});

// The page must actually scroll to bring the newly active workspace into
// view, not merely render it somewhere the user has to find on their own.
test("the page scrolls to the beginning of the workspace after a successful initial import", async ({
	page,
}) => {
	await page.setViewportSize({ width: 800, height: 400 });
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));

	const workspace = page.getByTestId("workspace-active");
	await expect(workspace).toBeVisible();
	await expect(workspace).toBeInViewport();
});

test("creates a workspace from the real minimal Android export fixture", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);

	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2026-07-27_16-13-22",
	);
});

// Replacement (docs/APPLICATION_LAYOUT.md "Replace Export"): the header
// action only ever appears once a workspace exists, and clicking it opens
// the same native file picker as the first import — verified here without
// touching the OS dialog, exactly like the existing keyboard tests in
// test/e2e/app-shell.spec.ts.
test("the Replace Export action appears only once a workspace is active and opens the native file picker", async ({
	page,
}) => {
	await expect(page.getByTestId("replace-export-button")).toHaveCount(0);

	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-active")).toBeVisible();

	const replaceButton = page.getByTestId("replace-export-button");
	await expect(replaceButton).toBeVisible();

	const chooserPromise = page.waitForEvent("filechooser");
	await replaceButton.click();
	await chooserPromise;
});

test("selecting a valid replacement shows a confirmation identifying both sessions before replacing, and confirming atomically replaces the workspace and moves focus to the workspace heading", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);

	// Not replaced yet: the original workspace remains visible until the
	// user explicitly confirms (docs/FEATURE_SPECIFICATION.md F-001 step 2).
	// The longer timeout accommodates real image-decode validation of the
	// ~7 MB Android export fixture under parallel test-worker load.
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);

	// The confirmation must identify both the current and the candidate
	// session, not just state that "something" will be replaced.
	await expect(
		page.getByTestId("replacement-mode-current-session"),
	).toContainText("2024-01-15_10-30-00");
	await expect(page.getByTestId("replacement-mode-new-session")).toContainText(
		"2026-07-27_16-13-22",
	);

	// The initial-import green success transition (docs/APPLICATION_LAYOUT.md
	// "Import Succeeded") never applies to Replace Export: the stage isn't
	// even rendered while a workspace is active, so its "succeeded" class
	// can't appear here either.
	await expect(page.getByTestId("import-stage")).toHaveCount(0);

	await page.getByTestId("replace-confirm-button").click();

	await expect(page.getByTestId("replace-confirm-dialog")).toHaveCount(0);
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2026-07-27_16-13-22",
	);
	// Focus moves to the (now-replaced) active workspace's heading, since the
	// overlay that held focus has just closed.
	await expect(page.locator("#workspace-active-title")).toBeFocused();
});

test("cancelling a replacement leaves the existing workspace completely unchanged and restores focus to Replace Export", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);
	// See the timeout note in the "confirming atomically replaces" test above.
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});

	await page.getByTestId("replace-cancel-button").click();

	await expect(page.getByTestId("replace-confirm-dialog")).toHaveCount(0);
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);
	await expect(page.getByTestId("replace-export-button")).toBeFocused();
});

test("pressing Escape while a replacement is pending behaves like Cancel", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});

	await page.keyboard.press("Escape");

	await expect(page.getByTestId("replace-confirm-dialog")).toHaveCount(0);
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);
	await expect(page.getByTestId("replace-export-button")).toBeFocused();
});

test("Tab and Shift+Tab stay trapped between Cancel and Replace while the confirmation is open", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});

	const cancelButton = page.getByTestId("replace-cancel-button");
	const confirmButton = page.getByTestId("replace-confirm-button");

	await cancelButton.focus();
	await expect(cancelButton).toBeFocused();

	await page.keyboard.press("Tab");
	await expect(confirmButton).toBeFocused();

	// Forward from the last control wraps back to the first.
	await page.keyboard.press("Tab");
	await expect(cancelButton).toBeFocused();

	// Backward from the first control wraps to the last.
	await page.keyboard.press("Shift+Tab");
	await expect(confirmButton).toBeFocused();
});

test("the background is non-interactive while a replacement is pending", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});

	// The existing workspace stays visible behind the overlay
	// (docs/APPLICATION_LAYOUT.md "Loading Philosophy")...
	await expect(page.getByTestId("workspace-active")).toBeVisible();
	// ...but its container (and the header/footer alongside it) is inert, so
	// it cannot be interacted with or reached by keyboard underneath the
	// modal (docs/AI_ENGINEERING_GUIDE.md Accessibility).
	await expect(page.locator(".app-shell-content")).toHaveJSProperty(
		"inert",
		true,
	);

	await page.getByTestId("replace-cancel-button").click();
	await expect(page.locator(".app-shell-content")).toHaveJSProperty(
		"inert",
		false,
	);
});

test("a failed replacement validation keeps the existing workspace unchanged and shows the error locally", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);

	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "missing-required-file.zip"));

	// Validation fails before any confirmation step is ever reached.
	await expect(page.getByTestId("replace-confirm-dialog")).toHaveCount(0);
	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);
	await expect(page.getByTestId("import-error")).toBeVisible();
});

test("Replacement Mode shows a validating state while the candidate is still being checked", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);

	// The overlay opens in a validating state before the candidate is known
	// to be valid — there is nothing to confirm or cancel yet.
	await expect(page.getByTestId("replacement-mode-validating")).toBeVisible();
	await expect(page.getByTestId("replace-confirm-button")).toHaveCount(0);

	// It then hands off to the confirmation once validation succeeds. See
	// the timeout note on the "confirming atomically replaces" test above.
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});
});

test("Replace and Cancel show visibly distinct hover, focus-visible and pressed states", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});

	const confirmButton = page.getByTestId("replace-confirm-button");
	// Reads the background color well after the 0.15s transition
	// (.replacement-mode__button) has settled, rather than racing it: reading
	// immediately after triggering a state change can still observe the
	// pre-transition value.
	const TRANSITION_SETTLE_MS = 250;
	async function settledBackground() {
		await page.waitForTimeout(TRANSITION_SETTLE_MS);
		return confirmButton.evaluate((el) => getComputedStyle(el).backgroundColor);
	}

	const idle = await settledBackground();

	// Checked before any mouse interaction, and via a real keyboard Tab
	// (not a scripted .focus() call): Chromium's :focus-visible heuristic
	// tracks the page's most recent input modality, and once a mouse
	// interaction has happened anywhere, neither a scripted .focus() nor
	// even a later synthetic Tab reliably re-shows it in this environment —
	// confirmed empirically while writing this test. Real keyboard-first
	// navigation (as a user tabbing to this dialog would do) is what
	// actually exercises :focus-visible reliably here.
	await page.keyboard.press("Tab"); // heading is tabIndex=-1, skipped -> Cancel
	await page.keyboard.press("Tab"); // Cancel -> Confirm
	const focused = await settledBackground();
	expect(focused).not.toBe(idle);

	// Only now does the mouse touch the page, for hover/pressed.
	// Locator.hover() waits for actionability and positions the cursor
	// reliably, unlike computing coordinates from a boundingBox() snapshot
	// that may race a still-settling layout.
	await confirmButton.hover();
	const hovered = await settledBackground();
	expect(hovered).not.toBe(idle);

	// The cursor is already over the button after hover(); pressing down
	// without moving triggers :active in place. Releasing away from the
	// button (rather than on it) means this never completes as a real click,
	// so Confirm never actually commits and the dialog stays open.
	await page.mouse.down();
	const pressed = await settledBackground();
	await page.mouse.move(0, 0);
	await page.mouse.up();
	expect(pressed).not.toBe(idle);
	expect(pressed).not.toBe(hovered);
});
