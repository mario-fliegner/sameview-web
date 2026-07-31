// A minimal accessible toggle switch, extracted here because the Edit
// Inspector's Comparison Information section (src/components/
// ComparisonInformationSection.tsx) genuinely repeats this exact markup four
// times (Show Title, Show Description, Show Time, Show Location) — not built
// ahead of that need. docs/APPLICATION_LAYOUT.md "Common Control Rules"
// requires real switches, not checkboxes, right-aligned with a shared
// vertical alignment regardless of label length; a native
// `role="switch"` button is the standard accessible pattern for that, without
// adding a dependency.

interface SwitchProps {
	readonly id: string;
	readonly checked: boolean;
	readonly onChange: (checked: boolean) => void;
	readonly label: string;
	readonly disabled?: boolean;
}

export default function Switch({
	id,
	checked,
	onChange,
	label,
	disabled,
}: SwitchProps) {
	return (
		<button
			type="button"
			id={id}
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			className={`switch${checked ? " switch--on" : ""}`}
			// `id` doubles as the stable functional-test hook
			// (docs/AI_ENGINEERING_GUIDE.md Testing: assertions use stable
			// `data-testid`s, never translated labels) — every call site already
			// gives each switch a unique, non-localized id.
			data-testid={id}
			onClick={() => onChange(!checked)}
		>
			<span className="switch__track" aria-hidden="true">
				<span className="switch__thumb" />
			</span>
		</button>
	);
}
