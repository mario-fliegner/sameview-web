// Coverage for src/lib/overflow-tooltip-geometry.ts against
// docs/COMPARISON_PRESENTATION.md Part 2 "Overflow Tooltip". Pure,
// deterministic arithmetic — no browser API involved — so this belongs in
// the Node unit suite (the actual DOM measurement/positioning glue lives in
// src/lib/overflow-tooltip.ts and is not unit-testable in Node, the same
// gap as src/lib/text-measurement.ts).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeTooltipPlacement } from "../../src/lib/overflow-tooltip-geometry.ts";

const VIEWPORT = { width: 1000, height: 800 };
const INSET = 8;
const GAP = 6;

function rect(overrides = {}) {
	const base = {
		top: 300,
		left: 100,
		right: 300,
		bottom: 320,
		width: 200,
		height: 20,
	};
	return { ...base, ...overrides };
}

describe("computeTooltipPlacement", () => {
	test("plenty of room on both sides: prefers above", () => {
		const result = computeTooltipPlacement(
			rect(),
			{ width: 150, height: 60 },
			VIEWPORT,
			INSET,
			GAP,
		);
		assert.equal(result.placement, "above");
		assert.equal(result.top, 300 - GAP - 60);
	});

	test("no room above, room below: falls back to below", () => {
		const trigger = rect({ top: 10, bottom: 30 });
		const result = computeTooltipPlacement(
			trigger,
			{ width: 150, height: 60 },
			VIEWPORT,
			INSET,
			GAP,
		);
		assert.equal(result.placement, "below");
		assert.equal(result.top, 30 + GAP);
	});

	test("no room on either side: uses whichever side has more space, still clamped inside the viewport", () => {
		const trigger = rect({ top: 5, bottom: 795 }); // nearly the entire viewport height
		const result = computeTooltipPlacement(
			trigger,
			{ width: 150, height: 60 },
			VIEWPORT,
			INSET,
			GAP,
		);
		assert.ok(result.top >= INSET);
		assert.ok(result.top + 60 <= VIEWPORT.height - INSET);
	});

	test("left-aligned with the trigger when there is enough room on the right", () => {
		const result = computeTooltipPlacement(
			rect({ left: 50, right: 150 }),
			{ width: 150, height: 60 },
			VIEWPORT,
			INSET,
			GAP,
		);
		assert.equal(result.align, "start");
		assert.equal(result.left, 50);
	});

	test("switches to right-aligned when left-alignment would overflow the right edge", () => {
		const trigger = rect({ left: 900, right: 950 });
		const result = computeTooltipPlacement(
			trigger,
			{ width: 300, height: 60 },
			VIEWPORT,
			INSET,
			GAP,
		);
		assert.equal(result.align, "end");
		assert.equal(result.left, 950 - 300);
	});

	test("final position never extends past any viewport edge, even for a very wide/tall tooltip near a corner", () => {
		const trigger = rect({ top: 5, left: 5, right: 55, bottom: 25 });
		const result = computeTooltipPlacement(
			trigger,
			{ width: 900, height: 700 },
			VIEWPORT,
			INSET,
			GAP,
		);
		assert.ok(result.top >= INSET - 1e-9);
		assert.ok(result.left >= INSET - 1e-9);
		assert.ok(result.top + 700 <= VIEWPORT.height - INSET + 1e-9);
		assert.ok(result.left + 900 <= VIEWPORT.width - INSET + 1e-9);
	});

	test("a tooltip taller than the entire safe viewport area still resolves to a defined, non-inverted position", () => {
		const result = computeTooltipPlacement(
			rect({ top: 400, bottom: 420 }),
			{ width: 150, height: 5000 },
			VIEWPORT,
			INSET,
			GAP,
		);
		assert.equal(result.top, INSET);
	});

	test("a tooltip wider than the entire safe viewport area still resolves to a defined, non-inverted position", () => {
		const result = computeTooltipPlacement(
			rect({ left: 500, right: 550 }),
			{ width: 5000, height: 60 },
			VIEWPORT,
			INSET,
			GAP,
		);
		assert.equal(result.left, INSET);
	});
});
