// The Edit Inspector's "Presentation" section
// (docs/APPLICATION_LAYOUT.md "Edit Inspector" > "Presentation";
// docs/COMPARISON_PRESENTATION.md Part 3 "Canvas", "Text", "Comparison
// Stage"). Implements the options approved so far, grouped per
// APPLICATION_LAYOUT.md's information architecture: Colors (Background,
// Frame, Text), Shape (Corners), Slider (Show Slider Date Labels). Map
// Preview is explicitly a separate, later iteration
// (COMPARISON_PRESENTATION.md Part 3 "Map") and has no control here.
//
// Pure editing controls only, mirroring the same split already established
// by src/components/ComparisonInformationSection.tsx: this component never
// renders a comparison value for display, only controls that write to the
// Current Working State. The corresponding live rendering lives in
// src/components/WorkspaceActive.tsx's `PresentationCanvas`.
//
// The two local, unexported components below (`OptionGroup`,
// `CustomColorFields`) exist only because Background, Frame and Text each
// need the exact same segmented-option-group and Custom Color behavior
// (docs/APPLICATION_LAYOUT.md: "identical in presentation to Background").
// They are not exported and not meant to generalize beyond this section.

import { useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import {
	applyPresentationConfiguration,
	normalizeHexColor,
} from "../lib/comparison-edit";
import type {
	CanvasBackground,
	CornerRadius,
	CurrentWorkingState,
	PresentationFrame,
	PresentationTextColor,
} from "../lib/workspace-state";
import OutlinedField from "./OutlinedField";
import Switch from "./Switch";

interface PresentationSectionProps {
	readonly currentWorkingState: CurrentWorkingState;
	readonly onCurrentWorkingStateChange: (next: CurrentWorkingState) => void;
}

// A sensible starting value the moment a "Custom" option is first selected,
// before the user has picked a color of their own — Background, Frame and
// Text each require a concrete `color` the instant their `kind` becomes
// "custom" (see src/lib/workspace-state.ts's discriminated unions).
const INITIAL_CUSTOM_COLOR = "#FFFFFF";

export default function PresentationSection({
	currentWorkingState,
	onCurrentWorkingStateChange,
}: PresentationSectionProps) {
	const { t } = useLocale();
	const configuration = currentWorkingState.presentationConfiguration;

	function updateConfiguration(
		patch: Parameters<typeof applyPresentationConfiguration>[1],
	) {
		onCurrentWorkingStateChange(
			applyPresentationConfiguration(currentWorkingState, patch),
		);
	}

	return (
		<div className="presentation-section">
			<div className="presentation-option-group">
				<span className="presentation-option-group__legend">
					{t.editInspector.presentation.colorsLegend}
				</span>

				<div className="presentation-subgroup">
					<span className="presentation-subgroup__legend">
						{t.editInspector.presentation.backgroundLegend}
					</span>
					<OptionGroup
						legend={t.editInspector.presentation.backgroundLegend}
						testIdPrefix="edit-presentation-background"
						selected={configuration.canvasBackground.kind}
						options={[
							{
								value: "transparent",
								label:
									t.editInspector.presentation.backgroundOptions.transparent,
							},
							{
								value: "white",
								label: t.editInspector.presentation.backgroundOptions.white,
								chipColor: "#FFFFFF",
							},
							{
								value: "black",
								label: t.editInspector.presentation.backgroundOptions.black,
								chipColor: "#000000",
							},
							{
								value: "brand",
								label: t.editInspector.presentation.backgroundOptions.brand,
								chipColor: "#4F8CFF",
							},
							{
								value: "custom",
								label: t.editInspector.presentation.backgroundOptions.custom,
							},
						]}
						onSelect={(value) => {
							const kind = value as CanvasBackground["kind"];
							updateConfiguration({
								canvasBackground:
									kind === "custom"
										? { kind: "custom", color: INITIAL_CUSTOM_COLOR }
										: { kind },
							});
						}}
					/>
					{configuration.canvasBackground.kind === "custom" && (
						<CustomColorFields
							idPrefix="edit-presentation-background-custom-color"
							value={configuration.canvasBackground.color}
							onChange={(color) =>
								updateConfiguration({
									canvasBackground: { kind: "custom", color },
								})
							}
						/>
					)}
				</div>

				<div className="presentation-subgroup">
					<span className="presentation-subgroup__legend">
						{t.editInspector.presentation.frameLegend}
					</span>
					<OptionGroup
						legend={t.editInspector.presentation.frameLegend}
						testIdPrefix="edit-presentation-frame"
						selected={configuration.frame.kind}
						options={[
							{
								value: "none",
								label: t.editInspector.presentation.frameOptions.none,
							},
							{
								value: "white",
								label: t.editInspector.presentation.frameOptions.white,
								chipColor: "#FFFFFF",
							},
							{
								value: "black",
								label: t.editInspector.presentation.frameOptions.black,
								chipColor: "#000000",
							},
							{
								value: "custom",
								label: t.editInspector.presentation.frameOptions.custom,
							},
						]}
						onSelect={(value) => {
							const kind = value as PresentationFrame["kind"];
							updateConfiguration({
								frame:
									kind === "custom"
										? { kind: "custom", color: INITIAL_CUSTOM_COLOR }
										: { kind },
							});
						}}
					/>
					{configuration.frame.kind === "custom" && (
						<CustomColorFields
							idPrefix="edit-presentation-frame-custom-color"
							value={configuration.frame.color}
							onChange={(color) =>
								updateConfiguration({ frame: { kind: "custom", color } })
							}
						/>
					)}
				</div>

				<div className="presentation-subgroup">
					<span className="presentation-subgroup__legend">
						{t.editInspector.presentation.textLegend}
					</span>
					<OptionGroup
						legend={t.editInspector.presentation.textLegend}
						testIdPrefix="edit-presentation-text"
						selected={configuration.textColor.kind}
						options={[
							{
								value: "automatic",
								label: t.editInspector.presentation.textOptions.automatic,
							},
							{
								value: "light",
								label: t.editInspector.presentation.textOptions.light,
								chipColor: "#FFFFFF",
							},
							{
								value: "dark",
								label: t.editInspector.presentation.textOptions.dark,
								chipColor: "#0D1424",
							},
							{
								value: "custom",
								label: t.editInspector.presentation.textOptions.custom,
							},
						]}
						onSelect={(value) => {
							const kind = value as PresentationTextColor["kind"];
							updateConfiguration({
								textColor:
									kind === "custom"
										? { kind: "custom", color: INITIAL_CUSTOM_COLOR }
										: { kind },
							});
						}}
					/>
					{configuration.textColor.kind === "custom" && (
						<CustomColorFields
							idPrefix="edit-presentation-text-custom-color"
							value={configuration.textColor.color}
							onChange={(color) =>
								updateConfiguration({ textColor: { kind: "custom", color } })
							}
						/>
					)}
				</div>
			</div>

			<div className="presentation-option-group">
				<span className="presentation-option-group__legend">
					{t.editInspector.presentation.shapeLegend}
				</span>

				<div className="presentation-subgroup">
					<span className="presentation-subgroup__legend">
						{t.editInspector.presentation.cornersLegend}
					</span>
					<OptionGroup
						legend={t.editInspector.presentation.cornersLegend}
						testIdPrefix="edit-presentation-corners"
						selected={configuration.cornerRadius}
						options={[
							{
								value: "sharp",
								label: t.editInspector.presentation.cornerOptions.sharp,
							},
							{
								value: "rounded",
								label: t.editInspector.presentation.cornerOptions.rounded,
							},
						]}
						onSelect={(value) =>
							updateConfiguration({ cornerRadius: value as CornerRadius })
						}
					/>
				</div>
			</div>

			<div className="presentation-option-group">
				<span className="presentation-option-group__legend">
					{t.editInspector.presentation.sliderLegend}
				</span>
				<div className="field-row">
					<span className="presentation-toggle-label">
						{t.editInspector.presentation.showSliderDateLabelsLabel}
					</span>
					<Switch
						id="edit-show-slider-date-labels"
						checked={configuration.showSliderDateLabels}
						onChange={(checked) =>
							updateConfiguration({ showSliderDateLabels: checked })
						}
						label={t.editInspector.presentation.showSliderDateLabelsLabel}
					/>
				</div>
			</div>
		</div>
	);
}

interface OptionGroupOption {
	readonly value: string;
	readonly label: string;
	readonly chipColor?: string;
}

interface OptionGroupProps {
	readonly legend: string;
	readonly testIdPrefix: string;
	readonly options: readonly OptionGroupOption[];
	readonly selected: string;
	readonly onSelect: (value: string) => void;
}

// docs/APPLICATION_LAYOUT.md "Background"/"Frame"/"Text": "Visual segmented
// option group with color chips"; "Corners": "Single-row option group" (no
// chips — its options simply carry no `chipColor`, so the same renderer
// serves all four without a separate variant).
function OptionGroup({
	legend,
	testIdPrefix,
	options,
	selected,
	onSelect,
}: OptionGroupProps) {
	return (
		<div className="presentation-options" role="radiogroup" aria-label={legend}>
			{options.map((option) => (
				// A native <input type="radio"> cannot host the visible color chip
				// and label this option needs — src/components/Switch.tsx already
				// establishes the same pattern (role="switch" on a plain button)
				// for the identical reason.
				// biome-ignore lint/a11y/useSemanticElements: see comment above
				<button
					key={option.value}
					type="button"
					role="radio"
					aria-checked={option.value === selected}
					data-testid={`${testIdPrefix}-${option.value}`}
					className={`presentation-options__button${
						option.value === selected
							? " presentation-options__button--selected"
							: ""
					}`}
					onClick={() => onSelect(option.value)}
				>
					{option.chipColor && (
						<span
							className="presentation-options__chip"
							style={{ background: option.chipColor }}
							aria-hidden="true"
						/>
					)}
					{option.label}
				</button>
			))}
		</div>
	);
}

interface CustomColorFieldsProps {
	readonly idPrefix: string;
	readonly value: string;
	readonly onChange: (color: string) => void;
}

// docs/COMPARISON_PRESENTATION.md "Custom Color Editing": identical behavior
// for Background, Frame and Text — a native color field plus a HEX input, no
// aggressive validation while typing, immediate preview once valid, and an
// invalid value keeps the last valid color with only a subtle error state
// (no explanatory text).
function CustomColorFields({
	idPrefix,
	value,
	onChange,
}: CustomColorFieldsProps) {
	const { t } = useLocale();
	const [hasError, setHasError] = useState(false);

	function handleHexChange(rawInput: string) {
		const normalized = normalizeHexColor(rawInput);
		if (normalized === undefined) {
			setHasError(true);
			return;
		}
		setHasError(false);
		onChange(normalized);
	}

	return (
		<div className="presentation-custom-color">
			<span className="presentation-custom-color__heading">
				{t.editInspector.presentation.customColorHeading}
			</span>
			<div className="presentation-custom-color__fields">
				<input
					type="color"
					className="presentation-custom-color__swatch"
					value={value}
					aria-label={t.editInspector.presentation.customColorSwatchLabel}
					data-testid={`${idPrefix}-swatch`}
					onChange={(event) => {
						const normalized = normalizeHexColor(event.target.value);
						if (normalized !== undefined) {
							setHasError(false);
							onChange(normalized);
						}
					}}
				/>
				<OutlinedField
					id={`${idPrefix}-hex`}
					label={t.editInspector.presentation.customColorHexLabel}
					defaultValue={value}
					onChange={handleHexChange}
					error={hasError ? "invalid" : null}
					hideErrorText
					testId={`${idPrefix}-hex-input`}
				/>
			</div>
		</div>
	);
}
