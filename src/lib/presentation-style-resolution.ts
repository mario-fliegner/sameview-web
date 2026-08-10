// Resolves Presentation Configuration's semantic Canvas Background/Frame/Text
// values (docs/COMPARISON_PRESENTATION.md Part 3, Part 4 "Semantic
// Presentation Configuration") into concrete rendering values — colors and
// pixel widths. Pure, no DOM/React: the single source for
// src/components/WorkspaceActive.tsx's live Workspace Preview and the
// generated Standalone HTML/Static Microsite (src/lib/comparison-artifact-markup.ts),
// so "Brand" or "Automatic" is never resolved a second, independently
// maintained way per consumer (docs/IMPLEMENTATION_PLAN_V1.md Section 3:
// "Never implement an independent ... presentation implementation per
// output type").

import type { PresentationConfiguration } from "./workspace-state.ts";

// docs/BRAND_GUIDE.md "Brand Accent Color" (#4F8CFF) — the one existing
// brand-specific color token, reused as-is rather than a second, slightly
// different blue (mirrors src/lib/comparison-handle-geometry.ts's own
// SYMBOL_COLOR_BRAND for the identical reason).
export const BRAND_ACCENT_COLOR = "#4F8CFF";

// docs/COMPARISON_PRESENTATION.md Part 3 "Frame": "Frame width is not a user
// setting … concrete frame width is a rendering concern" — this is that
// rendering decision, a fixed value applied whenever Frame is not "none".
export const FRAME_WIDTH_PX = 8;

// docs/COMPARISON_PRESENTATION.md Part 3 "Corner Radius": "Sharp"/"Rounded".
// 0.75rem matches the corner radius this canvas already used unconditionally
// before this option existed, kept as the concrete "Rounded" value so the
// documented default reproduces today's existing appearance unchanged.
export const CORNER_RADIUS_ROUNDED_PX = "0.75rem";
export const CORNER_RADIUS_SHARP_PX = "0";

// docs/COMPARISON_PRESENTATION.md "Text" → "Light": "the project's existing
// light presentation text color".
export const LIGHT_TEXT_COLOR = "#FFFFFF";
// docs/BRAND_GUIDE.md "Brand Identity Color" — Text's "Dark" value
// (docs/COMPARISON_PRESENTATION.md "Text" → "Dark": "not pure black").
export const DARK_TEXT_COLOR = "#0D1424";

export function resolveCanvasBackground(
	background: PresentationConfiguration["canvasBackground"],
): string {
	switch (background.kind) {
		case "transparent":
			return "transparent";
		case "white":
			return "#FFFFFF";
		case "black":
			return "#000000";
		case "brand":
			return BRAND_ACCENT_COLOR;
		case "custom":
			return background.color;
	}
}

export interface ResolvedFrame {
	readonly color: string;
	readonly widthPx: number;
}

export function resolveFrame(
	frame: PresentationConfiguration["frame"],
): ResolvedFrame {
	switch (frame.kind) {
		case "none":
			return { color: "transparent", widthPx: 0 };
		case "white":
			return { color: "#FFFFFF", widthPx: FRAME_WIDTH_PX };
		case "black":
			return { color: "#000000", widthPx: FRAME_WIDTH_PX };
		case "custom":
			return { color: frame.color, widthPx: FRAME_WIDTH_PX };
	}
}

// Relative luminance of a `#RRGGBB` hex color, sRGB-linearized per the
// standard WCAG/ITU-R BT.709 coefficients — used only to pick a light or
// dark text tone for "Automatic" (docs/COMPARISON_PRESENTATION.md "Text" →
// "Automatic": deliberately no algorithm or luminance threshold is
// specified there, so this is an ordinary, unremarkable renderer choice,
// not a documented contract).
export function relativeLuminance(hexColor: string): number {
	const channel = (start: number) => {
		const value = Number.parseInt(hexColor.slice(start, start + 2), 16) / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

// "Transparent" has no fixed color of its own to derive a tone from — this
// app's own surrounding surfaces are always dark (docs/BRAND_GUIDE.md
// "SameView is a dark-only app"), so Automatic treats Transparent the same
// way it would treat any other dark-enough background: a light text tone.
const AUTOMATIC_TRANSPARENT_LUMINANCE = 0;

export function resolveTextColor(
	textColor: PresentationConfiguration["textColor"],
	resolvedBackground: string,
): string {
	switch (textColor.kind) {
		case "light":
			return LIGHT_TEXT_COLOR;
		case "dark":
			return DARK_TEXT_COLOR;
		case "custom":
			return textColor.color;
		case "automatic": {
			const luminance =
				resolvedBackground === "transparent"
					? AUTOMATIC_TRANSPARENT_LUMINANCE
					: relativeLuminance(resolvedBackground);
			return luminance > 0.5 ? DARK_TEXT_COLOR : LIGHT_TEXT_COLOR;
		}
	}
}
