// Renders the Comparison Information items inside the Presentation Canvas,
// directly beneath the Comparison Stage, together forming one cohesive
// Presentation Card rather than a separate footer
// (docs/COMPARISON_PRESENTATION.md Part 1 "One Cohesive Card"; Part 2
// "Presentation Layout": Comparison Stage → Title → Description (optional)
// → Reference Date → Capture Date → Location).
// This is a rendering-only component, deliberately separate from the Edit
// Inspector (src/components/ComparisonInformationSection.tsx) per the
// approved Phase 5 correction: it never reads or writes the Current Working
// State itself and never appears in the same DOM subtree as the editing
// controls — it only turns already-derived display values plus the
// independent presentation-visibility flags into markup.
//
// General rendering rules (docs/COMPARISON_PRESENTATION.md Part 2 "General
// Rules"): hidden or unavailable items reserve no space (plain conditional
// rendering — no placeholder element for a hidden item), remaining items
// move up automatically (a consequence of not reserving space, not separate
// logic), all items are left-aligned, no rich text or emoji handling is
// performed (values are rendered as plain text, whatever they contain).
//
// "Show Time" governs only this rendered Reference → Capture line — it is
// explicitly independent from the Comparison Stage's own on-image Slider
// Date Labels (docs/COMPARISON_PRESENTATION.md "Slider Date Labels":
// "Independent from the Comparison Information Rendering time block below"),
// which src/components/ComparisonSlider.tsx renders unconditionally and
// which this component does not touch.
//
// Adaptive Sizing (docs/COMPARISON_PRESENTATION.md Part 2 "Adaptive
// Sizing"): each item independently steps from its one standard size to
// exactly one defined smaller ("compact") size when its own content would
// otherwise be truncated — never a shared/synchronized scaling of the
// whole block. The decision itself is computed here via
// src/lib/text-measurement.ts (a pure Canvas `measureText()` read, no DOM
// layout involved) and src/lib/adaptive-text-size.ts (the pure line-count/
// selection logic); the actual final-resort truncation is still handled
// entirely by this file's existing line-clamp/ellipsis CSS, unchanged.
// `stableWidthPx` is `null` until src/components/WorkspaceActive.tsx's
// `PresentationCanvas` has finished its own, already-existing geometry
// convergence (`canvasReady`) — every item renders at its standard size
// unconditionally until then, so that existing convergence loop is never
// touched or influenced by Adaptive Sizing.

import { useMemo } from "react";
import {
	type AdaptiveTextSize,
	computeWrappedLineCount,
	selectAdaptiveTextSize,
} from "../lib/adaptive-text-size";
import type { ComparisonPresentation } from "../lib/comparison-presentation";
import { measureSpaceWidth, measureWordWidths } from "../lib/text-measurement";
import type { PresentationVisibility } from "../lib/workspace-state";

interface ComparisonPresentationInfoProps {
	readonly presentation: ComparisonPresentation;
	readonly visibility: PresentationVisibility;
	// The Comparison Information block's settled available width, in
	// pixels — `null` until the Presentation Canvas's own geometry has
	// finished converging (see module comment above). Ratcheted to only
	// ever narrow within one settle episode by the caller, so Adaptive
	// Sizing's own effect on this block's rendered height can never widen
	// this value back and re-trigger a different decision — see
	// WorkspaceActive.tsx's `stableWidthPx` for the full reasoning.
	readonly stableWidthPx: number | null;
}

// Must match this file's own CSS standard-size rules exactly
// (src/styles/global.css `.presentation-info__title` /
// `__description` / `__time`, `__location`) — Canvas `measureText()` only
// reports the width the browser will actually render for the font it is
// given, not an approximation (the same requirement already documented for
// src/components/ComparisonSlider.tsx's `LABEL_FONT`).
const SYSTEM_FONT_STACK =
	'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
const TITLE_FONT = `600 1.125rem ${SYSTEM_FONT_STACK}`;
const DESCRIPTION_FONT = `400 1rem ${SYSTEM_FONT_STACK}`;
const TIME_LOCATION_FONT = `400 0.875rem ${SYSTEM_FONT_STACK}`;

