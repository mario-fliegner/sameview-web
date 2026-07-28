// Coverage for src/lib/compare-slider-labels.ts — the ported Android
// five-level comparison-label priority chain (CompareLabelLogic.kt
// `computeCompareLabels`). Pure, deterministic logic — no browser API
// involved — so this belongs in the Node unit suite, not Playwright.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeCompareSliderLabels } from "../../src/lib/compare-slider-labels.ts";

const FALLBACKS = {
	past: "Past",
	present: "Present",
	reference: "Reference",
	current: "Current",
};

describe("computeCompareSliderLabels", () => {
	test("Level 5: falls back to Reference/Current when reference.date is absent", () => {
		const result = computeCompareSliderLabels(
			undefined,
			Date.UTC(2026, 6, 27),
			"en",
			FALLBACKS,
		);
		assert.deepEqual(result, { left: "Reference", right: "Current" });
	});

	test("Level 1: different years produce bare year labels", () => {
		const result = computeCompareSliderLabels(
			"2019",
			Date.UTC(2024, 6, 27),
			"en",
			FALLBACKS,
		);
		assert.deepEqual(result, { left: "2019", right: "2024" });
	});

	test("Level 1: year-precision reference in the same year as capture falls back to Past/Present", () => {
		const result = computeCompareSliderLabels(
			"2024",
			Date.UTC(2024, 6, 27),
			"en",
			FALLBACKS,
		);
		assert.deepEqual(result, { left: "Past", right: "Present" });
	});

	test("Level 2: same year, different months formats abbreviated month and year on both sides", () => {
		const result = computeCompareSliderLabels(
			"2024-01",
			Date.UTC(2024, 6, 27),
			"en",
			FALLBACKS,
		);
		assert.deepEqual(result, { left: "Jan 2024", right: "Jul 2024" });
	});

	test("Level 2: month-precision reference in the same month as capture falls back to Past/Present", () => {
		const result = computeCompareSliderLabels(
			"2024-07",
			Date.UTC(2024, 6, 27),
			"en",
			FALLBACKS,
		);
		assert.deepEqual(result, { left: "Past", right: "Present" });
	});

	test("Level 3: same year and month with day precision formats day and abbreviated month on both sides", () => {
		const result = computeCompareSliderLabels(
			"2024-07-06",
			Date.UTC(2024, 6, 27),
			"en",
			FALLBACKS,
		);
		assert.deepEqual(result, { left: "6 Jul", right: "27 Jul" });
	});

	test("Level 3: applies even when reference and capture fall on the same day", () => {
		const result = computeCompareSliderLabels(
			"2024-07-27",
			Date.UTC(2024, 6, 27),
			"en",
			FALLBACKS,
		);
		assert.deepEqual(result, { left: "27 Jul", right: "27 Jul" });
	});

	test("localizes month/year and day/month formats while keeping Android's fixed token order", () => {
		const monthYear = computeCompareSliderLabels(
			"2024-01",
			Date.UTC(2024, 6, 27),
			"de",
			FALLBACKS,
		);
		// Fixed order (month, then year) regardless of locale — only the
		// month name itself is localized via Intl, matching Android's
		// SimpleDateFormat("MMM yyyy", locale) pattern behavior.
		assert.deepEqual(monthYear, {
			left: `${new Intl.DateTimeFormat("de", { month: "short" }).format(new Date(2024, 0, 1))} 2024`,
			right: `${new Intl.DateTimeFormat("de", { month: "short" }).format(new Date(2024, 6, 1))} 2024`,
		});

		const dayMonth = computeCompareSliderLabels(
			"2024-07-06",
			Date.UTC(2024, 6, 27),
			"de",
			FALLBACKS,
		);
		const julDe = new Intl.DateTimeFormat("de", { month: "short" }).format(
			new Date(2024, 6, 1),
		);
		assert.deepEqual(dayMonth, { left: `6 ${julDe}`, right: `27 ${julDe}` });
	});
});
