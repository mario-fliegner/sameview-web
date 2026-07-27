// Client-hydrated island implementing F-001 Import Comparison for the
// `No Workspace` -> `Workspace Active` transition only (docs/USER_WORKFLOW.md
// Operational States). Replacing an already-active workspace is a separate,
// later iteration — once a workspace is active, this component no longer
// offers an import entry point, so it cannot itself trigger the not-yet-
// implemented replacement path.
//
// No image is rendered and no Object URL is created here: only raw bytes are
// held in state. Object URL creation belongs to the future viewer (Phase 4),
// which will need to display the bytes already captured in Source Data.

import { type ChangeEvent, useState } from "react";
import { createSourceDataFromZip } from "../lib/import-source-data";
import {
	createWorkspace,
	initialWorkspaceState,
	type WorkspaceState,
} from "../lib/workspace-state";

const IMPORT_FAILURE_MESSAGE =
	"This file could not be imported as a SameView comparison. Please choose a valid SameView export ZIP.";

export default function ImportWorkspace() {
	const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(
		initialWorkspaceState,
	);
	const [isProcessing, setIsProcessing] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		// Reset so selecting the same file again still fires a change event.
		event.target.value = "";
		if (!file) return;

		setIsProcessing(true);
		setErrorMessage(null);

		const zipBytes = new Uint8Array(await file.arrayBuffer());
		const result = await createSourceDataFromZip(zipBytes);

		setIsProcessing(false);

		if (!result.ok) {
			setErrorMessage(IMPORT_FAILURE_MESSAGE);
			return;
		}

		setWorkspaceState(createWorkspace(result.value));
	}

	if (workspaceState.status === "active") {
		return (
			<div className="workspace__content">
				<p className="workspace__eyebrow">Workspace</p>
				<h1 id="workspace-title">Comparison imported</h1>
				<p className="workspace__description">
					Session{" "}
					{workspaceState.workspace.currentWorkingState.sessionDirectory}
				</p>
			</div>
		);
	}

	return (
		<div className="workspace__content">
			<p className="workspace__eyebrow">Workspace</p>
			<h1 id="workspace-title">No comparison open</h1>
			<p className="workspace__description">
				Import a SameView export to make an existing comparison available in
				SameView Web.
			</p>
			<label className="workspace__import-label" htmlFor="import-zip-input">
				Import SameView export
			</label>
			<input
				id="import-zip-input"
				type="file"
				accept=".zip"
				disabled={isProcessing}
				aria-describedby="import-status"
				onChange={handleFileChange}
			/>
			<p
				id="import-status"
				className="workspace__description"
				aria-live="polite"
			>
				{isProcessing ? "Importing…" : errorMessage}
			</p>
		</div>
	);
}
