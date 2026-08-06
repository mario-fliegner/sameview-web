// Coverage for src/lib/hex-color.ts (docs/COMPARISON_PRESENTATION.md "Custom
// Color Editing") — the shared HEX normalizer every Custom Color control
// depends on: Presentation Configuration's Background/Frame/Text
// (src/lib/comparison-edit.ts, which re-exports this module's own
// `normalizeHexColor` unchanged — see test/unit/comparison-edit.test.mjs's
// own "normalizeHexColor" suite, still covering that re-export) and a
// Built-in Symbol's Color (src/lib/branding.ts).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeHexColor } from "../../src/lib/hex-color.ts";

describe("normalizeHexColor", () => {
	test("accepts a value with a leading #, uppercased", () => {
		assert.equal(normalizeHexColor("#ff00ff"), "#FF00FF");
	});

	test("accepts a value without a leading #, uppercased", () => {
		assert.equal(normalizeHexColor("ff00ff"), "#FF00FF");
	});

	test("accepts surrounding whitespace", () => {
		assert.equal(normalizeHexColor("  #abcabc  "), "#ABCABC");
	});

	test("rejects a value with the wrong number of digits", () => {
		assert.equal(normalizeHexColor("#fff"), undefined);
	});

	test("rejects a non-hex value", () => {
		assert.equal(normalizeHexColor("not-a-color"), undefined);
	});

	test("rejects an empty value", () => {
		assert.equal(normalizeHexColor(""), undefined);
	});
});
