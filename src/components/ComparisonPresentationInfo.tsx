// Renders the Comparison Information items inside the Presentation Canvas,
// directly beneath the Comparison Stage
// (docs/COMPARISON_PRESENTATION.md Part 2 "Presentation Layout": Comparison
// Stage → Title → Reference Date → Capture Date → Location → Description).
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

import type { ComparisonPresentation } from "../lib/comparison-presentation";
import type { PresentationVisibility } from "../lib/workspace-state";

interface ComparisonPresentationInfoProps {
	readonly presentation: ComparisonPresentation;
	readonly visibility: PresentationVisibility;
}

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

export default function ComparisonPresentationInfo({
	presentation,
	visibility,
}: ComparisonPresentationInfoProps) {
	const locationText = presentation.location
		? formatLocation(presentation.location)
		: undefined;

	return (
		<div
			className="presentation-info"
			data-testid="comparison-presentation-info"
		>
			{visibility.title && presentation.title && (
				<p className="presentation-info__title" data-testid="comparison-title">
					{presentation.title}
				</p>
			)}
			{visibility.time && (
				<p className="presentation-info__time" data-testid="comparison-time">
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
					className="presentation-info__location"
					data-testid="comparison-location"
				>
					{locationText}
				</p>
			)}
			{visibility.description && presentation.description && (
				<p
					className="presentation-info__description"
					data-testid="comparison-description"
				>
					{presentation.description}
				</p>
			)}
		</div>
	);
}
