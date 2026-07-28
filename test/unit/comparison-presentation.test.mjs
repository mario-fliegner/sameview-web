// Coverage for src/lib/comparison-presentation.ts against
// docs/IMPORTED_COMPARISON_V1.md "Content Metadata", "Location Metadata" and
// "Derived Slider Labels". Pure, deterministic logic — no browser API
// involved — so this belongs in the Node unit suite, not Playwright.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deriveComparisonPresentation } from "../../src/lib/comparison-presentation.ts";

const FALLBACK = "Then";

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
			{ referenceFallbackLabel: FALLBACK },
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
			{ referenceFallbackLabel: FALLBACK },
		);
		assert.equal(result.title, "Legacy Title");
	});

	test("title, description and location are all undefined when absent", () => {
		const result = deriveComparisonPresentation(metadataWithRaw({}), "en", {
			referenceFallbackLabel: FALLBACK,
		});
		assert.equal(result.title, undefined);
		assert.equal(result.description, undefined);
		assert.equal(result.location, undefined);
	});

	test("location is undefined unless at least one of its three fields is present", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ location: {} }),
			"en",
			{ referenceFallbackLabel: FALLBACK },
		);
		assert.equal(result.location, undefined);
	});

	test("reference label uses the fallback when reference.date is absent", () => {
		const result = deriveComparisonPresentation(metadataWithRaw({}), "en", {
			referenceFallbackLabel: FALLBACK,
		});
		assert.equal(result.referenceLabel, FALLBACK);
	});

	test("reference label is the stored year for YYYY precision", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "2024" } }),
			"en",
			{ referenceFallbackLabel: FALLBACK },
		);
		assert.equal(result.referenceLabel, "2024");
	});

	test("reference label is a localized month and year for YYYY-MM precision", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "2024-05" } }),
			"en",
			{ referenceFallbackLabel: FALLBACK },
		);
		assert.equal(result.referenceLabel, "May 2024");
	});

	test("reference label is a localized full date for YYYY-MM-DD precision", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "2024-05-06" } }),
			"en",
			{ referenceFallbackLabel: FALLBACK },
		);
		assert.equal(result.referenceLabel, "May 6, 2024");
	});

	test("reference label falls back for a malformed date value rather than throwing", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "not-a-date" } }),
			"en",
			{ referenceFallbackLabel: FALLBACK },
		);
		assert.equal(result.referenceLabel, FALLBACK);
	});

	test("reference label localizes per locale", () => {
		const result = deriveComparisonPresentation(
			metadataWithRaw({ reference: { date: "2024-05-06" } }),
			"de",
			{ referenceFallbackLabel: "Damals" },
		);
		assert.equal(result.referenceLabel, "6. Mai 2024");
	});

	test("capture label is derived from captureTimestampMs and localized", () => {
		const captureTimestampMs = Date.UTC(2026, 6, 27, 12, 0, 0);
		const resultEn = deriveComparisonPresentation(
			metadataWithRaw({}, captureTimestampMs),
			"en",
			{ referenceFallbackLabel: FALLBACK },
		);
		const resultDe = deriveComparisonPresentation(
			metadataWithRaw({}, captureTimestampMs),
			"de",
			{ referenceFallbackLabel: "Damals" },
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
		});
		assert.equal(JSON.stringify(raw), before);
	});
});
