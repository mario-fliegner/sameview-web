// The Context Inspector's Edit Inspector (docs/APPLICATION_LAYOUT.md "Edit
// Inspector"), the workspace's right-hand column. For this iteration it
// hosts exactly one collapsible section, Comparison Information
// (docs/FEATURE_SPECIFICATION.md F-003) — the Presentation and Branding
// sections described alongside it belong to later iterations
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 5 "Not included") and are not
// stubbed out here.
//
// "All sections are expanded by default. Users may collapse individual
// sections... expanded/collapsed state should be preserved while the
// workspace remains open." Local `useState` already satisfies this: the
// component only unmounts (resetting to expanded) when the parent remounts
// it via `key={sessionDirectory}` on an actual workspace replacement, never
// on an edit — the same reset boundary every other workspace-scoped local
// UI state in this app already uses (e.g. src/components/
// ComparisonSlider.tsx's drag position).

import { useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import type { CurrentWorkingState } from "../lib/workspace-state";
import ComparisonInformationSection from "./ComparisonInformationSection";

interface EditInspectorProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly captureDateLabel: string;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
}

const COMPARISON_INFORMATION_BODY_ID = "edit-inspector-comparison-information";

export default function EditInspector({
	currentWorkingState,
	captureDateLabel,
	onCurrentWorkingStateChange,
}: EditInspectorProps) {
	const { t } = useLocale();
	const [isExpanded, setIsExpanded] = useState(true);

	return (
		<aside
			className="edit-inspector"
			aria-label={t.editInspector.heading}
			data-testid="edit-inspector"
		>
			<section className="edit-inspector__section">
				<h2 className="edit-inspector__section-heading">
					<button
						type="button"
						className="edit-inspector__section-toggle"
						aria-expanded={isExpanded}
						aria-controls={COMPARISON_INFORMATION_BODY_ID}
						data-testid="edit-inspector-comparison-information-toggle"
						onClick={() => setIsExpanded((expanded) => !expanded)}
					>
						<span>{t.editInspector.comparisonInformationHeading}</span>
						<span
							className={`edit-inspector__chevron${
								isExpanded ? " edit-inspector__chevron--expanded" : ""
							}`}
							aria-hidden="true"
						/>
					</button>
				</h2>
				{isExpanded && (
					<div
						id={COMPARISON_INFORMATION_BODY_ID}
						className="edit-inspector__section-body"
					>
						<ComparisonInformationSection
							currentWorkingState={currentWorkingState}
							captureDateLabel={captureDateLabel}
							onCurrentWorkingStateChange={onCurrentWorkingStateChange}
						/>
					</div>
				)}
			</section>
		</aside>
	);
}
