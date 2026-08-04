// Pure geometry for the Overflow Tooltip
// (docs/COMPARISON_PRESENTATION.md Part 2 "Overflow Tooltip"). No DOM —
// every input is a plain rectangle/size, every output a plain number, so
// this is unit-testable without a browser and reusable unchanged by
// whatever later renders the same presentation (mirrors
// src/lib/canvas-geometry.ts's own "pure function, unit-tested separately
// from its measurement glue" shape; the DOM measurement glue lives in
// src/lib/overflow-tooltip.ts).
//
// "Viewport-relative" throughout: callers pass rectangles already expressed
// in the same coordinate space `getBoundingClientRect()` and `position:
// fixed` share, so this module never needs to know about scroll offsets,
// the Presentation Canvas, or any other ancestor.

export interface Rect {
	readonly top: number;
	readonly left: number;
	readonly right: number;
	readonly bottom: number;
	readonly width: number;
	readonly height: number;
}

export interface Size {
	readonly width: number;
	readonly height: number;
}

export type TooltipVerticalPlacement = "above" | "below";
export type TooltipHorizontalAlign = "start" | "end";

export interface TooltipPlacement {
	readonly top: number;
	readonly left: number;
	readonly placement: TooltipVerticalPlacement;
	readonly align: TooltipHorizontalAlign;
}

function clamp(value: number, min: number, max: number): number {
	// A negative range (the tooltip's own measured size exceeds the safe
	// viewport area on that axis) still resolves to a defined position
	// rather than an inverted one — `min` is the edge closest to the
	// trigger's own preferred side, so pinning to it is the least
	// surprising fallback. `.presentation-tooltip`'s own `max-width` and
	// `max-height` (src/styles/global.css) are what actually keep this from
	// happening in practice; this is a defensive floor for the math alone.
	if (min > max) return min;
	return Math.min(Math.max(value, min), max);
}

// Decides where the Overflow Tooltip renders relative to its trigger,
// given the trigger's own viewport-relative bounding box, the tooltip's
// own already-measured (unclamped) natural size, the viewport size, and a
// safe inset from every viewport edge. Never estimates a size — every
// caller of this function has already measured the tooltip's real
// bounding box before calling it (see src/lib/overflow-tooltip.ts).
export function computeTooltipPlacement(
	triggerRect: Rect,
	tooltipSize: Size,
	viewportSize: Size,
	insetPx: number,
	gapPx: number,
): TooltipPlacement {
	const spaceAbove = triggerRect.top - insetPx;
	const spaceBelow = viewportSize.height - triggerRect.bottom - insetPx;

	// Prefer "above" (docs/COMPARISON_PRESENTATION.md "Overflow Tooltip":
	// "above or below … depending on available space") whenever it
	// genuinely fits; fall back to "below" when it fits there instead; if
	// neither fully fits, use whichever side offers more room — the
	// tooltip's own internal vertical scroll (global.css) covers the
	// remainder, not this decision.
	const placement: TooltipVerticalPlacement =
		spaceAbove >= tooltipSize.height + gapPx
			? "above"
			: spaceBelow >= tooltipSize.height + gapPx
				? "below"
				: spaceBelow > spaceAbove
					? "below"
					: "above";

	const rawTop =
		placement === "above"
			? triggerRect.top - gapPx - tooltipSize.height
			: triggerRect.bottom + gapPx;

	const top = clamp(
		rawTop,
		insetPx,
		viewportSize.height - insetPx - tooltipSize.height,
	);

	// Prefer "start" (left-aligned with the trigger — docs/
	// COMPARISON_PRESENTATION.md "General Rules": "All items are
	// left-aligned") unless that would push the tooltip's right edge past
	// the safe viewport area, in which case align to the trigger's right
	// edge instead.
	const align: TooltipHorizontalAlign =
		triggerRect.left + tooltipSize.width <= viewportSize.width - insetPx
			? "start"
			: "end";

	const rawLeft =
		align === "start"
			? triggerRect.left
			: triggerRect.right - tooltipSize.width;

	const left = clamp(
		rawLeft,
		insetPx,
		viewportSize.width - insetPx - tooltipSize.width,
	);

	return { top, left, placement, align };
}
