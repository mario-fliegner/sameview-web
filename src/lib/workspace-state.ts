// Pure workspace state model for SameView Web V1, per docs/USER_WORKFLOW.md
// "Workspace Model" and "Operational States", and docs/IMPORTED_COMPARISON_V1.md
// terminology (Source Data, Current Working State). No async, no browser API.
//
// State is held in memory only (component state); it does not persist
// across a page reload. Local workspace retention remains an explicitly
// open decision (docs/IMPLEMENTATION_PLAN_V1.md Section 9) that this module
// does not resolve.
//
// Presentation visibility (docs/FEATURE_SPECIFICATION.md F-003; per-item
// visibility is independent of each item's value) is a Current-Working-State
// concept with no Source Data equivalent — it does not exist in an imported
// comparison and is never derived from the preserved, inoperative
// `additional.visibility` metadata field (docs/IMPORTED_COMPARISON_V1.md
// "Preserved but Not Editable in Web V1"). It is kept here, as a sibling of
// `metadata`/`files` rather than folded into either, for exactly that
// reason: it has no Source Data counterpart to mirror. Editable comparison
// *values* (title, description, reference date, location text), by
// contrast, are not duplicated into a separate edit model — F-003 edits
// target the corresponding known fields directly inside a cloned
// `metadata.raw` (see src/lib/comparison-edit.ts), the same structure the
// existing derivation/display code already reads.

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

// docs/APPLICATION_LAYOUT.md "Comparison Information": Title, Time
// (Reference Date + Capture Date together) and Location are each shown by
// default; Description defaults to hidden. `time` and `location` each
// control one combined, indivisible rendered block — APPLICATION_LAYOUT.md
// is explicit that "Show Time controls visibility of the complete rendered
// time block" and a single Location switch "controls the complete rendered
// location"; there are no separate per-date or per-location-field switches.
// "Show Time Difference" (docs/COMPARISON_PRESENTATION.md Part 3) is
// intentionally not represented here — it is presentation-only, not part of
// the F-003 comparison information this model owns (see Part 2's "Time":
// "not part of the comparison information owned by F-003"), and is deferred
// to the later Presentation section iteration (docs/IMPLEMENTATION_PLAN_V1.md
// Phase 5 "Not included").
export interface PresentationVisibility {
	readonly title: boolean;
	readonly description: boolean;
	readonly time: boolean;
	readonly location: boolean;
}

export const DEFAULT_PRESENTATION_VISIBILITY: PresentationVisibility = {
	title: true,
	description: false,
	time: true,
	location: true,
};

// Adds only the one new concept Phase 5 introduces (see the module comment
// above for why visibility is a sibling field here rather than folded into
// `metadata`). Editable values have no separate representation: they live in
// `metadata.raw`, identical in shape to Source Data, and are changed in
// place on a cloned Current Working State by src/lib/comparison-edit.ts.
export interface CurrentWorkingState extends SourceData {
	readonly presentationVisibility: PresentationVisibility;
}

export interface Workspace {
	readonly sourceData: SourceData;
	readonly currentWorkingState: CurrentWorkingState;
}

// The one seam an edit (src/lib/comparison-edit.ts) or a future feature uses
// to commit a new Current Working State into an existing workspace, without
// ever touching `sourceData`.
export function withCurrentWorkingState(
	workspace: Workspace,
	currentWorkingState: CurrentWorkingState,
): Workspace {
	return { sourceData: workspace.sourceData, currentWorkingState };
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
		// A fresh import (or a replacement) always starts from the documented
		// defaults — there is no Source Data value to carry forward (see the
		// module comment above).
		presentationVisibility: DEFAULT_PRESENTATION_VISIBILITY,
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
