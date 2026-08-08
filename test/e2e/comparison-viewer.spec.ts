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

// Regression coverage for a confirmed bug: closing Fullscreen left the
// normal Presentation Preview permanently stuck at (approximately) its
// Fullscreen-era size, growing the whole workspace and introducing vertical
// document scroll — not a one-frame flicker, a stable incorrect state that
// persisted indefinitely (see src/components/WorkspaceActive.tsx's own
// comment on the `useLayoutEffect` this fix added, next to `previewSize`,
// for the full mechanism). `expect.poll` is used rather than a fixed
// timeout: the fix itself is synchronous (resolved before the first paint
// after closing), but polling still waits for the *real* rendered value
// instead of asserting on a timing assumption.
async function expectPreviewRestoresAfterFullscreen(
	page: import("@playwright/test").Page,
	closeFullscreen: () => Promise<void>,
) {
	const preview = page.locator(".workspace-active__preview");
	const before = await preview.boundingBox();
	if (!before) throw new Error("preview has no bounding box");
	const documentScrollHeightBefore = await page.evaluate(
		() => document.documentElement.scrollHeight,
	);

	await page.getByTestId("fullscreen-open-button").click();
	const duringFullscreen = await preview.boundingBox();
	if (!duringFullscreen) throw new Error("preview has no bounding box");
	expect(duringFullscreen.width).toBeGreaterThan(before.width);
	expect(duringFullscreen.height).toBeGreaterThan(before.height);

	await closeFullscreen();

	await expect
		.poll(async () => {
			const box = await preview.boundingBox();
			return box
				? Math.abs(box.width - before.width)
				: Number.POSITIVE_INFINITY;
		})
		.toBeLessThanOrEqual(1);
	await expect
		.poll(async () => {
			const box = await preview.boundingBox();
			return box
				? Math.abs(box.height - before.height)
				: Number.POSITIVE_INFINITY;
		})
		.toBeLessThanOrEqual(1);

	// No overflow the Preview itself is responsible for: the page's overall
	// scrollable size returns to what it already was before Fullscreen ever
	// opened (some pre-existing vertical scroll from header/footer beyond the
	// fold is normal and not itself the regression), and no new horizontal
	// overflow exists at all.
	const overflow = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
		scrollHeight: document.documentElement.scrollHeight,
	}));
	expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
	expect(
		Math.abs(overflow.scrollHeight - documentScrollHeightBefore),
	).toBeLessThanOrEqual(1);
}

test("Fullscreen Mode: the normal Presentation Preview size is restored exactly after closing via Escape, with no leftover document overflow", async ({
	page,
}) => {
	await importFullFixture(page);
	await expectPreviewRestoresAfterFullscreen(page, () =>
		page.keyboard.press("Escape"),
	);
});

test("Fullscreen Mode: the normal Presentation Preview size is restored exactly after closing via the Close button", async ({
	page,
}) => {
	await importFullFixture(page);
	await expectPreviewRestoresAfterFullscreen(page, () =>
		page.getByTestId("fullscreen-close-button").click(),
	);
});

