// Real-application coverage for Edit Comparison / Comparison Information
// (docs/FEATURE_SPECIFICATION.md F-003; docs/IMPLEMENTATION_PLAN_V1.md
// Phase 5) — src/components/EditInspector.tsx,
// ComparisonInformationSection.tsx and ComparisonPresentationInfo.tsx.
//
// Uses sample-v6-session_full.zip specifically: the one fixture with
// content.title, content.description, location.* and a reference.date set
// (test/fixtures/android-export/README.md), so every editable field already
// has a starting value to edit. Functional assertions use stable
// `data-testid`s, never translated copy (docs/AI_ENGINEERING_GUIDE.md
// Testing; see also test/e2e/comparison-viewer.spec.ts).

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

test("editing the title updates the Presentation Preview immediately, with no Apply action", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(page.getByTestId("comparison-title")).toHaveText(
		"White and black wall portait",
	);

	await page.getByTestId("edit-title-input").fill("A brand new title");

	await expect(page.getByTestId("comparison-title")).toHaveText(
		"A brand new title",
	);
});

test("editing location fields updates the rendered location live, in the documented format", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(page.getByTestId("comparison-location")).toHaveText(
		"This Is A Place Name · City Name, Country Name",
	);

	await page.getByTestId("edit-location-city-input").fill("Munich");

	await expect(page.getByTestId("comparison-location")).toHaveText(
		"This Is A Place Name · Munich, Country Name",
	);
});

test("editing the reference date updates the rendered time line live", async ({
	page,
}) => {
	await importFullFixture(page);

	// reference.date is "2024" (YYYY precision) in this fixture.
	await expect(page.getByTestId("comparison-reference-label")).toHaveText(
		"2024",
	);

	await page.getByTestId("edit-reference-date-input").fill("2024-05-06");

	await expect(page.getByTestId("comparison-reference-label")).toHaveText(
		"May 6, 2024",
	);
});

test("an invalid reference date shows a validation error and does not change the preview", async ({
	page,
}) => {
	await importFullFixture(page);

	await page.getByTestId("edit-reference-date-input").fill("2024-13-40");

	await expect(page.locator("#edit-reference-date-error")).toBeVisible();
	// The invalid edit never partially applies: the preview keeps showing the
	// last valid value.
	await expect(page.getByTestId("comparison-reference-label")).toHaveText(
		"2024",
	);
});

test("the Capture Date field is read-only and always matches the rendered capture label", async ({
	page,
}) => {
	await importFullFixture(page);

	const captureField = page.getByTestId("edit-capture-date-input");
	await expect(captureField).toHaveAttribute("readonly", "");

	const renderedCaptureLabel = await page
		.getByTestId("comparison-capture-label")
		.textContent();
	await expect(captureField).toHaveValue(renderedCaptureLabel ?? "");
});

test("Show Description defaults to off; toggling it shows the value without discarding it (hide differs from remove)", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(page.getByTestId("comparison-description")).toHaveCount(0);
	await expect(page.getByTestId("edit-description-input")).toHaveValue(
		"This is a description. Portrait format.",
	);

	await page.getByTestId("edit-show-description").click();
	await expect(page.getByTestId("comparison-description")).toHaveText(
		"This is a description. Portrait format.",
	);

	await page.getByTestId("edit-show-description").click();
	await expect(page.getByTestId("comparison-description")).toHaveCount(0);
	// Hiding again never cleared the underlying value.
	await expect(page.getByTestId("edit-description-input")).toHaveValue(
		"This is a description. Portrait format.",
	);
});

test("Show Title toggles visibility without discarding the title value", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(page.getByTestId("comparison-title")).toBeVisible();

	await page.getByTestId("edit-show-title").click();
	await expect(page.getByTestId("comparison-title")).toHaveCount(0);
	await expect(page.getByTestId("edit-title-input")).toHaveValue(
		"White and black wall portait",
	);

	await page.getByTestId("edit-show-title").click();
	await expect(page.getByTestId("comparison-title")).toHaveText(
		"White and black wall portait",
	);
});

test("Show Time hides the complete rendered time block as one unit", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(page.getByTestId("comparison-time")).toBeVisible();

	await page.getByTestId("edit-show-time").click();

	await expect(page.getByTestId("comparison-time")).toHaveCount(0);
});

test("a single Show Location switch controls the complete rendered location, independent of the individual fields", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(page.getByTestId("comparison-location")).toBeVisible();

	await page.getByTestId("edit-show-location").click();
	await expect(page.getByTestId("comparison-location")).toHaveCount(0);
	// The three underlying field values are untouched by the visibility toggle.
	await expect(
		page.getByTestId("edit-location-display-name-input"),
	).toHaveValue("This Is A Place Name");
	await expect(page.getByTestId("edit-location-city-input")).toHaveValue(
		"City Name",
	);
	await expect(page.getByTestId("edit-location-country-input")).toHaveValue(
		"Country Name",
	);
});

