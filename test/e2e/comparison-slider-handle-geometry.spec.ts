// Regression coverage for the four confirmed Branding Handle geometry bugs
// (docs/COMPARISON_PRESENTATION.md Part 2 "Handle"; docs/FEATURE_SPECIFICATION.md
// F-004) — src/components/ComparisonSlider.tsx,
// src/components/ComparisonSliderHandle.tsx, src/lib/comparison-handle-geometry.ts:
//
// A. The divider line was painted over the handle (DOM order), so it
//    visibly cut across non-white branding content.
// B. Date-label placement used a fixed, always-standard ring radius, so
//    labels overlapped the 1.5×-enlarged branded handle.
// C. The branding content box was centered on the handle's radius (24)
//    instead of its actual center coordinate (27).
// D. A freshly selected Built-in Symbol used the app's own interactive
//    accent color instead of Android's actual #17202F.
//
// Uses sample-v6-session_full.zip specifically: the one fixture with real
// imported Android built-in branding (branding.type: "builtin",
// branding.builtinId: "star", plus its own branding-handle.png) — see
// test/fixtures/android-export/README.md. Functional/geometric assertions
// use stable `data-testid`s and computed layout, never a screenshot diff
// (no test in this suite uses one — see AI_ENGINEERING_GUIDE.md Testing).

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
	BRANDED_HANDLE_VISUAL_PX,
	getHandleVisualSizePx,
	HANDLE_ENLARGEMENT_FACTOR,
	REFERENCE_STAGE_MIN_DIMENSION_PX,
	STANDARD_HANDLE_VISUAL_PX,
} from "../../src/lib/comparison-handle-geometry.ts";

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"fixtures",
);

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 780 };
// The layout geometry this suite asserts (BRANDING_CONTENT_OFFSET_PX etc.)
// is expressed in a 54-unit SVG viewBox rendered at a 54px/81px CSS box —
// sub-pixel rounding across that scale is the only source of imprecision,
// so a small, fixed tolerance is used throughout rather than an exact
// equality that browser rounding could occasionally fail.
const CENTER_TOLERANCE_PX = 1.5;

test.beforeEach(async ({ page }) => {
	await page.setViewportSize(DESKTOP_VIEWPORT);
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

async function expandBrandingSection(page: import("@playwright/test").Page) {
	await page.getByTestId("edit-inspector-branding-toggle").click();
}

async function selectCustomImage(page: import("@playwright/test").Page) {
	await page.getByTestId("edit-branding-option-custom").click();
	await page
		.getByTestId("edit-branding-custom-input")
		.setInputFiles(join(fixturesDir, "images", "tiny-valid.png"));
	await expect(page.getByTestId("edit-branding-custom-preview")).toBeVisible();
}

// Root Cause A: the divider `<div>` must sit before (beneath, in paint
// order) the handle's own SVG in the DOM — never after it — for every
// branding kind, so the opaque ring/circle/content always occludes it and
// it is visible only through the ring's own 12° gaps.
async function expectDividerBeneathHandle(
	page: import("@playwright/test").Page,
) {
	const dividerIsBeforeHandle = await page.evaluate(() => {
		const frame = document.querySelector('[data-testid="comparison-slider"]');
		const divider = frame?.querySelector(
			'[data-testid="comparison-divider-line"]',
		);
		const handle = frame?.querySelector(".comparison-slider__handle");
		if (!frame || !divider || !handle) return false;
		const children = Array.from(frame.children);
		return children.indexOf(divider) < children.indexOf(handle);
	});
	expect(dividerIsBeforeHandle).toBe(true);
}

interface Box {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

function centerOf(box: Box): { readonly x: number; readonly y: number } {
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Root Cause C: the branding content box (a Built-in Symbol's nested <svg>
// or a raster asset's <image>) must be centered exactly on the handle's
// own center — never on its radius.
async function expectContentCenteredOnHandle(
	page: import("@playwright/test").Page,
	contentLocator: ReturnType<import("@playwright/test").Page["locator"]>,
) {
	const handleBox = await page
		.getByTestId("comparison-slider-handle")
		.boundingBox();
	const contentBox = await contentLocator.boundingBox();
	if (!handleBox || !contentBox) {
		throw new Error("handle or content has no bounding box");
	}
	const handleCenter = centerOf(handleBox);
	const contentCenter = centerOf(contentBox);
	expect(Math.abs(contentCenter.x - handleCenter.x)).toBeLessThan(
		CENTER_TOLERANCE_PX,
	);
	expect(Math.abs(contentCenter.y - handleCenter.y)).toBeLessThan(
		CENTER_TOLERANCE_PX,
	);
}

// Root Cause B: date labels must never overlap the handle as it is
// actually rendered (standard or 1.5× branding-enlarged).
async function expectLabelsOutsideHandle(
	page: import("@playwright/test").Page,
) {
	const handleBox = await page
		.getByTestId("comparison-slider-handle")
		.boundingBox();
	if (!handleBox) throw new Error("handle has no bounding box");
	for (const testId of [
		"comparison-slider-label-left",
		"comparison-slider-label-right",
	]) {
		const label = page.getByTestId(testId);
		if ((await label.count()) === 0) continue; // hidden at this divider position — nothing to assert
		const labelBox = await label.boundingBox();
		if (!labelBox) throw new Error(`${testId} has no bounding box`);
		const noHorizontalOverlap =
			labelBox.x + labelBox.width <= handleBox.x + 0.5 ||
			labelBox.x >= handleBox.x + handleBox.width - 0.5;
		expect(noHorizontalOverlap).toBe(true);
	}
}

test.describe("divider vs. branding content (Root Cause A)", () => {
	test("the divider is stacked beneath the handle for imported raster branding", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expectDividerBeneathHandle(page);
	});

	test("the divider is stacked beneath the handle for a freshly selected symbol", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);
		await page.getByTestId("edit-branding-symbol-fire").click();
		await expectDividerBeneathHandle(page);
	});

	test("the divider is stacked beneath the handle for a custom image", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);
		await selectCustomImage(page);
		await expectDividerBeneathHandle(page);
	});

	test("the divider is stacked beneath the handle with no branding", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);
		await page.getByTestId("edit-branding-option-none").click();
		await expectDividerBeneathHandle(page);
	});
});

