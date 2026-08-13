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
	computeCanvasGeometryForAvailableWidth,
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
		frameWidth: 0,
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
		assert.equal(initialMetadataWidth(874, 16, 0), 874 - 32);
	});

	test("clamps to zero when padding exceeds preview width", () => {
		assert.equal(initialMetadataWidth(10, 16, 0), 0);
	});

	// docs/COMPARISON_PRESENTATION.md Part 3 "Frame": proven necessary
	// (see canvas-geometry.ts's own header comment) once a Frame with a
	// real width is configured — subtracted the same way as padding.
	test("also subtracts frame width from both sides", () => {
		assert.equal(initialMetadataWidth(874, 16, 8), 874 - 32 - 16);
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

	// docs/COMPARISON_PRESENTATION.md Part 3 "Frame": proven necessary (see
	// canvas-geometry.ts's own header comment) — with `box-sizing: border-box`
	// a real Frame border draws inside the already-fixed canvas box, so it
	// must be subtracted from the available Stage area exactly like padding,
	// and added back into canvasWidth/canvasHeight so those still describe
	// the full outer box.
	test("a non-zero frame width shrinks the available Stage area on both axes", () => {
		const withoutFrame = computeCanvasGeometry(
			baseInput({ metadataHeight: 0, frameWidth: 0 }),
		);
		const withFrame = computeCanvasGeometry(
			baseInput({ metadataHeight: 0, frameWidth: 8 }),
		);
		assert.ok(withFrame.stageHeight < withoutFrame.stageHeight);
		assert.ok(withFrame.stageWidth < withoutFrame.stageWidth);
		assert.ok(
			Math.abs(withoutFrame.stageHeight - withFrame.stageHeight - 2 * 8) < 1e-9,
		);
	});

	test("canvasWidth/canvasHeight include the frame width on top of padding", () => {
		const result = computeCanvasGeometry(
			baseInput({ metadataHeight: 60, frameWidth: 8 }),
		);
		assert.ok(
			Math.abs(
				result.canvasWidth -
					(result.stageWidth + 2 * CANVAS_PADDING_PX + 2 * 8),
			) < 1e-9,
		);
		assert.ok(
			Math.abs(
				result.canvasHeight -
					(result.stageHeight +
						CANVAS_CONTENT_GAP_PX +
						60 +
						2 * CANVAS_PADDING_PX +
						2 * 8),
			) < 1e-9,
		);
	});

	test("zero frame width reproduces the exact pre-Frame geometry", () => {
		const result = computeCanvasGeometry(
			baseInput({ metadataHeight: 60, frameWidth: 0 }),
		);
		assert.ok(
			Math.abs(
				result.canvasWidth - (result.stageWidth + 2 * CANVAS_PADDING_PX),
			) < 1e-9,
		);
	});
});