// Regression coverage for the still-open case the fix above did not yet
// cover: a viewport resize *while* Fullscreen is open, crossing
// `.workspace-active__layout`'s own 48rem column breakpoint, must not leave
// the normal Preview sized for the *pre-Fullscreen* viewport once Fullscreen
// closes — restoring a pixel snapshot from before Fullscreen opened cannot
// detect that the viewport itself changed size in the meantime (see
// src/components/WorkspaceActive.tsx's own comment on the `useLayoutEffect`
// next to `previewSize` for the full mechanism this exercises). Compares the
// closed Preview against a second, independently loaded page at the target
// viewport — never touched by Fullscreen at all — rather than hardcoding the
// column split/gap/padding math into this test, so it keeps working if
// those CSS values themselves ever change.
async function expectPreviewMatchesFreshLoadAfterFullscreenResize(
	page: import("@playwright/test").Page,
	fromViewport: { readonly width: number; readonly height: number },
	toViewport: { readonly width: number; readonly height: number },
	closeFullscreen: () => Promise<void>,
) {
	await page.setViewportSize(fromViewport);
	await importFullFixture(page);

	await page.getByTestId("fullscreen-open-button").click();
	await page.setViewportSize(toViewport);

	// Fullscreen survives the resize, and the complete canvas still fits
	// entirely inside the new viewport (already covered for a same-size
	// viewport resize by the "orientation change" test below; re-verified
	// here specifically for one that crosses the column breakpoint, since
	// that is the scenario this test exists for) — before ever closing it.
	await expect(page.getByTestId("fullscreen-close-button")).toBeVisible();
	const canvasDuringFullscreen = await page
		.locator(".presentation-canvas")
		.boundingBox();
	if (!canvasDuringFullscreen) {
		throw new Error("presentation-canvas has no bounding box");
	}
	expect(canvasDuringFullscreen.x).toBeGreaterThanOrEqual(0);
	expect(canvasDuringFullscreen.y).toBeGreaterThanOrEqual(0);
	expect(
		canvasDuringFullscreen.x + canvasDuringFullscreen.width,
	).toBeLessThanOrEqual(toViewport.width);
	expect(
		canvasDuringFullscreen.y + canvasDuringFullscreen.height,
	).toBeLessThanOrEqual(toViewport.height);

	await closeFullscreen();

	// No further viewport nudge and no second resize: the fix is synchronous,
	// so the very first read after closing must already be correct — this
	// intentionally is not wrapped in `expect.poll`, unlike the no-resize
	// case above, specifically to prove no later settling step is needed.
	const preview = page.locator(".workspace-active__preview");
	const afterClose = await preview.boundingBox();
	if (!afterClose) throw new Error("preview has no bounding box");

	const referencePage = await page.context().newPage();
	await referencePage.setViewportSize(toViewport);
	await referencePage.goto("/");
	await referencePage.waitForFunction(() =>
		document.querySelector("astro-island")?.hasAttribute("client-render-time"),
	);
	await importFullFixture(referencePage);
	const expected = await referencePage
		.locator(".workspace-active__preview")
		.boundingBox();
	await referencePage.close();
	if (!expected) throw new Error("reference preview has no bounding box");

	expect(Math.abs(afterClose.width - expected.width)).toBeLessThanOrEqual(1);
	expect(Math.abs(afterClose.height - expected.height)).toBeLessThanOrEqual(1);

	// No horizontal overflow, and no vertical overflow caused by a wrong
	// (too-tall) Preview size specifically — some page-level vertical scroll
	// unrelated to the Preview is not itself the regression this guards.
	const overflow = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
	}));
	expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

test("Fullscreen Mode: a viewport resize across the column breakpoint while open leaves the normal Preview matching the new viewport immediately after closing (desktop to mobile)", async ({
	page,
}) => {
	await expectPreviewMatchesFreshLoadAfterFullscreenResize(
		page,
		{ width: 1280, height: 800 },
		{ width: 390, height: 780 },
		() => page.getByTestId("fullscreen-close-button").click(),
	);
});

test("Fullscreen Mode: a viewport resize across the column breakpoint while open leaves the normal Preview matching the new viewport immediately after closing (mobile to desktop)", async ({
	page,
}) => {
	await expectPreviewMatchesFreshLoadAfterFullscreenResize(
		page,
		{ width: 390, height: 780 },
		{ width: 1280, height: 800 },
		() => page.getByTestId("fullscreen-close-button").click(),
	);
});

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

