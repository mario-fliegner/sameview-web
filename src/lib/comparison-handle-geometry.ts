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

// Browser default — matches how STANDARD_HANDLE_VISUAL_REM/
// BRANDED_HANDLE_VISUAL_REM have always been described throughout this
// codebase's own comments (54px/81px). getHandleVisualSizePx below works in
// px, not rem, because its whole point is comparing the handle's own
// rendered size against the Presentation Stage's own rendered pixel size —
// a plain, consistent unit conversion of the same rem constants above, not
// a second, independently chosen size.
const ROOT_FONT_SIZE_PX = 16;
export const STANDARD_HANDLE_VISUAL_PX =
	STANDARD_HANDLE_VISUAL_REM * ROOT_FONT_SIZE_PX;
export const BRANDED_HANDLE_VISUAL_PX =
	STANDARD_HANDLE_VISUAL_PX * HANDLE_ENLARGEMENT_FACTOR;

// docs/COMPARISON_PRESENTATION.md Part 2 "Handle", "Responsive Handle Size
// on a Small Presentation Stage": the Presentation Stage's own shorter side,
// in px, at which the Handle renders at its full documented base size
// (STANDARD_HANDLE_VISUAL_PX / BRANDED_HANDLE_VISUAL_PX) — i.e. the "normal
// reference presentation" size this whole feature scales proportionally
// against, per the approved product decision. No existing geometry in this
// codebase defines a "normal" Stage size on its own (the Stage is always
// purely a function of available container space and image aspect ratio —
// see src/lib/canvas-geometry.ts's own header comment), so this is a
// deliberately chosen constant, not a derived one; chosen low enough that
// this project's own reference desktop fixture (~227px Stage width) still
// renders at exactly the base size unaffected, with headroom to spare.
export const REFERENCE_STAGE_MIN_DIMENSION_PX = 200;

// A purely visual legibility floor (docs/COMPARISON_PRESENTATION.md Part 2
// "Handle"): the Pointer/Touch/Keyboard hit area
// (`.comparison-slider__handle`, a fixed-width wrapper around this visual —
// see that class's own comment in src/styles/comparison-presentation.css)
// is deliberately never derived from this value and never shrinks with it,
// so this floor exists only to keep the ring/chevrons/branding content
// visually recognizable at the smallest Stage sizes, not to satisfy a touch
// target minimum.
export const MIN_STANDARD_HANDLE_VISUAL_PX = 28;
// HANDLE_ENLARGEMENT_FACTOR keeps this exactly the same 1.5× relationship
// the base sizes already use — never a second, independently chosen
// Branded minimum.
export const MIN_BRANDED_HANDLE_VISUAL_PX =
	MIN_STANDARD_HANDLE_VISUAL_PX * HANDLE_ENLARGEMENT_FACTOR;

