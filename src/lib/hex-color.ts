// Generic HEX color parsing/normalization (docs/COMPARISON_PRESENTATION.md
// "Custom Color Editing"), shared by every Custom Color control in the app:
// Presentation Configuration's Background/Frame/Text (src/lib/comparison-edit.ts)
// and a Built-in Symbol's Color (src/lib/branding.ts). Pure, no React, no DOM.
//
// Extracted out of src/lib/comparison-edit.ts, which explicitly scopes
// itself to F-003 (see that module's own header comment) — this logic has no
// F-003-specific behavior of its own and both F-003's and F-004's editing
// modules now depend on it directly, rather than one importing it from the
// other's module.

const HEX_COLOR = /^#?([0-9a-fA-F]{6})$/;

// Accepts a value with or without a leading `#`; the result is always
// normalized to `#RRGGBB` in uppercase, or `undefined` when `rawInput` is not
// a valid 6-digit hex color.
export function normalizeHexColor(rawInput: string): string | undefined {
	const match = HEX_COLOR.exec(rawInput.trim());
	if (!match) return undefined;
	return `#${(match[1] as string).toUpperCase()}`;
}
