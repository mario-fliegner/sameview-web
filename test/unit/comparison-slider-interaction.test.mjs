// Coverage for src/lib/comparison-slider-interaction.ts — the single shared
// interaction source src/components/ComparisonSlider.tsx (React binding)
// and src/lib/comparison-presentation-runtime.ts (vanilla-DOM binding for
// generated outputs) both consume unchanged. Regression coverage for the
// existing behaviors this module was extracted from, unchanged: keyboard
// step/clamp, pointer-position math, on-image label edge-collision math.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	clampPercent,
	computeLabelVisibility,
	dividerPositionPx,
	nextPositionForKey,
	positionFromClientX,
	SLIDER_KEYBOARD_STEP,
} from "../../src/lib/comparison-slider-interaction.ts";

describe("clampPercent", () => {
	test("clamps into [0, 100]", () => {
		assert.equal(clampPercent(-5), 0);
		assert.equal(clampPercent(105), 100);
		assert.equal(clampPercent(42.5), 42.5);
	});
});

describe("positionFromClientX", () => {
	test("computes a percentage from clientX relative to the frame's origin/width", () => {
		assert.equal(positionFromClientX(50, 0, 200), 25);
		assert.equal(positionFromClientX(150, 0, 200), 75);
	});

	test("clamps outside the frame's own bounds", () => {
		assert.equal(positionFromClientX(-50, 0, 200), 0);
		assert.equal(positionFromClientX(500, 0, 200), 100);
	});

	test("returns undefined rather than dividing by zero when the frame has no measured width yet", () => {
		assert.equal(positionFromClientX(50, 0, 0), undefined);
	});

	test("accounts for a non-zero origin (the frame's own viewport-relative left edge)", () => {
		assert.equal(positionFromClientX(150, 100, 200), 25);
	});
});

describe("nextPositionForKey", () => {
	test("ArrowLeft/ArrowDown step down by the default step, clamped at 0", () => {
		assert.equal(nextPositionForKey("ArrowLeft", 50), 45);
		assert.equal(nextPositionForKey("ArrowDown", 50), 45);
		assert.equal(nextPositionForKey("ArrowLeft", 2), 0);
	});

	test("ArrowRight/ArrowUp step up by the default step, clamped at 100", () => {
		assert.equal(nextPositionForKey("ArrowRight", 50), 55);
		assert.equal(nextPositionForKey("ArrowUp", 50), 55);
		assert.equal(nextPositionForKey("ArrowRight", 98), 100);
	});

	test("Home/End jump to the extremes", () => {
		assert.equal(nextPositionForKey("Home", 73), 0);
		assert.equal(nextPositionForKey("End", 12), 100);
	});

	test("an unhandled key returns undefined, never a position", () => {
		assert.equal(nextPositionForKey("Tab", 50), undefined);
		assert.equal(nextPositionForKey("a", 50), undefined);
	});

	test("accepts a custom step", () => {
		assert.equal(nextPositionForKey("ArrowRight", 50, 10), 60);
	});

	test("the default step matches the documented Android CompareScreen step", () => {
		assert.equal(SLIDER_KEYBOARD_STEP, 5);
	});
});

describe("dividerPositionPx", () => {
	test("converts a percent position into a pixel offset within the frame", () => {
		assert.equal(dividerPositionPx(50, 400), 200);
		assert.equal(dividerPositionPx(0, 400), 0);
		assert.equal(dividerPositionPx(100, 400), 400);
	});
});

describe("computeLabelVisibility", () => {
	const BASE = {
		showDateLabels: true,
		frameWidthPx: 400,
		dividerXPx: 200,
		effectiveRingRadiusPx: 27,
		labelGapPx: 8,
		leftLabelWidthPx: 40,
		rightLabelWidthPx: 40,
	};

	test("both labels show when there is room on both sides", () => {
		const result = computeLabelVisibility(BASE);
		assert.deepEqual(result, { showLeft: true, showRight: true });
	});

	test("showDateLabels=false hides both regardless of available room", () => {
		const result = computeLabelVisibility({ ...BASE, showDateLabels: false });
		assert.deepEqual(result, { showLeft: false, showRight: false });
	});

	test("a label independently hides once its own bounds would cross the frame edge", () => {
		// Divider near the left edge: the left label no longer fits.
		const nearLeft = computeLabelVisibility({ ...BASE, dividerXPx: 30 });
		assert.equal(nearLeft.showLeft, false);
		assert.equal(nearLeft.showRight, true);

		// Divider near the right edge: the right label no longer fits.
		const nearRight = computeLabelVisibility({ ...BASE, dividerXPx: 370 });
		assert.equal(nearRight.showLeft, true);
		assert.equal(nearRight.showRight, false);
	});

	test("hides both while the frame has not been measured yet (frameWidthPx = 0)", () => {
		const result = computeLabelVisibility({ ...BASE, frameWidthPx: 0 });
		assert.deepEqual(result, { showLeft: false, showRight: false });
	});

	test("a branding-enlarged ring radius shrinks the room available to each label", () => {
		// 80 - 27 - 8 - 40 = 5 >= 0 (fits); 80 - 40.5 - 8 - 40 = -8.5 < 0 (does not).
		const standard = computeLabelVisibility({ ...BASE, dividerXPx: 80 });
		const branded = computeLabelVisibility({
			...BASE,
			dividerXPx: 80,
			effectiveRingRadiusPx: 27 * 1.5,
		});
		assert.equal(standard.showLeft, true);
		assert.equal(branded.showLeft, false);
	});

	test("the boundary itself (exactly zero remaining room) still shows the label", () => {
		// dividerXPx - ringRadius - gap - labelWidth === 0 exactly.
		const result = computeLabelVisibility({
			...BASE,
			dividerXPx: 27 + 8 + 40,
			leftLabelWidthPx: 40,
		});
		assert.equal(result.showLeft, true);
	});
});