// docs/IMPLEMENTATION_PLAN_V1.md Phase 17, Decision 77 "Embed sizing model":
// the WordPress Embed context's own sizing mode — width is the only external
// constraint, height is always derived from it. No `previewHeight` input
// exists for this function at all (see its own header comment for why).
describe("computeCanvasGeometryForAvailableWidth", () => {
	function widthInput(overrides = {}) {
		return {
			previewWidth: 874,
			ratio: PORTRAIT_RATIO,
			metadataHeight: 0,
			canvasPadding: CANVAS_PADDING_PX,
			contentGap: CANVAS_CONTENT_GAP_PX,
			frameWidth: 0,
			...overrides,
		};
	}

	test("portrait: Stage width is the full available width, height derived from the ratio", () => {
		const result = computeCanvasGeometryForAvailableWidth(
			widthInput({ ratio: PORTRAIT_RATIO }),
		);
		const expectedStageWidth = 874 - 2 * CANVAS_PADDING_PX;
		assert.ok(Math.abs(result.stageWidth - expectedStageWidth) < 1e-9);
		assert.ok(
			Math.abs(result.stageHeight - expectedStageWidth / PORTRAIT_RATIO) < 1e-9,
		);
	});

	test("landscape: Stage width is still the full available width, height derived from the ratio", () => {
		const result = computeCanvasGeometryForAvailableWidth(
			widthInput({ ratio: LANDSCAPE_RATIO }),
		);
		const expectedStageWidth = 874 - 2 * CANVAS_PADDING_PX;
		assert.ok(Math.abs(result.stageWidth - expectedStageWidth) < 1e-9);
		assert.ok(
			Math.abs(result.stageHeight - expectedStageWidth / LANDSCAPE_RATIO) <
				1e-9,
		);
	});

	test("a wider available width increases both Stage width and derived height, aspect ratio preserved", () => {
		const narrow = computeCanvasGeometryForAvailableWidth(
			widthInput({ previewWidth: 400 }),
		);
		const wide = computeCanvasGeometryForAvailableWidth(
			widthInput({ previewWidth: 1200 }),
		);
		assert.ok(wide.stageWidth > narrow.stageWidth);
		assert.ok(wide.stageHeight > narrow.stageHeight);
		assert.ok(
			Math.abs(narrow.stageWidth / narrow.stageHeight - PORTRAIT_RATIO) < 1e-6,
		);
		assert.ok(
			Math.abs(wide.stageWidth / wide.stageHeight - PORTRAIT_RATIO) < 1e-6,
		);
	});

	// Unlike `computeCanvasGeometry`'s height-bound branch, metadataHeight
	// must never affect the Stage's own width/height here — only
	// `canvasHeight` (the metadata block sits below the Stage, never beside
	// it) — since there is no height budget for it to compete with.
	test("metadataHeight affects canvasHeight but never the Stage's own width or height", () => {
		const noMetadata = computeCanvasGeometryForAvailableWidth(
			widthInput({ metadataHeight: 0 }),
		);
		const withMetadata = computeCanvasGeometryForAvailableWidth(
			widthInput({ metadataHeight: 90 }),
		);
		assert.equal(noMetadata.stageWidth, withMetadata.stageWidth);
		assert.equal(noMetadata.stageHeight, withMetadata.stageHeight);
		assert.ok(withMetadata.canvasHeight > noMetadata.canvasHeight);
	});

	test("invalid or not-yet-known ratio (null, zero, negative, NaN): all zero, never NaN", () => {
		for (const ratio of [null, 0, -1, Number.NaN]) {
			const result = computeCanvasGeometryForAvailableWidth(
				widthInput({ ratio }),
			);
			assert.deepEqual(result, {
				stageWidth: 0,
				stageHeight: 0,
				canvasWidth: 0,
				canvasHeight: 0,
			});
		}
	});

	test("invalid preview width (zero, negative): all zero", () => {
		for (const previewWidth of [0, -5]) {
			assert.deepEqual(
				computeCanvasGeometryForAvailableWidth(widthInput({ previewWidth })),
				{ stageWidth: 0, stageHeight: 0, canvasWidth: 0, canvasHeight: 0 },
			);
		}
	});

	test("a non-zero frame width shrinks the available Stage width, matching the height-bound branch's own treatment", () => {
		const withoutFrame = computeCanvasGeometryForAvailableWidth(
			widthInput({ frameWidth: 0 }),
		);
		const withFrame = computeCanvasGeometryForAvailableWidth(
			widthInput({ frameWidth: 8 }),
		);
		assert.ok(withFrame.stageWidth < withoutFrame.stageWidth);
		assert.ok(
			Math.abs(withoutFrame.stageWidth - withFrame.stageWidth - 2 * 8) < 1e-9,
		);
	});

	test("canvasWidth/canvasHeight include padding and frame width, matching the height-bound branch's own formula", () => {
		const result = computeCanvasGeometryForAvailableWidth(
			widthInput({ metadataHeight: 60, frameWidth: 8 }),
		);
		assert.ok(
			Math.abs(
				result.canvasWidth -
					(result.stageWidth + 2 * CANVAS_PADDING_PX + 2 * 8),
			) < 1e-9,
		);
		assert.ok(
			Math.abs(
				result.canvasHeight -
					(result.stageHeight +
						CANVAS_CONTENT_GAP_PX +
						60 +
						2 * CANVAS_PADDING_PX +
						2 * 8),
			) < 1e-9,
		);
	});
});
