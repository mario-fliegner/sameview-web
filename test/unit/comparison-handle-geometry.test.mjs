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
	BRANDED_HANDLE_VISUAL_REM,
	getContentBox,
	getEffectiveRingRadiusPx,
	HANDLE_CENTER_PX,
	HANDLE_ENLARGEMENT_FACTOR,
	HANDLE_RADIUS_PX,
	IMAGE_CONTENT_RATIO,
	STANDARD_ARROW_COLOR,
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
	test("returns the standard radius when not branded", () => {
		assert.equal(getEffectiveRingRadiusPx(false), STANDARD_RING_RADIUS_PX);
	});

	test("returns the radius scaled by the same enlargement factor when branded", () => {
		assert.equal(
			getEffectiveRingRadiusPx(true),
			STANDARD_RING_RADIUS_PX * HANDLE_ENLARGEMENT_FACTOR,
		);
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
