// Real-application coverage for the first Comparison Viewer iteration
// (docs/FEATURE_SPECIFICATION.md F-002; docs/IMPLEMENTATION_PLAN_V1.md
// Phase 4) — src/components/WorkspaceActive.tsx, ComparisonSlider.tsx and
// ComparisonInfo.tsx.
//
// Uses sample-v6-session_full.zip specifically: it is the one fixture with
// content.title, content.description, location.* and a reference.date set
// (test/fixtures/android-export/README.md), needed to exercise the derived
// presentation values this iteration adds. Functional assertions use stable
// `data-testid`s and ARIA roles, never translated copy, per this project's
// established testing convention (see test/e2e/workspace-creation.spec.ts).

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
	// Real image decode of a real ~7 MB photo pair; generous timeout to
	// accommodate parallel-worker load, matching this project's existing
	// convention for the same fixture in test/e2e/workspace-creation.spec.ts.
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});
}

test("both comparison images render, and the loading state clears once both are ready", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_full.zip"),
		);
	await expect(page.getByTestId("workspace-active")).toBeVisible();

	// The object-URL images (re-decoded from bytes already validated during
	// import) tend to load faster than a Playwright assertion's own poll
	// interval, so the loading state's transient presence isn't reliably
	// observable here — its absence once both images are ready is what this
	// test asserts (see src/components/ComparisonSlider.tsx for the
	// mechanism: the slider handle only renders once both have loaded).
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});
	await expect(page.getByTestId("reference-image")).toBeVisible();
	await expect(page.getByTestId("capture-image")).toBeVisible();
	await expect(page.getByRole("slider")).toBeVisible();
});

test("title and location are derived and presented from the imported metadata", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(page.locator("#workspace-active-title")).toHaveText(
		"White and black wall portait",
	);
	await expect(page.getByTestId("comparison-location")).toContainText(
		"This Is A Place Name",
	);
	await expect(page.getByTestId("comparison-location")).toContainText(
		"City Name",
	);
	await expect(page.getByTestId("comparison-location")).toContainText(
		"Country Name",
	);
	// reference.date is "2024" (YYYY precision) in this fixture.
	await expect(page.getByTestId("comparison-reference-label")).toHaveText(
		"2024",
	);
	await expect(page.getByTestId("comparison-capture-label")).not.toBeEmpty();
});

test("description is derived from the imported metadata but hidden until Show Description is enabled (docs/APPLICATION_LAYOUT.md default)", async ({
	page,
}) => {
	await importFullFixture(page);

	// docs/APPLICATION_LAYOUT.md "Comparison Information" > "Description":
	// "visibility default: OFF" — even though content.description is present
	// in this fixture, it must not render until explicitly shown.
	await expect(page.getByTestId("comparison-description")).toHaveCount(0);

	await page.getByTestId("edit-show-description").click();

	await expect(page.getByTestId("comparison-description")).toHaveText(
		"This is a description. Portrait format.",
	);
});

test("the reference fallback label is used when no comparison title or reference date exist", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_minimal.zip"),
		);
	await expect(page.getByTestId("workspace-active")).toBeVisible();
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});

	// No content.title in the minimal fixture: the heading falls back to the
	// generic workspace title rather than being left blank.
	await expect(page.locator("#workspace-active-title")).not.toBeEmpty();
	await expect(page.getByTestId("comparison-description")).toHaveCount(0);
	await expect(page.getByTestId("comparison-location")).toHaveCount(0);
});

test("the slider is keyboard-operable and moves the reveal position without changing workspace data", async ({
	page,
}) => {
	await importFullFixture(page);

	const slider = page.getByRole("slider");
	await slider.focus();
	await expect(slider).toHaveAttribute("aria-valuenow", "50");

	await page.keyboard.press("ArrowRight");
	await expect(slider).toHaveAttribute("aria-valuenow", "55");

	await page.keyboard.press("Home");
	await expect(slider).toHaveAttribute("aria-valuenow", "0");

	await page.keyboard.press("End");
	await expect(slider).toHaveAttribute("aria-valuenow", "100");

	// Interacting with the slider never touches the underlying comparison
	// data (docs/FEATURE_SPECIFICATION.md F-002 Rules).
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2026-07-27_13-54-15",
	);
	await expect(page.locator("#workspace-active-title")).toHaveText(
		"White and black wall portait",
	);
});

