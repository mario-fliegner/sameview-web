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

// docs/APPLICATION_LAYOUT.md "Structure": "Presentation: collapsed by
// default" — its controls only exist in the DOM once expanded.
async function expandPresentationSection(
	page: import("@playwright/test").Page,
) {
	await page.getByTestId("edit-inspector-presentation-toggle").click();
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

// Presentation Configuration (docs/COMPARISON_PRESENTATION.md Part 3:
// Background, Frame, Corner Radius, Text, Show Slider Date Labels only —
// Map Preview is a separate, later iteration and has no control here).

test("the Presentation section renders with the documented defaults: Brand background, no Frame, Rounded corners, Automatic text, Show Slider Date Labels on", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);

	await expect(
		page.getByTestId("edit-presentation-background-brand"),
	).toHaveAttribute("aria-checked", "true");
	await expect(
		page.getByTestId("edit-presentation-frame-none"),
	).toHaveAttribute("aria-checked", "true");
	await expect(
		page.getByTestId("edit-presentation-corners-rounded"),
	).toHaveAttribute("aria-checked", "true");
	await expect(
		page.getByTestId("edit-presentation-text-automatic"),
	).toHaveAttribute("aria-checked", "true");
	await expect(
		page.getByTestId("edit-show-slider-date-labels"),
	).toHaveAttribute("aria-checked", "true");
	// No control for Map Preview exists in this iteration.
	await expect(page.getByText(/map preview/i)).toHaveCount(0);
});

test("selecting Background updates the Presentation Canvas immediately", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);

	await page.getByTestId("edit-presentation-background-black").click();
	await expect(page.locator(".presentation-canvas")).toHaveCSS(
		"background-color",
		"rgb(0, 0, 0)",
	);
	await expect(
		page.getByTestId("edit-presentation-background-black"),
	).toHaveAttribute("aria-checked", "true");
	await expect(
		page.getByTestId("edit-presentation-background-brand"),
	).toHaveAttribute("aria-checked", "false");
});

test("selecting Background: Custom expands a 'Custom color' panel with a color field and a HEX input; other options hide it again", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);

	await expect(page.locator(".presentation-custom-color")).toHaveCount(0);

	await page.getByTestId("edit-presentation-background-custom").click();
	await expect(page.locator(".presentation-custom-color")).toBeVisible();
	await expect(
		page.getByTestId("edit-presentation-background-custom-color-swatch"),
	).toBeVisible();
	await expect(
		page.getByTestId("edit-presentation-background-custom-color-hex-input"),
	).toBeVisible();

	await page.getByTestId("edit-presentation-background-white").click();
	await expect(page.locator(".presentation-custom-color")).toHaveCount(0);
});

test("the HEX input accepts a value with or without a leading #, normalized to uppercase #RRGGBB", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);
	await page.getByTestId("edit-presentation-background-custom").click();

	const hexInput = page.getByTestId(
		"edit-presentation-background-custom-color-hex-input",
	);
	await hexInput.fill("ff00ff");
	await expect(page.locator(".presentation-canvas")).toHaveCSS(
		"background-color",
		"rgb(255, 0, 255)",
	);

	await hexInput.fill("#00ff00");
	await expect(page.locator(".presentation-canvas")).toHaveCSS(
		"background-color",
		"rgb(0, 255, 0)",
	);
});

test("an invalid HEX value never changes the preview, keeps the last valid color, and shows only a subtle error state with no explanatory text", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);
	await page.getByTestId("edit-presentation-background-custom").click();

	const hexInput = page.getByTestId(
		"edit-presentation-background-custom-color-hex-input",
	);
	await hexInput.fill("00ff00");
	await expect(page.locator(".presentation-canvas")).toHaveCSS(
		"background-color",
		"rgb(0, 255, 0)",
	);

	await hexInput.fill("not-a-color");
	// The preview keeps the last valid color, unchanged.
	await expect(page.locator(".presentation-canvas")).toHaveCSS(
		"background-color",
		"rgb(0, 255, 0)",
	);
	// A subtle error state (the same class every other field's error uses)…
	await expect(hexInput.locator("..")).toHaveClass(/outlined-field--error/);
	// …but no explanatory error text, unlike every other validated field
	// (docs/COMPARISON_PRESENTATION.md "Custom Color Editing").
	await expect(
		page.locator(".presentation-custom-color [role='alert']"),
	).toHaveCount(0);
});

