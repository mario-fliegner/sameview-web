// Pure geometry for the Presentation Canvas (docs/COMPARISON_PRESENTATION.md
// Part 1 "Complete Presentation", "Preview Scaling"; docs/APPLICATION_LAYOUT.md
// "Viewer"). No DOM, no React — every input is a plain number, every output a
// plain number, so this is unit-testable without a browser and reusable
// unchanged if a future output type ever needs the same layout math.
//
// Replaces an earlier CSS-only attempt (`width: fit-content` combined with
// flexbox and `aspect-ratio` on the Comparison Stage) that was empirically
// proven unreliable during this feature's design: the Comparison Stage has
// no in-flow content (its images are `position: absolute`), so it never
// contributes a usable width to a `fit-content` ancestor's shrink-to-fit
// calculation — the Comparison Information block's own intrinsic text width
// won instead, in every tested scenario, including cases where it silently
// violated the configured image aspect ratio. This module computes the same
// geometry explicitly so the result is deterministic and independently
// testable.

export const CANVAS_PADDING_PX = 16;
// docs/COMPARISON_PRESENTATION.md "One Cohesive Card" / "General Rules":
// "only a small padding separates" the Comparison Stage from Comparison
// Information — must stay numerically equal to the `--content-gap`
// fallback in src/styles/global.css's `.presentation-canvas__info-wrapper`.
export const CANVAS_CONTENT_GAP_PX = 8;
export const GEOMETRY_STABILITY_TOLERANCE_PX = 1;
export const MAX_GEOMETRY_MEASUREMENTS = 5;

export interface ImageDimensions {
	readonly width: number;
	readonly height: number;
}

export interface CanvasGeometryInput {
	readonly previewWidth: number;
	readonly previewHeight: number;
	readonly ratio: number | null;
	readonly metadataHeight: number;
	readonly canvasPadding: number;
	readonly contentGap: number;
	// docs/COMPARISON_PRESENTATION.md Part 3 "Frame": 0 when Frame is "None".
	// Proven necessary empirically, not added speculatively — with
	// `box-sizing: border-box` (global reset) and a real border width, the
	// border draws inside the already-fixed canvas box, so the content area
	// left for padding + Stage shrinks by `2 * frameWidth` on each axis; when
	// this wasn't accounted for here, the Stage measurably overflowed the
	// intended padding on the trailing/bottom edge by exactly that amount.
	readonly frameWidth: number;
}

export interface CanvasGeometryResult {
	readonly stageWidth: number;
	readonly stageHeight: number;
	readonly canvasWidth: number;
	readonly canvasHeight: number;
}

const ZERO_RESULT: CanvasGeometryResult = {
	stageWidth: 0,
	stageHeight: 0,
	canvasWidth: 0,
	canvasHeight: 0,
};

// Derives the image aspect ratio (width/height) from natural pixel
// dimensions, guarding the one input that could otherwise produce a
// division-by-zero/NaN/Infinity downstream.
export function deriveImageRatio(
	dimensions: ImageDimensions | null,
): number | null {
	if (!dimensions) return null;
	if (!(dimensions.width > 0) || !(dimensions.height > 0)) return null;
	return dimensions.width / dimensions.height;
}

// The Comparison Information block's own initial render width, before any
// geometry has ever been computed — the widest the Comparison Stage could
// legitimately ever be. Every later measurement only narrows the width down
// from here (a narrower width can only make text wrap onto equal-or-more
// lines, never fewer), which is what makes the bootstrap/iteration this
// value feeds into monotonically convergent rather than merely "usually
// fine": see the consumer (src/components/WorkspaceActive.tsx) for the
// iteration this return value bootstraps.
export function initialMetadataWidth(
	previewWidth: number,
	canvasPadding: number,
	frameWidth: number,
): number {
	return Math.max(0, previewWidth - 2 * canvasPadding - 2 * frameWidth);
}

// docs/COMPARISON_PRESENTATION.md Part 2 "Comparison Stage": "always
// occupies the maximum possible space inside the Presentation Canvas." The
// Comparison Information block gets its own (measured) height first — it
// never shrinks or grows to make room for the Stage — and the Comparison
// Stage receives whatever height remains, deriving its width from the
// configured image ratio and never exceeding the available width.
export function computeCanvasGeometry(
	input: CanvasGeometryInput,
): CanvasGeometryResult {
	const {
		previewWidth,
		previewHeight,
		ratio,
		metadataHeight,
		canvasPadding,
		contentGap,
		frameWidth,
	} = input;

	if (
		ratio === null ||
		!(ratio > 0) ||
		!(previewWidth > 0) ||
		!(previewHeight > 0)
	) {
		return ZERO_RESULT;
	}

	// docs/COMPARISON_PRESENTATION.md "General Rules": "Hidden or unavailable
	// items reserve no space" — the gap between the Comparison Stage and the
	// Comparison Information block only exists when there is something
	// visible to separate the Stage from.
	const gap = metadataHeight > 0 ? contentGap : 0;

	const availableWidth = Math.max(
		0,
		previewWidth - 2 * canvasPadding - 2 * frameWidth,
	);
	const availableHeight = Math.max(
		0,
		previewHeight - 2 * canvasPadding - 2 * frameWidth - gap - metadataHeight,
	);

	let stageHeight = availableHeight;
	let stageWidth = stageHeight * ratio;

	if (stageWidth > availableWidth) {
		stageWidth = availableWidth;
		stageHeight = stageWidth / ratio;
	}

	return {
		stageWidth,
		stageHeight,
		canvasWidth: stageWidth + 2 * canvasPadding + 2 * frameWidth,
		canvasHeight:
			stageHeight + gap + metadataHeight + 2 * canvasPadding + 2 * frameWidth,
	};
}