test("the slider is pointer-operable via drag", async ({ page }) => {
	await importFullFixture(page);

	const slider = page.getByRole("slider");
	const frame = page.getByTestId("comparison-slider");
	const frameBox = await frame.boundingBox();
	if (!frameBox) throw new Error("comparison-slider frame has no bounding box");

	await page.mouse.move(
		frameBox.x + frameBox.width / 2,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(
		frameBox.x + frameBox.width * 0.9,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.up();

	const value = Number(await slider.getAttribute("aria-valuenow"));
	expect(value).toBeGreaterThan(70);
});

test("the divider line always shares the handle's horizontal center, after both click and drag", async ({
	page,
}) => {
	await importFullFixture(page);

	const slider = page.getByRole("slider");
	const dividerLine = page.getByTestId("comparison-divider-line");
	const frame = page.getByTestId("comparison-slider");
	const frameBox = await frame.boundingBox();
	if (!frameBox) throw new Error("comparison-slider frame has no bounding box");

	async function expectHandleAndDividerAligned() {
		const handleBox = await slider.boundingBox();
		const dividerBox = await dividerLine.boundingBox();
		if (!handleBox || !dividerBox) {
			throw new Error("handle or divider line has no bounding box");
		}
		const handleCenter = handleBox.x + handleBox.width / 2;
		const dividerCenter = dividerBox.x + dividerBox.width / 2;
		// A regression here (the divider line stuck at a stale position while
		// the handle moves) would show up as tens of pixels of difference —
		// this tolerance only allows for ordinary sub-pixel rendering rounding.
		expect(Math.abs(handleCenter - dividerCenter)).toBeLessThanOrEqual(2);
	}

	// Click away from the default 50% position.
	await page.mouse.click(
		frameBox.x + frameBox.width * 0.25,
		frameBox.y + frameBox.height / 2,
	);
	await expect(slider).toHaveAttribute("aria-valuenow", "25");
	await expectHandleAndDividerAligned();

	// Drag to a different position again.
	await page.mouse.move(
		frameBox.x + frameBox.width * 0.25,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(
		frameBox.x + frameBox.width * 0.8,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.up();
	await expectHandleAndDividerAligned();
});

test("dragging continues correctly when the pointer moves outside the Viewer, and the position stays clamped", async ({
	page,
}) => {
	await importFullFixture(page);

	const slider = page.getByRole("slider");
	const frame = page.getByTestId("comparison-slider");
	const frameBox = await frame.boundingBox();
	if (!frameBox) throw new Error("comparison-slider frame has no bounding box");

	await page.mouse.move(
		frameBox.x + frameBox.width / 2,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.down();
	// Well outside the frame's right edge, and past the bottom of the page —
	// pointer capture (src/components/ComparisonSlider.tsx) must keep
	// routing move events to the frame regardless.
	await page.mouse.move(frameBox.x + frameBox.width + 400, frameBox.y - 200);
	await expect(slider).toHaveAttribute("aria-valuenow", "100");

	await page.mouse.move(frameBox.x - 400, frameBox.y - 200);
	await expect(slider).toHaveAttribute("aria-valuenow", "0");
	await page.mouse.up();
});

test("the on-image comparison labels use the Android-equivalent capture-aware wording", async ({
	page,
}) => {
	await importFullFixture(page);

	// sample-v6-session_full.zip: reference.date is "2024" (year precision)
	// and the capture timestamp is in 2026 (see the workspace-session
	// assertion above) — different years, so the ported Android priority
	// chain (src/lib/compare-slider-labels.ts) resolves to the bare years,
	// not the sidebar's independently-formatted referenceLabel.
	await expect(page.getByTestId("comparison-slider-label-left")).toHaveText(
		"2024",
	);
	await expect(page.getByTestId("comparison-slider-label-right")).toHaveText(
		"2026",
	);
});

test("each on-image label independently hides once its own rendered bounds would cross its Viewer edge", async ({
	page,
}) => {
	await importFullFixture(page);

	const frame = page.getByTestId("comparison-slider");
	const frameBox = await frame.boundingBox();
	if (!frameBox) throw new Error("comparison-slider frame has no bounding box");

	// Drag close to the left edge: the left label's own measured bounds
	// cross the Viewer's left edge and it disappears, independently of the
	// right label, which stays put.
	await page.mouse.move(
		frameBox.x + frameBox.width / 2,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(frameBox.x + 2, frameBox.y + frameBox.height / 2);
	await page.mouse.up();
	await expect(page.getByTestId("comparison-slider-label-left")).toHaveCount(0);
	await expect(page.getByTestId("comparison-slider-label-right")).toBeVisible();

	// Drag close to the right edge: the reverse.
	await page.mouse.move(
		frameBox.x + frameBox.width / 2,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.down();
	await page.mouse.move(
		frameBox.x + frameBox.width - 2,
		frameBox.y + frameBox.height / 2,
	);
	await page.mouse.up();
	await expect(page.getByTestId("comparison-slider-label-left")).toBeVisible();
	await expect(page.getByTestId("comparison-slider-label-right")).toHaveCount(
		0,
	);
});

test("touch and pen pointers drag the divider through the same Pointer Events implementation as the mouse", async ({
	page,
}) => {
	await importFullFixture(page);

	const slider = page.getByRole("slider");
	const frame = page.getByTestId("comparison-slider");
	const frameBox = await frame.boundingBox();
	if (!frameBox) throw new Error("comparison-slider frame has no bounding box");
	const centerX = frameBox.x + frameBox.width / 2;
	const centerY = frameBox.y + frameBox.height / 2;

	// Playwright's own input APIs only ever emit pointerType "mouse"; a real
	// touch/pen device is simulated the same way the app itself receives one
	// in production — as native PointerEvents with a different pointerType —
	// since the component has exactly one Pointer Events implementation with
	// no touch/pen-specific branch to otherwise exercise. Each event is
	// dispatched from its own `evaluate()` round trip (not all three from a
	// single synchronous script): dispatching them back-to-back with no yield
	// back to the browser never gives React a chance to commit the
	// `isDragging` state update from pointerdown before pointermove's own
	// (stale, pre-commit) handler closure runs — a test-harness artifact a
	// real pointer stream never hits, since genuine hardware events always
	// arrive as separate tasks.
	async function dragWithPointerType(pointerType: "touch" | "pen") {
		const pointerId = pointerType === "touch" ? 11 : 12;
		await frame.evaluate(
			(element, { pointerType: type, pointerId: id, x, y }) => {
				element.dispatchEvent(
					new PointerEvent("pointerdown", {
						bubbles: true,
						cancelable: true,
						pointerId: id,
						pointerType: type,
						isPrimary: true,
						clientX: x,
						clientY: y,
					}),
				);
			},
			{ pointerType, pointerId, x: centerX, y: centerY },
		);
		await frame.evaluate(
			(element, { pointerType: type, pointerId: id, x, y }) => {
				element.dispatchEvent(
					new PointerEvent("pointermove", {
						bubbles: true,
						cancelable: true,
						pointerId: id,
						pointerType: type,
						isPrimary: true,
						clientX: x + 40,
						clientY: y,
					}),
				);
			},
			{ pointerType, pointerId, x: centerX, y: centerY },
		);
		await frame.evaluate(
			(element, { pointerType: type, pointerId: id, x, y }) => {
				element.dispatchEvent(
					new PointerEvent("pointerup", {
						bubbles: true,
						cancelable: true,
						pointerId: id,
						pointerType: type,
						isPrimary: true,
						clientX: x + 40,
						clientY: y,
					}),
				);
			},
			{ pointerType, pointerId, x: centerX, y: centerY },
		);
	}

	await dragWithPointerType("touch");
	const afterTouch = Number(await slider.getAttribute("aria-valuenow"));
	expect(afterTouch).toBeGreaterThan(50);

	await frame.evaluate((element) => {
		element.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				cancelable: true,
				pointerId: 20,
				pointerType: "mouse",
				isPrimary: true,
				clientX: element.getBoundingClientRect().left + 10,
				clientY: element.getBoundingClientRect().top + 10,
			}),
		);
	});
	await frame.evaluate((element) => {
		element.dispatchEvent(
			new PointerEvent("pointerup", {
				bubbles: true,
				cancelable: true,
				pointerId: 20,
				pointerType: "mouse",
				isPrimary: true,
			}),
		);
	});
	await expect(slider).not.toHaveAttribute("aria-valuenow", String(afterTouch));

	await dragWithPointerType("pen");
	const afterPen = Number(await slider.getAttribute("aria-valuenow"));
	expect(afterPen).toBeGreaterThan(0);
});

test("an unrelated concurrent pointer cannot move or terminate the active drag", async ({
	page,
}) => {
	await importFullFixture(page);

	const slider = page.getByRole("slider");
	const frame = page.getByTestId("comparison-slider");
	const frameBox = await frame.boundingBox();
	if (!frameBox) throw new Error("comparison-slider frame has no bounding box");

	const x = frameBox.x + frameBox.width / 2;
	const y = frameBox.y + frameBox.height / 2;

	// Each event is its own `evaluate()` round trip so React commits the
	// preceding state update first — see the comment on `dragWithPointerType`
	// above for why dispatching a whole sequence synchronously would instead
	// read a stale pre-commit closure.
	async function dispatch(
		eventType: string,
		pointerId: number,
		clientX: number,
	) {
		await frame.evaluate(
			(element, { type, id, cx, cy }) => {
				element.dispatchEvent(
					new PointerEvent(type, {
						bubbles: true,
						cancelable: true,
						pointerId: id,
						pointerType: "touch",
						isPrimary: id === 1,
						clientX: cx,
						clientY: cy,
					}),
				);
			},
			{ type: eventType, id: pointerId, cx: clientX, cy: y },
		);
	}

	// Pointer 1 starts the drag.
	await dispatch("pointerdown", 1, x);
	// An unrelated second pointer (e.g. a second finger) moves and lifts — it
	// must not affect the active drag at all.
	await dispatch("pointermove", 2, x + 300);
	await dispatch("pointerup", 2, x + 300);
	await expect(slider).toHaveAttribute("aria-valuenow", "50");

	// The original pointer keeps controlling the drag afterwards.
	await dispatch("pointermove", 1, x + 40);
	const afterOriginalContinues = await slider.getAttribute("aria-valuenow");
	expect(Number(afterOriginalContinues)).toBeGreaterThan(50);
	await dispatch("pointerup", 1, x + 40);
});

test("the Viewer keeps native vertical touch scrolling enabled", async ({
	page,
}) => {
	await importFullFixture(page);

	const touchAction = await page
		.getByTestId("comparison-slider")
		.evaluate((element) => getComputedStyle(element).touchAction);
	expect(touchAction).toBe("pan-y");
});

test("the Viewer appears before the comparison information in visual order on a narrow screen", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 780 });
	await importFullFixture(page);

	const sliderBox = await page.getByTestId("comparison-slider").boundingBox();
	// docs/APPLICATION_LAYOUT.md "Description": "visibility default: OFF" —
	// comparison-location is visible by default and, like description,
	// belongs to the same Presentation Preview column beneath the Comparison
	// Stage, so it is an equally valid signal for this ordering check.
	const infoBox = await page.getByTestId("comparison-location").boundingBox();
	expect(sliderBox).not.toBeNull();
	expect(infoBox).not.toBeNull();
	expect(sliderBox?.y ?? 0).toBeLessThan(infoBox?.y ?? 0);
});

test("replacing the workspace shows the new comparison's images and information", async ({
	page,
}) => {
	await page
		.locator("#import-zip-input")
		.setInputFiles(join(fixturesDir, "archives", "valid-with-real-images.zip"));
	await expect(page.getByTestId("workspace-session")).toContainText(
		"2024-01-15_10-30-00",
	);
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0);

	await page
		.locator("#import-zip-input")
		.setInputFiles(
			join(fixturesDir, "android-export", "sample-v6-session_full.zip"),
		);
	await expect(page.getByTestId("replace-confirm-dialog")).toBeVisible({
		timeout: 20_000,
	});
	await page.getByTestId("replace-confirm-button").click();

	await expect(page.getByTestId("workspace-session")).toContainText(
		"2026-07-27_13-54-15",
	);
	await expect(page.getByTestId("comparison-loading")).toHaveCount(0, {
		timeout: 20_000,
	});
	await expect(page.locator("#workspace-active-title")).toHaveText(
		"White and black wall portait",
	);
	await expect(page.getByTestId("reference-image")).toBeVisible();
	await expect(page.getByTestId("capture-image")).toBeVisible();
});

