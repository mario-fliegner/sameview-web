// Real-application coverage for Generate Comparison Output (F-005;
// docs/IMPLEMENTATION_PLAN_V1.md Phase 9) — src/components/OutputInspector.tsx,
// src/lib/generate-comparison-output.ts, generate-standalone-html.ts,
// generate-static-microsite.ts and src/lib/trigger-download.ts.
//
// Uses sample-v6-session_full.zip, the same fixture test/e2e/comparison-editing.spec.ts
// uses, so the generated artifacts always have a real title/description/
// location/date to render and assert against.

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import {
	TextWriter,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipReader,
} from "@zip.js/zip.js";

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
);

// File-scoped, not per-describe: Playwright's `launchOptions` forces a new
// worker/browser and can only be set at the top level of a test file (or in
// the config), never inside a `test.describe` group. Applies to every test
// below, including the pre-existing generation/download ones — harmless for
// those (none of them assert layout), and necessary for the "Presentation
// Preview geometry" describe block further down: Chromium's default
// `--hide-scrollbars` flag makes the document scrollbar take no layout
// space at all, which would make that block's regression tests pass
// regardless of whether the underlying bug is actually fixed (see that
// block's own header comment).
test.use({
	launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] },
});

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await page.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
});

async function importFullFixture(page: import("@playwright/test").Page) {
	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_full.zip"),
		);
	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});
}

async function openOutputInspector(page: import("@playwright/test").Page) {
	await page.getByTestId("create-output-button").click();
	await expect(page.getByTestId("output-inspector")).toBeVisible();
}

// Confirmed regression fix (src/lib/comparison-artifact-markup.ts
// `buildHandleMarkup`): the generated artifact's Handle visual used to carry
// no `width`/`height` at all (neither src/styles/comparison-presentation.css's
// `.comparison-slider__handle-visual` rule nor the markup itself set one —
// only src/components/ComparisonSliderHandle.tsx's own inline style did,
// which the generated markup never reproduced), so the `<svg>` fell back to
// the browser's own default replaced-element size instead of the Live
// Preview's actual, branding-dependent size. `.comparison-slider__handle-visual`
// is both the Live Preview's own class and the generated artifact's `id`
// (`#sameview-handle-visual` also carries this class) — this helper works
// for either page unchanged.
async function measureHandleVisualBox(
	locator: import("@playwright/test").Locator,
) {
	const box = await locator.boundingBox();
	if (!box) throw new Error("handle visual has no bounding box");
	return box;
}

// Comparison Information stays open by default (docs/APPLICATION_LAYOUT.md
// "Structure"); this switches to Branding and selects "None", the one
// scenario `sample-v6-session_full.zip`'s own imported asset branding
// doesn't already exercise (docs/COMPARISON_PRESENTATION.md Part 2 "Handle":
// standard vs. 1.5×-enlarged).
async function switchToNoneBranding(page: import("@playwright/test").Page) {
	await page.getByTestId("edit-inspector-branding-toggle").click();
	await page.getByTestId("edit-branding-option-none").click();
}

// English is the default locale (see test/e2e/app-shell.spec.ts); switching
// to German uses the same role/name locator already established there — "DE"
// is a locale code, not translated content, so this stays independent of
// mutable UI copy (docs/AI_ENGINEERING_GUIDE.md "Testing"). Always called
// after an import here (Workspace Active), where the language selector lives
// in the footer: Astro's dev toolbar (dev-only, never present in a
// production build) overlaps it in the Playwright dev server, exactly like
// test/e2e/app-shell.spec.ts's own identical `.evaluate(...click())`
// workaround — this only bypasses Playwright's pointer-actionability check,
// not the real click handler.
async function switchToGerman(page: import("@playwright/test").Page) {
	const germanButton = page.getByRole("button", { name: "DE", exact: true });
	await germanButton.evaluate((element: HTMLElement) => element.click());
}

// The public SameView source-branding comment
// (src/lib/comparison-artifact-scaffold.ts `SOURCE_BRANDING_COMMENT_BY_LOCALE`)
// in both locales — mirrors the same table in
// test/unit/comparison-artifact-document.test.mjs, kept independently here
// since this file verifies the real, browser-generated artifact bytes, not
// a reconstruction.
const BRANDING_COMMENT_BY_LOCALE = {
	en: {
		openingLine: "Hey there, you found the source!",
		createdWith: "Created with https://web.sameview.app",
		discover:
			"Discover SameView and get the Android app at https://sameview.app",
		closing: "Enjoy!",
	},
	de: {
		openingLine: "Hey, du hast den Quelltext gefunden!",
		createdWith: "Erstellt mit https://web.sameview.app",
		discover:
			"Entdecke SameView und die Android-App unter https://sameview.app",
		closing: "Viel Spaß!",
	},
} as const;

test("Create Output opens the Output Inspector with Standalone HTML selected, Remove Embedded Location Data on, and Embed in website shown as a third, selectable card with a visible-but-disabled WordPress platform selector", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	await expect(page.getByTestId("output-card-standalone-html")).toHaveAttribute(
		"aria-checked",
		"true",
	);
	await expect(
		page.getByTestId("output-card-static-microsite"),
	).toHaveAttribute("aria-checked", "false");
	await expect(
		page.getByTestId("output-remove-location-data-switch"),
	).toHaveAttribute("aria-checked", "true");
	await expect(
		page.getByTestId("output-use-current-slider-position-switch"),
	).toHaveAttribute("aria-checked", "false");
	// Both output-specific switches must have a programmatically determined
	// accessible name (aria-labelledby to their own visible label), not just a
	// visually adjacent, unassociated <span> — checked via the real browser
	// accessibility tree, not by asserting any particular translated text.
	await expect(
		page.getByTestId("output-use-current-slider-position-switch"),
	).toHaveAccessibleName(/\S/);
	await expect(
		page.getByTestId("output-remove-location-data-switch"),
	).toHaveAccessibleName(/\S/);

	// docs/APPLICATION_LAYOUT.md "Output Cards": exactly three output cards.
	await expect(page.getByTestId("output-card-standalone-html")).toBeVisible();
	await expect(page.getByTestId("output-card-static-microsite")).toBeVisible();
	const embedCard = page.getByTestId("output-card-embed-in-website");
	await expect(embedCard).toBeVisible();

	// The historical CMS Package placeholder must be gone from the runtime UI
	// entirely (docs/IMPLEMENTATION_PLAN_V1.md Phase 9 "Not included": "since
	// superseded by the approved Embed in website output").
	await expect(page.getByTestId("output-card-cms-package")).toHaveCount(0);
	await expect(page.getByText("CMS Package")).toHaveCount(0);
	await expect(page.getByText("Coming Soon")).toHaveCount(0);

	// Embed in website is genuinely selectable — a real radio button, not a
	// disabled placeholder (docs/EMBED_IN_WEBSITE.md "Output Inspector
	// Behavior").
	await expect(embedCard).toHaveAttribute("aria-checked", "false");
	await expect(embedCard).not.toHaveAttribute("aria-disabled", "true");
	await expect(embedCard).toBeEnabled();
	expect(await embedCard.evaluate((element) => element.tagName)).toBe("BUTTON");
	await expect(embedCard).toContainText("Embed in website");
	await expect(embedCard).toContainText(
		"Add this comparison to your website through WordPress.",
	);

	// docs/EMBED_IN_WEBSITE.md "Output Inspector Behavior": "shown directly on
	// its Output Inspector card rather than only after the card is selected
	// ... Platform controls may be disabled when Embed in website is not the
	// selected output, but they remain visible."
	const platformSelector = page.getByTestId("output-platform-wordpress");
	await expect(platformSelector).toBeVisible();
	await expect(platformSelector).toBeDisabled();
	await expect(platformSelector).toHaveAttribute("aria-checked", "true");
	await expect(platformSelector).toHaveAccessibleName("WordPress");

	// WordPress is the only platform offered (docs/EMBED_IN_WEBSITE.md
	// "Supported Platforms").
	await expect(page.getByText(/joomla/i)).toHaveCount(0);
	await expect(page.getByText(/webflow/i)).toHaveCount(0);
	await expect(page.getByText(/squarespace/i)).toHaveCount(0);
});

test("selecting Embed in website enables its WordPress platform selector, shows the real Generate-for-WordPress primary action, keeps the shared output settings interactive, and never changes the Workspace Preview", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	const canvasBefore = await page.locator(".presentation-canvas").boundingBox();

	const embedCard = page.getByTestId("output-card-embed-in-website");
	const platformSelector = page.getByTestId("output-platform-wordpress");
	await embedCard.click();

	await expect(embedCard).toHaveAttribute("aria-checked", "true");
	await expect(platformSelector).toBeEnabled();
	await expect(platformSelector).toHaveAttribute("aria-checked", "true");

	// docs/IMPLEMENTATION_PLAN_V1.md Phase 15: Embed in website now has a
	// real Generate action — no disabled button, no "Coming Soon" placeholder,
	// the same primary-action pattern Standalone HTML/Static Microsite use.
	await expect(page.getByTestId("output-primary-action")).toHaveText(
		/generate for wordpress/i,
	);

	// F-005: "available identically for Standalone HTML, Static Microsite and
	// Embed in website once an output type has been selected."
	const sliderPositionSwitch = page.getByTestId(
		"output-use-current-slider-position-switch",
	);
	const locationSwitch = page.getByTestId("output-remove-location-data-switch");
	await expect(sliderPositionSwitch).toBeEnabled();
	await expect(locationSwitch).toBeEnabled();
	await sliderPositionSwitch.click();
	await expect(sliderPositionSwitch).toHaveAttribute("aria-checked", "true");

	// docs/EMBED_IN_WEBSITE.md "Output Inspector Behavior": selecting Embed
	// (and changing its settings) "does not change ... the Workspace Preview."
	const canvasAfter = await page.locator(".presentation-canvas").boundingBox();
	expect(canvasAfter?.width).toBeCloseTo(canvasBefore?.width ?? 0, 0);
	expect(canvasAfter?.height).toBeCloseTo(canvasBefore?.height ?? 0, 0);
});

