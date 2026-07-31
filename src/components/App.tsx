// The single hydrated React root for the interactive application
// (docs/APPLICATION_LAYOUT.md Global Layout). Astro's AppLayout.astro is
// responsible only for the document shell (<html>/<head>/skip link) and
// mounts this component once via `client:load`; everything a user actually
// interacts with — header, workspace, footer — lives in this one tree so
// that locale and workspace state can be shared with ordinary React state/
// props instead of a cross-island store.
//
// Workspace and import state live here, not in ImportSection, because the
// header's "Replace Export" action (docs/APPLICATION_LAYOUT.md Header
// Actions) and the main import/replace flow both need to trigger the same
// hidden file input and the same validation pipeline — the smallest common
// owner for that shared state is this shell, not a new store or context
// (docs/IMPLEMENTATION_PLAN_V1.md Iteration 7 constraints).

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { LocaleProvider, useLocale } from "../i18n/LocaleContext";
import { createSourceDataFromZip } from "../lib/import-source-data";
import {
	type CurrentWorkingState,
	createWorkspace,
	initialWorkspaceState,
	type SourceData,
	type WorkspaceState,
	withCurrentWorkingState,
} from "../lib/workspace-state";
import AppFooter from "./AppFooter";
import AppHeader from "./AppHeader";
import ImportSection from "./ImportSection";
import ReplacementModeOverlay from "./ReplacementModeOverlay";

// How long the transient green "Import Succeeded" confirmation stays visible
// before the workspace is committed (docs/APPLICATION_LAYOUT.md "Import
// Succeeded": "a short visual confirmation" — the spec deliberately does not
// define an exact duration; this is a plain implementation-time choice, not
// a documented requirement).
const IMPORT_SUCCESS_DISPLAY_MS = 900;

