// Pure registry for the three selectable Comparison Presentation Fonts
// (docs/COMPARISON_PRESENTATION.md Part 3 "Typography";
// docs/IMPLEMENTATION_PLAN_V1.md Phase 8b). Deliberately pure data (no
// React, no DOM) — mirrors src/lib/builtin-branding-symbols.ts's own reason
// for staying framework-independent: the same font-family resolution must
// be reusable unchanged by a future Standalone HTML/Microsite generator
// (Phase 9), which runs without a React runtime.
//
// The three names below must match the `font-family` declared by the
// corresponding `@font-face` rules in src/styles/global.css exactly — those
// rules are the only place the actual font files are referenced
// (public/fonts/inter/InterVariable.woff2,
// public/fonts/manrope/Manrope-{Regular,Medium,SemiBold}.woff2,
// public/fonts/spacegrotesk/SpaceGrotesk-Variable.woff2). This module never
// reads or refers to those files directly.
//
// Applies exclusively to the Comparison Presentation's own text elements
// (Title, Description, Time, Time Difference, Location, Slider Date Labels
// and their Overflow Tooltips) — never to the application UI, which keeps
// its own unrelated system font stack (src/styles/global.css `body`).

export type PresentationFontId = "inter" | "manrope" | "space-grotesk";

export const PRESENTATION_FONT_IDS: readonly PresentationFontId[] = [
	"inter",
	"manrope",
	"space-grotesk",
];

// Accepts a plain `string` so callers reading an otherwise untrusted value
// never need their own separate type guard first — the same reasoning
// src/lib/builtin-branding-symbols.ts documents for `isBuiltinSymbolId`.
export function isPresentationFontId(
	value: string,
): value is PresentationFontId {
	return (PRESENTATION_FONT_IDS as readonly string[]).includes(value);
}

// The existing Application UI system font stack (src/styles/global.css
// `body`), reused verbatim as the fallback tail so a glyph missing from the
// selected Presentation Font's own coverage still renders via the same
// fallback chain the rest of the application already uses — never a second,
// independently maintained fallback list (docs/BRAND_GUIDE.md "Comparison
// Presentation Typography": "falls back to the Application UI's system font
// stack").
const SYSTEM_FALLBACK_STACK =
	'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

// Must match the `font-family` values declared by the `@font-face` rules in
// src/styles/global.css exactly.
const FONT_FAMILY_NAMES: Record<PresentationFontId, string> = {
	inter: '"Inter Variable"',
	manrope: '"Manrope"',
	"space-grotesk": '"Space Grotesk Variable"',
};

export function resolvePresentationFontFamily(id: PresentationFontId): string {
	return `${FONT_FAMILY_NAMES[id]}, ${SYSTEM_FALLBACK_STACK}`;
}