test("switching from Standalone HTML to Embed in website and back invalidates the previously generated artifact each time and requires a fresh generation for the newly selected type", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	const [htmlDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(htmlDownload.suggestedFilename()).toBe("sameview-comparison.html");
	const primaryAction = page.getByTestId("output-primary-action");
	await expect(primaryAction).toHaveText(/download again/i);

	// docs/APPLICATION_LAYOUT.md "Completion": switching output type
	// invalidates the already-generated artifact for repeat download.
	// docs/IMPLEMENTATION_PLAN_V1.md Phase 15: Embed now has its own real
	// primary action, so it reverts to its own normal generate state rather
	// than disappearing.
	await page.getByTestId("output-card-embed-in-website").click();
	await expect(primaryAction).toHaveText(/generate for wordpress/i);

	const [wordPressDownload] = await Promise.all([
		page.waitForEvent("download"),
		primaryAction.click(),
	]);
	expect(wordPressDownload.suggestedFilename()).toBe(
		"sameview-comparisons-wordpress.zip",
	);
	await expect(primaryAction).toHaveText(/download again/i);

	await page.getByTestId("output-card-standalone-html").click();
	await expect(primaryAction).toHaveText(/download html/i);

	const [freshDownload] = await Promise.all([
		page.waitForEvent("download"),
		primaryAction.click(),
	]);
	expect(freshDownload.suggestedFilename()).toBe("sameview-comparison.html");
});

test("the Embed card's output-type radio and its WordPress platform selector are two separate, non-nested controls", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	const embedCard = page.getByTestId("output-card-embed-in-website");
	const platformSelector = page.getByTestId("output-platform-wordpress");

	await expect(embedCard).toHaveAttribute("role", "radio");
	await expect(platformSelector).toHaveAttribute("role", "radio");
	await expect(platformSelector).toHaveAccessibleName(/\S/);

	// docs/EMBED_IN_WEBSITE.md "Output Inspector Behavior": the platform
	// selector is a separate control, never nested inside the radio that
	// selects the output type itself.
	const isNestedInsideRadio = await embedCard.evaluate(
		(element) =>
			element.querySelector('[data-testid="output-platform-wordpress"]') !==
			null,
	);
	expect(isNestedInsideRadio).toBe(false);
});

test("Embed in website's card name, description and platform selector render in German after switching locale", async ({
	page,
}) => {
	await importFullFixture(page);
	await switchToGerman(page);
	await openOutputInspector(page);

	const embedCard = page.getByTestId("output-card-embed-in-website");
	await expect(embedCard).toContainText("In Website einbetten");
	await expect(embedCard).toContainText(
		"Diese Vergleichsansicht per WordPress in Ihre Website einbinden.",
	);
	// WordPress remains untranslated in both locales.
	await expect(page.getByTestId("output-platform-wordpress")).toHaveText(
		"WordPress",
	);
});

// docs/IMPLEMENTATION_PLAN_V1.md Phase 15: the Embed in website → WordPress
// "Generate" action is now real. Verifies the exact unified package
// structure (docs/WORDPRESS_INTEGRATION.md "First Installation": "the same
// kind of downloadable package ... regardless") and that `comparison.json`
// is a direct mapping of the already-approved Outcome Snapshot content
// (test/unit/generate-wordpress-package.test.mjs covers the mapping itself
// in isolation; this test covers the real, actually-downloaded artifact).
test("generating for WordPress downloads sameview-comparisons-wordpress.zip containing the plugin files and a seed matching the current Comparison, then shows the install guide", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);
	await page.getByTestId("output-card-embed-in-website").click();

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(download.suggestedFilename()).toBe(
		"sameview-comparisons-wordpress.zip",
	);
	const zipPath = await download.path();
	expect(zipPath).not.toBeNull();

	const zipBytes = new Uint8Array(readFileSync(zipPath as string));
	const zipReader = new ZipReader(new Uint8ArrayReader(zipBytes));
	const entries = await zipReader.getEntries();
	const paths = entries.map((entry) => entry.filename).sort();

	// The exact Phase 14 plugin files, copied verbatim, plus the seed
	// (docs/IMPLEMENTATION_PLAN_V1.md Phase 15) — same fixture as the Static
	// Microsite test above, so branding.png is expected here too — plus the
	// Phase 16 Embed runtime/CSS and every Presentation Font's own file(s)
	// and license (never just the one selected font — see
	// scripts/build-presentation-runtime.mjs `buildComparisonEmbedCssCode()`
	// for why all three are always packaged in V1).
	expect(paths).toEqual(
		[
			"sameview-comparisons/sameview-comparisons.php",
			"sameview-comparisons/includes/post-type.php",
			"sameview-comparisons/includes/uploads.php",
			"sameview-comparisons/includes/capabilities.php",
			"sameview-comparisons/includes/import.php",
			"sameview-comparisons/includes/lifecycle.php",
			"sameview-comparisons/includes/admin-add-comparison.php",
			"sameview-comparisons/includes/comparison-lookup.php",
			"sameview-comparisons/includes/render.php",
			"sameview-comparisons/includes/block.php",
			"sameview-comparisons/includes/shortcode.php",
			"sameview-comparisons/includes/placements.php",
			"sameview-comparisons/includes/admin-library.php",
			"sameview-comparisons/uninstall.php",
			"sameview-comparisons/languages/sameview-comparisons-de_DE.mo",
			"sameview-comparisons/languages/sameview-comparisons-de_DE.po",
			"sameview-comparisons/languages/sameview-comparisons-block-editor-de_DE.po",
			"sameview-comparisons/languages/sameview-comparisons-de_DE-sameview-comparisons-block-editor.json",
			"sameview-comparisons/assets/block/block.json",
			"sameview-comparisons/assets/block/index.js",
			"sameview-comparisons/seed/comparison.json",
			"sameview-comparisons/seed/reference.jpg",
			"sameview-comparisons/seed/capture.jpg",
			"sameview-comparisons/seed/branding.png",
			"sameview-comparisons/assets/embed/comparison-embed-runtime.js",
			"sameview-comparisons/assets/embed/comparison-embed.css",
			"sameview-comparisons/assets/fonts/inter/InterVariable.woff2",
			"sameview-comparisons/assets/fonts/inter/LICENSE.txt",
			"sameview-comparisons/assets/fonts/manrope/Manrope-Regular.woff2",
			"sameview-comparisons/assets/fonts/manrope/Manrope-Medium.woff2",
			"sameview-comparisons/assets/fonts/manrope/Manrope-SemiBold.woff2",
			"sameview-comparisons/assets/fonts/manrope/OFL.txt",
			"sameview-comparisons/assets/fonts/spacegrotesk/SpaceGrotesk-Variable.woff2",
			"sameview-comparisons/assets/fonts/spacegrotesk/OFL.txt",
		].sort(),
	);

	// docs/IMPLEMENTATION_PLAN_V1.md Phase 15/18: WordPress's own native
	// plugin-install flow recognizes an installable plugin exclusively by a
	// "Plugin Name:" header inside a top-level PHP file's own doc comment —
	// the same criterion a real `wp plugin install` (verified separately
	// against a real instance in
	// integrations/wordpress/tests/fresh-install/verify-fresh-install.mjs)
	// relies on. Asserted here structurally, on every generated artifact, so
	// a future change to the packaged plugin file can never silently drop it.
	const pluginMainFileEntry = entries.find(
		(entry) =>
			entry.filename === "sameview-comparisons/sameview-comparisons.php" &&
			!entry.directory,
	);
	if (!pluginMainFileEntry || pluginMainFileEntry.directory) {
		throw new Error("sameview-comparisons.php entry missing");
	}
	const pluginMainFileText = await pluginMainFileEntry.getData(
		new TextWriter(),
	);
	expect(pluginMainFileText).toMatch(/^\s*\*\s*Plugin Name:\s*\S/m);

	const manifestEntry = entries.find(
		(entry) =>
			entry.filename === "sameview-comparisons/seed/comparison.json" &&
			!entry.directory,
	);
	if (!manifestEntry || manifestEntry.directory) {
		throw new Error("seed/comparison.json entry missing");
	}
	const manifestText = await manifestEntry.getData(new TextWriter());
	const manifest = JSON.parse(manifestText);

	expect(manifest.formatVersion).toBe(1);
	expect(typeof manifest.sessionId).toBe("string");
	expect(manifest.sessionId.length).toBeGreaterThan(0);
	expect(typeof manifest.outcomeFingerprint).toBe("string");
	expect(manifest.outcomeFingerprint.length).toBeGreaterThan(0);
	// No rendered markup, no device paths, no raw imported metadata — only
	// the already-approved Outcome Snapshot's own allowlisted shape.
	expect(manifest).not.toHaveProperty("html");
	expect(manifest).not.toHaveProperty("metadata");
	expect(manifest.presentation).toBeTruthy();
	expect(manifest.visibility).toBeTruthy();
	expect(manifest.configuration).toBeTruthy();
	expect(typeof manifest.initialSliderPosition).toBe("number");
	expect(manifest.branding).toBeTruthy();

	await zipReader.close();

	// docs/EMBED_IN_WEBSITE.md "Output Inspector Behavior": a short
	// installation guide, no dedicated success screen.
	await expect(
		page.getByTestId("output-wordpress-install-guide"),
	).toBeVisible();
	const primaryAction = page.getByTestId("output-primary-action");
	await expect(primaryAction).toHaveText(/download again/i);
});

test("the Presentation Preview stays visible and unchanged while the Output Inspector is open", async ({
	page,
}) => {
	await importFullFixture(page);
	const canvasBefore = await page.locator(".presentation-canvas").boundingBox();

	await openOutputInspector(page);
	await expect(page.locator(".presentation-canvas")).toBeVisible();
	const canvasAfter = await page.locator(".presentation-canvas").boundingBox();

	expect(canvasAfter?.width).toBeCloseTo(canvasBefore?.width ?? 0, 0);
	expect(canvasAfter?.height).toBeCloseTo(canvasBefore?.height ?? 0, 0);
});