// The single shared computation every renderer of the Handle (the live
// Workspace Preview's src/components/ComparisonSlider.tsx and the generated
// Standalone HTML/Static Microsite's src/lib/comparison-presentation-runtime.ts)
// must call unchanged, so the two can never drift into two formally similar
// but independently tuned formulas again (the exact defect this module
// already exists to prevent for every other Handle number — see this
// module's own header comment). `stageWidthPx`/`stageHeightPx` are the
// Presentation Stage's own actually rendered size at this moment (not the
// Presentation Canvas including padding/frame, and not the viewport) — the
// same two numbers src/lib/canvas-geometry.ts's `computeCanvasGeometry`
// already returns as `stageWidth`/`stageHeight`. Returns a concrete pixel
// size, ready to be written directly to the Handle SVG's own CSS
// width/height — the SVG's `viewBox="0 0 54 54"` (unchanged by this
// function) already scales the ring, chevrons and branding content
// proportionally with whatever size is applied here, so nothing else needs
// its own scaling logic.
export function getHandleVisualSizePx(
	stageWidthPx: number,
	stageHeightPx: number,
	isBranded: boolean,
): number {
	// The Standard size is computed once, via its own clamp, and Branded is
	// always exactly this same value × HANDLE_ENLARGEMENT_FACTOR — never a
	// second, independently clamped Branded curve. Clamping Standard and
	// Branded separately (each against its own base/minimum) would only
	// reproduce the exact 1.5× relationship at the two extremes (the base
	// size and the minimum) and silently drift from it everywhere in
	// between, since the *unclamped* linear term below does not itself
	// depend on `isBranded` — confirmed by an actual failing test, not a
	// theoretical concern.
	const minStageDimensionPx = Math.min(stageWidthPx, stageHeightPx);
	// Not yet measured (0) or a not-yet-loaded/invalid Stage: the documented
	// base size is the correct, already-established fallback — the same
	// value src/lib/comparison-artifact-markup.ts's own static bootstrap
	// markup already renders before the runtime's first real measurement.
	const standardPx = !(minStageDimensionPx > 0)
		? STANDARD_HANDLE_VISUAL_PX
		: Math.max(
				MIN_STANDARD_HANDLE_VISUAL_PX,
				// A genuine proportion of the Stage's own shorter side relative
				// to REFERENCE_STAGE_MIN_DIMENSION_PX — clamped to 1 so the
				// Handle can never grow past its documented base size for a
				// Stage larger than the reference, only ever shrink below it.
				Math.min(1, minStageDimensionPx / REFERENCE_STAGE_MIN_DIMENSION_PX) *
					STANDARD_HANDLE_VISUAL_PX,
			);
	return isBranded ? standardPx * HANDLE_ENLARGEMENT_FACTOR : standardPx;
}

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
// across all six built-in symbols. This is the "Dark" option's exact value
// (docs/APPLICATION_LAYOUT.md "Branding" → "Color") — a freshly selected
// symbol, or one with no configured color, renders with this color, never
// the app's own interactive accent.
export const SYMBOL_COLOR = "#17202F";
// sameview CompareScreen.kt CompareDivider: drawPath(..., color =
// SameViewAccent, ...) — the standard (unbranded) handle's arrows only.
export const STANDARD_ARROW_COLOR = "#4f8cff";
// docs/BRAND_GUIDE.md "Brand Accent Color". A Built-in Symbol's "Brand"
// color option (docs/APPLICATION_LAYOUT.md "Branding" → "Color") — a
// separately named constant from STANDARD_ARROW_COLOR above and
// WorkspaceActive.tsx's own BRAND_ACCENT_COLOR, not a shared import: the
// same literal already exists as multiple purpose-named constants in this
// codebase (arrows vs. Canvas Background's "Brand" option), each documenting
// its own specific role rather than one generic shared token.
export const SYMBOL_COLOR_BRAND = "#4F8CFF";

// Date-label placement (src/components/ComparisonSlider.tsx) has no direct
// Android precedent for the branded case: Android's own interactive
// CompareScreen divider never shows branding at all (SESSION_BRANDING_V1.md
// §14). This is the derived generalization the regression analysis
// approved: derive the ring radius from the handle's own actually rendered
// diameter, so labels can never end up placed for a handle size that is not
// the one on screen — this held only for the two fixed base sizes before
// responsive scaling existed (STANDARD_RING_RADIUS_PX is exactly
// STANDARD_HANDLE_VISUAL_PX / 2, and the previous branded formula was
// exactly BRANDED_HANDLE_VISUAL_PX / 2), and holds for any size in between
// or below now: the ring's outer edge sits at radius 27 of the SVG's own
// fixed 54-unit `viewBox`, i.e. always exactly half of whatever concrete
// pixel size `getHandleVisualSizePx` above renders the SVG at, by
// construction of that `viewBox`'s own proportional scaling — not an
// approximation. Takes the already-computed rendered diameter (px), never
// `isBranded` directly, so this can never silently fall back to the old,
// now-incorrect fixed-size assumption at a Stage size where the Handle is
// actually rendered smaller (or larger) than its base size.
export function getEffectiveRingRadiusPx(handleVisualSizePx: number): number {
	return handleVisualSizePx / 2;
}
