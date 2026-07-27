// Coverage for the application shell introduced by docs/APPLICATION_LAYOUT.md:
// header identity, the DE/EN language selector, footer legal navigation, and
// the polished import dropzone's accessibility/interaction states. Runs
// against the real app (see the "app" project in playwright.config.ts).
//
// The language-switch test is the most important case here: it exists
// specifically to prove the approved architecture decision actually holds —
// switching language must not reload the page and must not lose an already
// active workspace, since V1 has no workspace persistence (see
// src/i18n/LocaleContext.tsx and src/i18n/translations.ts for why a
// route-based locale switch was deliberately rejected).

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
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
});

test("header shows the SameView logo, brand name and a DE/EN language selector", async ({
	page,
}) => {
	await expect(page.getByRole("img", { name: "SameView" })).toBeVisible();
	await expect(page.getByText("SameView Web").first()).toBeVisible();

	const englishButton = page.getByRole("button", { name: "EN", exact: true });
	const germanButton = page.getByRole("button", { name: "DE", exact: true });
	await expect(englishButton).toBeVisible();
	await expect(germanButton).toBeVisible();
	// English is the default locale.
	await expect(englishButton).toHaveAttribute("aria-current", "true");
});

test("footer links to the existing sameview.app legal pages", async ({
	page,
}) => {
	await expect(
		page.getByRole("link", { name: "Privacy", exact: true }),
	).toHaveAttribute("href", "https://sameview.app/en/privacy");
	await expect(
		page.getByRole("link", { name: "Terms", exact: true }),
	).toHaveAttribute("href", "https://sameview.app/en/terms");
	await expect(
		page.getByRole("link", { name: "Imprint", exact: true }),
	).toHaveAttribute("href", "https://sameview.app/en/imprint");
});

test("switching language updates the UI immediately, without navigating or losing the active workspace", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(
		page.getByRole("heading", { name: "Comparison imported" }),
	).toBeVisible();

	const urlBeforeSwitch = page.url();

	await page.getByRole("button", { name: "DE", exact: true }).click();

	// Proves both requirements at once: if the switch had reloaded the page,
	// the in-memory workspace would be gone and this German heading (only
	// shown once a workspace is active) would not appear.
	await expect(
		page.getByRole("heading", { name: "Vergleich importiert" }),
	).toBeVisible();
	await expect(page.getByText(/2024-01-15_10-30-00/)).toBeVisible();
	expect(page.url()).toBe(urlBeforeSwitch);

	// Footer and header text updated too ("complete application UI").
	await expect(
		page.getByRole("link", { name: "Datenschutz", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "DE", exact: true }),
	).toHaveAttribute("aria-current", "true");
});

test("the dropzone is keyboard operable and opens the native file picker on Enter", async ({
	page,
}) => {
	const dropzone = page.locator(".dropzone");
	await dropzone.focus();
	const chooserPromise = page.waitForEvent("filechooser");
	await page.keyboard.press("Enter");
	await chooserPromise;
});

test("the dropzone is keyboard operable and opens the native file picker on Space", async ({
	page,
}) => {
	const dropzone = page.locator(".dropzone");
	await dropzone.focus();
	const chooserPromise = page.waitForEvent("filechooser");
	await page.keyboard.press(" ");
	await chooserPromise;
});

test("dragging a file over the dropzone shows the drag-active state", async ({
	page,
}) => {
	const dropzone = page.locator(".dropzone");
	await expect(dropzone).not.toHaveClass(/dropzone--drag-active/);

	await dropzone.dispatchEvent("dragenter", {
		dataTransfer: await page.evaluateHandle(() => new DataTransfer()),
	});
	await expect(dropzone).toHaveClass(/dropzone--drag-active/);

	await dropzone.dispatchEvent("dragleave", {
		dataTransfer: await page.evaluateHandle(() => new DataTransfer()),
	});
	await expect(dropzone).not.toHaveClass(/dropzone--drag-active/);
});

test("a failed import shows an accessible alert above the dropzone", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "missing-required-file.zip"));

	const alert = page.getByRole("alert");
	await expect(alert).toBeVisible();
	await expect(alert).toContainText(/could not be imported/i);
});
