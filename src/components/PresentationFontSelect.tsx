// The Presentation section's Font control
// (docs/APPLICATION_LAYOUT.md "Presentation" > "Typography";
// docs/COMPARISON_PRESENTATION.md Part 3 "Typography"). Replaces a plain
// native `<select>` (the original Phase 8b implementation): Chrome/Windows
// renders a native `<select>`'s open option list with a white system
// popup background while this app's own text stays near-white, which is
// illegible — a defect no CSS on a native `<select>` popup can fix in that
// browser. This component owns exactly that one control's popup rendering
// instead; it is not a general-purpose replacement for `<select>` elsewhere
// in this codebase.
//
// Implements the WAI-ARIA APG "Collapsible Select-Only Listbox" pattern
// (https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-collapsible/)
// unchanged rather than inventing new keyboard semantics: a trigger button
// (`aria-haspopup="listbox"`, `aria-expanded`) opens a `role="listbox"`
// that receives real DOM focus; `aria-activedescendant` tracks the
// currently highlighted `role="option"` while focus stays on the listbox
// itself, exactly as the pattern specifies. Only Escape and outside-pointer
// dismissal are additive on top of the pattern's own required keys, both
// closing without changing the committed value.
//
// Each option (and the trigger's own current-value text) is rendered in its
// own resolved Presentation Font (docs/BRAND_GUIDE.md "Comparison
// Presentation Typography": "Preview and Output must use the same
// font..."; this control previews the choice itself) — the group legend,
// this control's own chrome (border, background, chevron) and the rest of
// the Edit Inspector are never affected, exactly like every other
// Presentation Font scoping rule in this codebase.

import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	type PresentationFontId,
	resolvePresentationFontFamily,
} from "../lib/presentation-fonts";

interface PresentationFontOption {
	readonly id: PresentationFontId;
	readonly label: string;
}

interface PresentationFontSelectProps {
	readonly id: string;
	// The already-localized "Font" subgroup legend's own element id
	// (docs/APPLICATION_LAYOUT.md "Presentation" > "Typography") — this
	// component never invents a separate accessible name, it only assembles
	// the trigger's accessible name from this existing label plus its own
	// current-value text, via `aria-labelledby`.
	readonly legendId: string;
	readonly value: PresentationFontId;
	readonly options: readonly PresentationFontOption[];
	readonly onChange: (value: PresentationFontId) => void;
}

