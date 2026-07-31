// A minimal outlined text field with the label integrated into the border
// (docs/APPLICATION_LAYOUT.md "Common Control Rules" > "Input Fields": "The
// field label is integrated into the outline instead of occupying a separate
// row"), extracted here because the Edit Inspector's Comparison Information
// section (src/components/ComparisonInformationSection.tsx) genuinely repeats
// this exact input/label/error markup six times (Title, Description,
// Reference Date, the read-only Capture Date, and the three Location
// fields) — not built ahead of that need.
//
// Deliberately uncontrolled (`defaultValue`, not `value`): F-003 edits apply
// immediately to the Current Working State on every change for the live
// preview, but the field must keep showing exactly what the user is typing,
// not a normalized/validated echo — re-normalizing description text on every
// keystroke would otherwise fight a user typing a blank line (trailing
// newlines trimmed mid-edit). See src/components/
// ComparisonInformationSection.tsx for how callers reset this by remounting
// (`key={sessionDirectory}`) rather than by pushing a new `value` down.

import type { ChangeEvent } from "react";

interface OutlinedFieldProps {
	readonly id: string;
	readonly label: string;
	readonly defaultValue?: string;
	readonly onChange?: (value: string) => void;
	readonly multiline?: boolean;
	readonly rows?: number;
	readonly readOnly?: boolean;
	readonly error?: string | null;
	readonly testId?: string;
}

export default function OutlinedField({
	id,
	label,
	defaultValue,
	onChange,
	multiline,
	rows,
	readOnly,
	error,
	testId,
}: OutlinedFieldProps) {
	const errorId = error ? `${id}-error` : undefined;
	const className = [
		"outlined-field",
		error && "outlined-field--error",
		readOnly && "outlined-field--readonly",
	]
		.filter(Boolean)
		.join(" ");

	const sharedProps = {
		id,
		className: "outlined-field__control",
		defaultValue,
		readOnly,
		"aria-invalid": Boolean(error),
		"aria-describedby": errorId,
		"data-testid": testId,
		onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			onChange?.(event.target.value),
	};

	return (
		<div className={className}>
			{multiline ? (
				<textarea {...sharedProps} rows={rows ?? 3} />
			) : (
				<input {...sharedProps} type="text" />
			)}
			{/* Placed after the control on purpose: `.outlined-field__label` in
			    global.css positions it absolutely over the control's own top
			    border, the standard CSS-only technique for an "integrated" label
			    that needs no JS measurement. */}
			<label htmlFor={id} className="outlined-field__label">
				{label}
			</label>
			{error && (
				<p id={errorId} className="outlined-field__error" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