test("Corner Radius affects the Presentation Canvas and the Comparison Stage together as one unit", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);

	await page.getByTestId("edit-presentation-corners-sharp").click();
	await expect(page.locator(".presentation-canvas")).toHaveCSS(
		"border-radius",
		"0px",
	);
	await expect(page.getByTestId("comparison-slider")).toHaveCSS(
		"border-radius",
		"0px",
	);

	await page.getByTestId("edit-presentation-corners-rounded").click();
	await expect(page.locator(".presentation-canvas")).toHaveCSS(
		"border-radius",
		"12px",
	);
	await expect(page.getByTestId("comparison-slider")).toHaveCSS(
		"border-radius",
		"12px",
	);
});

test("a visible Frame does not cause horizontal overflow and keeps the Stage symmetrically inset", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);

	await page.getByTestId("edit-presentation-frame-white").click();
	await expect(page.locator(".presentation-canvas")).toHaveCSS(
		"border-color",
		"rgb(255, 255, 255)",
	);

	const canvasBox = await page.locator(".presentation-canvas").boundingBox();
	const stageBox = await page.getByTestId("comparison-slider").boundingBox();
	if (!canvasBox || !stageBox) {
		throw new Error("canvas or stage has no bounding box");
	}
	const leftGap = stageBox.x - canvasBox.x;
	const rightGap =
		canvasBox.x + canvasBox.width - (stageBox.x + stageBox.width);
	const topGap = stageBox.y - canvasBox.y;
	expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
	expect(Math.abs(leftGap - topGap)).toBeLessThanOrEqual(1);

	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth >
			document.documentElement.clientWidth,
	);
	expect(overflow).toBe(false);
});

test("selecting Text updates the Presentation Canvas's rendered text color immediately", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);

	await page.getByTestId("edit-presentation-text-light").click();
	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"color",
		"rgb(255, 255, 255)",
	);
	await expect(
		page.getByTestId("edit-presentation-text-light"),
	).toHaveAttribute("aria-checked", "true");

	await page.getByTestId("edit-presentation-text-dark").click();
	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"color",
		"rgb(13, 20, 36)",
	);
	await expect(
		page.getByTestId("edit-presentation-text-light"),
	).toHaveAttribute("aria-checked", "false");
});

test("selecting Text: Custom expands a 'Custom color' panel with a color field and a HEX input; other options hide it again", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);

	await expect(page.locator(".presentation-custom-color")).toHaveCount(0);

	await page.getByTestId("edit-presentation-text-custom").click();
	await expect(page.locator(".presentation-custom-color")).toBeVisible();
	await expect(
		page.getByTestId("edit-presentation-text-custom-color-swatch"),
	).toBeVisible();
	await expect(
		page.getByTestId("edit-presentation-text-custom-color-hex-input"),
	).toBeVisible();

	await page.getByTestId("edit-presentation-text-light").click();
	await expect(page.locator(".presentation-custom-color")).toHaveCount(0);
});

test("the Text HEX input accepts a value with or without a leading #, normalized to uppercase #RRGGBB, and an invalid value keeps the last valid color with only a subtle error state", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);
	await page.getByTestId("edit-presentation-text-custom").click();

	const hexInput = page.getByTestId(
		"edit-presentation-text-custom-color-hex-input",
	);
	await hexInput.fill("ff00ff");
	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"color",
		"rgb(255, 0, 255)",
	);

	await hexInput.fill("#00ff00");
	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"color",
		"rgb(0, 255, 0)",
	);

	await hexInput.fill("not-a-color");
	// The preview keeps the last valid color, unchanged.
	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"color",
		"rgb(0, 255, 0)",
	);
	await expect(hexInput.locator("..")).toHaveClass(/outlined-field--error/);
});

