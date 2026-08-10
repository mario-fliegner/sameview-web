// Canvas `font` shorthand strings for the Comparison Presentation's
// Canvas-measured text elements (docs/COMPARISON_PRESENTATION.md Part 3
// "Typography"; Part 2 "Adaptive Sizing"). Single source for
// src/components/ComparisonPresentationInfo.tsx (Title/Description/Time/
// Location), src/components/ComparisonSlider.tsx (the on-image Slider Date
// Labels) and the generated Standalone HTML/Static Microsite runtime
// (src/lib/comparison-presentation-runtime.ts) — each of these must match
// its own CSS rule exactly (Canvas `measureText()` only reports the width
// the browser will actually render for the font it is given, not an
// approximation), so the shorthand strings are written down exactly once.
//
// The font-family portion of every shorthand below is `presentationFontFamily`
// (docs/COMPARISON_PRESENTATION.md Part 3 "Typography"), never a fixed
// constant — see src/lib/presentation-fonts.ts `resolvePresentationFontFamily`,
// the one place that value is itself resolved.
//
// Deliberately excludes any CSS property Canvas' `font` shorthand cannot
// represent (letter-spacing, `font-variant-numeric`, …): including one in a
// matching CSS rule without a corresponding change here would silently
// diverge the measured width from the rendered width.

// Must match src/styles/comparison-presentation.css `.presentation-info__title`.
export function buildTitleFont(presentationFontFamily: string): string {
	return `500 1rem ${presentationFontFamily}`;
}

// Must match `.presentation-info__description`.
export function buildDescriptionFont(presentationFontFamily: string): string {
	return `400 0.875rem ${presentationFontFamily}`;
}

// Must match `.presentation-info__time`.
export function buildTimeFont(presentationFontFamily: string): string {
	return `500 0.8125rem ${presentationFontFamily}`;
}

// Must match `.presentation-info__location`.
export function buildLocationFont(presentationFontFamily: string): string {
	return `400 0.75rem ${presentationFontFamily}`;
}

// Must match `.comparison-slider__label`.
export function buildSliderLabelFont(presentationFontFamily: string): string {
	return `600 0.875rem ${presentationFontFamily}`;
}
