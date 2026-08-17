// Coverage for src/lib/comparison-presentation.ts against
// docs/IMPORTED_COMPARISON_V1.md "Content Metadata", "Location Metadata" and
// "Derived Slider Labels", plus docs/COMPARISON_PRESENTATION.md Part 2 "Time"
// ("Reference → Capture · Duration") and Part 3 "Comparison Information"
// ("Show Time Difference"). Pure, deterministic logic — no browser API
// involved — so this belongs in the Node unit suite, not Playwright.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deriveComparisonPresentation } from "../../src/lib/comparison-presentation.ts";

const FALLBACK = "Then";
const SLIDER_LABEL_FALLBACKS = {
	past: "Past",
	present: "Present",
	reference: "Reference",
	current: "Current",
};
const DURATION_LABEL_FALLBACKS = {
	year: "year",
	years: "years",
	month: "month",
	months: "months",
	sameYear: "Same year",
};
const DURATION_LABEL_FALLBACKS_DE = {
	year: "Jahr",
	years: "Jahre",
	month: "Monat",
	months: "Monate",
	sameYear: "Im selben Jahr",
};

function metadataWithRaw(raw, captureTimestampMs = 1700000000000) {
	return {
		version: 6,
		sessionId: undefined,
		captureTimestampMs,
		referenceFile: "reference.jpg",
		captureFile: "capture.jpg",
		raw,
	};
}

describe("deriveComparisonPresentation", () => {
	test("resolves title, description and location from content/location blocks", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({
				content: { title: "White wall", description: "A description." },
				location: {
					displayName: "The Place",
					city: "Berlin",
					country: "Germany",
				},
			}),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);

		assert.equal(result.title, "White wall");
		assert.equal(result.description, "A description.");
		assert.deepEqual(result.location, {
			displayName: "The Place",
			city: "Berlin",
			country: "Germany",
		});
	});

	test("falls back to the legacy top-level `title` field when content.title is absent", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ title: "Legacy Title" }),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);
		assert.equal(result.title, "Legacy Title");
	});

	test("title, description and location are all undefined when absent", () => {
		const result = deriveComparisonPresentation(metadataWithRaw({}), "en", {
			referenceFallbackLabel: FALLBACK,
			sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
			durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
		});
		assert.equal(result.title, undefined);
		assert.equal(result.description, undefined);
		assert.equal(result.location, undefined);
	});

	test("location is undefined unless at least one of its three fields is present", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ location: {} }),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);
		assert.equal(result.location, undefined);
	});

	test("reference label uses the fallback when reference.date is absent", () => {
		const result = deriveComparisonPresentation(metadataWithRaw({}), "en", {
			referenceFallbackLabel: FALLBACK,
			sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
			durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
		});
		assert.equal(result.referenceLabel, FALLBACK);
	});

	test("reference label is the stored year for YYYY precision", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "2024" } }),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);
		assert.equal(result.referenceLabel, "2024");
	});

	test("reference label is a localized month and year for YYYY-MM precision", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "2024-05" } }),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);
		assert.equal(result.referenceLabel, "May 2024");
	});

	test("reference label is a localized full date for YYYY-MM-DD precision", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "2024-05-06" } }),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);
		assert.equal(result.referenceLabel, "May 6, 2024");
	});

	test("reference label falls back for a malformed date value rather than throwing", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "not-a-date" } }),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);
		assert.equal(result.referenceLabel, FALLBACK);
	});

	test("reference label localizes per locale", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "2024-05-06" } }),
			"de",
			{
				referenceFallbackLabel: "Damals",
				sliderLabelFallbacks: {
					past: "Früher",
					present: "Heute",
					reference: "Referenz",
					current: "Aktuell",
				},
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS_DE,
			},
		);
		assert.equal(result.referenceLabel, "6. Mai 2024");
	});

	test("sliderLabels falls back to the canonical referenceFallbackLabel/current wording when reference.date is absent", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({}, Date.UTC(2026, 6, 27)),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);
		// docs/COMPARISON_PRESENTATION.md "Slider Date Labels": derived using
		// the same rules as IMPORTED_COMPARISON_V1.md's Derived Slider Labels —
		// the on-image left label reuses the same canonical `referenceFallbackLabel`
		// (FALLBACK, "Then") the sidebar referenceLabel uses, not a separate
		// slider-only wording.
		assert.deepEqual(result.sliderLabels, {
			left: FALLBACK,
			right: "Current",
		});
	});

	test("sliderLabels are capture-aware, unlike the independently-formatted sidebar referenceLabel", () => {
		// Same year as the capture timestamp below: the sidebar's
		// referenceLabel formats "2024" in isolation, while sliderLabels
		// compares against the capture date and falls back to Past/Present
		// per the ported Android priority chain (compare-slider-labels.test.mjs
		// covers the full chain; this only checks the two are wired together
		// and genuinely differ).
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "2024" } }, Date.UTC(2024, 6, 27)),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);
		assert.equal(result.referenceLabel, "2024");
		assert.deepEqual(result.sliderLabels, { left: "Past", right: "Present" });
	});

	test("capture label is derived from captureTimestampMs and localized", () => {
		const captureTimestampMs = Date.UTC(2026, 6, 27, 12, 0, 0);
		const resultEn = deriveComparisonPresentation(
			metadataWithRaw({}, captureTimestampMs),
			"en",
			{
				referenceFallbackLabel: FALLBACK,
				sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
			},
		);
		const resultDe = deriveComparisonPresentation(
			metadataWithRaw({}, captureTimestampMs),
			"de",
			{
				referenceFallbackLabel: "Damals",
				sliderLabelFallbacks: {
					past: "Früher",
					present: "Heute",
					reference: "Referenz",
					current: "Aktuell",
				},
				durationLabelFallbacks: DURATION_LABEL_FALLBACKS_DE,
			},
		);
		assert.equal(resultEn.captureLabel, "July 27, 2026");
		assert.equal(resultDe.captureLabel, "27. Juli 2026");
	});

	test("never mutates the metadata it reads", () => {
		const raw = {
			content: { title: "Untouched" },
			reference: { date: "2024" },
		};
		const metadata = metadataWithRaw(raw);
		const before = JSON.stringify(raw);
		deriveComparisonPresentation(metadata, "en", {
			referenceFallbackLabel: FALLBACK,
			sliderLabelFallbacks: SLIDER_LABEL_FALLBACKS,
			durationLabelFallbacks: DURATION_LABEL_FALLBACKS,
		});
		assert.equal(JSON.stringify(raw), before);
	});
});

