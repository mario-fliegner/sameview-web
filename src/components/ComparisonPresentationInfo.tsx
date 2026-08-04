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

import { useEffect, useMemo, useRef } from "react";
import {
	type AdaptiveTextSize,
	computeWrappedLineCount,
	selectAdaptiveTextSize,
} from "../lib/adaptive-text-size";
import type { ComparisonPresentation } from "../lib/comparison-presentation";
import { attachPresentationOverflowTooltips } from "../lib/overflow-tooltip";
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
// (src/styles/global.css `.presentation-info__title` / `__description` /
// `__time` / `__location`) — Canvas `measureText()` only reports the width
// the browser will actually render for the font it is given, not an
// approximation (the same requirement already documented for
// src/components/ComparisonSlider.tsx's `LABEL_FONT`). Only each item's
// standard size is measured — `selectAdaptiveTextSize` (src/lib/
// adaptive-text-size.ts) decides "standard" vs. "compact" from that one
// measurement alone and never re-measures at the compact size, so no
// compact-size font string exists here to match.
//
// Deliberately excludes any CSS property Canvas' `font` shorthand cannot
// represent (letter-spacing, `font-variant-numeric`, …): including one in
// the CSS rule without a corresponding change here would silently diverge
// the measured width from the rendered width.
const SYSTEM_FONT_STACK =
	'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
const TITLE_FONT = `500 1rem ${SYSTEM_FONT_STACK}`;
const DESCRIPTION_FONT = `400 0.875rem ${SYSTEM_FONT_STACK}`;
const TIME_FONT = `500 0.8125rem ${SYSTEM_FONT_STACK}`;
const LOCATION_FONT = `400 0.75rem ${SYSTEM_FONT_STACK}`;

// The Adaptive Sizing decision threshold, deliberately kept separate from
// each item's visible clamp (src/styles/global.css
// `.presentation-info__title` / `__description`: `-webkit-line-clamp: 2` /
// `3`, unchanged): Standard is only used while the item still fits within
// one line fewer than its own clamp — the clamp itself is the *ceiling*
// Compact is still allowed to use, not the trigger for staying Standard.
// Without this separation, content that exactly fills the clamp (e.g. a
// Title needing exactly two lines) would incorrectly stay at the larger
// Standard size instead of stepping down.
const TITLE_STANDARD_MAX_LINES = 1;
const DESCRIPTION_STANDARD_MAX_LINES = 2;
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
		TITLE_STANDARD_MAX_LINES,
		stableWidthPx,
	);
	const descriptionSize = useAdaptiveTextSize(
		presentation.description,
		DESCRIPTION_FONT,
		DESCRIPTION_STANDARD_MAX_LINES,
		stableWidthPx,
	);
	const timeSize = useAdaptiveTextSize(
		timeText,
		TIME_FONT,
		SINGLE_LINE_MAX_LINES,
		stableWidthPx,
	);
	const locationSize = useAdaptiveTextSize(
		locationText,
		LOCATION_FONT,
		SINGLE_LINE_MAX_LINES,
		stableWidthPx,
	);

	const showTitle = visibility.title && Boolean(presentation.title);
	const showDescription =
		visibility.description && Boolean(presentation.description);
	const showTime = visibility.time;
	const showLocation = visibility.location && Boolean(locationText);

	// Purely presentational grouping (docs/COMPARISON_PRESENTATION.md
	// "Typographic Hierarchy"): Title/Description form the Primary Cluster
	// (Level 1), Time/Location form the Context Cluster — a wrapper is
	// omitted entirely when none of its own items are visible, so it never
	// contributes an empty box or a stray gap.
	const hasPrimaryCluster = showTitle || showDescription;
	const hasContextCluster = showTime || showLocation;

	const infoRootRef = useRef<HTMLDivElement>(null);

	// Overflow Tooltip (docs/COMPARISON_PRESENTATION.md Part 2 "Overflow
	// Tooltip"): attached once, on this component's own root — the
	// framework-independent module (src/lib/overflow-tooltip.ts) then owns
	// every dynamic behavior from there (measuring, opening, closing,
	// repositioning) by reacting to real DOM mutations, not to this
	// component's own re-renders, which is why this effect has no
	// dependency on `presentation`/`visibility`.
	useEffect(() => {
		if (!infoRootRef.current) return;
		return attachPresentationOverflowTooltips(infoRootRef.current);
	}, []);

	return (
		<div
			ref={infoRootRef}
			className="presentation-info"
			data-testid="comparison-presentation-info"
		>
			{hasPrimaryCluster && (
				<div className="presentation-info__primary">
					{showTitle && (
						<p
							className={`presentation-info__title${
								titleSize === "compact"
									? " presentation-info__title--compact"
									: ""
							}`}
							data-testid="comparison-title"
							data-overflow-tooltip=""
						>
							{presentation.title}
						</p>
					)}
					{showDescription && (
						<p
							className={`presentation-info__description${
								descriptionSize === "compact"
									? " presentation-info__description--compact"
									: ""
							}`}
							data-testid="comparison-description"
							data-overflow-tooltip=""
						>
							{presentation.description}
						</p>
					)}
				</div>
			)}
			{hasContextCluster && (
				<div className="presentation-info__context">
					{showTime && (
						<p
							className={`presentation-info__time${
								timeSize === "compact"
									? " presentation-info__time--compact"
									: ""
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
					{showLocation && (
						<p
							className={`presentation-info__location${
								locationSize === "compact"
									? " presentation-info__location--compact"
									: ""
							}`}
							data-testid="comparison-location"
							data-overflow-tooltip=""
						>
							{locationText}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
