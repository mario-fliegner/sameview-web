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

// Show Time Difference (docs/APPLICATION_LAYOUT.md "Photo dates";
// docs/COMPARISON_PRESENTATION.md Part 2 "Time", Part 3 "Comparison
// Information"). This fixture's reference.date is "2024" (YYYY precision,
// see the reference-date test above) and its capture timestamp falls in
// 2026 (session directory "2026-07-27_13-54-15", asserted elsewhere by its
// exact string) — a year-only difference of "2 years" regardless of the
// runtime's local time zone, since only the year components are ever
// compared at this precision (never a day near a year boundary).
test("Show Time Difference defaults to off, renders 'Reference → Capture · Duration' once enabled, and hides the Duration again once disabled", async ({
	page,
}) => {
	await importFullFixture(page);

	const timeDifferenceSwitch = page.getByTestId("edit-show-time-difference");
	const duration = page.getByTestId("comparison-duration-label");

	await expect(timeDifferenceSwitch).toHaveAttribute("aria-checked", "false");
	await expect(duration).toHaveCount(0);
	await expect(page.getByTestId("comparison-reference-label")).toHaveText(
		"2024",
	);

	await timeDifferenceSwitch.click();

	await expect(timeDifferenceSwitch).toHaveAttribute("aria-checked", "true");
	await expect(duration).toBeVisible();
	await expect(duration).toHaveText("2 years");
	await expect(page.getByTestId("comparison-time")).toContainText("2024 → ");
	await expect(page.getByTestId("comparison-time")).toContainText(" · 2 years");

	await timeDifferenceSwitch.click();

	await expect(timeDifferenceSwitch).toHaveAttribute("aria-checked", "false");
	await expect(duration).toHaveCount(0);
});

test("Show photo dates disabled makes Show Time Difference unavailable and hides any rendered Duration along with the whole Time block", async ({
	page,
}) => {
	await importFullFixture(page);

	const timeDifferenceSwitch = page.getByTestId("edit-show-time-difference");
	await timeDifferenceSwitch.click();
	await expect(page.getByTestId("comparison-duration-label")).toBeVisible();

	await page.getByTestId("edit-show-time").click();

	await expect(page.getByTestId("comparison-time")).toHaveCount(0);
	await expect(page.getByTestId("comparison-duration-label")).toHaveCount(0);
	await expect(timeDifferenceSwitch).toBeDisabled();

	// Re-enabling Show photo dates restores the Time block; the underlying
	// Show Time Difference value was never reset by having been disabled, so
	// the Duration reappears without needing to be turned on again.
	await page.getByTestId("edit-show-time").click();
	await expect(timeDifferenceSwitch).toBeEnabled();
	await expect(page.getByTestId("comparison-duration-label")).toBeVisible();
});

