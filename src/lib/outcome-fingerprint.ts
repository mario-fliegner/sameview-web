// Computes the Outcome Fingerprint (docs/IMPORTED_COMPARISON_V1.md "Outcome
// Fingerprint"; docs/IMPLEMENTATION_PLAN_V1.md Phase 11): a value that
// changes if and only if the outcome's own allowlisted content changes.
//
// Inputs are deliberately the authoritative, locale- and timezone-independent
// raw values that produce the Outcome Snapshot's locale-formatted display
// strings (`referenceLabel`, `captureLabel`, `durationLabel`, `sliderLabels`
// in src/lib/comparison-presentation.ts), never those derived strings
// themselves — regenerating the same Current Working State in a different
// SameView Web UI language or a different execution time zone must not
// change the fingerprint. `title`/`description`/`location` are the exception:
// src/lib/comparison-presentation.ts already resolves those without any
// locale involvement, so they are reused as-is rather than re-derived here.
//
// `session.id` deliberately never participates (see
// src/lib/outcome-snapshot.ts): identity and content are orthogonal —
// docs/EMBED_IN_WEBSITE.md "Comparison Lifecycle" only ever compares
// fingerprints after already matching by `session.id`.
//
// Takes only plain, already-resolved values — never CurrentWorkingState or
// raw imported metadata directly — mirroring src/lib/process-comparison-images.ts's
// own "operates on plain values only" scoping.
//
// SHA-256 via the native Web Crypto API (`crypto.subtle`, available
// unchanged in both the browser and Node >=20 — see package.json's `engines`
// field): no new dependency, and materially stronger collision resistance
// than a hand-rolled non-cryptographic hash for a mechanism whose entire job
// is exact-duplicate detection (docs/EMBED_IN_WEBSITE.md "Comparison
// Lifecycle").

import { bytesToBase64 } from "./base64.ts";
import type { HandleBranding } from "./branding.ts";
import type { ComparisonLocation } from "./comparison-presentation.ts";
import type {
	PresentationConfiguration,
	PresentationVisibility,
} from "./workspace-state.ts";

export interface OutcomeFingerprintInput {
	readonly title: string | undefined;
	readonly description: string | undefined;
	readonly location: ComparisonLocation | undefined;
	// Raw `reference.date` (docs/IMPORTED_COMPARISON_V1.md "Reference Date"),
	// exactly as src/lib/comparison-edit.ts `getReferenceDateValue` already
	// reads it — never the locale-formatted `referenceLabel`/`durationLabel`/
	// `sliderLabels` derived from it.
	readonly referenceDateRaw: string | undefined;
	readonly captureTimestampMs: number;
	readonly visibility: PresentationVisibility;
	readonly configuration: PresentationConfiguration;
	readonly initialSliderPosition: number;
	readonly branding: HandleBranding;
	readonly brandingAssetBytes: Uint8Array | undefined;
	// The final, already-processed comparison images (docs/FEATURE_SPECIFICATION.md
	// F-005 "Remove Embedded Location Data") — whatever bytes actually end up
	// in the generated outcome, per docs/IMPORTED_COMPARISON_V1.md's "Outcome
	// and Publication Data" allowlist ("required comparison images") and
	// docs/DATA_AND_PRIVACY.md ("before a comparison image is included in a
	// generated ... output"). Never the pre-processing bytes.
	readonly referenceImageBytes: Uint8Array;
	readonly captureImageBytes: Uint8Array;
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

// Deterministic regardless of property insertion order — every nested plain
// object's keys are sorted before serialization. `undefined` becomes `null`
// (JSON.stringify would otherwise silently drop the property, which is fine
// for the fixed, hand-built shape this module always produces, but an
// explicit `null` keeps the canonical form self-evidently total rather than
// relying on that shape never changing without this function changing too).
function canonicalize(value: unknown): unknown {
	if (value === undefined) return null;
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value !== null && typeof value === "object") {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
		}
		return sorted;
	}
	return value;
}

export async function computeOutcomeFingerprint(
	input: OutcomeFingerprintInput,
): Promise<string> {
	const canonicalInput = canonicalize({
		title: input.title,
		description: input.description,
		location: input.location,
		referenceDateRaw: input.referenceDateRaw,
		captureTimestampMs: input.captureTimestampMs,
		visibility: input.visibility,
		configuration: input.configuration,
		initialSliderPosition: input.initialSliderPosition,
		branding: input.branding,
		brandingAssetBase64: input.brandingAssetBytes
			? bytesToBase64(input.brandingAssetBytes)
			: undefined,
		referenceImageBase64: bytesToBase64(input.referenceImageBytes),
		captureImageBase64: bytesToBase64(input.captureImageBytes),
	});

	const json = JSON.stringify(canonicalInput);
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(json),
	);
	return toHex(new Uint8Array(digest));
}