// Fullscreen Mode (docs/APPLICATION_LAYOUT.md "Fullscreen Mode") —
// src/components/App.tsx, WorkspaceActive.tsx. Kept in this file rather than
// a dedicated one: Fullscreen reuses the exact same, already-mounted
// `.workspace-active__preview` element (and therefore the same
// ComparisonSlider instance covered by the Viewer tests above) rather than
// rendering a second one, so this belongs with the rest of this file's
// Viewer coverage. Only a portrait real-image fixture exists in this
// project (test/fixtures/android-export/README.md) — Portrait-vs-Landscape
// geometry correctness itself is already covered by
// test/unit/canvas-geometry.test.mjs (both ratios, purely as numbers); these
// tests re-verify only that Fullscreen's own reused container keeps that
// existing, orientation-agnostic geometry pipeline intact, not the geometry
// math itself again.

test("Fullscreen Mode: opening it shows a Close button and the complete Presentation Canvas", async ({
	page,
}) => {
	await importFullFixture(page);

	await page.getByTestId("fullscreen-open-button").click();

	await expect(page.getByTestId("fullscreen-close-button")).toBeVisible();
	await expect(page.getByTestId("comparison-slider")).toBeVisible();
	await expect(page.getByTestId("comparison-presentation-info")).toBeVisible();
});