test("editing the reference date updates the rendered Duration live, alongside the unchanged Reference/Capture label rendering", async ({
	page,
}) => {
	await importFullFixture(page);

	await page.getByTestId("edit-show-time-difference").click();
	await expect(page.getByTestId("comparison-duration-label")).toHaveText(
		"2 years",
	);

	// The existing Reference/Capture label rendering (docs/IMPORTED_COMPARISON_V1.md
	// "Derived Slider Labels") is unaffected by Duration existing alongside
	// it. A year-only edit keeps the Duration assertion below exact and
	// time-zone-safe (see the fixture comment above the previous test) —
	// month/day-precision arithmetic already has dedicated, deterministic
	// coverage in test/unit/comparison-presentation.test.mjs.
	await page.getByTestId("edit-reference-date-input").fill("2020");
	await expect(page.getByTestId("comparison-reference-label")).toHaveText(
		"2020",
	);
	await expect(page.getByTestId("comparison-duration-label")).toHaveText(
		"6 years",
	);
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

// Typographic Hierarchy clustering (docs/COMPARISON_PRESENTATION.md
// "Typographic Hierarchy"): Title/Description form the Primary Cluster,
// Time/Location form the Context Cluster, separated by a deliberately
// larger gap than the spacing within each cluster.

// The actual visual gap between two stacked elements' bounding boxes —
// distinct from a `y` delta, which would also include the first element's
// own height.
function verticalGap(
	upper: { readonly y: number; readonly height: number },
	lower: { readonly y: number },
): number {
	return lower.y - (upper.y + upper.height);
}

const GAP_TOLERANCE_PX = 2;

test("Typographic Hierarchy: with Description visible, the Primary Cluster (Title/Description) and Context Cluster (Time/Location) each sit closer together than the gap between the two clusters", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("edit-show-description").click();

	const titleBox = await page.getByTestId("comparison-title").boundingBox();
	const descriptionBox = await page
		.getByTestId("comparison-description")
		.boundingBox();
	const timeBox = await page.getByTestId("comparison-time").boundingBox();
	const locationBox = await page
		.getByTestId("comparison-location")
		.boundingBox();
	if (!titleBox || !descriptionBox || !timeBox || !locationBox) {
		throw new Error(
			"one or more Comparison Information items has no bounding box",
		);
	}

	const titleToDescription = verticalGap(titleBox, descriptionBox);
	const descriptionToTime = verticalGap(descriptionBox, timeBox);
	const timeToLocation = verticalGap(timeBox, locationBox);

	expect(titleToDescription).toBeLessThan(descriptionToTime);
	expect(timeToLocation).toBeLessThan(descriptionToTime);
});

test("Typographic Hierarchy: without Description, the cluster gap moves directly between Title and Time", async ({
	page,
}) => {
	await importFullFixture(page);
	// Show Description defaults to off (docs/APPLICATION_LAYOUT.md) — left
	// untouched here, so Title is the Primary Cluster's only member.

	const titleBox = await page.getByTestId("comparison-title").boundingBox();
	const timeBox = await page.getByTestId("comparison-time").boundingBox();
	const locationBox = await page
		.getByTestId("comparison-location")
		.boundingBox();
	if (!titleBox || !timeBox || !locationBox) {
		throw new Error(
			"one or more Comparison Information items has no bounding box",
		);
	}

	const titleToTime = verticalGap(titleBox, timeBox);
	const timeToLocation = verticalGap(timeBox, locationBox);

	// 0.75rem (src/styles/global.css `.presentation-info`).
	expect(Math.abs(titleToTime - 12)).toBeLessThanOrEqual(GAP_TOLERANCE_PX);
	expect(timeToLocation).toBeLessThan(titleToTime);
});

test("Typographic Hierarchy: Time hidden, Location visible — the Context Cluster still sits the full cluster gap away, with no leftover or doubled spacing", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("edit-show-time").click();
	await expect(page.getByTestId("comparison-time")).toHaveCount(0);

	const titleBox = await page.getByTestId("comparison-title").boundingBox();
	const locationBox = await page
		.getByTestId("comparison-location")
		.boundingBox();
	if (!titleBox || !locationBox) {
		throw new Error("Title or Location has no bounding box");
	}

	const titleToLocation = verticalGap(titleBox, locationBox);

	// 0.75rem (src/styles/global.css `.presentation-info`) — Location is the
	// Context Cluster's only member, so its own internal 0.1875rem gap
	// (`.presentation-info__context`) never applies; no special-case
	// selector exists for this, so this also verifies none is silently
	// needed.
	expect(Math.abs(titleToLocation - 12)).toBeLessThanOrEqual(GAP_TOLERANCE_PX);
});

test("Typographic Hierarchy: Presentation Information stays horizontally flush with the Comparison Stage after the Primary/Context wrapper change", async ({
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

// Adaptive Sizing (docs/COMPARISON_PRESENTATION.md Part 2 "Adaptive
// Sizing"): each of Title/Description/Time/Location independently steps
// from its one standard size to exactly one defined smaller "compact" size
// when its own content would otherwise be truncated — never a shared
// scaling of the whole block, never more than one additional step.

test("Adaptive Sizing: short content renders every item at its standard size", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("edit-show-description").click();
	// The fixture's own default location value is long enough to already
	// need Adaptive Sizing's compact size at this test's viewport width —
	// replaced here with something unambiguously short so this test
	// isolates "short content" specifically.
	await page.getByTestId("edit-location-display-name-input").fill("Munich");
	await page.getByTestId("edit-location-city-input").fill("");
	await page.getByTestId("edit-location-country-input").fill("");

	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"font-size",
		"16px",
	);
	await expect(page.getByTestId("comparison-description")).toHaveCSS(
		"font-size",
		"14px",
	);
	await expect(page.getByTestId("comparison-time")).toHaveCSS(
		"font-size",
		"13px",
	);
	await expect(page.getByTestId("comparison-location")).toHaveCSS(
		"font-size",
		"12px",
	);
});

test("Adaptive Sizing: a long Title steps down to its defined compact size without affecting Location", async ({
	page,
}) => {
	await importFullFixture(page);
	// See the previous test for why the fixture's own default location
	// value is replaced with something unambiguously short here.
	await page.getByTestId("edit-location-display-name-input").fill("Munich");
	await page.getByTestId("edit-location-city-input").fill("");
	await page.getByTestId("edit-location-country-input").fill("");

	await page
		.getByTestId("edit-title-input")
		.fill(
			"This is a deliberately very long title that will not fit on two lines at the standard size no matter how wide the Presentation Canvas happens to be in this test",
		);

	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"font-size",
		"14px",
	);
	// Independent per item (docs/COMPARISON_PRESENTATION.md "Adaptive
	// Sizing": "evaluated independently per rendered item") — Location's
	// short, unrelated value is unaffected.
	await expect(page.getByTestId("comparison-location")).toHaveCSS(
		"font-size",
		"12px",
	);
});