// Confirmed regression fix (docs/COMPARISON_PRESENTATION.md "Preview
// Consistency": "Changing from the Edit Inspector to the Output Inspector
// does not alter the presentation itself"): the Edit/Output Inspector swap
// used to be able to change the *document's* need for a vertical scrollbar
// (Output Inspector's content height differs from whichever Edit Inspector
// accordion section happened to be open — see EditInspector.tsx's own
// header comment), and on a real, non-overlay scrollbar this changes
// `document.documentElement.clientWidth`, which `.workspace-active__layout`'s
// `minmax(0, 1fr)` grid columns — including the Presentation Preview's —
// faithfully reflect. `scrollbar-gutter: stable` on `html`
// (src/styles/global.css) permanently reserves that gutter so a scrollbar
// appearing or disappearing can no longer change any column's width.
//
// This class of bug is invisible unless the browser's scrollbar genuinely
// reserves layout space: Chromium's default headless flags (and therefore
// this project's other Playwright coverage) pass `--hide-scrollbars`, which
// makes scrollbars take no layout space at all — the existing "stays visible
// and unchanged" assertion above already ran under that flag and passed
// throughout the regression. `ignoreDefaultArgs` below removes it for this
// describe block only, so these tests exercise the real, scrollbar-affected
// code path instead of a false-positive one.
test.describe("Presentation Preview geometry across Edit ↔ Output (real, non-overlay scrollbars)", () => {
	// PresentationCanvas's own convergence loop (src/components/WorkspaceActive.tsx)
	// only marks `.presentation-canvas--ready` once its measured geometry has
	// actually settled at the currently requested width — reading its bounding
	// box any earlier than that races the exact ResizeObserver-driven
	// convergence this whole fix is about, which is measurably slower to
	// settle under heavy parallel test load (many concurrent real dev-server
	// requests/image decodes) than in an isolated run. This mirrors this
	// project's own existing convention for reading a settled canvas (e.g.
	// this file's own offline/microsite assertions further below).
	async function waitForCanvasReady(page: import("@playwright/test").Page) {
		await expect(page.locator(".presentation-canvas")).toHaveClass(
			/presentation-canvas--ready/,
			{ timeout: 10_000 },
		);
	}

	async function geometry(page: import("@playwright/test").Page) {
		await waitForCanvasReady(page);
		return page.evaluate(() => {
			const preview = document.querySelector(".workspace-active__preview");
			const canvas = document.querySelector(".presentation-canvas");
			const rect = (el: Element | null) => {
				const box = el?.getBoundingClientRect();
				return box ? { width: box.width, height: box.height } : null;
			};
			return {
				preview: rect(preview),
				canvas: rect(canvas),
				hasDocumentScroll:
					document.documentElement.scrollHeight >
					document.documentElement.clientHeight,
			};
		});
	}

	function expectSameGeometry(
		a: Awaited<ReturnType<typeof geometry>>,
		b: Awaited<ReturnType<typeof geometry>>,
	) {
		if (!a.preview || !b.preview || !a.canvas || !b.canvas) {
			throw new Error("preview or canvas has no bounding box");
		}
		expect(b.preview.width).toBeCloseTo(a.preview.width, 0);
		expect(b.preview.height).toBeCloseTo(a.preview.height, 0);
		expect(b.canvas.width).toBeCloseTo(a.canvas.width, 0);
		expect(b.canvas.height).toBeCloseTo(a.canvas.height, 0);
	}

	test("Desktop, with real document scroll: Preview and Presentation Canvas geometry is identical before Create Output, in the Output Inspector, and after ← Edit", async ({
		page,
	}) => {
		// Confirmed empirically for this fixture: Comparison information (the
		// default open section) makes the document taller than this viewport
		// (a real scrollbar), while the Output Inspector's own, shorter,
		// uncollapsible content fits without one — so this viewport genuinely
		// exercises the scrollbar appearing/disappearing across the switch,
		// not merely a plausible-looking size.
		await page.setViewportSize({ width: 1280, height: 800 });
		await importFullFixture(page);

		const beforeCreateOutput = await geometry(page);
		expect(beforeCreateOutput.hasDocumentScroll).toBe(true);

		await openOutputInspector(page);
		const inOutputInspector = await geometry(page);
		expectSameGeometry(beforeCreateOutput, inOutputInspector);

		await page.getByTestId("output-inspector-back-button").click();
		await expect(page.getByTestId("edit-inspector")).toBeVisible();
		const afterBackToEdit = await geometry(page);
		expectSameGeometry(beforeCreateOutput, afterBackToEdit);
	});

	test("Desktop, no document scroll: Preview and Presentation Canvas geometry is identical before Create Output, in the Output Inspector, and after ← Edit", async ({
		page,
	}) => {
		// Tall enough that neither the default-open Edit Inspector nor the
		// Output Inspector ever needs a scrollbar — the baseline case, kept so
		// the fix is proven not to only help the scrolling scenario above while
		// quietly regressing this one.
		await page.setViewportSize({ width: 1280, height: 1400 });
		await importFullFixture(page);

		const beforeCreateOutput = await geometry(page);
		expect(beforeCreateOutput.hasDocumentScroll).toBe(false);

		await openOutputInspector(page);
		const inOutputInspector = await geometry(page);
		expect(inOutputInspector.hasDocumentScroll).toBe(false);
		expectSameGeometry(beforeCreateOutput, inOutputInspector);

		await page.getByTestId("output-inspector-back-button").click();
		await expect(page.getByTestId("edit-inspector")).toBeVisible();
		const afterBackToEdit = await geometry(page);
		expectSameGeometry(beforeCreateOutput, afterBackToEdit);
	});

	test("repeated Edit → Output → Edit round trips introduce no geometry drift", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await importFullFixture(page);

		const initial = await geometry(page);
		expect(initial.hasDocumentScroll).toBe(true);

		for (let round = 0; round < 3; round++) {
			await openOutputInspector(page);
			expectSameGeometry(initial, await geometry(page));

			await page.getByTestId("output-inspector-back-button").click();
			await expect(page.getByTestId("edit-inspector")).toBeVisible();
			expectSameGeometry(initial, await geometry(page));
		}
	});

	test("Mobile: switching Edit → Output → Edit does not change the Preview's size", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 780 });
		await importFullFixture(page);

		const before = await geometry(page);

		await openOutputInspector(page);
		expectSameGeometry(before, await geometry(page));

		await page.getByTestId("output-inspector-back-button").click();
		await expect(page.getByTestId("edit-inspector")).toBeVisible();
		expectSameGeometry(before, await geometry(page));
	});

	// Deliberately a *non-scrolling* viewport (unlike the "with real document
	// scroll" test above): once the document is genuinely overflowing, a real,
	// non-overlay scrollbar reserves layout space no matter what — that is
	// ordinary, correct browser behavior, entirely unrelated to this fix, and
	// no CSS can (or should) override it. What this fix's own
	// `html:has(.workspace-active__preview--fullscreen) { scrollbar-gutter:
	// auto; }` (src/styles/global.css) addresses is narrower: without it, the
	// *artificial* `stable` reservation from the base `html` rule would still
	// apply even while nothing genuinely overflows, permanently shaving the
	// same pixels off Fullscreen — which does need the true, full viewport
	// (docs/APPLICATION_LAYOUT.md "Fullscreen Mode": "scales proportionally to
	// the maximum available space"), since header, footer and the Context
	// Inspector are already fully covered and inert by then.
	test("Fullscreen still fills the exact full viewport after an Edit → Output → Edit round trip beforehand, even though scrollbar-gutter: stable applies to the document", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 1400 });
		await importFullFixture(page);

		await openOutputInspector(page);
		await page.getByTestId("output-inspector-back-button").click();
		await expect(page.getByTestId("edit-inspector")).toBeVisible();
		const beforeFullscreen = await geometry(page);
		if (!beforeFullscreen.preview) {
			throw new Error("preview has no bounding box");
		}
		expect(beforeFullscreen.hasDocumentScroll).toBe(false);
		const beforeFullscreenPreviewHeight = beforeFullscreen.preview.height;

		await page.getByTestId("fullscreen-open-button").click();
		const viewport = page.viewportSize();
		if (!viewport) throw new Error("no viewport size");
		await expect
			.poll(async () => {
				const box = await page
					.locator(".workspace-active__preview")
					.boundingBox();
				return box?.width;
			})
			.toBeCloseTo(viewport.width, 0);

		await page.keyboard.press("Escape");
		await expect
			.poll(async () => {
				const box = await page
					.locator(".workspace-active__preview")
					.boundingBox();
				return box
					? Math.abs(box.height - beforeFullscreenPreviewHeight)
					: Infinity;
			})
			.toBeLessThanOrEqual(1);
	});
});

test("← Edit returns to the Edit Inspector without discarding any workspace state", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	await page.getByTestId("output-inspector-back-button").click();
	await expect(page.getByTestId("edit-inspector")).toBeVisible();
	await expect(page.getByTestId("output-inspector")).toHaveCount(0);
});

test("generating the Standalone HTML downloads sameview-comparison.html, shows no success screen, and Download again re-downloads identical bytes without regenerating", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	const [firstDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(firstDownload.suggestedFilename()).toBe("sameview-comparison.html");

	// No dedicated success screen (docs/APPLICATION_LAYOUT.md "Completion"):
	// the only visible change on success is the primary action itself
	// becoming "Download again" — no success card, no ready message.
	const downloadAgainButton = page.getByTestId("output-primary-action");
	await expect(downloadAgainButton).toHaveText(/download again/i);

	const [secondDownload] = await Promise.all([
		page.waitForEvent("download"),
		downloadAgainButton.click(),
	]);
	expect(secondDownload.suggestedFilename()).toBe("sameview-comparison.html");

	const firstPath = await firstDownload.path();
	const secondPath = await secondDownload.path();
	expect(firstPath).not.toBeNull();
	expect(secondPath).not.toBeNull();
	const firstBytes = readFileSync(firstPath as string);
	const secondBytes = readFileSync(secondPath as string);
	expect(secondBytes.equals(firstBytes)).toBe(true);
});