test("toggling Show Slider Date Labels off hides the on-image reference/capture labels even when the divider position would otherwise show them", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);

	const slider = page.getByTestId("comparison-slider");
	const sliderBox = await slider.boundingBox();
	if (!sliderBox) throw new Error("comparison-slider has no bounding box");

	// Move the divider to a middle position where both on-image labels are
	// eligible to show (docs/COMPARISON_PRESENTATION.md "Slider Date Labels").
	await page.mouse.move(
		sliderBox.x + sliderBox.width / 2,
		sliderBox.y + sliderBox.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(
		sliderBox.x + sliderBox.width / 2,
		sliderBox.y + sliderBox.height / 2,
	);
	await page.mouse.up();
	await expect(page.getByTestId("comparison-slider-label-left")).toBeVisible();

	await page.getByTestId("edit-show-slider-date-labels").click();
	await expect(page.getByTestId("comparison-slider-label-left")).toHaveCount(0);
	await expect(page.getByTestId("comparison-slider-label-right")).toHaveCount(
		0,
	);
});

test("the Presentation section starts collapsed and can be expanded and re-collapsed", async ({
	page,
}) => {
	await importFullFixture(page);

	// docs/APPLICATION_LAYOUT.md "Structure": "Presentation: collapsed by
	// default" — its controls do not exist in the DOM until expanded.
	const toggle = page.getByTestId("edit-inspector-presentation-toggle");
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(
		page.getByTestId("edit-presentation-background-brand"),
	).toHaveCount(0);

	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	await expect(
		page.getByTestId("edit-presentation-background-brand"),
	).toBeVisible();

	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(
		page.getByTestId("edit-presentation-background-brand"),
	).toHaveCount(0);
});

// docs/APPLICATION_LAYOUT.md "Structure": "The Edit Inspector itself is
// only a vertical layout container for these sections. It does not present
// a single shared bordered panel around all of them. Each section has its
// own panel surface: its own border, its own background, its own padding,
// its own heading and its own independent collapse control. A clear visual
// gap separates each section from the next."
test("Comparison Information starts expanded and Presentation starts collapsed, each in its own separated panel", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(
		page.getByTestId("edit-inspector-comparison-information-toggle"),
	).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByTestId("edit-title-input")).toBeVisible();

	await expect(
		page.getByTestId("edit-inspector-presentation-toggle"),
	).toHaveAttribute("aria-expanded", "false");
	await expect(
		page.getByTestId("edit-presentation-background-brand"),
	).toHaveCount(0);

	// Each section is its own panel; the outer `.edit-inspector` is only a
	// layout container and must carry none of that panel styling itself.
	const sections = page.locator(".edit-inspector__section");
	await expect(sections).toHaveCount(2);
	for (let i = 0; i < 2; i++) {
		const style = await sections.nth(i).evaluate((el) => {
			const cs = getComputedStyle(el);
			return {
				borderWidth: cs.borderTopWidth,
				background: cs.backgroundColor,
			};
		});
		expect(style.borderWidth).not.toBe("0px");
		expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
	}

	const outerStyle = await page.getByTestId("edit-inspector").evaluate((el) => {
		const cs = getComputedStyle(el);
		return {
			borderWidth: cs.borderTopWidth,
			background: cs.backgroundColor,
		};
	});
	expect(outerStyle.borderWidth).toBe("0px");
	expect(outerStyle.background).toBe("rgba(0, 0, 0, 0)");

	// A measurable visual gap separates the two section panels.
	const firstBox = await sections.nth(0).boundingBox();
	const secondBox = await sections.nth(1).boundingBox();
	if (!firstBox || !secondBox) {
		throw new Error("section has no bounding box");
	}
	const gap = secondBox.y - (firstBox.y + firstBox.height);
	expect(gap).toBeGreaterThan(4);
});

