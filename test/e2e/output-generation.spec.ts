// Real-application coverage for Generate Comparison Output (F-005;
// docs/IMPLEMENTATION_PLAN_V1.md Phase 9) — src/components/OutputInspector.tsx,
// src/lib/generate-comparison-output.ts, generate-standalone-html.ts,
// generate-static-microsite.ts and src/lib/trigger-download.ts.
//
// Uses sample-v6-session_full.zip, the same fixture test/e2e/comparison-editing.spec.ts
// uses, so the generated artifacts always have a real title/description/
// location/date to render and assert against.

import { mkdtempSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";

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

test("Create Output opens the Output Inspector with Standalone HTML selected, Remove Embedded Location Data on, and CMS Package shown but not selectable", async ({
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

	const cmsCard = page.getByTestId("output-card-cms-package");
	await expect(cmsCard).toBeVisible();
	await expect(cmsCard).toHaveAttribute("aria-disabled", "true");
	// A plain <div>, not a <button> — genuinely unclickable, not just visually
	// disabled.
	await expect(cmsCard).not.toHaveJSProperty("tagName", "BUTTON");
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

test("generating the Standalone HTML downloads sameview-comparison.html, shows a non-claiming Completion state, and Download again re-downloads identical bytes without regenerating", async ({
	page,
}) => {
	await importFullFixture(page);
	await openOutputInspector(page);

	const [firstDownload] = await Promise.all([
		page.waitForEvent("download"),
		page.getByTestId("output-primary-action").click(),
	]);
	expect(firstDownload.suggestedFilename()).toBe("sameview-comparison.html");

	await expect(page.getByTestId("output-ready")).toBeVisible();
	const readyText = await page.getByTestId("output-ready").innerText();
	// The Completion state must never assert the file was actually saved —
	// only that a download was started (Variante A, no reliable browser
	// signal exists for the former).
	expect(readyText.toLowerCase()).not.toMatch(/saved|successfully/);
	expect(readyText).toMatch(/should start automatically/i);

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
	await expect(page.getByTestId("output-ready")).toHaveCount(0);
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