test.describe("date labels vs. the effective handle radius (Root Cause B)", () => {
	test("labels stay outside the standard (unbranded) handle", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);
		await page.getByTestId("edit-branding-option-none").click();
		await expectLabelsOutsideHandle(page);
	});

	test("labels stay outside the 1.5×-enlarged branded handle", async ({
		page,
	}) => {
		await importFullFixture(page);
		// Imported branding (Symbol/Star) is already active from the fixture.
		await expectLabelsOutsideHandle(page);
	});
});

test.describe("symbol color (Root Cause D)", () => {
	test("a freshly selected symbol uses Android's exact #17202F, never the app accent", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);
		await page.getByTestId("edit-branding-symbol-heart").click();

		const symbolPath = page.locator(
			'[data-testid="comparison-slider-handle"] > svg > path',
		);
		const fill = await symbolPath.getAttribute("fill");
		expect(fill?.toLowerCase()).toBe("#17202f");
		expect(fill?.toLowerCase()).not.toBe("#4f8cff");
	});

	test("the standard (unbranded) arrows keep the app's own accent color", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);
		await page.getByTestId("edit-branding-option-none").click();

		const arrowPaths = page.locator(
			'[data-testid="comparison-slider-handle"] path[stroke]',
		);
		const strokes = await arrowPaths.evaluateAll((paths) =>
			paths
				.map((p) => p.getAttribute("stroke"))
				.filter((stroke) => stroke && stroke.toLowerCase() !== "#ffffff"),
		);
		expect(strokes.length).toBeGreaterThan(0);
		for (const stroke of strokes) {
			expect(stroke?.toLowerCase()).toBe("#4f8cff");
		}
	});
});

test.describe("centering (Root Cause C)", () => {
	test("a freshly selected symbol's content box is centered on the handle", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);
		await page.getByTestId("edit-branding-symbol-camera").click();

		await expectContentCenteredOnHandle(
			page,
			page.locator('[data-testid="comparison-slider-handle"] > svg'),
		);
	});

	test("a custom image's content box is centered on the handle", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);
		await selectCustomImage(page);

		await expectContentCenteredOnHandle(
			page,
			page.locator('[data-testid="comparison-slider-handle"] > image'),
		);
	});

	test("imported built-in branding's raster asset is centered on the handle", async ({
		page,
	}) => {
		await importFullFixture(page);

		await expectContentCenteredOnHandle(
			page,
			page.locator('[data-testid="comparison-slider-handle"] > image'),
		);
	});
});