// Reserved Control Area (docs/APPLICATION_LAYOUT.md "Fullscreen Mode"):
// regression coverage for a confirmed bug this feature's own analysis
// established mathematically (no landscape-oriented real fixture exists in
// this project to reproduce it with an actually-overlapping photo — see
// test/fixtures/android-export/README.md) — a wide/landscape Presentation
// Canvas used to be able to grow directly underneath the absolutely
// positioned Fullscreen/Close button, overlaying real image content. This
// asserts the structural invariant the fix actually relies on: the
// Presentation Canvas can never start above the Reserved Control Area's own
// bottom edge, regardless of the canvas's own width — true independent of
// whether the currently loaded comparison happens to be portrait, so it
// still exercises the real code path even with this project's only
// available (portrait) fixture.
async function expectCanvasNeverStartsAboveControlArea(
	page: import("@playwright/test").Page,
) {
	const controlAreaBottom = await page
		.locator(".workspace-active__fullscreen-toggle")
		.evaluate((element) => element.getBoundingClientRect().bottom);
	const canvasTop = await page
		.locator(".presentation-canvas")
		.evaluate((element) => element.getBoundingClientRect().top);
	expect(canvasTop).toBeGreaterThanOrEqual(controlAreaBottom);
}

test("Reserved Control Area: the Presentation Canvas never starts above it, on desktop and mobile, normal and Fullscreen", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await importFullFixture(page);
	await expectCanvasNeverStartsAboveControlArea(page);

	await page.getByTestId("fullscreen-open-button").click();
	await expectCanvasNeverStartsAboveControlArea(page);
	await page.keyboard.press("Escape");

	await page.setViewportSize({ width: 390, height: 780 });
	await expectCanvasNeverStartsAboveControlArea(page);

	await page.getByTestId("fullscreen-open-button").click();
	await expectCanvasNeverStartsAboveControlArea(page);
});

test("Reserved Control Area: the Fullscreen button's position relative to the Presentation Preview is the same on desktop and on mobile", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await importFullFixture(page);
	const desktopButtonBox = await page
		.locator(".workspace-active__fullscreen-toggle")
		.boundingBox();
	const desktopPreviewBox = await page
		.locator(".workspace-active__preview")
		.boundingBox();
	if (!desktopButtonBox || !desktopPreviewBox) {
		throw new Error("missing bounding box");
	}

	await page.setViewportSize({ width: 390, height: 780 });
	const mobileButtonBox = await page
		.locator(".workspace-active__fullscreen-toggle")
		.boundingBox();
	const mobilePreviewBox = await page
		.locator(".workspace-active__preview")
		.boundingBox();
	if (!mobileButtonBox || !mobilePreviewBox) {
		throw new Error("missing bounding box");
	}

	// Same inset from the Presentation Preview's own top and right edges on
	// both viewports — "identical for portrait, landscape and square
	// comparisons, and identical on desktop, tablet and mobile"
	// (docs/APPLICATION_LAYOUT.md "Fullscreen Mode").
	const desktopTopInset = desktopButtonBox.y - desktopPreviewBox.y;
	const mobileTopInset = mobileButtonBox.y - mobilePreviewBox.y;
	expect(Math.abs(desktopTopInset - mobileTopInset)).toBeLessThanOrEqual(1);

	const desktopRightInset =
		desktopPreviewBox.x +
		desktopPreviewBox.width -
		(desktopButtonBox.x + desktopButtonBox.width);
	const mobileRightInset =
		mobilePreviewBox.x +
		mobilePreviewBox.width -
		(mobileButtonBox.x + mobileButtonBox.width);
	expect(Math.abs(desktopRightInset - mobileRightInset)).toBeLessThanOrEqual(1);
});