test("Fullscreen Mode: header, footer and the Context Inspector become inert and are fully covered", async ({
	page,
}) => {
	await importFullFixture(page);
	const viewport = page.viewportSize();
	if (!viewport) throw new Error("no viewport size");

	await page.getByTestId("fullscreen-open-button").click();

	const headerRegion = page
		.locator(".inert-region")
		.filter({ has: page.locator("header.app-header") });
	const footerRegion = page
		.locator(".inert-region")
		.filter({ has: page.locator("footer.app-footer") });
	const inspectorRegion = page
		.locator(".inert-region")
		.filter({ has: page.getByTestId("edit-inspector") });
	await expect(headerRegion).toHaveJSProperty("inert", true);
	await expect(footerRegion).toHaveJSProperty("inert", true);
	await expect(inspectorRegion).toHaveJSProperty("inert", true);

	// The fullscreen surface itself covers the entire viewport, so nothing
	// behind it (header, footer, Context Inspector) is actually visible to
	// the user, regardless of `inert` not implying `display: none`.
	const previewBox = await page
		.locator(".workspace-active__preview--fullscreen")
		.boundingBox();
	if (!previewBox) throw new Error("fullscreen preview has no bounding box");
	expect(previewBox.x).toBe(0);
	expect(previewBox.y).toBe(0);
	expect(previewBox.width).toBe(viewport.width);
	expect(previewBox.height).toBe(viewport.height);
});

