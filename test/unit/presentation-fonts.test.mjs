// Coverage for src/lib/presentation-fonts.ts: the fixed three-font
// Comparison Presentation Typography catalog (docs/COMPARISON_PRESENTATION.md
// Part 3 "Typography"; docs/IMPLEMENTATION_PLAN_V1.md Phase 8b). Pure,
// deterministic — no browser API — so this belongs in the Node unit suite.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	isPresentationFontId,
	PRESENTATION_FONT_IDS,
	resolvePresentationFontFamily,
} from "../../src/lib/presentation-fonts.ts";

describe("PRESENTATION_FONT_IDS", () => {
	test("contains exactly the three V1 Presentation Fonts", () => {
		assert.deepEqual(PRESENTATION_FONT_IDS, [
			"inter",
			"manrope",
			"space-grotesk",
		]);
	});
});

describe("isPresentationFontId", () => {
	test("accepts every known id", () => {
		for (const id of PRESENTATION_FONT_IDS) {
			assert.equal(isPresentationFontId(id), true);
		}
	});

	test("rejects an unknown value", () => {
		assert.equal(isPresentationFontId("comic-sans"), false);
		assert.equal(isPresentationFontId(""), false);
	});
});

describe("resolvePresentationFontFamily", () => {
	test("resolves each id to its own font-family, with the Application UI system fallback stack", () => {
		assert.equal(
			resolvePresentationFontFamily("inter"),
			'"Inter Variable", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
		);
		assert.equal(
			resolvePresentationFontFamily("manrope"),
			'"Manrope", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
		);
		assert.equal(
			resolvePresentationFontFamily("space-grotesk"),
			'"Space Grotesk Variable", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
		);
	});

	test("every resolved family differs from the other two", () => {
		const resolved = PRESENTATION_FONT_IDS.map((id) =>
			resolvePresentationFontFamily(id),
		);
		assert.equal(new Set(resolved).size, resolved.length);
	});
});
