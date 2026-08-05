// The Edit Inspector's "Comparison Information" section
// (docs/APPLICATION_LAYOUT.md "Edit Inspector" > "Comparison Information";
// docs/FEATURE_SPECIFICATION.md F-003). Pure editing controls only — this
// component never renders a comparison value for display, only inputs and
// switches that write to the Current Working State; the corresponding
// rendered-under-the-image presentation lives entirely in
// src/components/ComparisonPresentationInfo.tsx, per the approved Phase 5
// correction (rendering and editing are two separate components, never
// merged).
//
// Uncontrolled fields (see src/components/OutlinedField.tsx): every change
// applies immediately to the Current Working State for the live preview
// (docs/USER_WORKFLOW.md "Live Workspace"), but the field itself keeps
// showing exactly what the user typed. The parent (src/components/
// WorkspaceActive.tsx) remounts this whole section with
// `key={sessionDirectory}` on workspace replacement, which is this
// component's only reset mechanism — deliberately, so an in-progress edit is
// never silently overwritten by its own committed value.

import { useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import {
	applyDescription,
	applyLocationCity,
	applyLocationCountry,
	applyLocationDisplayName,
	applyReferenceDate,
	applyTitle,
	applyVisibility,
	getDescriptionValue,
	getLocationCityValue,
	getLocationCountryValue,
	getLocationDisplayNameValue,
	getReferenceDateValue,
	getTitleValue,
	validateReferenceDateInput,
} from "../lib/comparison-edit";
import type { CurrentWorkingState } from "../lib/workspace-state";
import OutlinedField from "./OutlinedField";
import Switch from "./Switch";

interface ComparisonInformationSectionProps {
	readonly currentWorkingState: CurrentWorkingState;
	// The read-only Capture Date field displays the same derived, localized
	// label the Presentation Canvas and Viewer already use
	// (src/lib/comparison-presentation.ts `captureLabel`) rather than
	// re-deriving it here, so the two never drift apart.
	readonly captureDateLabel: string;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
}

export default function ComparisonInformationSection({
	currentWorkingState,
	captureDateLabel,
	onCurrentWorkingStateChange,
}: ComparisonInformationSectionProps) {
	const { t } = useLocale();
	const [referenceDateError, setReferenceDateError] = useState<string | null>(
		null,
	);
	const visibility = currentWorkingState.presentationVisibility;

	function handleReferenceDateChange(rawInput: string) {
		const result = validateReferenceDateInput(rawInput);
		if (!result.ok) {
			setReferenceDateError(t.editInspector.referenceDateErrors[result.error]);
			// Invalid input is never applied — the Current Working State keeps
			// its last valid value (docs/IMPLEMENTATION_PLAN_V1.md Phase 5
			// Definition of Done: "invalid edits cannot partially apply").
			return;
		}
		setReferenceDateError(null);
		onCurrentWorkingStateChange(
			applyReferenceDate(currentWorkingState, result.value),
		);
	}

	return (
		<div className="comparison-information">
			<div className="field-row">
				<OutlinedField
					id="edit-title"
					label={t.editInspector.titleLabel}
					defaultValue={getTitleValue(currentWorkingState)}
					onChange={(value) =>
						onCurrentWorkingStateChange(applyTitle(currentWorkingState, value))
					}
					testId="edit-title-input"
				/>
				<Switch
					id="edit-show-title"
					checked={visibility.title}
					onChange={(checked) =>
						onCurrentWorkingStateChange(
							applyVisibility(currentWorkingState, { title: checked }),
						)
					}
					label={t.editInspector.showTitleLabel}
				/>
			</div>

			<div className="field-row field-row--top">
				<OutlinedField
					id="edit-description"
					label={t.editInspector.descriptionLabel}
					defaultValue={getDescriptionValue(currentWorkingState)}
					onChange={(value) =>
						onCurrentWorkingStateChange(
							applyDescription(currentWorkingState, value),
						)
					}
					multiline
					rows={3}
					testId="edit-description-input"
				/>
				<Switch
					id="edit-show-description"
					checked={visibility.description}
					onChange={(checked) =>
						onCurrentWorkingStateChange(
							applyVisibility(currentWorkingState, { description: checked }),
						)
					}
					label={t.editInspector.showDescriptionLabel}
				/>
			</div>

			<fieldset className="comparison-information__group">
				<legend>
					<span>{t.editInspector.timeLegend}</span>
					<Switch
						id="edit-show-time"
						checked={visibility.time}
						onChange={(checked) =>
							onCurrentWorkingStateChange(
								applyVisibility(currentWorkingState, { time: checked }),
							)
						}
						label={t.editInspector.showTimeLabel}
					/>
				</legend>
				<div className="field-row field-row--split">
					<OutlinedField
						id="edit-reference-date"
						label={t.editInspector.referenceDateLabel}
						defaultValue={getReferenceDateValue(currentWorkingState)}
						onChange={handleReferenceDateChange}
						error={referenceDateError}
						testId="edit-reference-date-input"
					/>
					<OutlinedField
						id="edit-capture-date"
						label={t.editInspector.captureDateLabel}
						defaultValue={captureDateLabel}
						readOnly
						testId="edit-capture-date-input"
					/>
				</div>
				{/* docs/APPLICATION_LAYOUT.md "Photo dates": "Show Time Difference
				    is only available when Show photo dates is enabled" / "When Show
				    photo dates is disabled, Show Time Difference becomes disabled."
				    A plain label + switch row, no accompanying field — the same
				    `.presentation-toggle-label` pattern already used for "Show Slider
				    Date Labels" (src/components/PresentationSection.tsx). `disabled`
				    only affects interactivity here; the underlying value is left
				    untouched so it is restored automatically if Show photo dates is
				    re-enabled — the rendered Duration is separately gated on both
				    flags (src/components/ComparisonPresentationInfo.tsx
				    `showDuration`), so a stale `true` value while disabled can never
				    become visible on its own. */}
				<div className="field-row">
					<span className="presentation-toggle-label">
						{t.editInspector.showTimeDifferenceLabel}
					</span>
					<Switch
						id="edit-show-time-difference"
						checked={visibility.timeDifference}
						disabled={!visibility.time}
						onChange={(checked) =>
							onCurrentWorkingStateChange(
								applyVisibility(currentWorkingState, {
									timeDifference: checked,
								}),
							)
						}
						label={t.editInspector.showTimeDifferenceLabel}
					/>
				</div>
			</fieldset>

			<fieldset className="comparison-information__group">
				<legend>
					<span>{t.editInspector.locationLegend}</span>
					<Switch
						id="edit-show-location"
						checked={visibility.location}
						onChange={(checked) =>
							onCurrentWorkingStateChange(
								applyVisibility(currentWorkingState, { location: checked }),
							)
						}
						label={t.editInspector.showLocationLabel}
					/>
				</legend>
				<OutlinedField
					id="edit-location-display-name"
					label={t.editInspector.locationDisplayNameLabel}
					defaultValue={getLocationDisplayNameValue(currentWorkingState)}
					onChange={(value) =>
						onCurrentWorkingStateChange(
							applyLocationDisplayName(currentWorkingState, value),
						)
					}
					testId="edit-location-display-name-input"
				/>
				<div className="field-row field-row--split">
					<OutlinedField
						id="edit-location-city"
						label={t.editInspector.locationCityLabel}
						defaultValue={getLocationCityValue(currentWorkingState)}
						onChange={(value) =>
							onCurrentWorkingStateChange(
								applyLocationCity(currentWorkingState, value),
							)
						}
						testId="edit-location-city-input"
					/>
					<OutlinedField
						id="edit-location-country"
						label={t.editInspector.locationCountryLabel}
						defaultValue={getLocationCountryValue(currentWorkingState)}
						onChange={(value) =>
							onCurrentWorkingStateChange(
								applyLocationCountry(currentWorkingState, value),
							)
						}
						testId="edit-location-country-input"
					/>
				</div>
			</fieldset>
		</div>
	);
}
