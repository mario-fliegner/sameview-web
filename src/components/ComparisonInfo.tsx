// The Comparison Section's read-only information panel
// (docs/APPLICATION_LAYOUT.md "Comparison Section": "Initially this includes
// imported comparison information. Later iterations may introduce editing
// controls directly inside this region.") — one block per information item
// (rather than a single paragraph) is deliberate: it is the seam that lets
// Phase 5's editing controls extend this component later without a rewrite.
//
// Receives only already-derived display values (never `metadata.raw`) from
// src/lib/comparison-presentation.ts via the parent — this component itself
// is free to resolve its own static heading copy through useLocale(), like
// every other non-reusable component in this app; only the reusable
// ComparisonSlider is required to stay free of i18n resolution.

import { useLocale } from "../i18n/LocaleContext";
import type { ComparisonLocation } from "../lib/comparison-presentation";

interface ComparisonInfoProps {
	readonly description: string | undefined;
	readonly referenceLabel: string;
	readonly captureLabel: string;
	readonly location: ComparisonLocation | undefined;
	readonly sessionDirectory: string;
}

export default function ComparisonInfo({
	description,
	referenceLabel,
	captureLabel,
	location,
	sessionDirectory,
}: ComparisonInfoProps) {
	const { t } = useLocale();
	const locationText = location
		? [location.displayName, location.city, location.country]
				.filter((part): part is string => Boolean(part))
				.join(", ")
		: undefined;

	return (
		<div className="comparison-info">
			{description && (
				<p
					className="comparison-info__description"
					data-testid="comparison-description"
				>
					{description}
				</p>
			)}
			<dl className="comparison-info__labels">
				<div className="comparison-info__label-row">
					<dt>{t.workspace.referenceHeading}</dt>
					<dd data-testid="comparison-reference-label">{referenceLabel}</dd>
				</div>
				<div className="comparison-info__label-row">
					<dt>{t.workspace.captureHeading}</dt>
					<dd data-testid="comparison-capture-label">{captureLabel}</dd>
				</div>
			</dl>
			{locationText && (
				<div
					className="comparison-info__location"
					data-testid="comparison-location"
				>
					<h2 className="comparison-info__location-heading">
						{t.workspace.locationHeading}
					</h2>
					<p>{locationText}</p>
				</div>
			)}
			<p className="comparison-info__session" data-testid="workspace-session">
				{t.workspace.sessionLabel} {sessionDirectory}
			</p>
		</div>
	);
}
