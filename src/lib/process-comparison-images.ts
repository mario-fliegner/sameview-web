// Phase 8 API entry point (docs/IMPLEMENTATION_PLAN_V1.md Phase 8;
// docs/FEATURE_SPECIFICATION.md F-005 "Remove Embedded Location Data").
// Combines an immutable Outcome Snapshot (Phase 7 — never mutated or
// re-derived from here) with the output-specific `removeEmbeddedLocationData`
// setting to produce the two comparison images an output generator needs.
// This is the only file in Phase 8 that knows about `OutcomeSnapshot`; every
// module it calls operates on plain bytes only.
//
// `OutcomeSnapshot` required no changes for this contract: it already
// carries exactly `referenceImageBytes`/`captureImageBytes` as defensive
// copies (src/lib/outcome-snapshot.ts), which is all this function reads.
// `removeEmbeddedLocationData` is an output-specific setting, not a Snapshot
// field — USER_WORKFLOW.md's "Generate the Outcome" step combines the
// Snapshot with "the configuration of the selected outcome" as two
// separate inputs, which is exactly this function's own two parameters.
// `branding`, `brandingAssetBytes`, `presentation`, `visibility`,
// `configuration` and `initialSliderPosition` are never read here and never
// appear in this function's return value — this module performs no
// branding processing of any kind, per the approved Phase 8 scope.
//
// Off is a pure identity pass-through of the Snapshot's own already-final
// bytes (no re-copy: Phase 7 already guarantees they are never mutated) and
// can never fail. On processes reference before capture (fail-fast, the
// same sequencing already used by src/lib/import-source-data.ts) — either
// failing fails the whole call atomically; neither processed image is ever
// returned unless both succeeded.

import type { LocationMetadataRemovalError } from "./jpeg-location-metadata.ts";
import { removeEmbeddedLocationData } from "./jpeg-location-metadata.ts";
import type { OutcomeSnapshot } from "./outcome-snapshot.ts";

export interface ProcessComparisonImagesOptions {
	readonly removeEmbeddedLocationData: boolean;
}

export interface ProcessedComparisonImages {
	readonly referenceImageBytes: Uint8Array;
	readonly captureImageBytes: Uint8Array;
}

export type ProcessComparisonImagesError =
	| {
			readonly code: "reference-processing-failed";
			readonly error: LocationMetadataRemovalError;
	  }
	| {
			readonly code: "capture-processing-failed";
			readonly error: LocationMetadataRemovalError;
	  };

export type ProcessComparisonImagesResult =
	| { readonly ok: true; readonly value: ProcessedComparisonImages }
	| { readonly ok: false; readonly error: ProcessComparisonImagesError };

export function processComparisonImages(
	snapshot: OutcomeSnapshot,
	options: ProcessComparisonImagesOptions,
): ProcessComparisonImagesResult {
	if (!options.removeEmbeddedLocationData) {
		return {
			ok: true,
			value: {
				referenceImageBytes: snapshot.referenceImageBytes,
				captureImageBytes: snapshot.captureImageBytes,
			},
		};
	}

	const referenceResult = removeEmbeddedLocationData(
		snapshot.referenceImageBytes,
	);
	if (!referenceResult.ok) {
		return {
			ok: false,
			error: {
				code: "reference-processing-failed",
				error: referenceResult.error,
			},
		};
	}

	const captureResult = removeEmbeddedLocationData(snapshot.captureImageBytes);
	if (!captureResult.ok) {
		return {
			ok: false,
			error: { code: "capture-processing-failed", error: captureResult.error },
		};
	}

	return {
		ok: true,
		value: {
			referenceImageBytes: referenceResult.bytes,
			captureImageBytes: captureResult.bytes,
		},
	};
}