export default function PresentationFontSelect({
	id,
	legendId,
	value,
	options,
	onChange,
}: PresentationFontSelectProps) {
	const [open, setOpen] = useState(false);
	const [activeId, setActiveId] = useState<PresentationFontId>(value);
	const [openUpward, setOpenUpward] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const listboxRef = useRef<HTMLUListElement>(null);

	const buttonId = `${id}-button`;
	const listboxId = `${id}-listbox`;
	const selectedOption = options.find((option) => option.id === value);

	function openListbox() {
		setActiveId(value);
		setOpen(true);
	}

	function closeAndFocusButton() {
		setOpen(false);
		buttonRef.current?.focus();
	}

	// Moves real DOM focus into the listbox itself once it opens (the APG
	// pattern's own required focus target — see module comment above), and
	// only then: rendering it first, then focusing, avoids focusing an
	// element that does not exist in the DOM yet.
	useEffect(() => {
		if (open) listboxRef.current?.focus();
	}, [open]);

	// Keeps the popup inside the viewport ("Popup soll sinnvoll innerhalb des
	// Viewports bleiben") with the same "prefer the side that actually fits"
	// reasoning already established for the Overflow Tooltip
	// (src/lib/overflow-tooltip-geometry.ts), but flipped to prefer *below*
	// first — the conventional direction for a dropdown, unlike that
	// tooltip's own "prefer above" default. A small, self-contained
	// calculation kept local to this one control rather than extracted to a
	// shared module: reusing the tooltip's own function here would silently
	// import its "prefer above" bias, which is the wrong default for a
	// dropdown.
	useLayoutEffect(() => {
		if (!open) return;
		const trigger = buttonRef.current;
		const listbox = listboxRef.current;
		if (!trigger || !listbox) return;
		const triggerRect = trigger.getBoundingClientRect();
		const listboxHeight = listbox.getBoundingClientRect().height;
		const spaceBelow = window.innerHeight - triggerRect.bottom;
		const spaceAbove = triggerRect.top;
		setOpenUpward(spaceBelow < listboxHeight && spaceAbove > spaceBelow);
	}, [open]);

	// Closes without changing the committed value on any pointer interaction
	// outside this control — the same established "outside pointerdown
	// closes" technique src/lib/overflow-tooltip.ts already uses for its own
	// popup.
	useEffect(() => {
		if (!open) return;
		function handlePointerDown(event: PointerEvent) {
			if (containerRef.current?.contains(event.target as Node)) return;
			setOpen(false);
		}
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [open]);

	function commitActive() {
		onChange(activeId);
		closeAndFocusButton();
	}

	function handleButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
		if (
			event.key === "ArrowDown" ||
			event.key === "ArrowUp" ||
			event.key === "Enter" ||
			event.key === " "
		) {
			event.preventDefault();
			openListbox();
		}
	}

	function handleListboxKeyDown(event: ReactKeyboardEvent<HTMLUListElement>) {
		const currentIndex = options.findIndex((option) => option.id === activeId);
		switch (event.key) {
			case "ArrowDown": {
				event.preventDefault();
				const next = options[Math.min(currentIndex + 1, options.length - 1)];
				if (next) setActiveId(next.id);
				break;
			}
			case "ArrowUp": {
				event.preventDefault();
				const previous = options[Math.max(currentIndex - 1, 0)];
				if (previous) setActiveId(previous.id);
				break;
			}
			case "Home": {
				event.preventDefault();
				const first = options[0];
				if (first) setActiveId(first.id);
				break;
			}
			case "End": {
				event.preventDefault();
				const last = options[options.length - 1];
				if (last) setActiveId(last.id);
				break;
			}
			case "Enter":
			case " ":
				event.preventDefault();
				commitActive();
				break;
			case "Escape":
				// "Escape zum Schließen ohne unbeabsichtigte Änderung" — never
				// calls onChange.
				event.preventDefault();
				closeAndFocusButton();
				break;
			case "Tab":
				// Never preventDefault: Tab must still move focus on to the next
				// element exactly as it would from any other focused control;
				// only the now-stale open popup is dismissed.
				setOpen(false);
				break;
			default:
				break;
		}
	}

	return (
		<div className="presentation-font-select" ref={containerRef}>
			<button
				type="button"
				id={buttonId}
				ref={buttonRef}
				data-testid={id}
				className="presentation-font-select__trigger"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-labelledby={`${legendId} ${buttonId}`}
				onClick={() => (open ? setOpen(false) : openListbox())}
				onKeyDown={handleButtonKeyDown}
			>
				<span
					data-testid={`${id}-value`}
					className="presentation-font-select__value"
					style={{
						fontFamily: selectedOption
							? resolvePresentationFontFamily(selectedOption.id)
							: undefined,
					}}
				>
					{selectedOption?.label}
				</span>
				<span
					className={`presentation-font-select__chevron${
						open ? " presentation-font-select__chevron--open" : ""
					}`}
					aria-hidden="true"
				/>
			</button>
			{open && (
				<ul
					ref={listboxRef}
					id={listboxId}
					data-testid={listboxId}
					// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the WAI-ARIA APG "Collapsible Select-Only Listbox" pattern (module comment above) requires role="listbox" on the focusable container that owns aria-activedescendant — this is that pattern, not an accidental role on a plain list.
					role="listbox"
					tabIndex={-1}
					aria-labelledby={legendId}
					aria-activedescendant={`${id}-option-${activeId}`}
					className={`presentation-font-select__listbox${
						openUpward ? " presentation-font-select__listbox--up" : ""
					}`}
					onKeyDown={handleListboxKeyDown}
				>
					{options.map((option) => (
						// biome-ignore lint/a11y/useFocusableInteractive: the APG pattern (module comment above) deliberately keeps each option unfocusable — DOM focus stays on the listbox itself, and aria-activedescendant (set above) is what identifies the "active" option to assistive technology instead of per-option focus.
						// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is handled entirely by the listbox's own onKeyDown above (the APG pattern's required key set); this option's onClick only mirrors that same commit path for mouse/touch, never a separate keyboard target of its own.
						<li
							key={option.id}
							id={`${id}-option-${option.id}`}
							data-testid={`${id}-option-${option.id}`}
							// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: role="option" on a plain <li>, owned by the parent's role="listbox", is exactly the WAI-ARIA APG pattern referenced in the module comment above.
							role="option"
							aria-selected={option.id === value}
							className={`presentation-font-select__option${
								option.id === activeId
									? " presentation-font-select__option--active"
									: ""
							}`}
							style={{ fontFamily: resolvePresentationFontFamily(option.id) }}
							onMouseEnter={() => setActiveId(option.id)}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								setActiveId(option.id);
								onChange(option.id);
								closeAndFocusButton();
							}}
						>
							{option.label}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
