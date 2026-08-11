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
// Slider Position", "Use Current Slider Position"): defaults to
// DEFAULT_INITIAL_SLIDER_POSITION, but the caller may pass an already-read
// live Workspace Preview slider position instead (as a [0, 1] fraction) —
// this module itself still never reads Comparison Slider component state
// directly; it only accepts the value already resolved by the caller
// (src/components/OutputInspector.tsx), exactly like every other
// caller-resolved value this module accepts (locale, options).
//
// session (docs/IMPORTED_COMPARISON_V1.md "Comparison Identity (`session.id`)",
// docs/IMPLEMENTATION_PLAN_V1.md Phase 11): sourced exclusively from
// `cws.sessionDirectory`, the archive-directory identity already resolved and
// established as authoritative at import time (src/lib/import-resolve.ts,
// src/lib/import-source-data.ts) — never from `cws.metadata.sessionId`, the
// informational, non-authoritative `session.id`/`sessionId` field that may be
// present in imported metadata (docs/IMPORTED_COMPARISON_V1.md "Session
// Identity"). The two must never be conflated.
//
// outcomeFingerprint (docs/IMPORTED_COMPARISON_V1.md "Outcome Fingerprint"):
// computed by src/lib/outcome-fingerprint.ts from the authoritative,
// locale/timezone-independent raw inputs this function already has in hand —
// see that module's own header comment for the exact input set and why. Must
// describe the *final* allowlisted outcome content, including the final
// comparison image bytes after Phase 8's `Remove Embedded Location Data`
// processing (docs/FEATURE_SPECIFICATION.md F-005) — so this function accepts
// those final bytes as an optional `finalImages` override instead of always
// deriving them from `cws.files` itself. This keeps this function the single,
// sole construction point for a complete OutcomeSnapshot: it is never called
// twice, and there is never an intermediate snapshot whose outcomeFingerprint
// could go stale relative to its own image bytes. When `finalImages` is
// omitted, `cws.files.referenceBytes`/`captureBytes` are used unchanged,
// exactly as before this field existed — every direct caller/test that does
// not go through Phase 8 image processing needs no new argument.
//
// No React, no DOM: still synchronous in spirit, but `outcomeFingerprint`
// requires the async Web Crypto digest (src/lib/outcome-fingerprint.ts), so
// this function itself is `async` — the one deliberate exception to this
// module's original "no async" design, scoped narrowly to that one need.

import type { Locale } from "../i18n/translations";
import { type HandleBranding, resolveHandleBranding } from "./branding.ts";
import { getReferenceDateValue } from "./comparison-edit.ts";
import {
	type ComparisonPresentation,
	type DeriveComparisonPresentationOptions,
	deriveComparisonPresentation,
} from "./comparison-presentation.ts";
import { computeOutcomeFingerprint } from "./outcome-fingerprint.ts";
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
	// docs/IMPORTED_COMPARISON_V1.md "Comparison Identity (`session.id`)" —
	// see this file's own header comment for the authoritative source.
	readonly session: { readonly id: string };
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
	// docs/IMPORTED_COMPARISON_V1.md "Outcome Fingerprint" — see this file's
	// own header comment for what participates and why.
	readonly outcomeFingerprint: string;
}

// See this file's own header comment ("outcomeFingerprint").
export interface FinalComparisonImages {
	readonly referenceImageBytes: Uint8Array;
	readonly captureImageBytes: Uint8Array;
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

export async function createOutcomeSnapshot(
	cws: CurrentWorkingState,
	locale: Locale,
	options: DeriveComparisonPresentationOptions,
	initialSliderPosition: number = DEFAULT_INITIAL_SLIDER_POSITION,
	finalImages?: FinalComparisonImages,
): Promise<OutcomeSnapshot> {
	const branding = resolveHandleBranding(cws);
	const presentation = deriveComparisonPresentation(
		cws.metadata,
		locale,
		options,
	);
	const brandingAssetBytes =
		branding.kind === "asset"
			? cloneOptionalBytes(cws.files.brandingHandleBytes)
			: undefined;
	const referenceImageBytes = cloneBytes(
		finalImages?.referenceImageBytes ?? cws.files.referenceBytes,
	);
	const captureImageBytes = cloneBytes(
		finalImages?.captureImageBytes ?? cws.files.captureBytes,
	);

	const outcomeFingerprint = await computeOutcomeFingerprint({
		title: presentation.title,
		description: presentation.description,
		location: presentation.location,
		referenceDateRaw: getReferenceDateValue(cws) || undefined,
		captureTimestampMs: cws.metadata.captureTimestampMs,
		visibility: cws.presentationVisibility,
		configuration: cws.presentationConfiguration,
		initialSliderPosition,
		branding,
		brandingAssetBytes,
		referenceImageBytes,
		captureImageBytes,
	});

	return {
		session: { id: cws.sessionDirectory },
		presentation,
		visibility: { ...cws.presentationVisibility },
		configuration: { ...cws.presentationConfiguration },
		branding,
		brandingAssetBytes,
		referenceImageBytes,
		captureImageBytes,
		initialSliderPosition,
		outcomeFingerprint,
	};
}