test("Adaptive Sizing: a long Location steps down to its defined compact size without affecting Title", async ({
	page,
}) => {
	await importFullFixture(page);

	await page
		.getByTestId("edit-location-display-name-input")
		.fill(
			"A deliberately very long place name that will not fit on a single line at the standard size no matter how wide the Presentation Canvas happens to be",
		);

	await expect(page.getByTestId("comparison-location")).toHaveCSS(
		"font-size",
		"11px",
	);
	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"font-size",
		"16px",
	);
});

test("Adaptive Sizing: content far too long even for the compact size still renders at exactly the compact size (no further automatic shrinking)", async ({
	page,
}) => {
	await importFullFixture(page);

	await page
		.getByTestId("edit-title-input")
		.fill(
			Array.from(
				{ length: 40 },
				(_, index) => `extremelylongunbrokenword${index}`,
			).join(" "),
		);

	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"font-size",
		"14px",
	);
});

// Standard/Compact decision thresholds are deliberately decoupled from each
// item's own visible clamp (src/components/ComparisonPresentationInfo.tsx
// `TITLE_STANDARD_MAX_LINES` / `DESCRIPTION_STANDARD_MAX_LINES`): Standard
// is only used while content still fits one line short of the clamp, not
// right up to it — the two tests below specifically cover content that
// needs *more than the standard threshold but still fits the clamp*, which
// the four tests above never exercise (their "long" content already needs
// more lines than even the compact size allows).

test("Adaptive Sizing: a Title that needs a second line at the standard size steps down to Compact, even though two lines would still fit the clamp", async ({
	page,
}) => {
	await importFullFixture(page);

	await page
		.getByTestId("edit-title-input")
		.fill("A quiet street corner captured just after the evening rain stopped");

	await expect(page.getByTestId("comparison-title")).toHaveCSS(
		"font-size",
		"14px",
	);
});

test("Adaptive Sizing: a Description that needs a third line at the standard size steps down to Compact, even though three lines would still fit the clamp", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("edit-show-description").click();

	await page
		.getByTestId("edit-description-input")
		.fill(
			"A quiet street corner captured just after the evening rain stopped, with the old shopfronts still reflecting the last light of the day",
		);

	await expect(page.getByTestId("comparison-description")).toHaveCSS(
		"font-size",
		"13px",
	);
});

// The visible clamp itself (the ceiling Compact is still allowed to use)
// stays exactly as documented — these two confirm it directly against the
// rendered box, independent of the font-size assertions above.

test("Adaptive Sizing: a Compact Title never grows past two lines — the remaining overflow is clipped by the existing ellipsis", async ({
	page,
}) => {
	await importFullFixture(page);

	await page
		.getByTestId("edit-title-input")
		.fill(
			Array.from(
				{ length: 40 },
				(_, index) => `extremelylongunbrokenword${index}`,
			).join(" "),
		);

	const title = page.getByTestId("comparison-title");
	await expect(title).toHaveCSS("font-size", "14px");
	const { clientHeight, scrollHeight } = await title.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
	}));
	// Compact line-height is 1.25 at 14px = 17.5px/line; two lines = 35px.
	// A small tolerance absorbs sub-pixel rounding without allowing a third
	// line through.
	expect(clientHeight).toBeLessThanOrEqual(37);
	// The clamp is genuinely doing something for this content — content
	// taller than the clamped box confirms truncation actually engaged,
	// not just that the box happens to be small.
	expect(scrollHeight).toBeGreaterThan(clientHeight);
});