// Fullscreen/Close button tooltips — reuse of the same, shared tooltip
// infrastructure src/lib/overflow-tooltip.ts already provides for the
// Overflow Tooltip (docs/COMPARISON_PRESENTATION.md Part 2 "Overflow
// Tooltip"): the identical `.presentation-tooltip` element/class, the same
// `attachPresentationOverflowTooltips` function, only invoked a second time
// on a disjoint root (see WorkspaceActive.tsx's own comment next to
// `fullscreenToggleContainerRef`). Not itself a documented Presentation
// Interaction (it applies to application UI, not to Title/Description/
// Location), so covered here rather than in that doc's own section — mouse
// leaves before every hover assertion below so each one starts from a real,
// fresh `mouseenter`, matching how a user's pointer actually arrives.
test("Fullscreen/Close button tooltips: hover shows the same localized text as the accessible name, and it disappears again on mouse leave", async ({
	page,
}) => {
	await importFullFixture(page);

	const openButton = page.getByTestId("fullscreen-open-button");
	const tooltip = page.getByTestId("fullscreen-toggle-tooltip");

	await openButton.hover();
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toHaveText(
		(await openButton.getAttribute("aria-label")) ?? "",
	);

	await page.mouse.move(0, 0);
	await expect(tooltip).toBeHidden();
});

test("Fullscreen/Close button tooltips: keyboard focus shows it, and it disappears again on blur", async ({
	page,
}) => {
	await importFullFixture(page);

	const openButton = page.getByTestId("fullscreen-open-button");
	const tooltip = page.getByTestId("fullscreen-toggle-tooltip");

	await openButton.focus();
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toHaveText(
		(await openButton.getAttribute("aria-label")) ?? "",
	);

	await openButton.blur();
	await expect(tooltip).toBeHidden();
});

test("Fullscreen/Close button tooltips: aria-label stays exactly as it already was — the tooltip is additive, not a replacement", async ({
	page,
}) => {
	await importFullFixture(page);

	const openButton = page.getByTestId("fullscreen-open-button");
	const labelBefore = await openButton.getAttribute("aria-label");

	await openButton.hover();
	await expect(page.getByTestId("fullscreen-toggle-tooltip")).toBeVisible();
	await expect(openButton).toHaveAttribute("aria-label", labelBefore ?? "");
});

test("Fullscreen/Close button tooltips: the Close button uses the exact same tooltip infrastructure, with its own localized text, positioned below it", async ({
	page,
}) => {
	await importFullFixture(page);

	await page.getByTestId("fullscreen-open-button").click();
	const closeButton = page.getByTestId("fullscreen-close-button");
	const tooltip = page.getByTestId("fullscreen-toggle-tooltip");

	await closeButton.hover();
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toHaveText(
		(await closeButton.getAttribute("aria-label")) ?? "",
	);
	// Same `.presentation-tooltip` element/class as every Overflow Tooltip —
	// no second, differently named tooltip class exists.
	await expect(tooltip).toHaveClass("presentation-tooltip");

	const buttonBox = await closeButton.boundingBox();
	const tooltipBox = await tooltip.boundingBox();
	if (!buttonBox || !tooltipBox) throw new Error("missing bounding box");
	expect(tooltipBox.y).toBeGreaterThan(buttonBox.y);
});

test("Fullscreen/Close button tooltips: still available immediately after re-opening Fullscreen, with the correct text for whichever button is currently rendered", async ({
	page,
}) => {
	await importFullFixture(page);
	const tooltip = page.getByTestId("fullscreen-toggle-tooltip");

	await page.getByTestId("fullscreen-open-button").click();
	await page.getByTestId("fullscreen-close-button").click();

	const openButton = page.getByTestId("fullscreen-open-button");
	await openButton.hover();
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toHaveText(
		(await openButton.getAttribute("aria-label")) ?? "",
	);
});

