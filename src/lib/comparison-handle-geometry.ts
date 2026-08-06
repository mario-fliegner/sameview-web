// Shared Session Branding handle geometry (docs/COMPARISON_PRESENTATION.md
// Part 2 "Handle"; docs/FEATURE_SPECIFICATION.md F-004). Single source of
// truth for every number src/components/ComparisonSlider.tsx (drag
// interaction and date-label placement) and
// src/components/ComparisonSliderHandle.tsx (the handle's own visual)
// must agree on. Before this module existed, the 1.5× branding
// enlargement and the branding content's centering coordinate were each
// hardcoded twice — once correctly, once not — which was the root cause
// of three confirmed regressions (divider drawn over branded content;
// date labels overlapping the enlarged handle; branding content centered
// on the wrong point). No React, no DOM: plain numbers only, so nothing
// here can itself depend on which of the two components happens to import
// it first.
//
// Values are the SameView Android app's own *ratios*, not its literal dp
// figures (per product decision — Web's own viewBox unit already plays
// the same role Android's dp does, and the two are not meant to be
// numerically identical):
// - sameview/app/src/main/java/com/isardomains/sameview/ui/compare/CompareScreen.kt
//   — CompareSliderHandleSize=48dp, CompareSliderRingGap=1dp,
//   CompareSliderRingThickness=2dp; handleRadiusPx = 24+1+2 = 27dp, the
//   basis for STANDARD_RING_RADIUS_PX below.
// - sameview/app/src/main/java/com/isardomains/sameview/branding/BrandingHandleRenderer.kt
//   — branding diameter = standard diameter × 1.5 (HANDLE_ENLARGEMENT_FACTOR);
//   LOGO_SIZE_FRACTION = 0.72, the basis for IMAGE_CONTENT_RATIO below
//   (SYMBOL_CONTENT_RATIO has no Android precedent — see its own comment);
//   content centered at the circle's own (cx, cy) via
//   `RectF(cx - sw/2f, ...)` — its actual center coordinate, never its
//   radius (the exact defect getContentBox below fixes).
// - sameview/app/src/main/res/drawable/ic_branding_*.xml — fillColor
//   "#17202F", identical across all six built-in symbols.
// - sameview CompareScreen.kt `CompareDivider` — standard-handle arrows use
//   `SameViewAccent` (#4F8CFF); that color is scoped to the arrows only.

// The handle SVG's own coordinate space (see
// src/components/ComparisonSliderHandle.tsx's ring/chevron path constants,
// unchanged by this module).
export const HANDLE_VIEWBOX_SIZE = 54;
// The circle's actual center coordinate — a *position*, not a length. Do
// not substitute HANDLE_RADIUS_PX here; that specific substitution was the
// previous centering bug.
export const HANDLE_CENTER_PX = HANDLE_VIEWBOX_SIZE / 2;
export const HANDLE_RADIUS_PX = 24;
export const RING_STROKE_WIDTH_PX = 2;

// Android CompareScreen.kt: handleRadiusPx = handleSize/2 + ringGap +
// ringThickness = 24 + 1 + 2. Used for date-label placement, never
// branding-enlarged on its own — see getEffectiveRingRadiusPx below.
export const STANDARD_RING_RADIUS_PX = 27;

// sameview BrandingHandleRenderer.kt / SliderRenderStrategy.kt:
// "brandingDiam = standardHandleDiam * 1.5f" — the one number this module
// exists to keep from being duplicated between the handle's own visual
// size and the date labels' placement around it.
export const HANDLE_ENLARGEMENT_FACTOR = 1.5;

// The handle visual's rendered CSS box, standard and branding-enlarged.
// Previously a CSS class pair (`.comparison-slider__handle-visual` /
// `--branded`) carrying the *same* 3.375rem/5.0625rem values independently
// of HANDLE_ENLARGEMENT_FACTOR above; now the one place either size is
// written down.
export const STANDARD_HANDLE_VISUAL_REM = 3.375;
export const BRANDED_HANDLE_VISUAL_REM =
	STANDARD_HANDLE_VISUAL_REM * HANDLE_ENLARGEMENT_FACTOR;

// docs/COMPARISON_PRESENTATION.md Part 2 "Handle": a Custom Image or an
// imported branding image occupies 72% of the Handle's diameter — sameview
// BrandingHandleRenderer.kt's LOGO_SIZE_FRACTION, unchanged.
export const IMAGE_CONTENT_RATIO = 0.72;
// docs/COMPARISON_PRESENTATION.md Part 2 "Handle": a Built-in Symbol
// occupies 57.6% of the Handle's diameter — 20% smaller than
// IMAGE_CONTENT_RATIO. A Web V1 product decision with no Android
// precedent (Android's own BrandingHandleRenderer.kt applies
// LOGO_SIZE_FRACTION uniformly to both); kept as its own named constant
// rather than an inline `IMAGE_CONTENT_RATIO * 0.8` so the documented
// 57.6% figure is the one literally checked by tests, not a derived value
// that could silently drift if IMAGE_CONTENT_RATIO ever changes.
export const SYMBOL_CONTENT_RATIO = 0.576;

export interface ContentBox {
	readonly side: number;
	readonly offset: number;
}

// The one shared centering formula both branding kinds go through
// (docs/FEATURE_SPECIFICATION.md F-004: no separate geometry per branding
// kind) — only the ratio differs between them, never how a ratio turns
// into a box. Centers on HANDLE_CENTER_PX, never HANDLE_RADIUS_PX (see
// that constant's own comment for why the distinction matters).
export function getContentBox(ratio: number): ContentBox {
	const side = HANDLE_RADIUS_PX * 2 * ratio;
	return { side, offset: HANDLE_CENTER_PX - side / 2 };
}

// sameview ic_branding_*.xml: android:fillColor="#17202F", identical
// across all six built-in symbols. A freshly selected symbol renders with
// this color, never the app's own interactive accent.
export const SYMBOL_COLOR = "#17202F";
// sameview CompareScreen.kt CompareDivider: drawPath(..., color =
// SameViewAccent, ...) — the standard (unbranded) handle's arrows only.
export const STANDARD_ARROW_COLOR = "#4f8cff";

// Date-label placement (src/components/ComparisonSlider.tsx) has no direct
// Android precedent for the branded case: Android's own interactive
// CompareScreen divider never shows branding at all (SESSION_BRANDING_V1.md
// §14), so `handleRadiusPx` there is always the standard, unbranded value.
// This is the derived generalization the regression analysis approved:
// scale that same radius by HANDLE_ENLARGEMENT_FACTOR whenever the handle
// itself is actually rendered enlarged, so labels can never end up placed
// for a handle size that is not the one on screen.
export function getEffectiveRingRadiusPx(isBranded: boolean): number {
	return isBranded
		? STANDARD_RING_RADIUS_PX * HANDLE_ENLARGEMENT_FACTOR
		: STANDARD_RING_RADIUS_PX;
}