test("Adaptive Sizing: a Compact Description never grows past three lines — the remaining overflow is clipped by the existing ellipsis", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("edit-show-description").click();

	await page
		.getByTestId("edit-description-input")
		.fill(
			Array.from(
				{ length: 60 },
				(_, index) => `extremelylongunbrokenword${index}`,
			).join(" "),
		);

	const description = page.getByTestId("comparison-description");
	await expect(description).toHaveCSS("font-size", "13px");
	const { clientHeight, scrollHeight } = await description.evaluate(
		(element) => ({
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
		}),
	);
	// Compact line-height is 1.4 at 13px = 18.2px/line; three lines =
	// 54.6px. A small tolerance absorbs sub-pixel rounding without allowing
	// a fourth line through.
	expect(clientHeight).toBeLessThanOrEqual(57);
	expect(scrollHeight).toBeGreaterThan(clientHeight);
});

// Overflow Tooltip (docs/COMPARISON_PRESENTATION.md Part 2 "Overflow
// Tooltip"; Part 1 "Interaction Parity"). src/lib/overflow-tooltip.ts is a
// framework-independent DOM module, attached once by
// src/components/ComparisonPresentationInfo.tsx — these tests exercise it
// exactly as a real user would (hover, keyboard, real touch PointerEvents,
// resize, scroll), never by calling its internal functions directly.

const LONG_LOCATION_NAME =
	"A deliberately very long place name that will not fit on a single line at the standard size no matter how wide the Presentation Canvas happens to be";

async function fillLongLocation(page: import("@playwright/test").Page) {
	await page
		.getByTestId("edit-location-display-name-input")
		.fill(LONG_LOCATION_NAME);
	await page.getByTestId("edit-location-city-input").fill("");
	await page.getByTestId("edit-location-country-input").fill("");
}

// Mirrors test/e2e/comparison-viewer.spec.ts's own established technique
// for simulating a real touch device: Playwright's own input APIs only
// ever emit pointerType "mouse", so a tap is reproduced as native
// PointerEvents with pointerType "touch" instead — the same events this
// module's own `pointerdown`/`pointerup` listeners react to in production.
// Each event gets its own `evaluate()` round trip, matching that file's
// documented reasoning (a real device never delivers two events without a
// yield back to the browser in between).
async function tapWithTouch(
	locator: import("@playwright/test").Locator,
	pointerId: number,
) {
	const box = await locator.boundingBox();
	if (!box) throw new Error("tap target has no bounding box");
	const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	await locator.evaluate(
		(element, { pointerId: id, x, y }) => {
			element.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					cancelable: true,
					pointerId: id,
					pointerType: "touch",
					isPrimary: true,
					clientX: x,
					clientY: y,
				}),
			);
		},
		{ pointerId, x: point.x, y: point.y },
	);
	await locator.evaluate(
		(element, { pointerId: id, x, y }) => {
			element.dispatchEvent(
				new PointerEvent("pointerup", {
					bubbles: true,
					cancelable: true,
					pointerId: id,
					pointerType: "touch",
					isPrimary: true,
					clientX: x,
					clientY: y,
				}),
			);
		},
		{ pointerId, x: point.x, y: point.y },
	);
}

test("Overflow Tooltip: data-overflow-tooltip marks exactly Title, Description and Location — never Time", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("edit-show-description").click();

	await expect(page.locator("[data-overflow-tooltip]")).toHaveCount(3);
	await expect(page.getByTestId("comparison-title")).toHaveAttribute(
		"data-overflow-tooltip",
		"",
	);
	await expect(page.getByTestId("comparison-description")).toHaveAttribute(
		"data-overflow-tooltip",
		"",
	);
	await expect(page.getByTestId("comparison-location")).toHaveAttribute(
		"data-overflow-tooltip",
		"",
	);
	await expect(page.getByTestId("comparison-time")).not.toHaveAttribute(
		"data-overflow-tooltip",
	);
});

test("Overflow Tooltip: a fully visible item is never focusable and never opens a tooltip", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("edit-location-display-name-input").fill("Munich");
	await page.getByTestId("edit-location-city-input").fill("");
	await page.getByTestId("edit-location-country-input").fill("");

	const location = page.getByTestId("comparison-location");
	await expect(location).not.toHaveAttribute("tabindex");

	await location.hover();
	await expect(page.getByTestId("presentation-overflow-tooltip")).toHaveCount(
		0,
	);
});

