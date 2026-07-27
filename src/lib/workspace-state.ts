// Pure workspace state model for SameView Web V1, per docs/USER_WORKFLOW.md
// "Workspace Model" and "Operational States", and docs/IMPORTED_COMPARISON_V1.md
// terminology (Source Data, Current Working State). No async, no browser API.
//
// This iteration only implements workspace creation from `no-workspace`.
// Replacing an already-active workspace (confirmation, atomic replace,
// cancel/failure preservation) is a separate, later iteration — this module
// deliberately does not encode replacement-specific rules yet.
//
// State is held in memory only (component state); it does not persist
// across a page reload. Local workspace retention remains an explicitly
// open decision (docs/IMPLEMENTATION_PLAN_V1.md Section 9) that this module
// does not resolve.

import type { ResolvedImportedMetadata } from "./import-metadata.ts";

export interface AcceptedComparisonFiles {
	readonly referenceBytes: Uint8Array;
	readonly captureBytes: Uint8Array;
	readonly referenceOriginalBytes: Uint8Array | undefined;
	readonly captureOriginalBytes: Uint8Array | undefined;
	readonly referenceSourceOriginalBytes: Uint8Array | undefined;
	readonly brandingHandleBytes: Uint8Array | undefined;
}

// The complete accepted Imported Comparison. Immutable by convention: no
// code path in this module (or elsewhere) writes to a SourceData value after
// it is constructed.
export interface SourceData {
	readonly sessionDirectory: string;
	readonly metadata: ResolvedImportedMetadata;
	readonly files: AcceptedComparisonFiles;
}

// Structurally identical to SourceData for V1: no editable fields exist yet
// (Phase 5 introduces them). Kept as a distinct type alias — and always
// constructed as a genuinely independent object, see cloneAsCurrentWorkingState
// below — so future edits can never alias or mutate Source Data.
export type CurrentWorkingState = SourceData;

export interface Workspace {
	readonly sourceData: SourceData;
	readonly currentWorkingState: CurrentWorkingState;
}

export type WorkspaceState =
	| { readonly status: "no-workspace" }
	| { readonly status: "active"; readonly workspace: Workspace };

export function initialWorkspaceState(): WorkspaceState {
	return { status: "no-workspace" };
}

function cloneOptionalBytes(
	bytes: Uint8Array | undefined,
): Uint8Array | undefined {
	return bytes === undefined ? undefined : bytes.slice();
}

function cloneAsCurrentWorkingState(
	sourceData: SourceData,
): CurrentWorkingState {
	return {
		sessionDirectory: sourceData.sessionDirectory,
		metadata: {
			...sourceData.metadata,
			raw: structuredClone(sourceData.metadata.raw),
		},
		files: {
			referenceBytes: sourceData.files.referenceBytes.slice(),
			captureBytes: sourceData.files.captureBytes.slice(),
			referenceOriginalBytes: cloneOptionalBytes(
				sourceData.files.referenceOriginalBytes,
			),
			captureOriginalBytes: cloneOptionalBytes(
				sourceData.files.captureOriginalBytes,
			),
			referenceSourceOriginalBytes: cloneOptionalBytes(
				sourceData.files.referenceSourceOriginalBytes,
			),
			brandingHandleBytes: cloneOptionalBytes(
				sourceData.files.brandingHandleBytes,
			),
		},
	};
}

// Creates the one active workspace from freshly accepted Source Data.
// Atomicity is the caller's responsibility: this function must only be
// invoked once a complete, valid SourceData already exists (see
// src/lib/import-source-data.ts) — it never produces a partial workspace.
export function createWorkspace(sourceData: SourceData): WorkspaceState {
	return {
		status: "active",
		workspace: {
			sourceData,
			currentWorkingState: cloneAsCurrentWorkingState(sourceData),
		},
	};
}
