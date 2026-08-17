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
// both — or, with three sections now, more than one — open at once.
//
// `openSection` is a controlled prop, owned by
// src/components/WorkspaceActive.tsx, not local `useState` — confirmed
// regression fix: this component is conditionally rendered alongside
// OutputInspector (WorkspaceActive.tsx's Edit/Output ternary), and React
// unmounts/remounts a component whenever the element type at that tree
// position changes, `key` or not — `key={sessionDirectory}` only prevents a
// remount across renders of this *same* type, it does nothing to keep this
// component alive across a switch to OutputInspector and back. Local state
// here was silently discarded on every "Create Output" and replaced with
// this component's own initial value on every "← Edit", which regressed
// docs/APPLICATION_LAYOUT.md "the expanded/collapsed state should be
// preserved while the workspace remains open" (confirmed by dedicated
// regression tests) and, because the discarded/default-reopened section can
// render at a different height than whatever was actually open before, also
// regressed docs/COMPARISON_PRESENTATION.md "Preview Consistency" (a taller
// or shorter Context Inspector column changes whether the document needs a
// scrollbar, which changes the two-column grid's own available width — see
// `scrollbar-gutter: stable` on `html` in src/styles/global.css for the
// other half of that same fix). WorkspaceActive survives the Edit/Output
// switch (it is the component that renders both), so it is the smallest
// state owner this can move to without any other structural change.
//
// Each section's descriptive subline (docs/APPLICATION_LAYOUT.md "Edit
// Inspector" > "Structure") is a `<p>` sibling placed after the toggle
// `<button>`'s own `</h2>`, deliberately outside both the `<h2>` (which must
// contain only the actual heading text) and the `<button>` (whose accessible
// name must stay exactly the heading — "Details"/"Presentation"/"Branding" —
// never the description text appended to it). Rendered unconditionally,
// independent of `isComparisonInformationExpanded`/`isPresentationExpanded`/
// `isBrandingExpanded`, so it never changes the header's own height on
// expand/collapse and gives the initially-open Details section the same
// orientation text as the two collapsed sections beside it.

import { useLocale } from "../i18n/LocaleContext";
import type { CurrentWorkingState } from "../lib/workspace-state";
import BrandingSection from "./BrandingSection";
import ComparisonInformationSection from "./ComparisonInformationSection";
import PresentationSection from "./PresentationSection";

export type OpenSection =
	| "comparison-information"
	| "presentation"
	| "branding"
	| null;

interface EditInspectorProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly captureDateLabel: string;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
	// docs/APPLICATION_LAYOUT.md "Output Inspector": "The Output Inspector
	// replaces the Edit Inspector after the user selects Create Output."
	readonly onCreateOutput: () => void;
	// See this file's own header comment: owned by WorkspaceActive so it
	// survives the Edit/Output switch instead of resetting on every remount.
	readonly openSection: OpenSection;
	readonly onOpenSectionChange: (next: OpenSection) => void;
}

const COMPARISON_INFORMATION_BODY_ID = "edit-inspector-comparison-information";
const PRESENTATION_BODY_ID = "edit-inspector-presentation";
const BRANDING_BODY_ID = "edit-inspector-branding";

export default function EditInspector({
	currentWorkingState,
	captureDateLabel,
	onCurrentWorkingStateChange,
	onCreateOutput,
	openSection,
	onOpenSectionChange,
}: EditInspectorProps) {
	const { t } = useLocale();
	const isComparisonInformationExpanded =
		openSection === "comparison-information";
	const isPresentationExpanded = openSection === "presentation";
	const isBrandingExpanded = openSection === "branding";

	function toggleSection(
		section: "comparison-information" | "presentation" | "branding",
	) {
		onOpenSectionChange(openSection === section ? null : section);
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
				<p
					className="edit-inspector__section-description"
					data-testid="edit-inspector-comparison-information-description"
				>
					{t.editInspector.comparisonInformationDescription}
				</p>
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
				<p
					className="edit-inspector__section-description"
					data-testid="edit-inspector-presentation-description"
				>
					{t.editInspector.presentation.description}
				</p>
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
				<p
					className="edit-inspector__section-description"
					data-testid="edit-inspector-branding-description"
				>
					{t.editInspector.branding.description}
				</p>
				{isBrandingExpanded && (
					<div id={BRANDING_BODY_ID} className="edit-inspector__section-body">
						<BrandingSection
							currentWorkingState={currentWorkingState}
							onCurrentWorkingStateChange={onCurrentWorkingStateChange}
						/>
					</div>
				)}
			</section>
			<button
				type="button"
				className="edit-inspector__create-output-button"
				data-testid="create-output-button"
				onClick={onCreateOutput}
			>
				{t.editInspector.createOutputButton}
			</button>
		</aside>
	);
}
