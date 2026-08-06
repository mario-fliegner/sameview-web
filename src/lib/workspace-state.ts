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

import {
	type BuiltinSymbolId,
	isBuiltinSymbolId,
} from "./builtin-branding-symbols.ts";
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
// `timeDifference` ("Show Time Difference", docs/APPLICATION_LAYOUT.md
// "Photo dates"; docs/COMPARISON_PRESENTATION.md Part 3 "Comparison
// Information") is presentation-only, not part of the F-003 comparison
// information this model owns (see Part 2's "Time": "The Duration addition
// is presentation-only ... not part of the comparison information owned by
// F-003") — it is kept here as a sibling nonetheless, exactly like `time`
// and `location` above, because it is likewise a Current-Working-State
// visibility flag with no Source Data counterpart. Disabled by default
// (docs/COMPARISON_PRESENTATION.md Part 2 "Time": "disabled by default")
// and only ever meaningful while `time` is also on (docs/APPLICATION_LAYOUT.md
// "Photo dates": "Show Time Difference is only available when Show photo
// dates is enabled") — that dependency is a UI/rendering concern (the
// switch's own `disabled` state, the rendered Duration's own visibility
// gate), not a second, coupled value here.
export interface PresentationVisibility {
	readonly title: boolean;
	readonly description: boolean;
	readonly time: boolean;
	readonly timeDifference: boolean;
	readonly location: boolean;
}

export const DEFAULT_PRESENTATION_VISIBILITY: PresentationVisibility = {
	title: true,
	description: false,
	time: true,
	timeDifference: false,
	location: true,
};

// docs/COMPARISON_PRESENTATION.md Part 3 "Canvas"/"Comparison Stage": the
// four Presentation Configuration options this iteration implements.
// Background and Frame are each a closed set of named options, with
// "custom" carrying the one additional value (a normalized `#RRGGBB` hex
// string — see src/lib/comparison-edit.ts `normalizeHexColor`) the other
// options don't need; modeled as a discriminated union rather than an
// always-present optional `color` field so a non-custom selection can never
// carry a stale or meaningless color value.
export type CanvasBackground =
	| { readonly kind: "transparent" | "white" | "black" | "brand" }
	| { readonly kind: "custom"; readonly color: string };

export type PresentationFrame =
	| { readonly kind: "none" | "white" | "black" }
	| { readonly kind: "custom"; readonly color: string };

export type CornerRadius = "sharp" | "rounded";

// Same shape as `PresentationFrame` above, for the same reason: "Automatic"/
// "Light"/"Dark" carry no color of their own, "Custom" is the only kind that
// needs one (docs/COMPARISON_PRESENTATION.md Part 3 "Text").
export type PresentationTextColor =
	| { readonly kind: "automatic" | "light" | "dark" }
	| { readonly kind: "custom"; readonly color: string };

// Like `PresentationVisibility` above, this has no Source Data counterpart
// (docs/COMPARISON_PRESENTATION.md "Where Presentation Configuration
// Belongs": "part of the Current Working State, using the same model as
// Session Branding") — a fresh import always starts from the documented
// defaults below, never from a preserved prior value.
export interface PresentationConfiguration {
	readonly canvasBackground: CanvasBackground;
	readonly frame: PresentationFrame;
	readonly cornerRadius: CornerRadius;
	readonly textColor: PresentationTextColor;
	readonly showSliderDateLabels: boolean;
}

// docs/COMPARISON_PRESENTATION.md Part 3: Background default "Brand", Frame
// default "None", Corner Radius default "Rounded", Text default "Automatic",
// Show Slider Date Labels default "On".
export const DEFAULT_PRESENTATION_CONFIGURATION: PresentationConfiguration = {
	canvasBackground: { kind: "brand" },
	frame: { kind: "none" },
	cornerRadius: "rounded",
	textColor: { kind: "automatic" },
	showSliderDateLabels: true,
};

// docs/FEATURE_SPECIFICATION.md F-004: "the most recently selected built-in
// symbol and the most recently valid custom branding image are each
// retained independently of which branding option is currently active."
// Purely a UI/workspace memory for values that are *not* currently
// effective — the currently effective branding remains exclusively
// `metadata.raw.branding` + `files.brandingHandleBytes` (src/lib/branding.ts
// `resolveHandleBranding`, which never reads this type). Modeled the same
// way as PresentationVisibility/PresentationConfiguration above and for the
// identical reason: no Source Data counterpart exists for "a value the user
// chose earlier but is not currently using" — Android's own session
// branding is a single-slot model with no such memory of its own.
export interface BrandingDraft {
	readonly lastBuiltinId: BuiltinSymbolId | undefined;
	readonly lastCustomImageBytes: Uint8Array | undefined;
}

export const DEFAULT_BRANDING_DRAFT: BrandingDraft = {
	lastBuiltinId: undefined,
	lastCustomImageBytes: undefined,
};

// Adds only the new concepts Phase 5, the Presentation Configuration
// iteration and Session Branding retention introduce (see the module
// comment above for why visibility is a sibling field here rather than
// folded into `metadata`; Presentation Configuration and BrandingDraft
// follow the identical reasoning). Editable values have no separate
// representation: they live in `metadata.raw`, identical in shape to
// Source Data, and are changed in place on a cloned Current Working State
// by src/lib/comparison-edit.ts.
export interface CurrentWorkingState extends SourceData {
	readonly presentationVisibility: PresentationVisibility;
	readonly presentationConfiguration: PresentationConfiguration;
	readonly brandingDraft: BrandingDraft;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Deliberately duplicates src/lib/branding.ts's own tolerant
// `getBrandingType`/`getBrandingBuiltinId` reading, rather than importing
// them: this module is imported BY branding.ts (for the `CurrentWorkingState`
// type), so importing the other direction here would be circular. The same
// small-helper duplication already used between src/lib/comparison-edit.ts,
// src/lib/comparison-presentation.ts and src/lib/import-metadata.ts.
function seedBrandingDraft(
	raw: Record<string, unknown>,
	brandingHandleBytes: Uint8Array | undefined,
): BrandingDraft {
	const block = raw.branding;
	if (!isPlainObject(block)) return DEFAULT_BRANDING_DRAFT;
	if (block.type === "builtin") {
		const id = block.builtinId;
		return {
			lastBuiltinId:
				typeof id === "string" && isBuiltinSymbolId(id) ? id : undefined,
			lastCustomImageBytes: undefined,
		};
	}
	if (block.type === "image") {
		return {
			lastBuiltinId: undefined,
			lastCustomImageBytes: cloneOptionalBytes(brandingHandleBytes),
		};
	}
	return DEFAULT_BRANDING_DRAFT;
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
		// module comment above). BrandingDraft is the one exception: it starts
		// seeded from the imported branding, not from a fixed default (docs/FEATURE_SPECIFICATION.md
		// F-004: "Importing a comparison with built-in symbol branding
		// initializes the most recently selected built-in symbol accordingly").
		presentationVisibility: DEFAULT_PRESENTATION_VISIBILITY,
		presentationConfiguration: DEFAULT_PRESENTATION_CONFIGURATION,
		brandingDraft: seedBrandingDraft(
			sourceData.metadata.raw,
			sourceData.files.brandingHandleBytes,
		),
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