// Confirmed regression fix (src/lib/comparison-artifact-scaffold.ts
// `composeArtifactCss`; scripts/build-presentation-runtime.mjs
// `stripBundlerRegionMarkers`; public/favicon.svg itself): the embedded CSS
// and JS used to carry full developer comments — including internal
// `docs/`/`src/` paths and design-tool export metadata — verbatim into a
// publicly downloadable artifact. Reads the actually-downloaded HTML file's
// real bytes, not a reconstruction, so this proves the real generation path
// is clean, not just the unit-level building blocks.
//
// Looped over both locales (src/lib/generate-comparison-output.ts now
// forwards the active `locale` — already read via `useLocale()` in
// src/components/OutputInspector.tsx — unchanged through to
// `buildArtifactDocument`): proves `<html lang>` and the source-branding
// comment both actually follow the language active at generation time, not
// a fixed "en", and that the other language's comment never leaks in
// alongside it.
for (const locale of ["en", "de"] as const) {
	const expectedBranding = BRANDING_COMMENT_BY_LOCALE[locale];
	const otherBranding =
		BRANDING_COMMENT_BY_LOCALE[locale === "en" ? "de" : "en"];

	test(`the downloaded Standalone HTML (locale=${locale}) contains no internal developer comments, source paths, or design-tool metadata, but does contain the public source-branding comment exactly once in the matching language`, async ({
		page,
	}) => {
		await importFullFixture(page);
		if (locale === "de") {
			await switchToGerman(page);
		}
		await openOutputInspector(page);

		const [download] = await Promise.all([
			page.waitForEvent("download"),
			page.getByTestId("output-primary-action").click(),
		]);
		const html = readFileSync(await download.path(), "utf8");

		// CSS comments (would have carried docs/COMPARISON_PRESENTATION.md,
		// src/lib/canvas-geometry.ts, src/components/WorkspaceActive.tsx, etc.).
		expect(html).not.toMatch(/\/\*[\s\S]*?docs\//);
		expect(html).not.toMatch(/\/\*[\s\S]*?src\/(lib|components)\//);

		// Bundler-inserted JS region markers revealing internal src/lib/*.ts
		// file layout (the original .ts source comments themselves do not
		// survive the bundling step at all, so no separate check for those is
		// meaningful here).
		expect(html).not.toContain("//#region");
		expect(html).not.toContain("//#endregion");

		// The embedded favicon is a base64 data: URI — decode it to check the
		// actual SVG content, not just the opaque encoded string.
		const faviconMatch = html.match(
			/href="data:image\/svg\+xml;base64,([^"]+)"/,
		);
		expect(faviconMatch).not.toBeNull();
		const decodedFavicon = Buffer.from(
			faviconMatch?.[1] ?? "",
			"base64",
		).toString("utf8");
		expect(decodedFavicon).not.toMatch(/Inkscape/i);
		expect(decodedFavicon).not.toContain("<metadata");
		expect(decodedFavicon).not.toMatch(/display:\s*none/);

		// The document's own declared language matches the locale active at
		// generation time.
		expect(html).toContain(`<html lang="${locale}">`);

		// Deliberate exception: the public SameView source-branding comment
		// (src/lib/comparison-artifact-scaffold.ts
		// `SOURCE_BRANDING_COMMENT_BY_LOCALE`) — intentional public content,
		// not internal information, and must survive unaffected by the checks
		// above, in the language matching `locale`.
		const brandingOccurrences =
			html.match(new RegExp(expectedBranding.openingLine, "g")) ?? [];
		expect(brandingOccurrences.length).toBe(1);
		expect(html).toMatch(
			new RegExp(
				`<html lang="${locale}">\\n<!--\\n[ \\t]*\\u{1F44B} ${expectedBranding.openingLine}`,
				"u",
			),
		);
		expect(html).toContain("\u{1F44B}");
		expect(html).toContain(expectedBranding.createdWith);
		expect(html).toContain(expectedBranding.discover);
		expect(html).toContain(expectedBranding.closing);

		// The other language's comment must never leak in alongside it.
		expect(html).not.toContain(otherBranding.openingLine);
		expect(html).not.toContain(otherBranding.createdWith);
		expect(html).not.toContain(otherBranding.discover);
	});
}

// Confirmed regression fix (src/components/OutputInspector.tsx
// `runGeneration`): the "Starting download" progress phase used to be set
// and immediately overwritten by the "ready" phase within the same
// synchronous continuation, so React's automatic batching coalesced both
// updates into a single commit and the phase was never actually painted.
// `flushSync` now forces that commit to happen on its own; a minimal
// double `requestAnimationFrame` guarantees it has actually been painted
// before the "ready" transition that immediately follows replaces it. That
// committed state is real but genuinely brief (well under one frame in
// this app's actual generation flow) — deliberately not lengthened just to
// make it easier to observe (a product behavior must not be slowed down to
// suit a test). Waiting for it via Playwright's normal locator polling is
// therefore unreliable by construction. Instead, a `MutationObserver` is
// installed in the page *before* generation starts, so every `data-phase`
// attribute change on the (persistent, only its attribute changes)
// `output-progress` element is captured immediately as it happens, via the
// browser's own microtask-timed mutation callback — independent of
// Playwright's external polling cadence. This proves the phase genuinely
// occurred in the DOM during this generation, via the locale-independent
// `data-phase` attribute, never translated text.
test("the Starting download progress phase actually occurs in the DOM during generation, before the download/completion step", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	await page.evaluate(() => {
		const observedPhases: string[] = [];
		(window as unknown as { __observedPhases: string[] }).__observedPhases =
			observedPhases;
		const root = document.querySelector('[data-testid="output-inspector"]');
		if (!root) throw new Error("output-inspector not found");
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "data-phase" &&
					mutation.target instanceof Element
				) {
					const value = mutation.target.getAttribute("data-phase");
					if (value) observedPhases.push(value);
				}
			}
		});
		observer.observe(root, {
			attributes: true,
			attributeFilter: ["data-phase"],
			subtree: true,
		});
	});

	let downloadCount = 0;
	page.on("download", () => {
		downloadCount++;
	});

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(download.suggestedFilename()).toBe("sameview-comparison.html");

	// Progress UI disappears again once generation completes
	// (docs/APPLICATION_LAYOUT.md "Completion") and the primary action
	// becomes interactive again — asserted structurally, not via text.
	await expect(page.getByTestId("output-progress")).toHaveCount(0);
	await expect(page.getByTestId("output-primary-action")).toBeEnabled();

	const observedPhases = await page.evaluate(
		() =>
			(window as unknown as { __observedPhases: string[] }).__observedPhases,
	);
	expect(observedPhases).toContain("starting-download");
	expect(downloadCount).toBe(1);
});

