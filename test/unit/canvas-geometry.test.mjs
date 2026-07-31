// Coverage for src/lib/canvas-geometry.ts against
// docs/COMPARISON_PRESENTATION.md Part 1 "Complete Presentation"/"Preview
// Scaling" and Part 2 "Comparison Stage". Pure, deterministic arithmetic —
// no browser API involved — so this belongs in the Node unit suite.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	CANVAS_CONTENT_GAP_PX,
	CANVAS_PADDING_PX,
	computeCanvasGeometry,
	deriveImageRatio,
	initialMetadataWidth,
} from "../../src/lib/canvas-geometry.ts";

const PORTRAIT_RATIO = 0.5625; // matches the real android-export fixture
const LANDSCAPE_RATIO = 1.7778; // 16:9

function baseInput(overrides = {}) {
	return {
		previewWidth: 874,
		previewHeight: 660,
		ratio: PORTRAIT_RATIO,
		metadataHeight: 0,
		canvasPadding: CANVAS_PADDING_PX,
		contentGap: CANVAS_CONTENT_GAP_PX,
		...overrides,
	};
}

describe("deriveImageRatio", () => {
	test("computes width/height for valid dimensions", () => {
		assert.equal(deriveImageRatio({ width: 900, height: 1600 }), 900 / 1600);
	});

	test("returns null for null input", () => {
		assert.equal(deriveImageRatio(null), null);
	});

	test("returns null for zero height", () => {
		assert.equal(deriveImageRatio({ width: 900, height: 0 }), null);
	});

	test("returns null for zero width", () => {
		assert.equal(deriveImageRatio({ width: 0, height: 1600 }), null);
	});

	test("returns null for negative dimensions", () => {
		assert.equal(deriveImageRatio({ width: -1, height: 100 }), null);
	});
});

describe("initialMetadataWidth", () => {
	test("subtracts padding from both sides", () => {
		assert.equal(initialMetadataWidth(874, 16), 874 - 32);
	});

	test("clamps to zero when padding exceeds preview width", () => {
		assert.equal(initialMetadataWidth(10, 16), 0);
	});
});

describe("computeCanvasGeometry", () => {
	test("no metadata visible: no gap reserved, Stage gets the full height budget", () => {
		const result = computeCanvasGeometry(baseInput({ metadataHeight: 0 }));
		const expectedStageHeight = 660 - 2 * CANVAS_PADDING_PX;
		assert.ok(Math.abs(result.stageHeight - expectedStageHeight) < 1e-9);
		assert.ok(
			Math.abs(result.stageWidth - expectedStageHeight * PORTRAIT_RATIO) < 1e-9,
		);
		assert.equal(
			result.canvasHeight,
			result.stageHeight + 0 + 2 * CANVAS_PADDING_PX,
		);
	});

	test("only a title visible: small metadataHeight, gap included", () => {
		const titleHeight = 22;
		const result = computeCanvasGeometry(
			baseInput({ metadataHeight: titleHeight }),
		);
		const expectedStageHeight =
			660 - 2 * CANVAS_PADDING_PX - CANVAS_CONTENT_GAP_PX - titleHeight;
		assert.ok(Math.abs(result.stageHeight - expectedStageHeight) < 1e-9);
	});

	test("short description: metadataHeight reflects a single line", () => {
		const result = computeCanvasGeometry(baseInput({ metadataHeight: 90 }));
		assert.ok(result.stageHeight > 0);
		assert.ok(result.stageHeight < 660 - 2 * CANVAS_PADDING_PX);
	});

	test("three-line description: larger metadataHeight further reduces the Stage, ratio preserved", () => {
		const result = computeCanvasGeometry(baseInput({ metadataHeight: 150 }));
		assert.ok(result.stageHeight > 0);
		assert.ok(
			Math.abs(result.stageWidth / result.stageHeight - PORTRAIT_RATIO) < 1e-6,
			"aspect ratio must be preserved exactly in the height-bound branch",
		);
	});

	test("portrait: height-bound branch, Stage width derived from height", () => {
		const result = computeCanvasGeometry(
			baseInput({ ratio: PORTRAIT_RATIO, previewWidth: 2000 }),
		);
		const expectedStageHeight = 660 - 2 * CANVAS_PADDING_PX;
		assert.ok(Math.abs(result.stageHeight - expectedStageHeight) < 1e-9);
		assert.ok(
			result.stageWidth < 2000,
			"must not consume the full (very wide) preview",
		);
	});

	test("landscape: width-bound branch, Stage height derived from width, independent of metadataHeight", () => {
		const narrowResult = computeCanvasGeometry(
			baseInput({
				ratio: LANDSCAPE_RATIO,
				previewWidth: 400,
				previewHeight: 2000,
				metadataHeight: 0,
			}),
		);
		const wideMetadataResult = computeCanvasGeometry(
			baseInput({
				ratio: LANDSCAPE_RATIO,
				previewWidth: 400,
				previewHeight: 2000,
				metadataHeight: 300,
			}),
		);
		const expectedStageWidth = 400 - 2 * CANVAS_PADDING_PX;
		assert.ok(Math.abs(narrowResult.stageWidth - expectedStageWidth) < 1e-9);
		// Width-bound branch: Stage width must not depend on metadataHeight at all.
		assert.equal(narrowResult.stageWidth, wideMetadataResult.stageWidth);
	});

	test("extremely small preview: clamps to zero, never negative, never NaN", () => {
		const result = computeCanvasGeometry(
			baseInput({ previewWidth: 10, previewHeight: 10, metadataHeight: 50 }),
		);
		assert.equal(result.stageWidth, 0);
		assert.equal(result.stageHeight, 0);
		assert.ok(result.canvasWidth >= 0);
		assert.ok(result.canvasHeight >= 0);
		assert.ok(Number.isFinite(result.canvasWidth));
		assert.ok(Number.isFinite(result.canvasHeight));
	});

	test("invalid or not-yet-known ratio (null, zero, negative, NaN): all zero, never NaN", () => {
		for (const ratio of [null, 0, -1, Number.NaN]) {
			const result = computeCanvasGeometry(baseInput({ ratio }));
			assert.deepEqual(result, {
				stageWidth: 0,
				stageHeight: 0,
				canvasWidth: 0,
				canvasHeight: 0,
			});
		}
	});

	test("invalid preview dimensions (zero, negative): all zero", () => {
		assert.deepEqual(computeCanvasGeometry(baseInput({ previewWidth: 0 })), {
			stageWidth: 0,
			stageHeight: 0,
			canvasWidth: 0,
			canvasHeight: 0,
		});
		assert.deepEqual(computeCanvasGeometry(baseInput({ previewHeight: -5 })), {
			stageWidth: 0,
			stageHeight: 0,
			canvasWidth: 0,
			canvasHeight: 0,
		});
	});

	test("canvasHeight never exceeds previewHeight across a spread of metadata heights", () => {
		for (const metadataHeight of [0, 22, 60, 90, 150, 300]) {
			const result = computeCanvasGeometry(baseInput({ metadataHeight }));
			assert.ok(
				result.canvasHeight <= 660 + 1e-9,
				`canvasHeight ${result.canvasHeight} exceeded previewHeight for metadataHeight=${metadataHeight}`,
			);
		}
	});

	test("canvasWidth equals stageWidth plus horizontal padding", () => {
		const result = computeCanvasGeometry(baseInput({ metadataHeight: 60 }));
		assert.ok(
			Math.abs(
				result.canvasWidth - (result.stageWidth + 2 * CANVAS_PADDING_PX),
			) < 1e-9,
		);
	});
});
