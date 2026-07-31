// Pure, unit-testable decision logic for "Adaptive Sizing"
// (docs/COMPARISON_PRESENTATION.md Part 2 "Adaptive Sizing"): each
// Presentation Information item independently steps from its one standard
// size to exactly one defined smaller ("compact") size when its content
// would otherwise be truncated, before the already-existing CSS
// line-clamp/ellipsis takes over as the final fallback. No DOM, no canvas —
// mirrors src/lib/canvas-geometry.ts's "pure function, unit-tested
// separately from its measurement glue" shape; the actual `measureText()`
// glue lives in src/lib/text-measurement.ts.
//
// Standard is preferred whenever it fits; Compact is used whenever it
// doesn't, regardless of whether Compact itself would still exceed
// `maxLines` — in that remaining case, the already-existing CSS line-clamp/
// ellipsis on the Compact-sized element is the final fallback ("Ellipsis
// remains the last resort"), so no separate "ellipsis" state is tracked
// here.

export type AdaptiveTextSize = "standard" | "compact";

// A greedy word-wrap line count, given each word's already-measured
// rendered width (px, at whatever font is being evaluated), the width of a
// single space at that same font, and the width available to wrap within.
// No hyphenation, no justification — matches this app's plain-text
// rendering (docs/COMPARISON_PRESENTATION.md "General Rules": "Rich text is
// not supported"). An overlong single word is never split onto multiple
// lines; it is placed on its own line regardless of overflow, the same way
// this app's text handling never breaks inside a word.
export function computeWrappedLineCount(
	wordWidths: readonly number[],
	spaceWidth: number,
	availableWidthPx: number,
): number {
	if (wordWidths.length === 0) return 0;
	let lineCount = 1;
	let currentLineWidth = wordWidths[0] ?? 0;
	for (let index = 1; index < wordWidths.length; index += 1) {
		const wordWidth = wordWidths[index] ?? 0;
		const widthWithWord = currentLineWidth + spaceWidth + wordWidth;
		if (widthWithWord > availableWidthPx) {
			lineCount += 1;
			currentLineWidth = wordWidth;
		} else {
			currentLineWidth = widthWithWord;
		}
	}
	return lineCount;
}

// The per-item decision itself — a pure function of that item's own inputs
// only, so that one item's content can never influence another's outcome
// (docs/COMPARISON_PRESENTATION.md "Adaptive Sizing": "evaluated
// independently per rendered item").
export function selectAdaptiveTextSize(
	standardLineCount: number,
	maxLines: number,
): AdaptiveTextSize {
	return standardLineCount <= maxLines ? "standard" : "compact";
}