test("Fullscreen Mode: the complete Presentation Canvas stays fully inside the viewport", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("fullscreen-open-button").click();

	const viewport = page.viewportSize();
	if (!viewport) throw new Error("no viewport size");
	const canvasBox = await page.locator(".presentation-canvas").boundingBox();
	if (!canvasBox) throw new Error("presentation-canvas has no bounding box");

	expect(canvasBox.x).toBeGreaterThanOrEqual(0);
	expect(canvasBox.y).toBeGreaterThanOrEqual(0);
	expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(viewport.width);
	expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(viewport.height);
});

test("Fullscreen Mode: the comparison slider remains fully operable by keyboard while open", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("fullscreen-open-button").click();

	const slider = page.getByRole("slider");
	await slider.focus();
	await page.keyboard.press("End");
	await expect(slider).toHaveAttribute("aria-valuenow", "100");
});

test("Fullscreen Mode: the slider position is preserved across opening and closing — the same ComparisonSlider instance, never a second one", async ({
	page,
}) => {
	await importFullFixture(page);

	const slider = page.getByRole("slider");
	await slider.focus();
	await page.keyboard.press("End"); // 100
	await expect(slider).toHaveAttribute("aria-valuenow", "100");

	await page.getByTestId("fullscreen-open-button").click();
	// Still 100 immediately after opening — nothing reset it.
	await expect(page.getByRole("slider")).toHaveAttribute(
		"aria-valuenow",
		"100",
	);

	await page.getByRole("slider").focus();
	await page.keyboard.press("Home"); // 0, set while inside Fullscreen
	await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "0");

	await page.getByTestId("fullscreen-close-button").click();
	// Still 0 after closing — the value set inside Fullscreen survives, on
	// the same slider now shown in the normal layout again.
	await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "0");
});