test("switches are keyboard-operable", async ({ page }) => {
	await importFullFixture(page);

	const showTitleSwitch = page.getByTestId("edit-show-title");
	await expect(showTitleSwitch).toHaveAttribute("aria-checked", "true");

	await showTitleSwitch.focus();
	await page.keyboard.press("Enter");

	await expect(showTitleSwitch).toHaveAttribute("aria-checked", "false");
	await expect(page.getByTestId("comparison-title")).toHaveCount(0);
});

test("the Comparison Information section can be collapsed and re-expanded", async ({
	page,
}) => {
	await importFullFixture(page);

	const toggle = page.getByTestId(
		"edit-inspector-comparison-information-toggle",
	);
	await expect(page.getByTestId("edit-title-input")).toBeVisible();

	await toggle.click();
	await expect(page.getByTestId("edit-title-input")).toHaveCount(0);

	await toggle.click();
	await expect(page.getByTestId("edit-title-input")).toBeVisible();
});

test("editing never modifies Source Data or the capture timestamp: replacing the workspace resets every edited field", async ({
	page,
}) => {
	await importFullFixture(page);

	await page.getByTestId("edit-title-input").fill("Temporary edit");
	await expect(page.getByTestId("comparison-title")).toHaveText(
		"Temporary edit",
	);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});
	await page.getByTestId("replace-confirm-button").click();
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});

	// The minimal fixture has no content.title: the edit made to the previous
	// workspace must not leak into the replacement.
	await expect(page.getByTestId("edit-title-input")).toHaveValue("");
});

// Layout regression coverage (docs/APPLICATION_LAYOUT.md "Common Control
// Rules", "Edit Inspector"; docs/COMPARISON_PRESENTATION.md Part 2) for a
// defect fixed after visual review: Show Time and Show Location previously
// landed at the far left instead of sharing the other switches' right edge,
// and the rendered Comparison Information was not aligned with the
// Comparison Stage it belongs to. Geometry-based, not screenshot-based, so
// these stay meaningful after unrelated copy or styling changes.

test("all four Comparison Information visibility switches share the same horizontal position", async ({
	page,
}) => {
	await importFullFixture(page);

	const switchIds = [
		"edit-show-title",
		"edit-show-description",
		"edit-show-time",
		"edit-show-location",
	];
	const boxes = await Promise.all(
		switchIds.map((id) => page.getByTestId(id).boundingBox()),
	);
	const xs = boxes.map((box) => {
		if (!box) throw new Error("switch has no bounding box");
		return box.x;
	});
	const [firstX, ...restX] = xs;
	if (firstX === undefined) throw new Error("no switches measured");
	for (const x of restX) {
		expect(Math.abs(x - firstX)).toBeLessThanOrEqual(1);
	}
});

test("Reference Date and Capture Date use the same (solid) border style", async ({
	page,
}) => {
	await importFullFixture(page);

	const referenceStyle = await page
		.getByTestId("edit-reference-date-input")
		.evaluate((element) => getComputedStyle(element).borderStyle);
	const captureStyle = await page
		.getByTestId("edit-capture-date-input")
		.evaluate((element) => getComputedStyle(element).borderStyle);

	expect(referenceStyle).toBe("solid");
	expect(captureStyle).toBe("solid");
});

test("the rendered Comparison Information shares the Comparison Stage's horizontal bounds (one Presentation Canvas)", async ({
	page,
}) => {
	await importFullFixture(page);

	const stageBox = await page.getByTestId("comparison-slider").boundingBox();
	const infoBox = await page
		.getByTestId("comparison-presentation-info")
		.boundingBox();
	if (!stageBox || !infoBox) {
		throw new Error(
			"Comparison Stage or Presentation Information has no bounding box",
		);
	}

	expect(Math.abs(infoBox.x - stageBox.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(infoBox.width - stageBox.width)).toBeLessThanOrEqual(1);
});

test("the Edit Inspector still fills nearly the full width of its own column, flush with its left edge", async ({
	page,
}) => {
	await importFullFixture(page);

	const layoutBox = await page
		.locator(".workspace-active__layout")
		.boundingBox();
	const inspectorBox = await page.getByTestId("edit-inspector").boundingBox();
	if (!layoutBox || !inspectorBox) {
		throw new Error("layout or inspector has no bounding box");
	}

	// Flush with the right edge of the two-column grid (its own column's
	// right boundary).
	expect(
		Math.abs(
			inspectorBox.x + inspectorBox.width - (layoutBox.x + layoutBox.width),
		),
	).toBeLessThanOrEqual(1);
	// Occupies close to the documented fixed 50 % share of the grid
	// (docs/APPLICATION_LAYOUT.md "Responsive Layout"), independent of the
	// comparison image orientation; slightly under 50 % is expected since
	// the inter-column gap itself takes up part of the grid's own width.
	expect(inspectorBox.width / layoutBox.width).toBeGreaterThan(0.45);
	expect(inspectorBox.width / layoutBox.width).toBeLessThan(0.51);
});