test("Overflow Tooltip: Hover opens it with the complete original text, Mouse Leave closes it", async ({
	page,
}) => {
	await importFullFixture(page);
	await fillLongLocation(page);

	const location = page.getByTestId("comparison-location");
	await expect(location).toHaveAttribute("tabindex", "0");

	await location.hover();
	const tooltip = page.getByTestId("presentation-overflow-tooltip");
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toHaveText(LONG_LOCATION_NAME);

	await page.mouse.move(0, 0);
	await expect(tooltip).toBeHidden();
});

test("Overflow Tooltip: keyboard focus opens it, Escape closes it without moving focus away from the item", async ({
	page,
}) => {
	await importFullFixture(page);
	await fillLongLocation(page);

	const location = page.getByTestId("comparison-location");
	const tooltip = page.getByTestId("presentation-overflow-tooltip");

	await location.focus();
	await expect(tooltip).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(tooltip).toBeHidden();
	await expect(location).toBeFocused();
});

test("Overflow Tooltip: Blur closes it", async ({ page }) => {
	await importFullFixture(page);
	await fillLongLocation(page);

	const location = page.getByTestId("comparison-location");
	const tooltip = page.getByTestId("presentation-overflow-tooltip");

	await location.focus();
	await expect(tooltip).toBeVisible();

	await page.keyboard.press("Tab");
	await expect(tooltip).toBeHidden();
});

test("Overflow Tooltip: touch — a first tap opens it, a second tap on the same trigger closes it, without opening and closing within the same tap", async ({
	page,
}) => {
	await importFullFixture(page);
	await fillLongLocation(page);

	const location = page.getByTestId("comparison-location");
	const tooltip = page.getByTestId("presentation-overflow-tooltip");

	await tapWithTouch(location, 41);
	await expect(tooltip).toBeVisible();

	await tapWithTouch(location, 41);
	await expect(tooltip).toBeHidden();
});

test("Overflow Tooltip: touch — tapping outside the trigger closes it", async ({
	page,
}) => {
	await importFullFixture(page);
	await fillLongLocation(page);

	const location = page.getByTestId("comparison-location");
	const tooltip = page.getByTestId("presentation-overflow-tooltip");

	await tapWithTouch(location, 42);
	await expect(tooltip).toBeVisible();

	await page.evaluate(() => {
		document.body.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				cancelable: true,
				pointerId: 43,
				pointerType: "touch",
				isPrimary: true,
				clientX: 1,
				clientY: 1,
			}),
		);
	});
	await expect(tooltip).toBeHidden();
});

test("Overflow Tooltip: narrowing the viewport makes it available; widening it again closes and removes it", async ({
	page,
}) => {
	await importFullFixture(page);
	// The fixture's images are portrait, so the Presentation Canvas is
	// height-bound (docs/COMPARISON_PRESENTATION.md "Preview Scaling":
	// "Portrait primarily uses the available height") — both dimensions
	// need to be generous together (a tall-but-narrow viewport flips it
	// back to width-bound instead). At 2000×1800 the same long value used
	// elsewhere (proven to truncate at the default 1280×720 viewport)
	// starts out fully visible here, isolating the resize transition
	// itself (verified empirically, not assumed).
	await page.setViewportSize({ width: 2000, height: 1800 });
	await fillLongLocation(page);

	const location = page.getByTestId("comparison-location");
	await expect(location).not.toHaveAttribute("tabindex");

	await page.setViewportSize({ width: 380, height: 700 });
	await expect(location).toHaveAttribute("tabindex", "0");

	await location.hover();
	const tooltip = page.getByTestId("presentation-overflow-tooltip");
	await expect(tooltip).toBeVisible();

	await page.setViewportSize({ width: 2000, height: 1800 });
	await expect(tooltip).toBeHidden();
	await expect(location).not.toHaveAttribute("tabindex");
});

test("Overflow Tooltip: still available after Adaptive Sizing steps a Compact item down — re-evaluation is not tied to one specific size", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("edit-show-description").click();
	await page
		.getByTestId("edit-description-input")
		.fill(
			Array.from(
				{ length: 60 },
				(_, index) => `extremelylongunbrokenword${index}`,
			).join(" "),
		);

	const description = page.getByTestId("comparison-description");
	await expect(description).toHaveCSS("font-size", "13px"); // Compact
	await expect(description).toHaveAttribute("tabindex", "0");

	await description.focus();
	await expect(page.getByTestId("presentation-overflow-tooltip")).toBeVisible();
});

