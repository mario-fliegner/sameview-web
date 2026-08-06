// Shared Custom Color control (docs/COMPARISON_PRESENTATION.md "Custom Color
// Editing"): a native color swatch plus a HEX input, no aggressive
// validation while typing, immediate preview once valid, and an invalid
// value keeps the last valid color with only a subtle error state — no
// explanatory text. Identical behavior for every Custom Color consumer:
// Presentation Configuration's Background/Frame/Text
// (src/components/PresentationSection.tsx) and a Built-in Symbol's Color
// (src/components/BrandingSection.tsx). Extracted out of
// PresentationSection.tsx, which previously kept this local because it was
// the only consumer — behavior is otherwise unchanged; only the three
// visible labels moved from a hardcoded translation path to props, so this
// component carries no assumption about which feature is using it.

import { useState } from "react";
import { normalizeHexColor } from "../lib/hex-color";
import OutlinedField from "./OutlinedField";

interface CustomColorFieldsProps {
	readonly idPrefix: string;
	readonly value: string;
	readonly onChange: (color: string) => void;
	readonly heading: string;
	readonly swatchLabel: string;
	readonly hexLabel: string;
}

export default function CustomColorFields({
	idPrefix,
	value,
	onChange,
	heading,
	swatchLabel,
	hexLabel,
}: CustomColorFieldsProps) {
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
			<span className="presentation-custom-color__heading">{heading}</span>
			<div className="presentation-custom-color__fields">
				<input
					type="color"
					className="presentation-custom-color__swatch"
					value={value}
					aria-label={swatchLabel}
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
					label={hexLabel}
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
