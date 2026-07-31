// The Context Inspector's Edit Inspector (docs/APPLICATION_LAYOUT.md "Edit
// Inspector"), the workspace's right-hand column. Hosts two collapsible
// sections for this iteration, Comparison Information
// (docs/FEATURE_SPECIFICATION.md F-003) and Presentation
// (docs/COMPARISON_PRESENTATION.md Part 3: Background, Frame, Corner
// Radius, Show Slider Date Labels only — Map Preview is its own later
// iteration, docs/IMPLEMENTATION_PLAN_V1.md Phase 5 "Not included"). The
// Branding section described alongside them in APPLICATION_LAYOUT.md
// belongs to a later iteration and is not stubbed out here.
//
// docs/APPLICATION_LAYOUT.md "Structure": "The Edit Inspector behaves as a
// focused accordion: at most one section may be open at a time... For the
// sections currently implemented, only Comparison information starts
// open." A single `openSection` value (rather than one boolean per
// section) is what makes "at most one" hold by construction: opening one
// section is the same state update as closing whichever other section was
// open, never two separate updates that could otherwise leave both — or,
// on some future section, more than one — open at once. Local `useState`
// already satisfies "the expanded/collapsed state should be preserved
// while the workspace remains open": the component only unmounts
// (resetting to this initial value) when the parent remounts it via
// `key={sessionDirectory}` on an actual workspace replacement, never on an
// edit — the same reset boundary every other workspace-scoped local UI
// state in this app already uses (e.g. src/components/
// ComparisonSlider.tsx's drag position).

import { useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import type { CurrentWorkingState } from "../lib/workspace-state";
import ComparisonInformationSection from "./ComparisonInformationSection";
import PresentationSection from "./PresentationSection";

interface EditInspectorProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly captureDateLabel: string;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
}

const COMPARISON_INFORMATION_BODY_ID = "edit-inspector-comparison-information";
const PRESENTATION_BODY_ID = "edit-inspector-presentation";

type OpenSection = "comparison-information" | "presentation" | null;

export default function EditInspector({
	currentWorkingState,
	captureDateLabel,
	onCurrentWorkingStateChange,
}: EditInspectorProps) {
	const { t } = useLocale();
	const [openSection, setOpenSection] = useState<OpenSection>(
		"comparison-information",
	);
	const isComparisonInformationExpanded =
		openSection === "comparison-information";
	const isPresentationExpanded = openSection === "presentation";

	function toggleSection(section: "comparison-information" | "presentation") {
		setOpenSection((current) => (current === section ? null : section));
	}

	return (
		<aside
			className="edit-inspector"
			aria-label={t.editInspector.heading}
			data-testid="edit-inspector"
		>
			<section
				className={`edit-inspector__section${
					isComparisonInformationExpanded
						? " edit-inspector__section--active"
						: ""
				}`}
			>
				<h2 className="edit-inspector__section-heading">
					<button
						type="button"
						className="edit-inspector__section-toggle"
						aria-expanded={isComparisonInformationExpanded}
						aria-controls={COMPARISON_INFORMATION_BODY_ID}
						data-testid="edit-inspector-comparison-information-toggle"
						onClick={() => toggleSection("comparison-information")}
					>
						<span>{t.editInspector.comparisonInformationHeading}</span>
						<span
							className={`edit-inspector__chevron${
								isComparisonInformationExpanded
									? " edit-inspector__chevron--expanded"
									: ""
							}`}
							aria-hidden="true"
						/>
					</button>
				</h2>
				{isComparisonInformationExpanded && (
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

			<section
				className={`edit-inspector__section${
					isPresentationExpanded ? " edit-inspector__section--active" : ""
				}`}
			>
				<h2 className="edit-inspector__section-heading">
					<button
						type="button"
						className="edit-inspector__section-toggle"
						aria-expanded={isPresentationExpanded}
						aria-controls={PRESENTATION_BODY_ID}
						data-testid="edit-inspector-presentation-toggle"
						onClick={() => toggleSection("presentation")}
					>
						<span>{t.editInspector.presentation.heading}</span>
						<span
							className={`edit-inspector__chevron${
								isPresentationExpanded
									? " edit-inspector__chevron--expanded"
									: ""
							}`}
							aria-hidden="true"
						/>
					</button>
				</h2>
				{isPresentationExpanded && (
					<div
						id={PRESENTATION_BODY_ID}
						className="edit-inspector__section-body"
					>
						<PresentationSection
							currentWorkingState={currentWorkingState}
							onCurrentWorkingStateChange={onCurrentWorkingStateChange}
						/>
					</div>
				)}
			</section>
		</aside>
	);
}