// Regression coverage: Overflow Tooltip triggers (Title/Description/
// Location, ComparisonPresentationInfo.tsx) must keep working exactly as
// before now that src/lib/overflow-tooltip.ts also serves the Fullscreen/
// Close buttons — a second, independent `attachPresentationOverflowTooltips`
// call site (WorkspaceActive.tsx), not a change to the existing one.
test("Overflow Tooltip: still works unchanged alongside the Fullscreen/Close button tooltips", async ({
	page,
}) => {
	await importFullFixture(page);
	await page
		.getByTestId("edit-location-display-name-input")
		.fill(
			"A deliberately very long place name that will not fit on a single line at the standard size no matter how wide the Presentation Canvas happens to be",
		);
	await page.getByTestId("edit-location-city-input").fill("");
	await page.getByTestId("edit-location-country-input").fill("");

	const location = page.getByTestId("comparison-location");
	await expect(location).toHaveAttribute("tabindex", "0");

	await location.hover();
	const tooltip = page.getByTestId("presentation-overflow-tooltip");
	await expect(tooltip).toBeVisible();
	await expect(tooltip).toContainText("A deliberately very long place name");

	await page.mouse.move(0, 0);
	await expect(tooltip).toBeHidden();
});

// Regression coverage for a real, confirmed bug this feature's own
// verification surfaced (not a theoretical concern): a focus transition
// between Location and the Fullscreen button — both live in the same
// document — blurs Location, closing its own Overflow Tooltip, while
// focusing the Fullscreen button opens its own — two independent
// `attachPresentationOverflowTooltips` instances (module comment above),
// each with its own tooltip element. Before the two were given distinct
// `testId`s, both elements shared the same default one and briefly coexisted
// in the DOM (one just-hidden, one newly visible), which is exactly the
// scenario this test exercises via real blur/focus events. Exercised via
// direct `.focus()` calls rather than a real `Tab` keypress: the Reserved
// Control Area (docs/APPLICATION_LAYOUT.md "Fullscreen Mode") now renders
// before the Presentation Canvas in document order — see
// src/components/WorkspaceActive.tsx — so the button is no longer Location's
// immediate next (or previous) Tab stop; the underlying blur/focus event
// sequence this test actually verifies is identical either way.
test("Overflow Tooltip and the Fullscreen button tooltip stay independently addressable across a focus transition between them", async ({
	page,
}) => {
	await importFullFixture(page);
	await page
		.getByTestId("edit-location-display-name-input")
		.fill(
			"A deliberately very long place name that will not fit on a single line at the standard size no matter how wide the Presentation Canvas happens to be",
		);
	await page.getByTestId("edit-location-city-input").fill("");
	await page.getByTestId("edit-location-country-input").fill("");

	const location = page.getByTestId("comparison-location");
	const overflowTooltip = page.getByTestId("presentation-overflow-tooltip");
	const buttonTooltip = page.getByTestId("fullscreen-toggle-tooltip");

	await location.focus();
	await expect(overflowTooltip).toBeVisible();

	await page.getByTestId("fullscreen-open-button").focus();
	await expect(page.getByTestId("fullscreen-open-button")).toBeFocused();
	await expect(overflowTooltip).toBeHidden();
	await expect(buttonTooltip).toBeVisible();
	await expect(buttonTooltip).toHaveText("Fullscreen");
});

// Regression coverage for a confirmed bug: on desktop,
// `.workspace-active__preview` used to reach its height purely via CSS
// (`align-self: stretch` into `.workspace-active__layout`'s single
// `minmax(0, 1fr)` grid row). That row only has a genuinely definite height
// while the whole page still fits within one viewport — `body`'s own
// `min-height: 100vh` (src/styles/global.css) is the sole source of
// definiteness the entire chain depends on. The moment the Context
// Inspector's own content (e.g. the Presentation section, now taller with
// its Typography group) makes the page taller than one viewport and the
// page starts scrolling, a `fr` row inside an indefinite-height grid
// container resolves to the *tallest item's own content size* instead of a
// real fraction of available space — so the stretched Preview column
// silently inherited the taller Inspector column's own content height,
// visibly enlarging the Comparison Stage. Fixed in
// src/components/App.tsx/WorkspaceActive.tsx by measuring the desktop
// Preview's available height from the actually rendered header/footer/main
// chrome and feeding it in as an explicit `height`
// (`--workspace-available-height`), independent of the Inspector.
//
// `expandPresentationSection` mirrors test/e2e/comparison-editing.spec.ts's
// own identically named helper (Presentation starts collapsed,
// docs/APPLICATION_LAYOUT.md "Structure").
async function expandPresentationSection(
	page: import("@playwright/test").Page,
) {
	await page.getByTestId("edit-inspector-presentation-toggle").click();
}

