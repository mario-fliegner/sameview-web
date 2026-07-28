// Implements docs/APPLICATION_LAYOUT.md's "Import Section" and "Import
// States" for State A (`No Workspace`), and the minimal State B
// (`Workspace Active`) placeholder pending later phases (viewer, editing,
// branding, output — see docs/IMPLEMENTATION_PLAN_V1.md Phases 4+).
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
// This component owns only the presentational states (idle, drag-active,
// importing, import-failed) and the existing workspace-creation logic; it
// does not change docs/FEATURE_SPECIFICATION.md F-001 behavior. Workspace
// replacement is a separate, later iteration — once a workspace is active,
// this component no longer offers an import entry point.
//
// `data-testid` attributes below exist so E2E functional/interaction tests
// never depend on visible copy or CSS class names, which change frequently
// as this screen's wording and presentation are iterated on. Copy itself is
// still covered, but only in tests whose explicit purpose is verifying copy
// or translation (see test/e2e/app-shell.spec.ts).

import {
	type ChangeEvent,
	type DragEvent,
	type KeyboardEvent,
	type MouseEvent,
	useRef,
	useState,
} from "react";
import { useLocale } from "../i18n/LocaleContext";
import { createSourceDataFromZip } from "../lib/import-source-data";
import {
	createWorkspace,
	initialWorkspaceState,
	type WorkspaceState,
} from "../lib/workspace-state";

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

export default function ImportSection() {
	const { t } = useLocale();
	const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(
		initialWorkspaceState,
	);
	const [isImporting, setIsImporting] = useState(false);
	const [isDragActive, setIsDragActive] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	async function processFile(file: File) {
		setIsImporting(true);
		setErrorMessage(null);

		const zipBytes = new Uint8Array(await file.arrayBuffer());
		const result = await createSourceDataFromZip(zipBytes);

		setIsImporting(false);

		if (!result.ok) {
			setErrorMessage(t.importSection.importFailed);
			return;
		}

		setWorkspaceState(createWorkspace(result.value));
	}

	function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		// Reset so selecting the same file again still fires a change event.
		event.target.value = "";
		if (!file) return;
		void processFile(file);
	}

	function openFilePicker() {
		if (isImporting) return;
		inputRef.current?.click();
	}

	function handleStageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openFilePicker();
		}
	}

	function handleChooseButtonClick(event: MouseEvent<HTMLButtonElement>) {
		// Prevents the stage's own onClick from also firing for the same
		// interaction (the button is nested inside the stage).
		event.stopPropagation();
		openFilePicker();
	}

	function handleDragEnter(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		if (!isImporting) setIsDragActive(true);
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
		if (isImporting) return;
		const file = event.dataTransfer.files?.[0];
		if (file) void processFile(file);
	}

	if (workspaceState.status === "active") {
		return (
			<section
				className="workspace-active"
				aria-labelledby="workspace-active-title"
				data-testid="workspace-active"
			>
				<h1 id="workspace-active-title" className="workspace-active__title">
					{t.workspace.title}
				</h1>
				<p
					className="workspace-active__session"
					data-testid="workspace-session"
				>
					{t.workspace.sessionLabel}{" "}
					{workspaceState.workspace.currentWorkingState.sessionDirectory}
				</p>
			</section>
		);
	}

	const stageClassName = [
		"import-stage",
		isDragActive && "import-stage--drag-active",
		isImporting && "import-stage--importing",
	]
		.filter(Boolean)
		.join(" ");

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
				aria-disabled={isImporting}
				aria-describedby="import-stage-status"
				onClick={openFilePicker}
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
					disabled={isImporting}
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
					{isImporting ? t.importSection.importing : ""}
				</p>
				<input
					ref={inputRef}
					id="import-zip-input"
					className="visually-hidden"
					type="file"
					accept=".zip"
					tabIndex={-1}
					disabled={isImporting}
					onChange={handleFileChange}
				/>
			</div>

			<p className="import-section__caption">{t.importSection.helperCaption}</p>
		</section>
	);
}