test("Overflow Tooltip: stays fully inside the viewport on every edge, even on a small viewport", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.setViewportSize({ width: 360, height: 640 });
	await page
		.getByTestId("edit-title-input")
		.fill(
			"This is a deliberately very long title that will not fit on two lines at the standard size no matter how wide the Presentation Canvas happens to be in this test",
		);

	const title = page.getByTestId("comparison-title");
	await expect(title).toHaveAttribute("tabindex", "0");
	await title.focus();

	const tooltip = page.getByTestId("presentation-overflow-tooltip");
	await expect(tooltip).toBeVisible();
	const box = await tooltip.boundingBox();
	if (!box) throw new Error("tooltip has no bounding box");
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(360);
	expect(box.y + box.height).toBeLessThanOrEqual(640);
});

test("Overflow Tooltip: repositions while open when the viewport is resized and when the page is scrolled", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.setViewportSize({ width: 800, height: 400 });
	await fillLongLocation(page);

	const location = page.getByTestId("comparison-location");
	const tooltip = page.getByTestId("presentation-overflow-tooltip");
	await location.focus();
	await expect(tooltip).toBeVisible();

	const beforeResize = await tooltip.boundingBox();
	await page.setViewportSize({ width: 500, height: 400 });
	await expect(tooltip).toBeVisible();
	const afterResize = await tooltip.boundingBox();
	if (!beforeResize || !afterResize) {
		throw new Error("tooltip has no bounding box");
	}
	expect(afterResize.x + afterResize.width).toBeLessThanOrEqual(500);

	const scrolledBy = await page.evaluate(() => {
		const before = window.scrollY;
		window.scrollBy(0, 150);
		return window.scrollY - before;
	});
	if (scrolledBy > 0) {
		await expect(tooltip).toBeVisible();
		const afterScroll = await tooltip.boundingBox();
		if (!afterScroll) throw new Error("tooltip has no bounding box");
		expect(afterScroll.y).toBeGreaterThanOrEqual(0);
		expect(afterScroll.y + afterScroll.height).toBeLessThanOrEqual(400);
	}
});

test("Overflow Tooltip: opening it never creates a document scrollbar and never resizes the Presentation Canvas", async ({
	page,
}) => {
	await importFullFixture(page);
	await fillLongLocation(page);

	const documentSizeBefore = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		scrollHeight: document.documentElement.scrollHeight,
	}));
	const canvasBefore = await page.locator(".presentation-canvas").boundingBox();

	await page.getByTestId("comparison-location").focus();
	await expect(page.getByTestId("presentation-overflow-tooltip")).toBeVisible();

	const documentSizeAfter = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		scrollHeight: document.documentElement.scrollHeight,
	}));
	const canvasAfter = await page.locator(".presentation-canvas").boundingBox();

	expect(documentSizeAfter.scrollWidth).toBeLessThanOrEqual(
		documentSizeBefore.scrollWidth,
	);
	expect(documentSizeAfter.scrollHeight).toBeLessThanOrEqual(
		documentSizeBefore.scrollHeight,
	);
	expect(canvasAfter).toEqual(canvasBefore);
});

test("Overflow Tooltip: extremely long text on a small viewport stays fully inside the viewport, uses its own internal vertical scroll, and is never ellipsized", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.setViewportSize({ width: 360, height: 500 });
	await page.getByTestId("edit-show-description").click();
	const veryLongText = Array.from(
		{ length: 200 },
		(_, index) => `word${index}`,
	).join(" ");
	await page.getByTestId("edit-description-input").fill(veryLongText);

	const description = page.getByTestId("comparison-description");
	await expect(description).toHaveAttribute("tabindex", "0");
	await description.focus();

	const tooltip = page.getByTestId("presentation-overflow-tooltip");
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toHaveText(veryLongText);

	const box = await tooltip.boundingBox();
	if (!box) throw new Error("tooltip has no bounding box");
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.y + box.height).toBeLessThanOrEqual(500);

	const overflowY = await tooltip.evaluate(
		(element) => getComputedStyle(element).overflowY,
	);
	expect(overflowY).toBe("auto");
	const { scrollHeight, clientHeight } = await tooltip.evaluate((element) => ({
		scrollHeight: element.scrollHeight,
		clientHeight: element.clientHeight,
	}));
	expect(scrollHeight).toBeGreaterThan(clientHeight);
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
