// Builds the Outcome Snapshot (docs/IMPORTED_COMPARISON_V1.md "Outcome
// Snapshot"; docs/FEATURE_SPECIFICATION.md F-005) — the immutable values a
// generated output needs, captured once from the Current Working State at
// generation time. Standalone HTML and Static Microsite
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 7-9) both consume only this type,
// never CurrentWorkingState or SourceData directly, so neither output ever
// needs its own, independently derived presentation/interaction data
// (docs/COMPARISON_PRESENTATION.md Part 1 "Interaction Parity").
//
// Reuses existing, already-pure derivation functions unchanged rather than
// re-deriving their values: deriveComparisonPresentation
// (src/lib/comparison-presentation.ts) for the locale-baked labels/text, and
// resolveHandleBranding (src/lib/branding.ts) for the resolved Session
// Branding state — both are already designed for exactly this reuse (see
// their own header comments).
//
// Presentation Visibility and Presentation Configuration are copied
// verbatim, not resolved: docs/COMPARISON_PRESENTATION.md Part 4 requires
// semantic values (e.g. Text "Automatic") to remain unresolved until render
// time — a decision this module does not make, unlike Session Branding's
// color, which src/lib/branding.ts already resolves before this module ever
// sees it (see that module's own header comment for why the two features
// differ here).
//
// initialSliderPosition (docs/COMPARISON_PRESENTATION.md Part 2 "Initial
// Slider Position"): fixed to DEFAULT_INITIAL_SLIDER_POSITION for the
// current V1 implementation, independent of any live Workspace Preview
// slider state — this module never reads Comparison Slider component state,
// which does not exist at this layer.
//
// No React, no DOM, no async: pure and synchronous, mirroring every other
// derivation module this one composes.

import type { Locale } from "../i18n/translations";
import { type HandleBranding, resolveHandleBranding } from "./branding.ts";
import {
	type ComparisonPresentation,
	type DeriveComparisonPresentationOptions,
	deriveComparisonPresentation,
} from "./comparison-presentation.ts";
import type {
	CurrentWorkingState,
	PresentationConfiguration,
	PresentationVisibility,
} from "./workspace-state.ts";

// docs/COMPARISON_PRESENTATION.md Part 2 "Initial Slider Position": "always
// set to the exact midpoint (50/50)" for the current V1 implementation. A
// fraction in [0, 1], not a percentage — the scale a future renderer
// converts into whatever unit it needs, independent of
// src/components/ComparisonSlider.tsx's own internal 0-100 percent state.
export const DEFAULT_INITIAL_SLIDER_POSITION = 0.5;

export interface OutcomeSnapshot {
	readonly presentation: ComparisonPresentation;
	readonly visibility: PresentationVisibility;
	readonly configuration: PresentationConfiguration;
	readonly branding: HandleBranding;
	// Present only when `branding.kind === "asset"` — the already-normalized
	// raster asset (docs/IMPLEMENTATION_PLAN_V1.md Phase 6), copied unchanged,
	// never re-decoded, re-scaled or re-encoded.
	readonly brandingAssetBytes: Uint8Array | undefined;
	readonly referenceImageBytes: Uint8Array;
	readonly captureImageBytes: Uint8Array;
	// docs/COMPARISON_PRESENTATION.md Part 2 "Initial Slider Position".
	readonly initialSliderPosition: number;
}

// Defensive copies: an Outcome Snapshot must remain a true point-in-time
// capture, unaffected by later edits to the Current Working State it was
// built from or by a subsequent Replace Export — neither mutates an
// existing Uint8Array in place today, but this module does not rely on that
// remaining true, mirroring src/lib/workspace-state.ts's own
// `cloneOptionalBytes` (the identical reasoning applies here).
function cloneBytes(bytes: Uint8Array): Uint8Array {
	return bytes.slice();
}

function cloneOptionalBytes(
	bytes: Uint8Array | undefined,
): Uint8Array | undefined {
	return bytes === undefined ? undefined : bytes.slice();
}

export function createOutcomeSnapshot(
	cws: CurrentWorkingState,
	locale: Locale,
	options: DeriveComparisonPresentationOptions,
): OutcomeSnapshot {
	const branding = resolveHandleBranding(cws);
	return {
		presentation: deriveComparisonPresentation(cws.metadata, locale, options),
		visibility: { ...cws.presentationVisibility },
		configuration: { ...cws.presentationConfiguration },
		branding,
		brandingAssetBytes:
			branding.kind === "asset"
				? cloneOptionalBytes(cws.files.brandingHandleBytes)
				: undefined,
		referenceImageBytes: cloneBytes(cws.files.referenceBytes),
		captureImageBytes: cloneBytes(cws.files.captureBytes),
		initialSliderPosition: DEFAULT_INITIAL_SLIDER_POSITION,
	};
}