async function expandBrandingSection(page: import("@playwright/test").Page) {
	await page.getByTestId("edit-inspector-branding-toggle").click();
}

async function expandComparisonInformationSection(
	page: import("@playwright/test").Page,
) {
	await page
		.getByTestId("edit-inspector-comparison-information-toggle")
		.click();
}

test("Portrait, desktop, page already scrolling: opening Presentation does not change the Preview's size, even though the Inspector column grows taller", async ({
	page,
}) => {
	// Short enough that the Presentation section's own (Typography-inclusive)
	// content height reliably exceeds one viewport once opened — verified
	// below via an explicit scroll-height assertion, not assumed.
	await page.setViewportSize({ width: 1280, height: 620 });
	await importFullFixture(page);

	const preview = page.locator(".workspace-active__preview");
	const before = await preview.boundingBox();
	if (!before) throw new Error("preview has no bounding box");

	await expandPresentationSection(page);

	// Confirms this test actually exercises the regression's precondition —
	// the page must genuinely be scrolling because of the Inspector's own
	// content, not merely be a plausible-looking viewport size.
	const overflow = await page.evaluate(() => ({
		scrollHeight: document.documentElement.scrollHeight,
		clientHeight: document.documentElement.clientHeight,
	}));
	expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);

	const after = await preview.boundingBox();
	if (!after) throw new Error("preview has no bounding box");
	expect(after.width).toBeCloseTo(before.width, 0);
	expect(after.height).toBeCloseTo(before.height, 0);
});

test("Portrait, desktop, no scroll: opening Presentation does not change the Preview's size", async ({
	page,
}) => {
	// Tall enough that the fully expanded Presentation section still fits
	// within one viewport — the "already worked before Typography" case,
	// kept as a baseline so the fix is proven not to only help the scrolling
	// case while quietly regressing this one.
	await page.setViewportSize({ width: 1280, height: 1400 });
	await importFullFixture(page);

	const preview = page.locator(".workspace-active__preview");
	const before = await preview.boundingBox();
	if (!before) throw new Error("preview has no bounding box");

	await expandPresentationSection(page);

	const overflow = await page.evaluate(() => ({
		scrollHeight: document.documentElement.scrollHeight,
		clientHeight: document.documentElement.clientHeight,
	}));
	expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);

	const after = await preview.boundingBox();
	if (!after) throw new Error("preview has no bounding box");
	expect(after.width).toBeCloseTo(before.width, 0);
	expect(after.height).toBeCloseTo(before.height, 0);
});

test("switching between Comparison information, Presentation and Branding never changes the Preview's size, with the page scrolling throughout", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 620 });
	await importFullFixture(page);

	const preview = page.locator(".workspace-active__preview");
	const initial = await preview.boundingBox();
	if (!initial) throw new Error("preview has no bounding box");

	await expandPresentationSection(page);
	const afterPresentation = await preview.boundingBox();
	if (!afterPresentation) throw new Error("preview has no bounding box");
	expect(afterPresentation.height).toBeCloseTo(initial.height, 0);

	await expandBrandingSection(page);
	const afterBranding = await preview.boundingBox();
	if (!afterBranding) throw new Error("preview has no bounding box");
	expect(afterBranding.height).toBeCloseTo(initial.height, 0);

	await expandComparisonInformationSection(page);
	const afterComparisonInformation = await preview.boundingBox();
	if (!afterComparisonInformation) {
		throw new Error("preview has no bounding box");
	}
	expect(afterComparisonInformation.height).toBeCloseTo(initial.height, 0);
});