test("Fullscreen Mode: Escape closes it", async ({ page }) => {
	await importFullFixture(page);
	await page.getByTestId("fullscreen-open-button").click();
	await expect(page.getByTestId("fullscreen-close-button")).toBeVisible();

	await page.keyboard.press("Escape");

	await expect(page.getByTestId("fullscreen-close-button")).toHaveCount(0);
	await expect(page.getByTestId("fullscreen-open-button")).toBeVisible();
});

test("Fullscreen Mode: the visible Close button closes it", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("fullscreen-open-button").click();

	await page.getByTestId("fullscreen-close-button").click();

	await expect(page.getByTestId("fullscreen-close-button")).toHaveCount(0);
	await expect(page.getByTestId("fullscreen-open-button")).toBeVisible();
});

test("Fullscreen Mode: clicking the background does not close it", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("fullscreen-open-button").click();

	// A point deliberately away from both the centered canvas and the
	// top-right button — the dark background area itself.
	await page
		.locator(".workspace-active__preview--fullscreen")
		.click({ position: { x: 10, y: 10 } });

	await expect(page.getByTestId("fullscreen-close-button")).toBeVisible();
});

test("Fullscreen Mode: closing it returns keyboard focus to the Fullscreen button", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("fullscreen-open-button").click();

	await page.keyboard.press("Escape");

	await expect(page.getByTestId("fullscreen-open-button")).toBeFocused();
});

test("Fullscreen Mode: the active Context Inspector section stays the same after closing", async ({
	page,
}) => {
	await importFullFixture(page);
	// Presentation starts collapsed by default (docs/APPLICATION_LAYOUT.md) —
	// expanding it first proves this is genuinely preserved, not just
	// coincidentally still at its own default.
	await page.getByTestId("edit-inspector-presentation-toggle").click();
	await expect(
		page.getByTestId("edit-inspector-presentation-toggle"),
	).toHaveAttribute("aria-expanded", "true");

	await page.getByTestId("fullscreen-open-button").click();
	await page.getByTestId("fullscreen-close-button").click();

	await expect(
		page.getByTestId("edit-inspector-presentation-toggle"),
	).toHaveAttribute("aria-expanded", "true");
});

test("Fullscreen Mode: a viewport resize (orientation change) rescales the preview but does not end it", async ({
	page,
}) => {
	await importFullFixture(page);
	await page.getByTestId("fullscreen-open-button").click();

	await page.setViewportSize({ width: 500, height: 900 });

	await expect(page.getByTestId("fullscreen-close-button")).toBeVisible();
	const viewport = page.viewportSize();
	if (!viewport) throw new Error("no viewport size");
	const canvasBox = await page.locator(".presentation-canvas").boundingBox();
	if (!canvasBox) throw new Error("presentation-canvas has no bounding box");
	expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(viewport.width);
	expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(viewport.height);
});

test("Fullscreen Mode: the button belongs to the Presentation Preview, never to the Presentation Canvas itself", async ({
	page,
}) => {
	await importFullFixture(page);

	await expect(
		page
			.locator(".presentation-canvas")
			.locator('[data-testid="fullscreen-open-button"]'),
	).toHaveCount(0);
	await expect(
		page.locator('[data-testid="fullscreen-open-button"]'),
	).toHaveCount(1);

	await page.getByTestId("fullscreen-open-button").click();

	await expect(
		page
			.locator(".presentation-canvas")
			.locator('[data-testid="fullscreen-close-button"]'),
	).toHaveCount(0);
});
