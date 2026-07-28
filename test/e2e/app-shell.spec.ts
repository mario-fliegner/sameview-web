// Coverage for the application shell introduced by docs/APPLICATION_LAYOUT.md:
// header identity, the DE/EN language selector, footer legal navigation, and
// the "No Workspace" stage's accessibility/interaction states. Runs against
// the real app (see the "app" project in playwright.config.ts).
//
// Functional/interaction tests below locate elements by stable `data-testid`
// attributes (see src/components/ImportSection.tsx), never by visible copy
// or translated text — this screen's wording has changed in nearly every
// iteration, and a functional test coupled to it broke every time even
// though the behavior it covered never changed. Copy and translation are
// still covered, but only in tests explicitly about wording (marked below);
// accessibility tests may use roles/accessible names where the test is
// specifically about accessibility, per the same reasoning.
//
// The language-switch persistence test is the most important functional case
// here: it exists specifically to prove the approved architecture decision
// actually holds — switching language must not reload the page and must not
// lose an already active workspace, since V1 has no workspace persistence
// (see src/i18n/LocaleContext.tsx and src/i18n/translations.ts for why a
// route-based locale switch was deliberately rejected). It is kept separate
// from the dedicated translation-content test below so that a future wording
// change can never accidentally mask a regression in that architectural
// guarantee, or vice versa.

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

// Functional: proves the architectural guarantee. Deliberately locates
// everything via stable testids/attributes, never via translated copy — see
// "switching language translates the visible UI text" below for the
// (separate) claim that the wording actually changes.
test("switching language updates the UI immediately, without navigating or losing the active workspace", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-active")).toBeVisible();

	const urlBeforeSwitch = page.url();

	// Force: the language selector now renders in the footer while a
	// workspace is active, which the Astro dev server's own dev-only
	// toolbar (astro-dev-toolbar, fixed to the bottom of the viewport, never
	// present in a production build) visually overlaps and intercepts
	// pointer events for — confirmed via the actionability-retry log, not
	// assumed. This is a test-environment artifact of where the button now
	// sits, not a real product interaction problem.
	await page
		.getByRole("button", { name: "DE", exact: true })
		.click({ force: true });

	// Proves both requirements at once: if the switch had reloaded the page,
	// the in-memory workspace would be gone and this testid would disappear.
	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);
	expect(page.url()).toBe(urlBeforeSwitch);

	await expect(
		page.getByRole("button", { name: "DE", exact: true }),
	).toHaveAttribute("aria-current", "true");
});

// Copy/localization: the one place that deliberately asserts translated
// wording landed, kept separate from the functional persistence test above.
test("switching language translates the visible UI text", async ({ page }) => {
	await page.getByRole("button", { name: "DE", exact: true }).click();

	await expect(
		page.getByRole("heading", {
			name: "Starte einen Arbeitsbereich mit einem SameView-Export",
		}),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Datenschutz", exact: true }),
	).toBeVisible();
});

test("the stage is keyboard operable and opens the native file picker on Enter", async ({
	page,
}) => {
	const stage = page.getByTestId("import-stage");
	await stage.focus();
	const chooserPromise = page.waitForEvent("filechooser");
	await page.keyboard.press("Enter");
	await chooserPromise;
});

test("the stage is keyboard operable and opens the native file picker on Space", async ({
	page,
}) => {
	const stage = page.getByTestId("import-stage");
	await stage.focus();
	const chooserPromise = page.waitForEvent("filechooser");
	await page.keyboard.press(" ");
	await chooserPromise;
});

test("dragging a file over the stage shows the drag-active state", async ({
	page,
}) => {
	const stage = page.getByTestId("import-stage");
	await expect(stage).not.toHaveClass(/import-stage--drag-active/);

	await stage.dispatchEvent("dragenter", {
		dataTransfer: await page.evaluateHandle(() => new DataTransfer()),
	});
	await expect(stage).toHaveClass(/import-stage--drag-active/);

	await stage.dispatchEvent("dragleave", {
		dataTransfer: await page.evaluateHandle(() => new DataTransfer()),
	});
	await expect(stage).not.toHaveClass(/import-stage--drag-active/);
});

// Accessibility: specifically verifies the failure is exposed as a
// semantic alert, so it intentionally uses role/accessible-name queries
// rather than a testid. It does not assert on the message's wording — see
// "the import failure message uses the expected product wording" below.
test("a failed import shows an accessible alert above the stage", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "missing-required-file.zip"));

	await expect(page.getByRole("alert")).toBeVisible();
});

// Copy/localization: the dedicated place that asserts the failure message's
// actual wording, decoupled from the accessibility test above and from the
// functional failure-path coverage in test/e2e/workspace-creation.spec.ts.
test("the import failure message uses the expected product wording", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "missing-required-file.zip"));

	await expect(page.getByTestId("import-error")).toContainText(
		/doesn't look like a SameView Export/i,
	);
});

// Header/footer language-selector placement (docs/APPLICATION_LAYOUT.md
// Header Actions, Language Selector): once a workspace is active, the
// language selector is no longer part of the header at all — it moves to
// the footer instead — so `Replace Export` becomes the header's only
// right-aligned control. "DE"/"EN" are locale codes, not translated
// wording, so using them to locate the language buttons is a stable
// functional selector here.
test("the language selector is not part of the Workspace Active header; Replace Export is its only right-aligned control", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-active")).toBeVisible();

	const header = page.locator("header.app-header");
	await expect(page.getByTestId("replace-export-button")).toBeVisible();
	await expect(
		header.getByRole("button", { name: "DE", exact: true }),
	).toHaveCount(0);
	await expect(
		header.getByRole("button", { name: "EN", exact: true }),
	).toHaveCount(0);
});

test("the language selector appears in the footer once a workspace is active", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-active")).toBeVisible();

	const footer = page.locator("footer.app-footer");
	await expect(
		footer.getByRole("button", { name: "DE", exact: true }),
	).toBeVisible();
	await expect(
		footer.getByRole("button", { name: "EN", exact: true }),
	).toBeVisible();
});

test("the Workspace Active header stays a compact single row at mobile width", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 780 });
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-active")).toBeVisible();

	const header = page.locator("header.app-header");
	const headerBox = await header.boundingBox();
	expect(headerBox).not.toBeNull();
	// A single row stays near the header's own minimum height; a second,
	// wrapped row (as previously happened when the language selector shared
	// this header with Replace Export) would roughly double it.
	expect(headerBox?.height ?? 0).toBeLessThan(80);

	await expect(page.getByTestId("replace-export-button")).toBeVisible();
	await expect(
		header.getByRole("button", { name: "DE", exact: true }),
	).toHaveCount(0);
});
