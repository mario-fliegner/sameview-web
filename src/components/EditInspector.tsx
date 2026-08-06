// The Context Inspector's Edit Inspector (docs/APPLICATION_LAYOUT.md "Edit
// Inspector"), the workspace's right-hand column. Hosts three collapsible
// sections: Comparison Information (docs/FEATURE_SPECIFICATION.md F-003),
// Presentation (docs/COMPARISON_PRESENTATION.md Part 3: Background, Frame,
// Corner Radius, Show Slider Date Labels only — Map Preview is its own
// later iteration, docs/IMPLEMENTATION_PLAN_V1.md Phase 5 "Not included"),
// and Branding (docs/FEATURE_SPECIFICATION.md F-004).
//
// docs/APPLICATION_LAYOUT.md "Structure": "The Edit Inspector behaves as a
// focused accordion: at most one section may be open at a time." Its own
// per-section defaults list both Comparison Information and Branding as
// "expanded by default", which it immediately qualifies as never able to
// apply simultaneously under that same accordion rule — resolved here by
// keeping the already-established "only Comparison information starts
// open" behavior unchanged (Branding starts closed alongside Presentation)
// per this phase's approved scope, rather than silently reinterpreting
// that still-open wording. A single `openSection` value (rather than one
// boolean per section) is what makes "at most one" hold by construction:
// opening one section is the same state update as closing whichever other
// section was open, never two separate updates that could otherwise leave
// both — or, with three sections now, more than one — open at once. Local
// `useState` already satisfies "the expanded/collapsed state should be
// preserved while the workspace remains open": the component only unmounts
// (resetting to this initial value) when the parent remounts it via
// `key={sessionDirectory}` on an actual workspace replacement, never on an
// edit — the same reset boundary every other workspace-scoped local UI
// state in this app already uses (e.g. src/components/
// ComparisonSlider.tsx's drag position).

import { useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import type { CurrentWorkingState } from "../lib/workspace-state";
import BrandingSection from "./BrandingSection";
import ComparisonInformationSection from "./ComparisonInformationSection";
import PresentationSection from "./PresentationSection";

interface EditInspectorProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly captureDateLabel: string;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
}

const COMPARISON_INFORMATION_BODY_ID = "edit-inspector-comparison-information";
const PRESENTATION_BODY_ID = "edit-inspector-presentation";
const BRANDING_BODY_ID = "edit-inspector-branding";

type OpenSection =
	| "comparison-information"
	| "presentation"
	| "branding"
	| null;

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
	const isBrandingExpanded = openSection === "branding";

	function toggleSection(
		section: "comparison-information" | "presentation" | "branding",
	) {
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

			<section
				className={`edit-inspector__section${
					isBrandingExpanded ? " edit-inspector__section--active" : ""
				}`}
			>
				<h2 className="edit-inspector__section-heading">
					<button
						type="button"
						className="edit-inspector__section-toggle"
						aria-expanded={isBrandingExpanded}
						aria-controls={BRANDING_BODY_ID}
						data-testid="edit-inspector-branding-toggle"
						onClick={() => toggleSection("branding")}
					>
						<span>{t.editInspector.branding.heading}</span>
						<span
							className={`edit-inspector__chevron${
								isBrandingExpanded ? " edit-inspector__chevron--expanded" : ""
							}`}
							aria-hidden="true"
						/>
					</button>
				</h2>
				{isBrandingExpanded && (
					<div id={BRANDING_BODY_ID} className="edit-inspector__section-body">
						<BrandingSection
							currentWorkingState={currentWorkingState}
							onCurrentWorkingStateChange={onCurrentWorkingStateChange}
						/>
					</div>
				)}
			</section>
		</aside>
	);
}