// docs/COMPARISON_PRESENTATION.md Part 2 "Time" ("Reference → Capture ·
// Duration") — every worked example from the approved specification, plus
// the explicitly listed edge cases (year precision, month precision, day
// precision, "Same year", exactly 1 year, exactly 1 month, years+months
// together, the day-of-month carry boundary, missing data, and
// Reference Date > Capture Date). `durationLabel` is exercised only through
// the public `deriveComparisonPresentation` entry point, exactly like
// `referenceLabel`/`captureLabel` above — `deriveDurationLabel` itself is a
// private helper, never exported.
describe("deriveComparisonPresentation — durationLabel (Show Time Difference)", () => {
	function durationFor(referenceDate, captureTimestampMs, locale = "en") {
		const fallbacks =
			locale === "de" ? DURATION_LABEL_FALLBACKS_DE : DURATION_LABEL_FALLBACKS;
		const sliderLabelFallbacks =
			locale === "de"
				? {
						past: "Früher",
						present: "Heute",
						reference: "Referenz",
						current: "Aktuell",
					}
				: SLIDER_LABEL_FALLBACKS;
		return deriveComparisonPresentation(
			metadataWithRaw(
				referenceDate === undefined
					? {}
					: { reference: { date: referenceDate } },
				captureTimestampMs,
			),
			locale,
			{
				referenceFallbackLabel: locale === "de" ? "Damals" : FALLBACK,
				sliderLabelFallbacks,
				durationLabelFallbacks: fallbacks,
			},
		).durationLabel;
	}

	test("year precision: 2019 → 2026 is '7 years'", () => {
		assert.equal(durationFor("2019", Date.UTC(2026, 6, 27)), "7 years");
	});

	test("year precision, same year: 2026 → 2026 is 'Same year'", () => {
		assert.equal(durationFor("2026", Date.UTC(2026, 6, 27)), "Same year");
	});

	test("month precision, years + months: May 2019 → Aug 2026 is '7 years 3 months'", () => {
		assert.equal(
			durationFor("2019-05", Date.UTC(2026, 7, 18)),
			"7 years 3 months",
		);
	});

	test("month precision, months rule (0 months never shown): May 2019 → May 2026 is '7 years'", () => {
		assert.equal(durationFor("2019-05", Date.UTC(2026, 4, 15)), "7 years");
	});

	test("month precision, exactly 1 month (singular): May 2019 → Jun 2019 is '1 month'", () => {
		assert.equal(durationFor("2019-05", Date.UTC(2019, 5, 15)), "1 month");
	});

	test("month precision, same year and month: May 2019 → May 2019 is 'Same year'", () => {
		assert.equal(durationFor("2019-05", Date.UTC(2019, 4, 20)), "Same year");
	});

	test("day precision, day at or after the reference day: 10 May 2019 → 18 Aug 2026 is '7 years 3 months'", () => {
		assert.equal(
			durationFor("2019-05-10", Date.UTC(2026, 7, 18)),
			"7 years 3 months",
		);
	});

	test("day precision, month-boundary carry: 31 May 2019 → 1 Jun 2026 is '7 years' (not '7 years 1 month')", () => {
		assert.equal(durationFor("2019-05-31", Date.UTC(2026, 5, 1)), "7 years");
	});

	test("exactly 1 year (singular)", () => {
		assert.equal(durationFor("2025", Date.UTC(2026, 6, 27)), "1 year");
	});

	test("missing reference date: no duration", () => {
		assert.equal(durationFor(undefined, Date.UTC(2026, 6, 27)), undefined);
	});

	test("Reference Date > Capture Date: no negative duration", () => {
		assert.equal(durationFor("2027", Date.UTC(2026, 6, 27)), undefined);
	});

	test("malformed reference date value: no duration, same as referenceLabel's own fallback path", () => {
		assert.equal(durationFor("not-a-date", Date.UTC(2026, 6, 27)), undefined);
	});

	test("localizes per locale, including the singular/plural unit wording", () => {
		assert.equal(
			durationFor("2019-05", Date.UTC(2026, 7, 18), "de"),
			"7 Jahre 3 Monate",
		);
	});
});