test("the downloaded Standalone HTML opens fully offline (file://) and renders the comparison interactively", async ({
	page,
	context,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	// `download.path()` saves to an opaque, extension-less temp filename —
	// Chromium's `file://` handler decides MIME type from the extension, so
	// without a real `.html` name the document loads as plain text instead
	// of being parsed as HTML. `saveAs` lets this test control the actual
	// on-disk filename, exactly like a real user's "Save As" would.
	const savedPath = join(
		mkdtempSync(join(tmpdir(), "sameview-standalone-")),
		"sameview-comparison.html",
	);
	await download.saveAs(savedPath);

	const offlinePage = await context.newPage();
	// No network access of any kind is required beyond the file:// document
	// itself — asserted, not assumed, by recording every request the page
	// actually makes rather than aborting them (aborting would also abort
	// the initial file:// navigation itself).
	const requestedUrls: string[] = [];
	offlinePage.on("request", (request) => requestedUrls.push(request.url()));
	await offlinePage.goto(pathToFileURL(savedPath).href);

	await expect(offlinePage.locator("main#sameview-output-frame")).toBeVisible();
	await expect(offlinePage.locator("#sameview-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);
	await expect(offlinePage.locator("#sameview-title")).toHaveText(
		"White and black wall portait",
	);

	// Keyboard-operable, exactly like the live Preview.
	const handle = offlinePage.locator("#sameview-handle");
	await handle.focus();
	const before = await handle.getAttribute("aria-valuenow");
	await offlinePage.keyboard.press("ArrowRight");
	await expect(handle).not.toHaveAttribute("aria-valuenow", before ?? "");

	// The one and only request is the initial file:// document navigation
	// itself — no image, font, script or stylesheet is ever fetched
	// separately.
	expect(requestedUrls).toEqual([pathToFileURL(savedPath).href]);

	await offlinePage.close();
});

test("the Standalone HTML's generated Handle visual matches the Live Preview's actually rendered size, for Branded and Standard branding alike", async ({
	page,
	context,
}) => {
	// Confirmed regression fix (docs/COMPARISON_PRESENTATION.md Part 2
	// "Handle", "Responsive Handle Size on a Small Presentation Stage"): the
	// Handle now scales proportionally below a 200px Stage-shorter-side
	// reference, which is *tighter* than the old ~135/203px implied
	// threshold — Playwright's own default "Desktop Chrome" viewport
	// (1280x720, no explicit size set) produces a Stage whose shorter side
	// is only ~173px for this fixture, already below the new 200px
	// reference, which would make this test's own `toBeCloseTo(81, 0)`
	// assertion fail on a partially-scaled value instead of the true base
	// size. An explicit viewport is required for a "the Handle is at its
	// unscaled base size" assertion to mean anything.
	await page.setViewportSize({ width: 1280, height: 800 });
	await importFullFixture(page);
	await expect(page.locator(".presentation-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);

	// `sample-v6-session_full.zip` imports with Branded (asset) branding
	// already active (test/fixtures/android-export/README.md;
	// src/lib/branding.ts `resolveHandleBranding` resolves its
	// `branding-handle.png` to `{ kind: "asset" }`) — the Live Preview's own
	// actually rendered size for that state, not an assumed constant.
	const brandedPreviewBox = await measureHandleVisualBox(
		page.locator(".comparison-slider__handle-visual"),
	);
	// A safeguard on the currently documented value only
	// (docs/COMPARISON_PRESENTATION.md Part 2 "Handle": 1.5× enlargement) —
	// never a substitute for the parity assertion below, which is what
	// actually proves the regression is fixed.
	expect(brandedPreviewBox.width).toBeCloseTo(81, 0);

	await openOutputInspector(page);
	const [brandedDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	const brandedPath = join(
		mkdtempSync(join(tmpdir(), "sameview-standalone-branded-")),
		"sameview-comparison.html",
	);
	await brandedDownload.saveAs(brandedPath);

	const brandedOfflinePage = await context.newPage();
	await brandedOfflinePage.goto(pathToFileURL(brandedPath).href);
	await expect(brandedOfflinePage.locator("#sameview-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);
	const brandedArtifactBox = await measureHandleVisualBox(
		brandedOfflinePage.locator("#sameview-handle-visual"),
	);
	expect(brandedArtifactBox.width).toBeCloseTo(brandedPreviewBox.width, 0);
	expect(brandedArtifactBox.height).toBeCloseTo(brandedPreviewBox.height, 0);
	await brandedOfflinePage.close();

	// Standard (no branding) — the one Handle state the fixture's own default
	// doesn't already exercise.
	await page.getByTestId("output-inspector-back-button").click();
	await expect(page.getByTestId("edit-inspector")).toBeVisible();
	await switchToNoneBranding(page);

	const standardPreviewBox = await measureHandleVisualBox(
		page.locator(".comparison-slider__handle-visual"),
	);
	expect(standardPreviewBox.width).toBeCloseTo(54, 0);

	await openOutputInspector(page);
	const [standardDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	const standardPath = join(
		mkdtempSync(join(tmpdir(), "sameview-standalone-standard-")),
		"sameview-comparison.html",
	);
	await standardDownload.saveAs(standardPath);

	const standardOfflinePage = await context.newPage();
	await standardOfflinePage.goto(pathToFileURL(standardPath).href);
	await expect(standardOfflinePage.locator("#sameview-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);
	const standardArtifactBox = await measureHandleVisualBox(
		standardOfflinePage.locator("#sameview-handle-visual"),
	);
	expect(standardArtifactBox.width).toBeCloseTo(standardPreviewBox.width, 0);
	expect(standardArtifactBox.height).toBeCloseTo(standardPreviewBox.height, 0);
	await standardOfflinePage.close();
});

// Confirmed regression fix (docs/COMPARISON_PRESENTATION.md Part 2 "Handle",
// "Responsive Handle Size on a Small Presentation Stage"): responsive Handle
// scaling must react live to the *already-generated, already-opened*
// document being resized — a Standalone HTML/Static Microsite output is
// never regenerated once downloaded (docs/APPLICATION_LAYOUT.md "Standalone
// HTML": "represents the current Presentation Preview exactly at the moment
// of download" describes generation, not an ongoing dependency), so a
// static, generation-time-only size would go stale the moment the viewer
// resizes their own window or opens the file on a different screen.
// src/lib/comparison-presentation-runtime.ts's own `recomputeGeometry()`
// (already resize-reactive for Stage geometry) is what this relies on.
test("the Standalone HTML's Handle visual resizes live when the already-opened artifact's own window is resized, without regenerating or reloading", async ({
	page,
	context,
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await importFullFixture(page);
	await openOutputInspector(page);
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	const savedPath = join(
		mkdtempSync(join(tmpdir(), "sameview-standalone-live-resize-")),
		"sameview-comparison.html",
	);
	await download.saveAs(savedPath);

	const offlinePage = await context.newPage();
	await offlinePage.setViewportSize({ width: 1280, height: 800 });
	await offlinePage.goto(pathToFileURL(savedPath).href);
	await expect(offlinePage.locator("#sameview-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);
	const normalBox = await measureHandleVisualBox(
		offlinePage.locator("#sameview-handle-visual"),
	);
	expect(normalBox.width).toBeCloseTo(81, 0);

	// The exact same already-open document — no navigation, no re-download.
	// Deliberately much smaller than the Preview's own equivalent "shrunk"
	// viewport (e.g. 800x500): the Standalone artifact's own outer chrome
	// (`#sameview-output-frame`, a centered `position: fixed` frame with a
	// small responsive margin) preserves noticeably more Stage space at the
	// same raw viewport size than the Live Preview's two-column app grid
	// does — confirmed empirically (at 800x500 the artifact's own Stage
	// measures ~210x374px, still above the Branded scaling threshold, so the
	// Handle would not visibly shrink there at all) — so this test uses a
	// viewport small enough for the *artifact's own* Stage to genuinely
	// cross the threshold, not one merely small enough for the Preview.
	await offlinePage.setViewportSize({ width: 300, height: 300 });
	await expect
		.poll(async () => {
			const box = await offlinePage
				.locator("#sameview-handle-visual")
				.boundingBox();
			return box?.width;
		})
		.toBeLessThan(80);

	await offlinePage.setViewportSize({ width: 1280, height: 800 });
	await expect
		.poll(async () => {
			const box = await offlinePage
				.locator("#sameview-handle-visual")
				.boundingBox();
			return box?.width;
		})
		.toBeCloseTo(81, 0);

	await offlinePage.close();
});

// The one test explicitly required to guard against a repeat of the exact
// defect this whole feature already fixed once (src/lib/comparison-artifact-markup.ts
// `buildHandleMarkup`, Problem 1): two formally similar but independently
// drifting implementations. Rather than asserting each renderer's own
// output against the shared formula in isolation (already covered above and
// in test/e2e/comparison-slider-handle-geometry.spec.ts), this directly
// compares the Live Preview's and the generated Standalone HTML's actually
// rendered Handle size *at the same actually rendered Stage size* — the two
// renderers' own outer chrome differs (the two-column app grid vs. the
// artifact's centered `#sameview-output-frame`), so matching viewport pixels
// alone does not guarantee a matching Stage size; this converges the
// artifact's own viewport (a handful of real resizes, not a guessed
// constant) until its measured Stage size matches the Preview's.
test("Preview and the generated Standalone HTML render the exact same Handle size at the same actually rendered Stage size", async ({
	page,
	context,
}) => {
	await page.setViewportSize({ width: 800, height: 500 });
	await importFullFixture(page);
	const previewStageBox = await page
		.locator('[data-testid="comparison-slider"]')
		.boundingBox();
	if (!previewStageBox) throw new Error("preview stage has no bounding box");
	const previewHandleBox = await measureHandleVisualBox(
		page.locator(".comparison-slider__handle-visual"),
	);

	await openOutputInspector(page);
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	const savedPath = join(
		mkdtempSync(join(tmpdir(), "sameview-standalone-parity-")),
		"sameview-comparison.html",
	);
	await download.saveAs(savedPath);

	const offlinePage = await context.newPage();
	let viewport = { width: 800, height: 500 };
	let artifactStageBox: { width: number; height: number } | null = null;
	for (let attempt = 0; attempt < 6; attempt++) {
		await offlinePage.setViewportSize(viewport);
		if (attempt === 0) {
			await offlinePage.goto(pathToFileURL(savedPath).href);
			await expect(offlinePage.locator("#sameview-canvas")).toHaveClass(
				/presentation-canvas--ready/,
				{ timeout: 10_000 },
			);
		} else {
			await offlinePage.waitForTimeout(150);
		}
		const box = await offlinePage
			.locator("#sameview-slider-frame")
			.boundingBox();
		if (!box) throw new Error("artifact stage has no bounding box");
		artifactStageBox = box;
		const deltaWidth = previewStageBox.width - box.width;
		const deltaHeight = previewStageBox.height - box.height;
		if (Math.abs(deltaWidth) < 1 && Math.abs(deltaHeight) < 1) break;
		viewport = {
			width: Math.round(viewport.width + deltaWidth),
			height: Math.round(viewport.height + deltaHeight),
		};
	}
	if (!artifactStageBox) throw new Error("artifact stage was never measured");

	// Confirms the loop above actually found a matching real Stage size —
	// the assertions below are only meaningful if this held.
	expect(Math.abs(artifactStageBox.width - previewStageBox.width)).toBeLessThan(
		1.5,
	);
	expect(
		Math.abs(artifactStageBox.height - previewStageBox.height),
	).toBeLessThan(1.5);

	const artifactHandleBox = await measureHandleVisualBox(
		offlinePage.locator("#sameview-handle-visual"),
	);
	expect(artifactHandleBox.width).toBeCloseTo(previewHandleBox.width, 0);
	expect(artifactHandleBox.height).toBeCloseTo(previewHandleBox.height, 0);

	await offlinePage.close();
});

test("generating the Static Microsite downloads sameview-comparison.zip with exactly the specified file structure, and the unpacked index.html works the same way", async ({
	page,
	context,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);
	await page.getByTestId("output-card-static-microsite").click();

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(download.suggestedFilename()).toBe("sameview-comparison.zip");
	const zipPath = await download.path();
	expect(zipPath).not.toBeNull();

	const zipBytes = new Uint8Array(readFileSync(zipPath as string));
	const zipReader = new ZipReader(new Uint8ArrayReader(zipBytes));
	const entries = await zipReader.getEntries();
	const paths = entries.map((entry) => entry.filename).sort();

	// Exact structure (docs/IMPLEMENTATION_PLAN_V1.md Phase 9). This fixture
	// carries an imported built-in-symbol branding asset
	// (branding-handle.png, test/fixtures/android-export/sample-v6-session_full.zip)
	// which src/lib/branding.ts `resolveHandleBranding` resolves to
	// `{ kind: "asset" }` for as long as that asset is present — so
	// images/branding.png is expected here, unlike a comparison with no
	// branding at all.
	expect(paths).toEqual(
		[
			"index.html",
			"favicon.svg",
			"css/sameview-comparison.css",
			"js/sameview-comparison.js",
			"images/reference.jpg",
			"images/capture.jpg",
			"images/branding.png",
			"fonts/InterVariable.woff2",
			"fonts/LICENSE.txt",
		].sort(),
	);
	// No additional outer root folder: every path is already relative to the
	// archive root.
	for (const path of paths) {
		expect(path.split("/")[0]).not.toMatch(/^sameview-comparison/);
	}

	const extractDir = mkdtempSync(join(tmpdir(), "sameview-microsite-"));
	for (const entry of entries) {
		if (entry.directory) continue;
		const bytes = await entry.getData(new Uint8ArrayWriter());
		const destination = join(extractDir, entry.filename);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, bytes);
	}
	await zipReader.close();

	// Confirmed regression fix (src/lib/comparison-artifact-scaffold.ts
	// `composeArtifactCss`; scripts/build-presentation-runtime.mjs
	// `stripBundlerRegionMarkers`; public/favicon.svg itself): none of the
	// packaged files may carry internal developer comments, source paths, or
	// design-tool export metadata — checked against the actually-unpacked
	// files, not a reconstruction.
	const micrositeCss = readFileSync(
		join(extractDir, "css/sameview-comparison.css"),
		"utf8",
	);
	expect(micrositeCss).not.toMatch(/\/\*[\s\S]*?docs\//);
	expect(micrositeCss).not.toMatch(/\/\*[\s\S]*?src\/(lib|components)\//);

	// Confirmed regression fix for this iteration
	// (docs/IMPLEMENTATION_PLAN_V1.md Phase 9's minified-Microsite-assets
	// rule; scripts/build-presentation-runtime.mjs `buildPresentationCssCode`;
	// src/lib/presentation-font-assets.ts `buildFontFaceCss` `compact`
	// option): the final packaged CSS — including the dynamically generated
	// `@font-face` rule — is genuinely minified, not just comment-free.
	// Structural, not size-based: no comment openings at all (minification
	// strips comments as a side effect), no readable multi-line/tab-indented
	// declarations, and the known selectors collapse onto a compact form.
	expect(micrositeCss).not.toMatch(/\/\*/);
	expect(micrositeCss).not.toMatch(/\n\t/);
	expect(micrositeCss).toMatch(/\.presentation-canvas\{/);
	expect(micrositeCss).toMatch(/#sameview-output-frame\{/);
	// The dynamic per-font @font-face rule (compact form, not the readable
	// multi-line form Standalone HTML still uses).
	expect(micrositeCss).toMatch(/@font-face\{font-family:/);
	expect(micrositeCss).not.toMatch(/@font-face \{\n/);
	// Fixed composition order preserved end to end: @font-face, then
	// Presentation CSS, then Frame CSS (src/lib/generate-static-microsite.ts;
	// scripts/build-presentation-runtime.mjs `buildPresentationCssCode`).
	const fontFaceIndex = micrositeCss.indexOf("@font-face{");
	const presentationIndex = micrositeCss.indexOf(".presentation-canvas{");
	const frameIndex = micrositeCss.indexOf("#sameview-output-frame{");
	expect(fontFaceIndex).toBeGreaterThanOrEqual(0);
	expect(presentationIndex).toBeGreaterThan(fontFaceIndex);
	expect(frameIndex).toBeGreaterThan(presentationIndex);

	const micrositeJs = readFileSync(
		join(extractDir, "js/sameview-comparison.js"),
		"utf8",
	);
	expect(micrositeJs).not.toContain("//#region");
	expect(micrositeJs).not.toContain("//#endregion");

	// Confirmed regression fix for this iteration: the packaged runtime
	// script is genuinely minified (scripts/build-presentation-runtime.mjs
	// `buildPresentationRuntimeCode({ minify: true })`), not merely
	// region-marker-free. Structural, not size-based: esbuild's minifier
	// collapses the whole IIFE onto a handful of lines with no tab-indented
	// declarations, unlike the readable source it is built from.
	expect(micrositeJs.split("\n").length).toBeLessThan(20);
	expect(micrositeJs).not.toMatch(/\n\t/);

	const micrositeFavicon = readFileSync(
		join(extractDir, "favicon.svg"),
		"utf8",
	);
	expect(micrositeFavicon).not.toMatch(/Inkscape/i);
	expect(micrositeFavicon).not.toContain("<metadata");
	expect(micrositeFavicon).not.toMatch(/display:\s*none/);

	// Deliberate exception: the public SameView source-branding comment
	// (src/lib/comparison-artifact-scaffold.ts
	// `SOURCE_BRANDING_COMMENT_BY_LOCALE`) — intentional public content, must
	// survive in the packaged `index.html` unaffected by the checks above,
	// exactly once, immediately after `<html lang="en">` (English is the
	// default locale — no language switch happened in this test).
	const micrositeIndexHtml = readFileSync(
		join(extractDir, "index.html"),
		"utf8",
	);
	expect(micrositeIndexHtml).toContain('<html lang="en">');
	const brandingOccurrences =
		micrositeIndexHtml.match(/Hey there, you found the source!/g) ?? [];
	expect(brandingOccurrences.length).toBe(1);
	expect(micrositeIndexHtml).toMatch(
		/<html lang="en">\n<!--\n[ \t]*\u{1F44B} Hey there, you found the source!/u,
	);
	expect(micrositeIndexHtml).toContain("\u{1F44B}");
	expect(micrositeIndexHtml).toContain("Created with https://web.sameview.app");
	expect(micrositeIndexHtml).toContain(
		"Discover SameView and get the Android app at https://sameview.app",
	);
	expect(micrositeIndexHtml).toContain("Enjoy!");
	expect(micrositeIndexHtml).not.toContain(
		BRANDING_COMMENT_BY_LOCALE.de.openingLine,
	);

	const micrositePage = await context.newPage();
	await micrositePage.route("**/*", (route) => {
		// Only same-directory (file://) requests are allowed through — proves
		// the unpacked microsite needs no external resource once served from
		// ordinary static webspace.
		if (route.request().url().startsWith("file://")) return route.continue();
		return route.abort();
	});
	await micrositePage.goto(pathToFileURL(join(extractDir, "index.html")).href);

	await expect(micrositePage.locator("#sameview-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);
	await expect(micrositePage.locator("#sameview-title")).toHaveText(
		"White and black wall portait",
	);

	await micrositePage.close();
});

// Extracts a freshly generated Static Microsite ZIP to a temp directory and
// returns its `index.html` path — factored out of the structure test above
// so the parity test below can generate it twice (Branded, then Standard)
// without duplicating the zip-reading mechanics.
async function downloadAndExtractMicrosite(
	page: import("@playwright/test").Page,
	dirPrefix: string,
): Promise<string> {
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	const zipBytes = new Uint8Array(readFileSync(await download.path()));
	const zipReader = new ZipReader(new Uint8ArrayReader(zipBytes));
	const entries = await zipReader.getEntries();
	const extractDir = mkdtempSync(join(tmpdir(), dirPrefix));
	for (const entry of entries) {
		if (entry.directory) continue;
		const bytes = await entry.getData(new Uint8ArrayWriter());
		const destination = join(extractDir, entry.filename);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, bytes);
	}
	await zipReader.close();
	return join(extractDir, "index.html");
}

// Locale coverage for the Static Microsite (see the equivalent Standalone
// HTML loop above): the full ZIP-structure/offline-serving assertions are
// already covered in English by the structure test above — this test adds
// only the language-specific ones for German, via `downloadAndExtractMicrosite`,
// to avoid duplicating the rest of that test's scope.
test('generating the Static Microsite after switching to German produces an index.html with <html lang="de"> and the German source-branding comment, never the English one', async ({
	page,
}) => {
	await importFullFixture(page);
	await switchToGerman(page);
	await openOutputInspector(page);
	await page.getByTestId("output-card-static-microsite").click();

	const indexHtmlPath = await downloadAndExtractMicrosite(
		page,
		"sameview-microsite-de-",
	);
	const micrositeIndexHtml = readFileSync(indexHtmlPath, "utf8");

	const expectedBranding = BRANDING_COMMENT_BY_LOCALE.de;
	const otherBranding = BRANDING_COMMENT_BY_LOCALE.en;

	expect(micrositeIndexHtml).toContain('<html lang="de">');
	const brandingOccurrences =
		micrositeIndexHtml.match(new RegExp(expectedBranding.openingLine, "g")) ??
		[];
	expect(brandingOccurrences.length).toBe(1);
	expect(micrositeIndexHtml).toMatch(
		new RegExp(
			`<html lang="de">\\n<!--\\n[ \\t]*\\u{1F44B} ${expectedBranding.openingLine}`,
			"u",
		),
	);
	expect(micrositeIndexHtml).toContain("\u{1F44B}");
	expect(micrositeIndexHtml).toContain(expectedBranding.createdWith);
	expect(micrositeIndexHtml).toContain(expectedBranding.discover);
	expect(micrositeIndexHtml).toContain(expectedBranding.closing);

	expect(micrositeIndexHtml).not.toContain(otherBranding.openingLine);
	expect(micrositeIndexHtml).not.toContain(otherBranding.createdWith);
	expect(micrositeIndexHtml).not.toContain(otherBranding.discover);
});

test("the Static Microsite's generated Handle visual matches the Live Preview's actually rendered size, for Branded and Standard branding alike", async ({
	page,
	context,
}) => {
	// See the Standalone HTML equivalent test's own comment: an explicit
	// viewport is required so this Stage's shorter side stays above the
	// 200px reference (Playwright's default "Desktop Chrome" viewport does
	// not).
	await page.setViewportSize({ width: 1280, height: 800 });
	await importFullFixture(page);
	await expect(page.locator(".presentation-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);

	// Same fixture default as the Standalone HTML parity test above: Branded
	// (asset) branding already active.
	const brandedPreviewBox = await measureHandleVisualBox(
		page.locator(".comparison-slider__handle-visual"),
	);
	expect(brandedPreviewBox.width).toBeCloseTo(81, 0);

	await openOutputInspector(page);
	await page.getByTestId("output-card-static-microsite").click();
	const brandedIndexPath = await downloadAndExtractMicrosite(
		page,
		"sameview-microsite-branded-",
	);

	const brandedMicrositePage = await context.newPage();
	await brandedMicrositePage.goto(pathToFileURL(brandedIndexPath).href);
	await expect(brandedMicrositePage.locator("#sameview-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);
	const brandedArtifactBox = await measureHandleVisualBox(
		brandedMicrositePage.locator("#sameview-handle-visual"),
	);
	expect(brandedArtifactBox.width).toBeCloseTo(brandedPreviewBox.width, 0);
	expect(brandedArtifactBox.height).toBeCloseTo(brandedPreviewBox.height, 0);
	await brandedMicrositePage.close();

	// Standard (no branding).
	await page.getByTestId("output-inspector-back-button").click();
	await expect(page.getByTestId("edit-inspector")).toBeVisible();
	await switchToNoneBranding(page);

	const standardPreviewBox = await measureHandleVisualBox(
		page.locator(".comparison-slider__handle-visual"),
	);
	expect(standardPreviewBox.width).toBeCloseTo(54, 0);

	await openOutputInspector(page);
	await page.getByTestId("output-card-static-microsite").click();
	const standardIndexPath = await downloadAndExtractMicrosite(
		page,
		"sameview-microsite-standard-",
	);

	const standardMicrositePage = await context.newPage();
	await standardMicrositePage.goto(pathToFileURL(standardIndexPath).href);
	await expect(standardMicrositePage.locator("#sameview-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);
	const standardArtifactBox = await measureHandleVisualBox(
		standardMicrositePage.locator("#sameview-handle-visual"),
	);
	expect(standardArtifactBox.width).toBeCloseTo(standardPreviewBox.width, 0);
	expect(standardArtifactBox.height).toBeCloseTo(standardPreviewBox.height, 0);
	await standardMicrositePage.close();
});

// Static Microsite equivalent of the Standalone HTML live-resize test above
// — both share the exact same markup and runtime script (docs/COMPARISON_PRESENTATION.md
// "Standalone HTML and Static Microsite Fidelity": "differ only in
// packaging"), but this is exercised independently rather than assumed, per
// this task's own explicit requirement.
test("the Static Microsite's Handle visual resizes live when the already-opened, already-unpacked artifact's own window is resized, without regenerating or reloading", async ({
	page,
	context,
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await importFullFixture(page);
	await openOutputInspector(page);
	await page.getByTestId("output-card-static-microsite").click();
	const indexPath = await downloadAndExtractMicrosite(
		page,
		"sameview-microsite-live-resize-",
	);

	const micrositePage = await context.newPage();
	await micrositePage.setViewportSize({ width: 1280, height: 800 });
	await micrositePage.goto(pathToFileURL(indexPath).href);
	await expect(micrositePage.locator("#sameview-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);
	const normalBox = await measureHandleVisualBox(
		micrositePage.locator("#sameview-handle-visual"),
	);
	expect(normalBox.width).toBeCloseTo(81, 0);

	// See the Standalone HTML equivalent test's own comment: the artifact's
	// own outer chrome needs a much smaller viewport than the Live Preview
	// to genuinely cross the scaling threshold.
	await micrositePage.setViewportSize({ width: 300, height: 300 });
	await expect
		.poll(async () => {
			const box = await micrositePage
				.locator("#sameview-handle-visual")
				.boundingBox();
			return box?.width;
		})
		.toBeLessThan(80);

	await micrositePage.setViewportSize({ width: 1280, height: 800 });
	await expect
		.poll(async () => {
			const box = await micrositePage
				.locator("#sameview-handle-visual")
				.boundingBox();
			return box?.width;
		})
		.toBeCloseTo(81, 0);

	await micrositePage.close();
});

test("a generation failure never triggers a download and shows the specified error state", async ({
	page,
}) => {
	await importFullFixture(page);
	// Forces the atomic failure path: the font asset fetch (a real network
	// request even for this same-origin static asset) fails, so generation
	// must fail before any download is ever attempted.
	await page.route("**/fonts/**", (route) => route.abort());
	await openOutputInspector(page);

	let downloadFired = false;
	page.on("download", () => {
		downloadFired = true;
	});

	await page.getByTestId("output-primary-action").click();
	await expect(page.getByTestId("output-error")).toBeVisible();
	// A failure never leaves the primary action in the post-success "Download
	// again" state (docs/APPLICATION_LAYOUT.md "Completion": no dedicated
	// success screen exists to leave either).
	await expect(page.getByTestId("output-primary-action")).not.toHaveText(
		/download again/i,
	);
	expect(downloadFired).toBe(false);
});

test("Remove Embedded Location Data hint appears only while it is on and Show Location is also on", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	// The fixture imports with Show Location on by default.
	await expect(
		page.getByTestId("output-remove-location-data-hint"),
	).toBeVisible();

	await page.getByTestId("output-remove-location-data-switch").click();
	await expect(
		page.getByTestId("output-remove-location-data-hint"),
	).toHaveCount(0);
});

// docs/COMPARISON_PRESENTATION.md "Use Current Slider Position". Covers the
// full chain end to end: a real keyboard-driven Workspace Preview slider
// move, through src/components/ComparisonSlider.tsx's `onPositionChange` and
// src/components/WorkspaceActive.tsx's ref, into
// src/components/OutputInspector.tsx's Generate-time snapshot, through
// src/lib/outcome-snapshot.ts, and finally the actually generated/downloaded
// artifact — not just the intermediate generator functions.
test("Use Current Slider Position: Off always starts at 50/50, On carries over a known non-50% Preview position identically into Standalone HTML and Static Microsite, and later Preview movement never changes an already-generated output", async ({
	page,
	context,
}) => {
	await importFullFixture(page);
	await expect(page.locator(".presentation-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);

	// Move the live Workspace Preview's own slider to a known, non-50%
	// position via its existing keyboard support (SLIDER_KEYBOARD_STEP = 5,
	// src/lib/comparison-slider-interaction.ts) — the same interaction a real
	// user performs, not a direct state injection.
	const previewHandle = page.getByRole("slider");
	await previewHandle.focus();
	for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
	await expect(previewHandle).toHaveAttribute("aria-valuenow", "75");

	await openOutputInspector(page);
	const toggle = page.getByTestId("output-use-current-slider-position-switch");
	await expect(toggle).toHaveAttribute("aria-checked", "false");

	// Off (the default): Standalone HTML starts at 50/50 regardless of the
	// Preview's own current position.
	const [offDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	const offPath = join(
		mkdtempSync(join(tmpdir(), "sameview-slider-off-")),
		"sameview-comparison.html",
	);
	await offDownload.saveAs(offPath);
	const offPage = await context.newPage();
	await offPage.goto(pathToFileURL(offPath).href);
	await expect(offPage.locator("#sameview-handle")).toHaveAttribute(
		"aria-valuenow",
		"50",
	);
	await offPage.close();

	// Back to Edit and Output again: a fresh OutputInspector instance, the
	// toggle back at its own default (Off) — output-specific state, not part
	// of Current Working State (see OutputInspector.tsx's own header
	// comment). The Preview's own slider position, unlike the toggle, is
	// unaffected by this Edit/Output switch (owned by WorkspaceActive, one
	// level up) and remains at 75.
	await page.getByTestId("output-inspector-back-button").click();
	await openOutputInspector(page);
	await expect(
		page.getByTestId("output-use-current-slider-position-switch"),
	).toHaveAttribute("aria-checked", "false");
	await page.getByTestId("output-use-current-slider-position-switch").click();

	const [onDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	const onPath = join(
		mkdtempSync(join(tmpdir(), "sameview-slider-on-standalone-")),
		"sameview-comparison.html",
	);
	await onDownload.saveAs(onPath);
	const onPage = await context.newPage();
	await onPage.goto(pathToFileURL(onPath).href);
	await expect(onPage.locator("#sameview-handle")).toHaveAttribute(
		"aria-valuenow",
		"75",
	);

	// Static Microsite, generated at the same, still-unmoved Preview position
	// (75): carries the identical value into index.html — proving both output
	// types consume the identical Outcome Snapshot value.
	await page.getByTestId("output-inspector-back-button").click();
	await openOutputInspector(page);
	await page.getByTestId("output-card-static-microsite").click();
	await page.getByTestId("output-use-current-slider-position-switch").click();
	const micrositeIndexPath = await downloadAndExtractMicrosite(
		page,
		"sameview-slider-on-microsite-",
	);
	const micrositePage = await context.newPage();
	await micrositePage.goto(pathToFileURL(micrositeIndexPath).href);
	await expect(micrositePage.locator("#sameview-handle")).toHaveAttribute(
		"aria-valuenow",
		"75",
	);
	await micrositePage.close();

	// The Preview's own slider is unaffected by any of the above — nothing
	// here ever writes back into it — and both already-generated outputs stay
	// exactly as captured regardless of later Preview movement.
	await expect(previewHandle).toHaveAttribute("aria-valuenow", "75");
	await previewHandle.focus();
	await page.keyboard.press("ArrowLeft");
	await expect(previewHandle).toHaveAttribute("aria-valuenow", "70");
	await expect(onPage.locator("#sameview-handle")).toHaveAttribute(
		"aria-valuenow",
		"75",
	);
	await onPage.close();
});

// docs/APPLICATION_LAYOUT.md "Completion": "The primary action remains a
// repeat download of the same generated artifact only while the selected
// output type and output-specific settings still match those it was
// generated with." Confirmed regression fix (src/components/OutputInspector.tsx
// `invalidateGeneratedArtifact`): switching the output type after a
// successful generation used to leave the primary action as "Download
// again", silently re-downloading the previous output type's artifact
// instead of generating the newly selected one.
test("switching from Standalone HTML to Static Microsite after a successful generation reverts the primary action to the normal Microsite state and generates a fresh ZIP, not the old HTML", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	const [htmlDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(htmlDownload.suggestedFilename()).toBe("sameview-comparison.html");

	const primaryAction = page.getByTestId("output-primary-action");
	await expect(primaryAction).toHaveText(/download again/i);

	await page.getByTestId("output-card-static-microsite").click();
	await expect(primaryAction).toHaveText(/download zip/i);

	const [zipDownload] = await Promise.all([
		page.waitForEvent("download"),
		primaryAction.click(),
	]);
	expect(zipDownload.suggestedFilename()).toBe("sameview-comparison.zip");
});

// Symmetric to the test above, the other direction.
test("switching from Static Microsite to Standalone HTML after a successful generation reverts the primary action to the normal Standalone state and generates a fresh HTML file, not the old ZIP", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);
	await page.getByTestId("output-card-static-microsite").click();

	const [zipDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(zipDownload.suggestedFilename()).toBe("sameview-comparison.zip");

	const primaryAction = page.getByTestId("output-primary-action");
	await expect(primaryAction).toHaveText(/download again/i);

	await page.getByTestId("output-card-standalone-html").click();
	await expect(primaryAction).toHaveText(/download html/i);

	const [htmlDownload] = await Promise.all([
		page.waitForEvent("download"),
		primaryAction.click(),
	]);
	expect(htmlDownload.suggestedFilename()).toBe("sameview-comparison.html");
});

test("changing Use Current Slider Position after a successful generation reverts Download again and the next generation carries the current Preview position, while a mere Preview slider movement alone does not revert it", async ({
	page,
	context,
}) => {
	await importFullFixture(page);
	await expect(page.locator(".presentation-canvas")).toHaveClass(
		/presentation-canvas--ready/,
		{ timeout: 10_000 },
	);
	await openOutputInspector(page);

	const [firstDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(firstDownload.suggestedFilename()).toBe("sameview-comparison.html");
	const primaryAction = page.getByTestId("output-primary-action");
	await expect(primaryAction).toHaveText(/download again/i);

	// docs/APPLICATION_LAYOUT.md "Completion": "A Presentation Preview slider
	// movement alone does not have this effect." — the Presentation Preview
	// stays visible and interactive behind the Output Inspector throughout.
	const previewHandle = page.getByRole("slider");
	await previewHandle.focus();
	for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
	await expect(previewHandle).toHaveAttribute("aria-valuenow", "75");
	await expect(primaryAction).toHaveText(/download again/i);

	// Changing the setting itself does invalidate it.
	await page.getByTestId("output-use-current-slider-position-switch").click();
	await expect(primaryAction).toHaveText(/download html/i);

	const [secondDownload] = await Promise.all([
		page.waitForEvent("download"),
		primaryAction.click(),
	]);
	const savedPath = join(
		mkdtempSync(join(tmpdir(), "sameview-invalidate-slider-")),
		"sameview-comparison.html",
	);
	await secondDownload.saveAs(savedPath);
	const artifactPage = await context.newPage();
	await artifactPage.goto(pathToFileURL(savedPath).href);
	await expect(artifactPage.locator("#sameview-handle")).toHaveAttribute(
		"aria-valuenow",
		"75",
	);
	await artifactPage.close();
});

test("changing Remove Embedded Location Data after a successful generation reverts Download again and the next click performs a real new generation", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	const [firstDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(firstDownload.suggestedFilename()).toBe("sameview-comparison.html");
	const primaryAction = page.getByTestId("output-primary-action");
	await expect(primaryAction).toHaveText(/download again/i);

	await page.getByTestId("output-remove-location-data-switch").click();
	await expect(primaryAction).toHaveText(/download html/i);

	const [secondDownload] = await Promise.all([
		page.waitForEvent("download"),
		primaryAction.click(),
	]);
	expect(secondDownload.suggestedFilename()).toBe("sameview-comparison.html");
	await expect(primaryAction).toHaveText(/download again/i);
});

function sha256Hex(bytes: Uint8Array | Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

// docs/IMPLEMENTATION_PLAN_V1.md Phase 11: session.id/outcomeFingerprint are
// additive Outcome Snapshot fields that must never change generated
// Standalone HTML or Static Microsite bytes. These hashes were captured from
// the real, actually-downloaded artifact for this fixture's default
// generation settings *before* Phase 11 was implemented — never update them
// merely to make this test pass; a mismatch means some change (Phase 11 or
// otherwise) altered output that must stay byte-for-byte identical.
//
// Updated once, deliberately, for docs/IMPLEMENTATION_PLAN_V1.md Phase 13
// ("Shared Runtime Multiple-Instance Safety"): the embedded Comparison
// Presentation runtime script's own source changed (root-relative,
// multi-instance-safe element resolution replacing global
// `document.getElementById` lookups), which necessarily changes this single
// file's overall hash since the script is inlined into it — verified before
// this update that the Static Microsite's own `index.html` entry hash below
// (identical `.presentation-canvas` markup, produced by the same
// `buildComparisonArtifactMarkup` call) stayed byte-for-byte unchanged, so
// the Presentation markup/content/settings embedded here are unaffected;
// only the runtime script bytes are.
//
// Updated again, deliberately, for docs/IMPLEMENTATION_PLAN_V1.md Phase 17
// ("WordPress Frontend Delivery and Host Isolation"): src/lib/comparison-presentation-runtime.ts
// now additionally exports its own per-instance initializer (`initInstance`,
// needed only by the WordPress Embed runtime for Shadow DOM mounting) and
// src/lib/overflow-tooltip.ts's outside-pointerdown detection now uses
// `event.composedPath()` instead of `event.target` (needed only to remain
// correct across a Shadow DOM boundary) — both are additive/behavior-preserving
// for this single-instance, non-shadow-rooted consumer, but the compiled
// runtime script's own bytes still change since both modules feed this same
// bundle. Verified again before this update that every other entry hash
// below, especially `index.html`, stayed exactly unchanged.
//
// Updated a third time, deliberately, for the same Phase 17 (Decision 77
// "Embed sizing model"): `initInstance` gained a `sizingMode` parameter
// (default `"bounded"`, this consumer's own call site — `initComparisonPresentation()`,
// unchanged — never passes a second argument, so it keeps taking exactly the
// same `computeCanvasGeometry` code path it always has) and
// src/lib/canvas-geometry.ts gained the new, separate
// `computeCanvasGeometryForAvailableWidth` function the Embed-only
// `"width-constrained"` mode calls instead — used by nothing in this bundle,
// but its mere presence in the same module still changes the compiled
// output's bytes. Verified again that every other entry hash stayed exactly
// unchanged, and that the full Workspace Preview/comparison-viewer and
// comparison-slider-handle-geometry E2E suites (this bundle's own real
// behavior, not just its bytes) still pass unmodified.
test("Standalone HTML bytes for the default fixture configuration remain byte-for-byte unchanged across unrelated Outcome Snapshot changes (Phase 11 regression guard)", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	const bytes = readFileSync(await download.path());
	expect(sha256Hex(bytes)).toBe(
		"3c174ab5185cb088d57c071b327022e97ec7f68f3921e04ba443aa5b9b34131a",
	);
});

// Compares each Static Microsite ZIP entry's own decompressed content bytes,
// not the raw .zip container bytes: @zip.js/zip.js embeds a per-entry
// last-modified timestamp that defaults to the real generation wall-clock
// time, so the container itself is not byte-stable across separate
// generation runs even without any code change — the entries' actual content
// is the outcome's own allowlisted content, and is what must stay stable.
//
// `js/sameview-comparison.js`'s expected hash was updated once, deliberately,
// for docs/IMPLEMENTATION_PLAN_V1.md Phase 13 ("Shared Runtime
// Multiple-Instance Safety") — the exact same embedded-runtime-script change
// documented on the Standalone HTML test above. Every other entry below,
// especially `index.html`, was verified unchanged before this update and
// must stay exactly as it was.
test("Static Microsite entry contents for the default fixture configuration remain byte-for-byte unchanged across unrelated Outcome Snapshot changes (Phase 11 regression guard)", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);
	await page.getByTestId("output-card-static-microsite").click();

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	const zipBytes = new Uint8Array(readFileSync(await download.path()));
	const zipReader = new ZipReader(new Uint8ArrayReader(zipBytes));
	const entries = await zipReader.getEntries();
	const hashes: Record<string, string> = {};
	for (const entry of [...entries].sort((a, b) =>
		a.filename.localeCompare(b.filename),
	)) {
		if (entry.directory) continue;
		const content = await entry.getData(new Uint8ArrayWriter());
		hashes[entry.filename] = sha256Hex(content);
	}
	await zipReader.close();

	expect(hashes).toEqual({
		"css/sameview-comparison.css":
			"9684cd9ec3123f1dbda7860ea7a43b08a8f91f8ce2ec6047da52cb2fb0f6b646",
		"favicon.svg":
			"b6cb258303f8f2152872f2d8be876c68b814b88ee5815a29df3de6ac932e430e",
		"fonts/InterVariable.woff2":
			"693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3",
		"fonts/LICENSE.txt":
			"262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a",
		"images/branding.png":
			"5b3509644714449696e358c63208577ef242728257f186b14eff645ca9a0d392",
		"images/capture.jpg":
			"923cd17ea10e2c6f298c9fbff21445a8d06af63bb52fb55e6f0a62961f492dde",
		"images/reference.jpg":
			"2b44c9683150071c833cb3c4d616cd1085eb08e504122d6879baaa973f3a2668",
		"index.html":
			"3b0dd723677a238fc1f9d2c399f92af1b50d57e4734eeeeb9beccde07188fbc1",
		"js/sameview-comparison.js":
			"95ca28f46a15d57e7f9902df5b42a3bf93c039f9656670db7e69e32b879e27a1",
	});
});