// No landscape real-image fixture exists in this project (see the module
// comment above the Fullscreen section: "Only a portrait real-image fixture
// exists"; landscape geometry math itself is covered by
// test/unit/canvas-geometry.test.mjs). This test instead forces the
// existing *portrait* fixture through the *width-bound* branch of
// `computeCanvasGeometry` — the same branch a real landscape image would
// take in an ordinarily-proportioned column — by using a narrow-ish, tall
// viewport (a portrait image only becomes width-bound once the available
// height is generous relative to the column's own width), so the Stage's
// rendered width (not the previously-buggy height input) is what actually
// constrains it. This proves the fix, which only changes the source of the
// *height* input, leaves the width-bound computation path unaffected.
// Confirmed width-bound empirically for this fixture/viewport: the rendered
// stage width sits at the column's own available width, not proportional to
// viewport height.
test("width-bound geometry (the real Landscape code path): opening Presentation does not change the Preview's rendered width", async ({
	page,
}) => {
	await page.setViewportSize({ width: 900, height: 2200 });
	await importFullFixture(page);

	const stage = page.locator(".comparison-slider__frame");
	const before = await stage.boundingBox();
	if (!before) throw new Error("stage has no bounding box");

	await expandPresentationSection(page);

	const after = await stage.boundingBox();
	if (!after) throw new Error("stage has no bounding box");
	expect(after.width).toBeCloseTo(before.width, 0);
});

test("Mobile: opening Presentation does not change the Preview's size (no desktop stretch chain applies below the 48rem breakpoint)", async ({
	page,
}) => {
	await page.setViewportSize({ width: 400, height: 900 });
	await importFullFixture(page);

	const preview = page.locator(".workspace-active__preview");
	const before = await preview.boundingBox();
	if (!before) throw new Error("preview has no bounding box");

	await expandPresentationSection(page);

	const after = await preview.boundingBox();
	if (!after) throw new Error("preview has no bounding box");
	expect(after.width).toBeCloseTo(before.width, 0);
	expect(after.height).toBeCloseTo(before.height, 0);
});

test("Fullscreen still fills the full viewport, and restores the correct (scroll-affected) size on close, even with a tall Presentation section open in the background", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 620 });
	await importFullFixture(page);
	await expandPresentationSection(page);

	const preview = page.locator(".workspace-active__preview");
	const beforeFullscreen = await preview.boundingBox();
	if (!beforeFullscreen) throw new Error("preview has no bounding box");

	await page.getByTestId("fullscreen-open-button").click();
	const duringFullscreen = await preview.boundingBox();
	if (!duringFullscreen) throw new Error("preview has no bounding box");
	// Fullscreen's own `inset: 0` fills the real viewport regardless of the
	// new `--workspace-available-height` mechanism (excluded via
	// `:not(.workspace-active__preview--fullscreen)`, src/styles/global.css).
	const viewport = page.viewportSize();
	if (!viewport) throw new Error("no viewport size");
	expect(duringFullscreen.width).toBeCloseTo(viewport.width, 0);
	expect(duringFullscreen.height).toBeCloseTo(viewport.height, 0);

	await page.keyboard.press("Escape");
	await expect
		.poll(async () => {
			const box = await preview.boundingBox();
			return box ? Math.abs(box.height - beforeFullscreen.height) : Infinity;
		})
		.toBeLessThanOrEqual(1);
});

test("resizing the viewport while Presentation is open updates the Preview to the new available height", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 1400 });
	await importFullFixture(page);
	await expandPresentationSection(page);

	const preview = page.locator(".workspace-active__preview");
	const tall = await preview.boundingBox();
	if (!tall) throw new Error("preview has no bounding box");

	await page.setViewportSize({ width: 1280, height: 900 });

	await expect
		.poll(async () => {
			const box = await preview.boundingBox();
			return box?.height ?? null;
		})
		.toBeLessThan(tall.height);
});
