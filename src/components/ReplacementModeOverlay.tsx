// Application-level modal for the Replace Export validate/confirm decision
// (docs/APPLICATION_LAYOUT.md "Replace Export"; docs/FEATURE_SPECIFICATION.md
// F-001 step 2). Rendered by the app shell (src/components/App.tsx) as a
// sibling of the header/workspace/footer — not nested inside any one
// workspace-region component — so it does not need to change shape once the
// Viewer, Editor and Output regions exist (docs/IMPLEMENTATION_PLAN_V1.md
// Phases 4-9): a fixed-position modal is layout-agnostic by construction,
// unlike content appended inside whichever component currently occupies
// those regions.
//
// The existing workspace stays visible, dimmed, behind this overlay's
// backdrop (docs/APPLICATION_LAYOUT.md "Loading Philosophy": existing
// content should remain visible whenever possible), while the app shell
// makes the rest of the page `inert` while this is mounted. Using a real
// modal here (rather than inline content) is explicitly sanctioned by
// "Error Philosophy": "Avoid modal dialogs unless the action itself requires
// confirmation" — Replace Export requires exactly that decision.
//
// Two phases share one dialog element so focus, the backdrop and the Tab
// trap never need to remount between them:
// - "validating": the selected candidate is still being read/validated; no
//   decision exists yet, so no Cancel/Confirm affordance is shown. Escape
//   and the Tab trap are also inert during this phase — there being no
//   prepared candidate yet to discard, and the existing import/validation
//   pipeline (src/lib/import-source-data.ts) having no cancellation hook,
//   which this task does not add (docs/IMPLEMENTATION_PLAN_V1.md
//   Implementation Principles: keep changes minimal).
// - "confirming": validation succeeded; the user must explicitly decide.

import { type KeyboardEvent, useEffect, useRef } from "react";
import { useLocale } from "../i18n/LocaleContext";

interface ReplacementModeOverlayProps {
	readonly phase: "validating" | "confirming";
	readonly currentSessionDirectory: string;
	readonly candidateSessionDirectory: string | null;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
}

export default function ReplacementModeOverlay({
	phase,
	currentSessionDirectory,
	candidateSessionDirectory,
	onConfirm,
	onCancel,
}: ReplacementModeOverlayProps) {
	const { t } = useLocale();
	const headingRef = useRef<HTMLHeadingElement>(null);
	const cancelButtonRef = useRef<HTMLButtonElement>(null);
	const confirmButtonRef = useRef<HTMLButtonElement>(null);

	// Moves focus into the dialog as soon as it appears, and again the
	// moment it switches from validating to confirming, since new
	// interactive content (Cancel/Replace) has just appeared. Focuses the
	// heading rather than a button so the user reads the decision before
	// acting, consistent with the initial-import confirmation heading focus
	// this replaces.
	// `phase` is intentionally a re-run trigger here, not a read value, so
	// the heading refocuses on every validating <-> confirming transition.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		headingRef.current?.focus();
	}, [phase]);

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (phase !== "confirming") return;
		if (event.key === "Escape") {
			event.preventDefault();
			onCancel();
			return;
		}
		if (event.key !== "Tab") return;
		const first = cancelButtonRef.current;
		const last = confirmButtonRef.current;
		if (!first || !last) return;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	return (
		<div className="replacement-mode" data-testid="replacement-mode-overlay">
			<div
				className="replacement-mode__panel"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="replacement-mode-heading"
				aria-describedby="replacement-mode-message"
				// Only "confirming" carries the stable `replace-confirm-dialog`
				// testid pre-existing tests rely on: that testid has always meant
				// "the decision is ready," and must not match during "validating",
				// when there is nothing yet to confirm or cancel.
				data-testid={
					phase === "confirming"
						? "replace-confirm-dialog"
						: "replacement-mode-validating"
				}
				onKeyDown={handleKeyDown}
			>
				<h2 id="replacement-mode-heading" ref={headingRef} tabIndex={-1}>
					{phase === "validating"
						? t.replacementMode.validatingHeading
						: t.replacementMode.confirmHeading}
				</h2>

				{phase === "validating" ? (
					<p
						id="replacement-mode-message"
						className="replacement-mode__message"
						aria-live="polite"
						data-testid="replacement-mode-status"
					>
						{t.replacementMode.validatingMessage}
					</p>
				) : (
					<>
						<p
							id="replacement-mode-message"
							className="replacement-mode__message"
						>
							{t.replacementMode.confirmDescription}
						</p>
						<dl className="replacement-mode__sessions">
							<div className="replacement-mode__session-row">
								<dt>{t.replacementMode.currentSessionLabel}</dt>
								<dd data-testid="replacement-mode-current-session">
									{currentSessionDirectory}
								</dd>
							</div>
							<div className="replacement-mode__session-row">
								<dt>{t.replacementMode.newSessionLabel}</dt>
								<dd data-testid="replacement-mode-new-session">
									{candidateSessionDirectory}
								</dd>
							</div>
						</dl>
						<div className="replacement-mode__actions">
							<button
								type="button"
								ref={cancelButtonRef}
								className="replacement-mode__button"
								data-testid="replace-cancel-button"
								onClick={onCancel}
							>
								{t.replacementMode.cancelButton}
							</button>
							<button
								type="button"
								ref={confirmButtonRef}
								className="replacement-mode__button replacement-mode__button--primary"
								data-testid="replace-confirm-button"
								onClick={onConfirm}
							>
								{t.replacementMode.confirmButton}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
