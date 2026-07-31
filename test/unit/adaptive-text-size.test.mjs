// Coverage for src/lib/adaptive-text-size.ts against
// docs/COMPARISON_PRESENTATION.md Part 2 "Adaptive Sizing". Pure,
// deterministic arithmetic — no browser API involved — so this belongs in
// the Node unit suite (the actual Canvas `measureText()` glue lives in
// src/lib/text-measurement.ts and is not unit-testable in Node, the same
// gap as src/components/ComparisonSlider.tsx's `measureLabelWidth`).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	computeWrappedLineCount,
	selectAdaptiveTextSize,
} from "../../src/lib/adaptive-text-size.ts";

describe("computeWrappedLineCount", () => {
	test("a single word is always one line", () => {
		assert.equal(computeWrappedLineCount([50], 5, 200), 1);
	});

	test("empty input is zero lines", () => {
		assert.equal(computeWrappedLineCount([], 5, 200), 0);
	});

	test("words that all fit within the available width stay on one line", () => {
		// 30 + 5 + 40 + 5 + 20 = 100, within 120.
		assert.equal(computeWrappedLineCount([30, 40, 20], 5, 120), 1);
	});

	test("wraps to a second line exactly at the boundary", () => {
		// 30 + 5 + 40 = 75 fits in 80; adding the third word (75 + 5 + 20 = 100)
		// does not, so it wraps.
		assert.equal(computeWrappedLineCount([30, 40, 20], 5, 80), 2);
	});

	test("wraps across more than two lines for long content", () => {
		assert.equal(computeWrappedLineCount([50, 50, 50, 50, 50], 5, 100), 5);
	});

	test("an overlong single word is placed on its own line rather than split", () => {
		// The first word alone (300) already exceeds the available width (100),
		// but is still placed on line 1 rather than producing an empty line.
		assert.equal(computeWrappedLineCount([300, 20], 5, 100), 2);
	});
});

describe("selectAdaptiveTextSize", () => {
	test("fits at standard size", () => {
		assert.equal(selectAdaptiveTextSize(1, 2), "standard");
		assert.equal(selectAdaptiveTextSize(2, 2), "standard");
	});

	test("exceeds standard size: steps down to compact", () => {
		assert.equal(selectAdaptiveTextSize(3, 2), "compact");
	});

	test("compact is also chosen when it would still exceed maxLines — the caller's existing line-clamp/ellipsis is the final fallback, not a third state here", () => {
		assert.equal(selectAdaptiveTextSize(10, 2), "compact");
	});

	test("each call is independent: one item's line count never affects another's result", () => {
		const title = selectAdaptiveTextSize(5, 2); // would overflow → compact
		const location = selectAdaptiveTextSize(1, 1); // fits → standard
		assert.equal(title, "compact");
		assert.equal(location, "standard");
	});
});
