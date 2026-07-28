// Implements docs/APPLICATION_LAYOUT.md's "Import Section" and "Import
// States" for State A (`No Workspace`), and the transient green
// "Import Succeeded" confirmation with its automatic scroll into the
// workspace. State B (`Workspace Active`) itself is
// src/components/WorkspaceActive.tsx (docs/FEATURE_SPECIFICATION.md F-002) —
// this component only decides which of the two states to render.
//
// The `No Workspace` composition is deliberately not a bordered/shadowed
// "card": the entire region between header and footer is one open stage —
// SameView's own two-frame symbol (large, with a soft glow behind it, grouped
// with the glow in `.import-stage__symbol` so the glow stays centered on the
// icon regardless of how much text follows), a headline, a real
// "Choose Export" button, and a quiet caption. An earlier iteration also had
// a supporting line between the headline and the button; it was removed
// because it restated the same idea as the headline/button in different
// words rather than answering a genuinely different user question (see the
// information-hierarchy review that approved this change). Clicking or
// dropping anywhere in the stage (not just on the icon or button) starts the
// same import. The page's H1 is visually hidden (`.visually-hidden`) rather
// than removed — sighted users get their immediate context from the stage's
// composition instead; assistive technology and the document outline still
// get exactly one heading.
//
// Workspace/import state and the shared hidden file input are owned by the
// app shell (src/components/App.tsx), not by this component — the header's
// "Replace Export" action needs to trigger the same input and pipeline, so
// the smallest common owner is the shared parent, not this component or a
// new store. This component renders two mutually exclusive top-level views
// driven by props: the `No Workspace` stage, and (delegated to
// src/components/WorkspaceActive.tsx) `Workspace Active`.
//
// The Replace Export validate/confirm decision (docs/FEATURE_SPECIFICATION.md
// F-001 step 2) is deliberately NOT rendered here: it is an application-level
// modal owned by the app shell (src/components/ReplacementModeOverlay.tsx),
// independent of whatever this component (or WorkspaceActive) renders — see
// the forward-looking Replacement Mode analysis this implements.
//
// `data-testid` attributes below exist so E2E functional/interaction tests
// never depend on visible copy or CSS class names, which change frequently
// as this screen's wording and presentation are iterated on. Copy itself is
// still covered, but only in tests whose explicit purpose is verifying copy
// or translation (see test/e2e/app-shell.spec.ts).

import {
	type DragEvent,
	type KeyboardEvent,
	type MouseEvent,
	useState,
} from "react";
import { useLocale } from "../i18n/LocaleContext";
import type { WorkspaceState } from "../lib/workspace-state";
import WorkspaceActive from "./WorkspaceActive";

// SameView's own two-frame glyph — the product's identity, not a generic
// cloud-upload icon (this product never uploads anything;
// docs/DATA_AND_PRIVACY.md). Rendered large: it is the stage's central
// visual element, not a small label icon.
function StageIcon() {
	return (
		<svg
			className="import-stage__icon"
			viewBox="0 0 48 48"
			width="96"
			height="96"
			aria-hidden="true"
			focusable="false"
		>
			<rect x="5" y="11" width="26" height="26" rx="4" />
			<rect x="17" y="21" width="26" height="26" rx="4" />
		</svg>
	);
}

interface ImportSectionProps {
	readonly workspaceState: WorkspaceState;
	readonly isImporting: boolean;
	readonly importSucceeded: boolean;
	readonly errorMessage: string | null;
	readonly onOpenFilePicker: () => void;
	readonly onFileDropped: (file: File) => void;
}

export default function ImportSection({
	workspaceState,
	isImporting,
	importSucceeded,
	errorMessage,
	onOpenFilePicker,
	onFileDropped,
}: ImportSectionProps) {
	const { t } = useLocale();
	const [isDragActive, setIsDragActive] = useState(false);
	const isBusy = isImporting || importSucceeded;

	function handleStageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onOpenFilePicker();
		}
	}

	function handleChooseButtonClick(event: MouseEvent<HTMLButtonElement>) {
		// Prevents the stage's own onClick from also firing for the same
		// interaction (the button is nested inside the stage).
		event.stopPropagation();
		onOpenFilePicker();
	}

	function handleDragEnter(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		if (!isBusy) setIsDragActive(true);
	}

	function handleDragOver(event: DragEvent<HTMLDivElement>) {
		// Required so the browser allows a drop on this element at all.
		event.preventDefault();
	}

	function handleDragLeave(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		// Ignore leave events caused by moving between children of the stage
		// (e.g. onto the nested button) to avoid flicker.
		const nextTarget = event.relatedTarget as Node | null;
		if (nextTarget && event.currentTarget.contains(nextTarget)) return;
		setIsDragActive(false);
	}

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setIsDragActive(false);
		if (isBusy) return;
		const file = event.dataTransfer.files?.[0];
		if (file) onFileDropped(file);
	}

	if (workspaceState.status === "active") {
		return (
			<WorkspaceActive
				currentWorkingState={workspaceState.workspace.currentWorkingState}
				errorMessage={errorMessage}
			/>
		);
	}

	const stageClassName = [
		"import-stage",
		isDragActive && "import-stage--drag-active",
		isImporting && "import-stage--importing",
		importSucceeded && "import-stage--succeeded",
	]
		.filter(Boolean)
		.join(" ");

	let statusText = "";
	if (isImporting) statusText = t.importSection.importing;
	else if (importSucceeded) statusText = t.importSection.importSucceeded;

	return (
		<section
			className="import-section"
			aria-labelledby="import-section-heading"
		>
			<h1 id="import-section-heading" className="visually-hidden">
				{t.importSection.hiddenHeading}
			</h1>

			<div className="import-section__alert-slot">
				{errorMessage && (
					<p
						className="import-section__alert"
						data-testid="import-error"
						role="alert"
					>
						{errorMessage}
					</p>
				)}
			</div>

			{/* biome-ignore lint/a11y/useSemanticElements: cannot be a <button>
			    element because it contains a nested, separately-clickable
			    <button> (the "Choose Export" secondary interaction per
			    docs/APPLICATION_LAYOUT.md "Import Button"); nesting a <button>
			    inside a native <button> is invalid HTML. */}
			<div
				className={stageClassName}
				data-testid="import-stage"
				role="button"
				tabIndex={0}
				aria-disabled={isBusy}
				aria-describedby="import-stage-status"
				onClick={onOpenFilePicker}
				onKeyDown={handleStageKeyDown}
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				<div className="import-stage__symbol">
					<span className="import-stage__glow" aria-hidden="true" />
					<StageIcon />
				</div>
				<p className="import-stage__instruction">
					{t.importSection.heroInstruction}
				</p>
				<button
					type="button"
					className="import-stage__button"
					data-testid="import-choose-button"
					disabled={isBusy}
					onClick={handleChooseButtonClick}
				>
					{t.importSection.chooseExportButton}
				</button>
				<p
					id="import-stage-status"
					className="import-stage__status"
					data-testid="import-status"
					aria-live="polite"
				>
					{statusText}
				</p>
			</div>

			<p className="import-section__caption">{t.importSection.helperCaption}</p>
		</section>
	);
}