function AppShell() {
	const { t } = useLocale();
	const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(
		initialWorkspaceState,
	);
	const [isImporting, setIsImporting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	// A validated candidate awaiting the user's explicit replace/cancel
	// decision (docs/FEATURE_SPECIFICATION.md F-001 step 2). Deliberately not
	// part of WorkspaceState: it is a transient step within the Import
	// Comparison action, not a new Operational State
	// (docs/USER_WORKFLOW.md only defines No Workspace / Workspace Active).
	const [pendingReplacement, setPendingReplacement] =
		useState<SourceData | null>(null);
	// A validated *first* import, held here only during the transient green
	// "Import Succeeded" confirmation (docs/APPLICATION_LAYOUT.md), before the
	// workspace is actually committed. Deliberately separate from
	// pendingReplacement: this state can only ever be reached from
	// `no-workspace`, so it never applies to Replace Export.
	const [justSucceeded, setJustSucceeded] = useState<SourceData | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	// So Cancel/Escape can return focus to the exact control that opened
	// Replacement Mode (docs/AI_ENGINEERING_GUIDE.md Accessibility).
	const replaceExportButtonRef = useRef<HTMLButtonElement>(null);
	// Distinguishes "pendingReplacement became null via Cancel" from "...via
	// Confirm" for the focus-restoration effect below, since both change the
	// same piece of state but must move focus to different places.
	const wasCancelledRef = useRef(false);

	// The <title> is corrected here (rather than left at Astro's
	// server-rendered default) so it also updates when the language changes
	// without a reload, per docs/APPLICATION_LAYOUT.md Internationalization
	// ("page title"). Must run in an effect, not during render: this
	// component is also rendered to a string on the server (client:load),
	// where `document` does not exist.
	useEffect(() => {
		document.title = t.meta.title;
	}, [t]);

	// Commits the workspace only after the transient success confirmation has
	// had a moment to be seen, per docs/APPLICATION_LAYOUT.md "Import
	// Succeeded" ("no additional user interaction is required to continue").
	useEffect(() => {
		if (!justSucceeded) return;
		const timer = setTimeout(() => {
			setWorkspaceState(createWorkspace(justSucceeded));
			setJustSucceeded(null);
		}, IMPORT_SUCCESS_DISPLAY_MS);
		return () => clearTimeout(timer);
	}, [justSucceeded]);

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

		if (workspaceState.status === "active") {
			// A workspace already exists: never replace it immediately. The
			// candidate is fully validated at this point, but committing it
			// still requires the user's explicit confirmation.
			setPendingReplacement(result.value);
			return;
		}

		// First import: show the transient green success confirmation before
		// the workspace becomes the primary focus. This branch is only ever
		// reached from `no-workspace`, so Replace Export never triggers it.
		setJustSucceeded(result.value);
	}

	function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		// Reset so selecting the same file again still fires a change event.
		event.target.value = "";
		if (!file) return;
		void processFile(file);
	}

	function openFilePicker() {
		if (isImporting || justSucceeded) return;
		inputRef.current?.click();
	}

	function confirmReplacement() {
		if (!pendingReplacement) return;
		setWorkspaceState(createWorkspace(pendingReplacement));
		setPendingReplacement(null);
	}

	function cancelReplacement() {
		setPendingReplacement(null);
		wasCancelledRef.current = true;
	}

	// The sole place that commits an F-003 edit (docs/FEATURE_SPECIFICATION.md
	// F-003) into the active workspace: replaces only `currentWorkingState`,
	// leaving `sourceData` untouched, exactly as withCurrentWorkingState
	// documents. A no-op if the workspace was replaced/closed between the
	// edit being made and this handler running (state is stale).
	function handleCurrentWorkingStateChange(next: CurrentWorkingState) {
		setWorkspaceState((previous) =>
			previous.status !== "active"
				? previous
				: {
						status: "active",
						workspace: withCurrentWorkingState(previous.workspace, next),
					},
		);
	}

	// Returns focus to the control that opened Replacement Mode once Cancel
	// has actually taken effect — not synchronously inside cancelReplacement
	// itself, since the "Replace Export" button is still disabled
	// (replaceExportDisabled below) until this render commits, and a
	// disabled button cannot receive focus (docs/AI_ENGINEERING_GUIDE.md
	// Accessibility: predictable focus).
	useEffect(() => {
		if (wasCancelledRef.current && pendingReplacement === null) {
			wasCancelledRef.current = false;
			replaceExportButtonRef.current?.focus();
		}
	}, [pendingReplacement]);

	// Replacement Mode (docs/APPLICATION_LAYOUT.md "Replace Export";
	// docs/FEATURE_SPECIFICATION.md F-001 step 2) is open for as long as a
	// replace attempt is in flight against an active workspace — from the
	// moment validation starts (`isImporting`) through the explicit decision
	// (`pendingReplacement`). It never opens for the first import, since that
	// can only happen from `no-workspace`, where isImporting drives the
	// ordinary import-stage status instead. See
	// src/components/ReplacementModeOverlay.tsx for why this is a sibling
	// overlay rather than content nested inside ImportSection.
	const isReplacing = workspaceState.status === "active" && isImporting;
	const replacementModeOpen = isReplacing || pendingReplacement !== null;

	return (
		<>
			{/* Made non-interactive while Replacement Mode is open, so the
			    existing workspace remains visible (docs/APPLICATION_LAYOUT.md
			    "Loading Philosophy") but cannot be operated on underneath the
			    overlay (docs/AI_ENGINEERING_GUIDE.md Accessibility). */}
			<div
				className="app-shell-content"
				inert={replacementModeOpen ? true : undefined}
			>
				<AppHeader
					showReplaceExport={workspaceState.status === "active"}
					replaceExportDisabled={isImporting || pendingReplacement !== null}
					onReplaceExportClick={openFilePicker}
					replaceExportButtonRef={replaceExportButtonRef}
				/>
				<main id="main-content" tabIndex={-1}>
					<ImportSection
						workspaceState={workspaceState}
						isImporting={isImporting}
						importSucceeded={justSucceeded !== null}
						errorMessage={errorMessage}
						onOpenFilePicker={openFilePicker}
						onFileDropped={(file) => void processFile(file)}
						onCurrentWorkingStateChange={handleCurrentWorkingStateChange}
					/>
				</main>
				<AppFooter showLanguageSelector={workspaceState.status === "active"} />
			</div>
			<input
				ref={inputRef}
				id="import-zip-input"
				className="visually-hidden"
				type="file"
				accept=".zip"
				tabIndex={-1}
				disabled={isImporting || justSucceeded !== null}
				onChange={handleFileChange}
			/>
			{replacementModeOpen && workspaceState.status === "active" && (
				<ReplacementModeOverlay
					phase={pendingReplacement ? "confirming" : "validating"}
					currentSessionDirectory={
						workspaceState.workspace.currentWorkingState.sessionDirectory
					}
					candidateSessionDirectory={
						pendingReplacement?.sessionDirectory ?? null
					}
					onConfirm={confirmReplacement}
					onCancel={cancelReplacement}
				/>
			)}
		</>
	);
}

export default function App() {
	return (
		<LocaleProvider>
			<AppShell />
		</LocaleProvider>
	);
}
