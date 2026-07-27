// Implements docs/APPLICATION_LAYOUT.md's "Import Section" and "Import
// States" for State A (`No Workspace`), and the minimal State B
// (`Workspace Active`) placeholder pending later phases (viewer, editing,
// branding, output — see docs/IMPLEMENTATION_PLAN_V1.md Phases 4+).
//
// This component owns only the presentational states (idle, drag-active,
// importing, import-failed) and the existing workspace-creation logic; it
// does not change docs/FEATURE_SPECIFICATION.md F-001 behavior. Workspace
// replacement is a separate, later iteration — once a workspace is active,
// this component no longer offers an import entry point.

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

	function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openFilePicker();
		}
	}

	function handleSelectButtonClick(event: MouseEvent<HTMLButtonElement>) {
		// Prevents the dropzone's own onClick from also firing for the same
		// interaction (the button is nested inside the dropzone).
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
		// Ignore leave events caused by moving between children of the
		// dropzone (e.g. onto the nested button) to avoid flicker.
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
			>
				<h1 id="workspace-active-title" className="workspace-active__title">
					{t.workspace.title}
				</h1>
				<p className="workspace-active__session">
					{t.workspace.sessionLabel}{" "}
					{workspaceState.workspace.currentWorkingState.sessionDirectory}
				</p>
			</section>
		);
	}

	const dropzoneClassName = [
		"dropzone",
		isDragActive && "dropzone--drag-active",
		isImporting && "dropzone--importing",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<section className="import-section" aria-labelledby="import-section-title">
			<h1 id="import-section-title" className="import-section__title">
				{t.importSection.title}
			</h1>
			<p className="import-section__description">
				{t.importSection.description}
			</p>

			<div className="import-section__alert-slot">
				{errorMessage && (
					<p className="import-section__alert" role="alert">
						{errorMessage}
					</p>
				)}
			</div>

			{/* biome-ignore lint/a11y/useSemanticElements: cannot be a <button>
			    element because it contains a nested, separately-clickable
			    <button> (the "select" secondary interaction per
			    docs/APPLICATION_LAYOUT.md "Import Button"); nesting a <button>
			    inside a native <button> is invalid HTML. */}
			<div
				className={dropzoneClassName}
				role="button"
				tabIndex={0}
				aria-disabled={isImporting}
				aria-describedby="import-section-status"
				onClick={openFilePicker}
				onKeyDown={handleDropzoneKeyDown}
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				<p className="dropzone__hint">{t.importSection.dropzoneLabel}</p>
				<p className="dropzone__or">{t.importSection.dropzoneOr}</p>
				<button
					type="button"
					className="dropzone__button"
					disabled={isImporting}
					onClick={handleSelectButtonClick}
				>
					{t.importSection.selectButton}
				</button>
				<p
					id="import-section-status"
					className="dropzone__status"
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

			<p className="import-section__privacy">
				{t.importSection.privacyNoticeLine1}
				<br />
				{t.importSection.privacyNoticeLine2}
			</p>
			<p className="import-section__format">
				{t.importSection.supportedFormat}
			</p>
		</section>
	);
}