// docs/APPLICATION_LAYOUT.md "Structure": "The Edit Inspector behaves as a
// focused accordion: at most one section may be open at a time... Opening a
// closed section automatically closes whichever section was previously
// open."
test("opening Presentation automatically closes Comparison Information, and its own controls remain usable", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(
		page.getByTestId("edit-inspector-comparison-information-toggle"),
	).toHaveAttribute("aria-expanded", "true");

	await expandPresentationSection(page);

	await expect(
		page.getByTestId("edit-inspector-comparison-information-toggle"),
	).toHaveAttribute("aria-expanded", "false");
	await expect(page.getByTestId("edit-title-input")).toHaveCount(0);
	await expect(
		page.getByTestId("edit-inspector-presentation-toggle"),
	).toHaveAttribute("aria-expanded", "true");

	// Presentation's own controls are fully usable after switching to it.
	await page.getByTestId("edit-presentation-background-black").click();
	await expect(page.locator(".presentation-canvas")).toHaveCSS(
		"background-color",
		"rgb(0, 0, 0)",
	);
});

test("opening Comparison Information automatically closes Presentation, and its own controls remain usable", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);
	await expect(
		page.getByTestId("edit-inspector-presentation-toggle"),
	).toHaveAttribute("aria-expanded", "true");

	await page
		.getByTestId("edit-inspector-comparison-information-toggle")
		.click();

	await expect(
		page.getByTestId("edit-inspector-presentation-toggle"),
	).toHaveAttribute("aria-expanded", "false");
	await expect(
		page.getByTestId("edit-presentation-background-brand"),
	).toHaveCount(0);
	await expect(
		page.getByTestId("edit-inspector-comparison-information-toggle"),
	).toHaveAttribute("aria-expanded", "true");

	// Comparison Information's own controls are fully usable after switching
	// back to it.
	await expect(page.getByTestId("comparison-title")).toHaveText(
		"White and black wall portait",
	);
	await page.getByTestId("edit-title-input").fill("A brand new title");
	await expect(page.getByTestId("comparison-title")).toHaveText(
		"A brand new title",
	);
});

test("clicking the currently open section again closes it, leaving no section open", async ({
	page,
}) => {
	await importFullFixture(page);

	const comparisonInformationToggle = page.getByTestId(
		"edit-inspector-comparison-information-toggle",
	);
	const presentationToggle = page.getByTestId(
		"edit-inspector-presentation-toggle",
	);

	await comparisonInformationToggle.click();
	await expect(comparisonInformationToggle).toHaveAttribute(
		"aria-expanded",
		"false",
	);
	await expect(presentationToggle).toHaveAttribute("aria-expanded", "false");
	await expect(page.getByTestId("edit-title-input")).toHaveCount(0);
	await expect(
		page.getByTestId("edit-presentation-background-brand"),
	).toHaveCount(0);
});

test("replacing the workspace resets Presentation Configuration to the documented defaults", async ({
	page,
}) => {
	await importFullFixture(page);
	await expandPresentationSection(page);

	await page.getByTestId("edit-presentation-background-black").click();
	await page.getByTestId("edit-presentation-corners-sharp").click();
	await page.getByTestId("edit-presentation-text-dark").click();
	await expect(
		page.getByTestId("edit-presentation-background-black"),
	).toHaveAttribute("aria-checked", "true");

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});
	await page.getByTestId("replace-confirm-button").click();
	await expect(page.getByTestId("replace-confirm-dialog")).toHaveCount(0);
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});

	// The replacement remounts the Edit Inspector, so Presentation is
	// collapsed again (its own documented default) and must be reopened.
	await expandPresentationSection(page);
	await expect(
		page.getByTestId("edit-presentation-background-brand"),
	).toHaveAttribute("aria-checked", "true");
	await expect(
		page.getByTestId("edit-presentation-corners-rounded"),
	).toHaveAttribute("aria-checked", "true");
	await expect(
		page.getByTestId("edit-presentation-text-automatic"),
	).toHaveAttribute("aria-checked", "true");
});
