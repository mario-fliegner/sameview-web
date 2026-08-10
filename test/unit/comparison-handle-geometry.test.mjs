// Coverage for src/lib/comparison-handle-geometry.ts — the single shared
// source for numbers src/components/ComparisonSlider.tsx and
// src/components/ComparisonSliderHandle.tsx must agree on. These
// assertions exist specifically to guard the confirmed regressions
// (divider drawn over branded content; date labels overlapping the
// enlarged handle; branding content centered on the wrong point; wrong
// symbol color; Built-in Symbol content sized identically to Custom/
// imported image content) from silently reappearing if any of these
// values is ever redefined independently at a second call site.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	BRANDED_HANDLE_VISUAL_PX,
	BRANDED_HANDLE_VISUAL_REM,
	getContentBox,
	getEffectiveRingRadiusPx,
	getHandleVisualSizePx,
	HANDLE_CENTER_PX,
	HANDLE_ENLARGEMENT_FACTOR,
	HANDLE_RADIUS_PX,
	IMAGE_CONTENT_RATIO,
	MIN_BRANDED_HANDLE_VISUAL_PX,
	MIN_STANDARD_HANDLE_VISUAL_PX,
	REFERENCE_STAGE_MIN_DIMENSION_PX,
	STANDARD_ARROW_COLOR,
	STANDARD_HANDLE_VISUAL_PX,
	STANDARD_HANDLE_VISUAL_REM,
	STANDARD_RING_RADIUS_PX,
	SYMBOL_COLOR,
	SYMBOL_CONTENT_RATIO,
} from "../../src/lib/comparison-handle-geometry.ts";

describe("HANDLE_CENTER_PX", () => {
	test("is the viewBox's actual center coordinate, not the handle radius", () => {
		assert.equal(HANDLE_CENTER_PX, 27);
		assert.notEqual(HANDLE_CENTER_PX, HANDLE_RADIUS_PX);
	});
});

describe("SYMBOL_CONTENT_RATIO vs. IMAGE_CONTENT_RATIO", () => {
	test("a Built-in Symbol is exactly 20% smaller than a Custom/imported image", () => {
		assert.equal(IMAGE_CONTENT_RATIO, 0.72);
		assert.equal(SYMBOL_CONTENT_RATIO, 0.576);
		assert.ok(
			Math.abs(SYMBOL_CONTENT_RATIO - IMAGE_CONTENT_RATIO * 0.8) < 1e-9,
		);
		assert.ok(SYMBOL_CONTENT_RATIO < IMAGE_CONTENT_RATIO);
	});
});

describe("getContentBox", () => {
	test("centers the content box exactly on HANDLE_CENTER_PX for either ratio", () => {
		for (const ratio of [IMAGE_CONTENT_RATIO, SYMBOL_CONTENT_RATIO]) {
			const box = getContentBox(ratio);
			assert.equal(box.offset + box.side / 2, HANDLE_CENTER_PX);
		}
	});

	test("the symbol content box is smaller than the image content box", () => {
		const imageBox = getContentBox(IMAGE_CONTENT_RATIO);
		const symbolBox = getContentBox(SYMBOL_CONTENT_RATIO);
		assert.ok(symbolBox.side < imageBox.side);
	});

	test("both content boxes fit entirely inside the handle circle", () => {
		for (const ratio of [IMAGE_CONTENT_RATIO, SYMBOL_CONTENT_RATIO]) {
			const box = getContentBox(ratio);
			assert.ok(box.offset > HANDLE_CENTER_PX - HANDLE_RADIUS_PX);
			assert.ok(box.offset + box.side < HANDLE_CENTER_PX + HANDLE_RADIUS_PX);
		}
	});
});

describe("BRANDED_HANDLE_VISUAL_REM", () => {
	test("is exactly the standard size times the enlargement factor", () => {
		assert.equal(
			BRANDED_HANDLE_VISUAL_REM,
			STANDARD_HANDLE_VISUAL_REM * HANDLE_ENLARGEMENT_FACTOR,
		);
	});
});

describe("getEffectiveRingRadiusPx", () => {
	test("is always exactly half of the given rendered diameter", () => {
		for (const diameter of [10, 28, 42, 54, 81, 200]) {
			assert.equal(getEffectiveRingRadiusPx(diameter), diameter / 2);
		}
	});

	test("matches the documented base radii at the two base diameters", () => {
		assert.equal(
			getEffectiveRingRadiusPx(STANDARD_HANDLE_VISUAL_PX),
			STANDARD_RING_RADIUS_PX,
		);
		assert.equal(
			getEffectiveRingRadiusPx(BRANDED_HANDLE_VISUAL_PX),
			STANDARD_RING_RADIUS_PX * HANDLE_ENLARGEMENT_FACTOR,
		);
	});
});