// docs/COMPARISON_PRESENTATION.md Part 2 "Handle": a Custom Image or an
// imported branding image occupies 72% of the Handle's diameter; a
// Built-in Symbol occupies 57.6% — 20% smaller — while both stay exactly
// centered (already covered above).
test.describe("content size (Symbol smaller than Image)", () => {
	test("a Built-in Symbol's content box is exactly 20% smaller than a Custom Image's", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);

		// Reads the declared `width`/`height` SVG attributes (the actual
		// geometry contract src/lib/comparison-handle-geometry.ts
		// `getContentBox` controls) rather than a rendered/painted bounding
		// box: a nested <svg>'s `getBoundingClientRect()` reflects where a
		// given icon's own glyph paints within its box, which — depending on
		// that one icon's internal shape — is not reliably the full declared
		// box on every axis, even though the box itself is exactly square.
		// The <image> element has no such ambiguity, but reading both
		// elements' own attributes the same way keeps the comparison
		// content-independent on both sides.
		await selectCustomImage(page);
		const imageAttrs = await page
			.locator('[data-testid="comparison-slider-handle"] > image')
			.evaluate((el) => ({
				width: Number(el.getAttribute("width")),
				height: Number(el.getAttribute("height")),
			}));

		await page.getByTestId("edit-branding-option-symbol").click();
		await page.getByTestId("edit-branding-symbol-camera").click();
		const symbolAttrs = await page
			.locator('[data-testid="comparison-slider-handle"] > svg')
			.evaluate((el) => ({
				width: Number(el.getAttribute("width")),
				height: Number(el.getAttribute("height")),
			}));

		// Both declared in the same 54-unit viewBox coordinate system
		// (src/lib/comparison-handle-geometry.ts HANDLE_VIEWBOX_SIZE), so
		// comparing the raw attribute values directly is exact — no pixel
		// scale/rounding involved.
		assertCloseTo(symbolAttrs.width / imageAttrs.width, 0.8, 1e-9);
		assertCloseTo(symbolAttrs.height / imageAttrs.height, 0.8, 1e-9);
	});
});

function assertCloseTo(actual: number, expected: number, tolerance: number) {
	expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
}

test.describe("None ↔ Symbol ↔ Custom", () => {
	test("every transition keeps the divider beneath the handle and content centered", async ({
		page,
	}) => {
		await importFullFixture(page);
		await expandBrandingSection(page);

		// Start: imported Symbol/Star (asset).
		await expectDividerBeneathHandle(page);
		await expectContentCenteredOnHandle(
			page,
			page.locator('[data-testid="comparison-slider-handle"] > image'),
		);

		// → Symbol (freshly selected, vector).
		await page.getByTestId("edit-branding-symbol-pin").click();
		await expectDividerBeneathHandle(page);
		await expectContentCenteredOnHandle(
			page,
			page.locator('[data-testid="comparison-slider-handle"] > svg'),
		);

		// → Custom Image.
		await selectCustomImage(page);
		await expectDividerBeneathHandle(page);
		await expectContentCenteredOnHandle(
			page,
			page.locator('[data-testid="comparison-slider-handle"] > image'),
		);

		// → None.
		await page.getByTestId("edit-branding-option-none").click();
		await expectDividerBeneathHandle(page);
		await expect(page.getByTestId("comparison-slider-handle")).toHaveAttribute(
			"data-branding-kind",
			"none",
		);

		// → back to Symbol: opening it alone activates nothing
		// (docs/FEATURE_SPECIFICATION.md F-004) — an explicit tile click is
		// required before there is any content box to center.
		await page.getByTestId("edit-branding-option-symbol").click();
		await expectDividerBeneathHandle(page);
		await expect(page.getByTestId("comparison-slider-handle")).toHaveAttribute(
			"data-branding-kind",
			"none",
		);

		await page.getByTestId("edit-branding-symbol-pin").click();
		await expectDividerBeneathHandle(page);
		await expectContentCenteredOnHandle(
			page,
			page.locator('[data-testid="comparison-slider-handle"] > svg'),
		);
	});
});

test.describe("Mobile viewport", () => {
	test("labels stay outside the handle and content stays centered on a mobile viewport", async ({
		page,
	}) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await importFullFixture(page);
		await expectLabelsOutsideHandle(page);
		await expectContentCenteredOnHandle(
			page,
			page.locator('[data-testid="comparison-slider-handle"] > image'),
		);
		await expectDividerBeneathHandle(page);
	});
});

test.describe("Fullscreen", () => {
	test("labels stay outside the handle and content stays centered in Fullscreen", async ({
		page,
	}) => {
		await importFullFixture(page);
		await page.getByTestId("fullscreen-open-button").click();
		await expect(page.getByTestId("fullscreen-close-button")).toBeVisible();

		await expectLabelsOutsideHandle(page);
		await expectContentCenteredOnHandle(
			page,
			page.locator('[data-testid="comparison-slider-handle"] > image'),
		);
		await expectDividerBeneathHandle(page);
	});
});

// Confirmed regression fix (docs/COMPARISON_PRESENTATION.md Part 2 "Handle",
// "Responsive Handle Size on a Small Presentation Stage"): the Handle used
// to keep its fixed 54px/81px diameter regardless of the Comparison Stage's
// own size, making it look grotesquely oversized once the Stage shrank far
// enough (confirmed empirically: the Handle's own diameter exceeded the
// entire Stage width at some viewport sizes). `[data-testid="comparison-slider"]`
// is `.comparison-slider__frame`, whose rendered box *is* the Comparison
// Stage's own size (`--stage-width`/`--stage-height`,
// src/styles/comparison-presentation.css) — no separate Stage measurement
// exists anywhere else.
async function measureStageAndHandle(page: import("@playwright/test").Page) {
	const stage = await page
		.locator('[data-testid="comparison-slider"]')
		.boundingBox();
	const handle = await page
		.getByTestId("comparison-slider-handle")
		.boundingBox();
	if (!stage || !handle) throw new Error("stage or handle has no bounding box");
	return { stage, handle };
}