const TITLE_MAX_LINES = 2;
const DESCRIPTION_MAX_LINES = 3;
const SINGLE_LINE_MAX_LINES = 1;

// docs/COMPARISON_PRESENTATION.md Part 2 "Location": "Marienplatz · Munich,
// Germany" — the display name is grouped with "·" from the city/country
// group, which is itself joined with ", "; any missing part is simply
// omitted rather than leaving a stray separator.
function formatLocation(location: {
	readonly displayName: string | undefined;
	readonly city: string | undefined;
	readonly country: string | undefined;
}): string {
	const cityCountry = [location.city, location.country]
		.filter((part): part is string => Boolean(part))
		.join(", ");
	return [location.displayName, cityCountry]
		.filter((part): part is string => Boolean(part))
		.join(" · ");
}

// Standard is used whenever `text` is empty/not yet measurable (including
// the entire pre-`canvasReady` phase, where `availableWidthPx` is `null`)
// — never a false "compact" from missing data.
function useAdaptiveTextSize(
	text: string | undefined,
	font: string,
	maxLines: number,
	availableWidthPx: number | null,
): AdaptiveTextSize {
	return useMemo(() => {
		if (!text || availableWidthPx === null) return "standard";
		const wordWidths = measureWordWidths(text, font);
		const spaceWidth = measureSpaceWidth(font);
		const lineCount = computeWrappedLineCount(
			wordWidths,
			spaceWidth,
			availableWidthPx,
		);
		return selectAdaptiveTextSize(lineCount, maxLines);
	}, [text, font, maxLines, availableWidthPx]);
}

export default function ComparisonPresentationInfo({
	presentation,
	visibility,
	stableWidthPx,
}: ComparisonPresentationInfoProps) {
	const locationText = presentation.location
		? formatLocation(presentation.location)
		: undefined;
	const timeText = `${presentation.referenceLabel} → ${presentation.captureLabel}`;

	const titleSize = useAdaptiveTextSize(
		presentation.title,
		TITLE_FONT,
		TITLE_MAX_LINES,
		stableWidthPx,
	);
	const descriptionSize = useAdaptiveTextSize(
		presentation.description,
		DESCRIPTION_FONT,
		DESCRIPTION_MAX_LINES,
		stableWidthPx,
	);
	const timeSize = useAdaptiveTextSize(
		timeText,
		TIME_LOCATION_FONT,
		SINGLE_LINE_MAX_LINES,
		stableWidthPx,
	);
	const locationSize = useAdaptiveTextSize(
		locationText,
		TIME_LOCATION_FONT,
		SINGLE_LINE_MAX_LINES,
		stableWidthPx,
	);

	return (
		<div
			className="presentation-info"
			data-testid="comparison-presentation-info"
		>
			{visibility.title && presentation.title && (
				<p
					className={`presentation-info__title${
						titleSize === "compact" ? " presentation-info__title--compact" : ""
					}`}
					data-testid="comparison-title"
				>
					{presentation.title}
				</p>
			)}
			{visibility.description && presentation.description && (
				<p
					className={`presentation-info__description${
						descriptionSize === "compact"
							? " presentation-info__description--compact"
							: ""
					}`}
					data-testid="comparison-description"
				>
					{presentation.description}
				</p>
			)}
			{visibility.time && (
				<p
					className={`presentation-info__time${
						timeSize === "compact" ? " presentation-info__time--compact" : ""
					}`}
					data-testid="comparison-time"
				>
					<span data-testid="comparison-reference-label">
						{presentation.referenceLabel}
					</span>
					{" → "}
					<span data-testid="comparison-capture-label">
						{presentation.captureLabel}
					</span>
				</p>
			)}
			{visibility.location && locationText && (
				<p
					className={`presentation-info__location${
						locationSize === "compact"
							? " presentation-info__location--compact"
							: ""
					}`}
					data-testid="comparison-location"
				>
					{locationText}
				</p>
			)}
		</div>
	);
}