// docs/COMPARISON_PRESENTATION.md Part 2 "Handle", "Responsive Handle Size
// on a Small Presentation Stage" — the single shared computation every
// renderer of the Handle (Live Preview, Standalone HTML, Static Microsite)
// must call unchanged. Formula: scale = clamp(0, minStageDimension / 200, 1);
// standardPx = max(28, scale * 54); brandedPx = standardPx * 1.5.
describe("getHandleVisualSizePx", () => {
	test("REFERENCE_STAGE_MIN_DIMENSION_PX is the approved 200px reference", () => {
		assert.equal(REFERENCE_STAGE_MIN_DIMENSION_PX, 200);
	});

	test("at the 200px reference (scale 1.0 / 100%), renders at exactly the documented base size", () => {
		assert.equal(getHandleVisualSizePx(200, 400, false), 54);
		assert.equal(getHandleVisualSizePx(200, 400, true), 81);
	});

	test("stays exactly at the documented base size above the reference (this project's own normal desktop fixture: ~227px Stage width) — never grows past it", () => {
		assert.equal(
			getHandleVisualSizePx(226.8, 402.8, false),
			STANDARD_HANDLE_VISUAL_PX,
		);
		assert.equal(
			getHandleVisualSizePx(226.8, 402.8, true),
			BRANDED_HANDLE_VISUAL_PX,
		);
		// Far larger than the reference still never exceeds the base size.
		assert.equal(getHandleVisualSizePx(5000, 5000, true), 81);
	});

	test("at 80% of the reference (160px), renders at exactly 43.2px Standard / 64.8px Branded", () => {
		const standard = getHandleVisualSizePx(160, 500, false);
		const branded = getHandleVisualSizePx(160, 500, true);
		assert.ok(Math.abs(standard - 43.2) < 1e-9, `got ${standard}`);
		assert.ok(Math.abs(branded - 64.8) < 1e-9, `got ${branded}`);
		// The *shorter* side drives the calculation, regardless of which axis
		// (width or height) it is.
		assert.equal(getHandleVisualSizePx(500, 160, false), standard);
	});

	test("at 60% of the reference (120px), renders at exactly 32.4px Standard / 48.6px Branded", () => {
		const standard = getHandleVisualSizePx(120, 500, false);
		const branded = getHandleVisualSizePx(120, 500, true);
		assert.ok(Math.abs(standard - 32.4) < 1e-9, `got ${standard}`);
		assert.ok(Math.abs(branded - 48.6) < 1e-9, `got ${branded}`);
	});

	test("proportional scaling starts immediately below the reference — no plateau", () => {
		const at199 = getHandleVisualSizePx(199, 500, false);
		const at180 = getHandleVisualSizePx(180, 500, false);
		assert.ok(at199 < STANDARD_HANDLE_VISUAL_PX);
		assert.ok(
			at180 < at199,
			"180px must render smaller than 199px — no plateau",
		);
	});

	test("never shrinks below the documented minimum, however small the Stage becomes", () => {
		assert.equal(
			getHandleVisualSizePx(1, 1, false),
			MIN_STANDARD_HANDLE_VISUAL_PX,
		);
		assert.equal(
			getHandleVisualSizePx(0.001, 400, true),
			MIN_BRANDED_HANDLE_VISUAL_PX,
		);
		// 40% of the reference (80px) already computes below the floor
		// (0.4 * 54 = 21.6 < 28) — the floor must win.
		assert.equal(getHandleVisualSizePx(80, 500, false), 28);
		assert.equal(getHandleVisualSizePx(80, 500, true), 42);
	});

	test("falls back to the documented base size when the Stage has not been measured yet (0 or negative)", () => {
		assert.equal(getHandleVisualSizePx(0, 0, false), STANDARD_HANDLE_VISUAL_PX);
		assert.equal(getHandleVisualSizePx(0, 0, true), BRANDED_HANDLE_VISUAL_PX);
		assert.equal(
			getHandleVisualSizePx(-5, 100, false),
			STANDARD_HANDLE_VISUAL_PX,
		);
	});

	test("Branded is always exactly HANDLE_ENLARGEMENT_FACTOR times Standard, at every Stage size", () => {
		for (const [w, h] of [
			[226.8, 402.8],
			[200, 400],
			[160, 500],
			[120, 500],
			[100, 250],
			[50, 89],
			[1, 1],
		]) {
			const standard = getHandleVisualSizePx(w, h, false);
			const branded = getHandleVisualSizePx(w, h, true);
			assert.ok(
				Math.abs(branded - standard * HANDLE_ENLARGEMENT_FACTOR) < 1e-9,
			);
		}
	});
});

describe("symbol and standard-arrow colors", () => {
	test("are the documented, distinct Android values", () => {
		assert.equal(SYMBOL_COLOR, "#17202F");
		assert.equal(STANDARD_ARROW_COLOR, "#4f8cff");
		assert.notEqual(
			SYMBOL_COLOR.toLowerCase(),
			STANDARD_ARROW_COLOR.toLowerCase(),
		);
	});
});