test.describe("Responsive Handle Size on a Small Presentation Stage", () => {
	test("at normal desktop size, the Handle keeps its exact documented base size — Branded (the fixture's own default) and Standard alike", async ({
		page,
	}) => {
		await importFullFixture(page);
		const { stage, handle: brandedHandle } = await measureStageAndHandle(page);
		// Confirms this test's own precondition: DESKTOP_VIEWPORT's Stage is
		// genuinely above the 200px reference, not a coincidentally-small one.
		expect(Math.min(stage.width, stage.height)).toBeGreaterThan(
			REFERENCE_STAGE_MIN_DIMENSION_PX,
		);
		expect(brandedHandle.width).toBeCloseTo(BRANDED_HANDLE_VISUAL_PX, 0);
		expect(brandedHandle.height).toBeCloseTo(BRANDED_HANDLE_VISUAL_PX, 0);

		await expandBrandingSection(page);
		await page.getByTestId("edit-branding-option-none").click();
		const { handle: standardHandle } = await measureStageAndHandle(page);
		expect(standardHandle.width).toBeCloseTo(STANDARD_HANDLE_VISUAL_PX, 0);
		expect(standardHandle.height).toBeCloseTo(STANDARD_HANDLE_VISUAL_PX, 0);
	});

	test("on a heavily shrunk Presentation Stage, the Handle's rendered size matches the shared formula exactly, stays exactly HANDLE_ENLARGEMENT_FACTOR x for Branded, and the existing divider/label geometry invariants still hold", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 800, height: 500 });
		await importFullFixture(page);

		const { stage: brandedStage, handle: brandedHandle } =
			await measureStageAndHandle(page);
		// Confirms this genuinely exercises the scaling/floor path, not a
		// coincidentally still-large Stage.
		expect(Math.min(brandedStage.width, brandedStage.height)).toBeLessThan(
			REFERENCE_STAGE_MIN_DIMENSION_PX,
		);
		const expectedBranded = getHandleVisualSizePx(
			brandedStage.width,
			brandedStage.height,
			true,
		);
		expect(brandedHandle.width).toBeCloseTo(expectedBranded, 0);
		expect(brandedHandle.width).toBeLessThan(BRANDED_HANDLE_VISUAL_PX);

		await expandBrandingSection(page);
		await page.getByTestId("edit-branding-option-none").click();
		const { stage: standardStage, handle: standardHandle } =
			await measureStageAndHandle(page);
		const expectedStandard = getHandleVisualSizePx(
			standardStage.width,
			standardStage.height,
			false,
		);
		expect(standardHandle.width).toBeCloseTo(expectedStandard, 0);

		// The two measurements above come from two independently rendered
		// moments (a real branding switch in between) — a tolerant ratio check
		// rather than `toBeCloseTo`'s tight precision, since the Stage's own
		// size can shift by a sub-pixel amount between them.
		const ratio = brandedHandle.width / standardHandle.width;
		expect(Math.abs(ratio - HANDLE_ENLARGEMENT_FACTOR)).toBeLessThan(0.05);

		// Root Cause A/B still hold at this scaled-down size — the ring radius
		// driving label placement must reflect the Handle's own actually
		// rendered (now smaller) size, never the old fixed assumption.
		await expectDividerBeneathHandle(page);
		await expectLabelsOutsideHandle(page);
	});

	test("live-resizes the Handle without a reload as the viewport shrinks and grows again", async ({
		page,
	}) => {
		await importFullFixture(page);
		const { handle: normalHandle } = await measureStageAndHandle(page);
		expect(normalHandle.width).toBeCloseTo(BRANDED_HANDLE_VISUAL_PX, 0);

		await page.setViewportSize({ width: 800, height: 500 });
		await expect
			.poll(async () => {
				const box = await page
					.getByTestId("comparison-slider-handle")
					.boundingBox();
				return box?.width;
			})
			.toBeLessThan(BRANDED_HANDLE_VISUAL_PX - 1);

		await page.setViewportSize(DESKTOP_VIEWPORT);
		await expect
			.poll(async () => {
				const box = await page
					.getByTestId("comparison-slider-handle")
					.boundingBox();
				return box?.width;
			})
			.toBeCloseTo(BRANDED_HANDLE_VISUAL_PX, 0);
	});
});
