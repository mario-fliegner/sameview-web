// Pure, framework-independent Comparison Stage slider interaction logic
// (docs/COMPARISON_PRESENTATION.md Part 1 "Interaction Parity": "Presentation
// interaction is defined once, by the presentation model. It is never
// redefined separately by an individual output type";
// docs/IMPLEMENTATION_PLAN_V1.md Section 3: "Never implement an independent
// slider, tooltip, branding or presentation implementation per output
// type"). Position math, keyboard mapping and on-image label edge-collision
// math only — no DOM, no React, no pointer-capture calls. This is the single
// source both src/components/ComparisonSlider.tsx (React binding: refs,
// `useState`, `setPointerCapture`) and the generated Standalone HTML/Static
// Microsite runtime (src/lib/comparison-presentation-runtime.ts — plain
// `addEventListener` binding) consume unchanged; each binding layer owns
// only its own event wiring and DOM reads/writes, never a second copy of the
// decisions below.
//
// Mirrors src/lib/canvas-geometry.ts's and src/lib/overflow-tooltip-geometry.ts's
// own shape: "pure function, unit-tested separately from its DOM/React
// glue".

export function clampPercent(value: number): number {
	return Math.min(100, Math.max(0, value));
}

// `widthPx === 0` (not yet measured) returns `undefined` rather than a
// misleading `0`/`NaN` — the caller (a binding layer) decides what "no
// change" means for its own state, exactly like the original inline
// `if (widthPx === 0) return;` guard this replaces.
export function positionFromClientX(
	clientX: number,
	originLeftPx: number,
	widthPx: number,
): number | undefined {
	if (widthPx === 0) return undefined;
	const ratio = (clientX - originLeftPx) / widthPx;
	return clampPercent(ratio * 100);
}

// Android CompareScreen keyboard step; exported so both binding layers use
// the exact same default without redeclaring the literal.
export const SLIDER_KEYBOARD_STEP = 5;

// `undefined` for a key this control does not handle — lets each binding
// layer decide whether to call `preventDefault()`/re-render only for a key
// that actually produced a new position, without a second "is this one of
// our keys" check duplicating the switch below.
export function nextPositionForKey(
	key: string,
	currentPosition: number,
	step: number = SLIDER_KEYBOARD_STEP,
): number | undefined {
	switch (key) {
		case "ArrowLeft":
		case "ArrowDown":
			return Math.max(0, currentPosition - step);
		case "ArrowRight":
		case "ArrowUp":
			return Math.min(100, currentPosition + step);
		case "Home":
			return 0;
		case "End":
			return 100;
		default:
			return undefined;
	}
}

export function dividerPositionPx(
	position: number,
	frameWidthPx: number,
): number {
	return (position / 100) * frameWidthPx;
}

// Android CompareDivider: showLeftLabel/showRightLabel — each label
// independently disappears once its own measured bounds would reach or
// cross the corresponding Viewer edge, not at an arbitrary percentage.
export interface LabelVisibilityInput {
	readonly showDateLabels: boolean;
	readonly frameWidthPx: number;
	readonly dividerXPx: number;
	readonly effectiveRingRadiusPx: number;
	readonly labelGapPx: number;
	readonly leftLabelWidthPx: number;
	readonly rightLabelWidthPx: number;
}

export interface LabelVisibilityResult {
	readonly showLeft: boolean;
	readonly showRight: boolean;
}

export function computeLabelVisibility(
	input: LabelVisibilityInput,
): LabelVisibilityResult {
	const {
		showDateLabels,
		frameWidthPx,
		dividerXPx,
		effectiveRingRadiusPx,
		labelGapPx,
		leftLabelWidthPx,
		rightLabelWidthPx,
	} = input;
	const showLeft =
		showDateLabels &&
		frameWidthPx > 0 &&
		dividerXPx - effectiveRingRadiusPx - labelGapPx - leftLabelWidthPx >= 0;
	const showRight =
		showDateLabels &&
		frameWidthPx > 0 &&
		dividerXPx + effectiveRingRadiusPx + labelGapPx + rightLabelWidthPx <=
			frameWidthPx;
	return { showLeft, showRight };
}
