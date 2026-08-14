// The Comparison-package manifest (`comparison.json`) — the one piece of
// docs/IMPLEMENTATION_PLAN_V1.md Phase 15/21's unified-package design that is
// genuinely platform-neutral: a direct, mechanical serialization of the
// existing approved Outcome Snapshot's own allowlisted fields
// (docs/IMPORTED_COMPARISON_V1.md "Outcome and Publication Data"), never a
// second, platform-specific semantic Outcome model. The only addition is
// `formatVersion`, a transport/package concern, not Comparison content
// (docs/WORDPRESS_INTEGRATION.md / docs/JOOMLA_INTEGRATION.md "Persistent
// Integration Versioning": "If a newer Comparison format is imported into an
// older integration that cannot fully understand it, the import is rejected
// completely").
//
// Extracted from src/lib/generate-wordpress-package.ts (docs/IMPLEMENTATION_PLAN_V1.md
// Phase 21): a pure relocation, re-exported unchanged from that module for
// import-path stability — WordPress's own generated package is byte-for-byte
// unaffected. src/lib/generate-joomla-package.ts imports this module
// directly, never a WordPress-specific one, since nothing here ever
// referenced WordPress.

import type { OutcomeSnapshot } from "./outcome-snapshot.ts";

// Bumped only if this manifest's own shape changes in a way an older
// integration could not safely interpret — never for ordinary Comparison
// content changes, which `outcomeFingerprint` already exists to detect.
export const COMPARISON_MANIFEST_FORMAT_VERSION = 1;

// Every field here already exists, unchanged, on the Outcome Snapshot
// itself (src/lib/outcome-snapshot.ts) — this is a transport shape, not a
// second semantic model. `formatVersion` is the one addition, and is a
// package/transport concern, not Comparison content.
export interface ComparisonManifest {
	readonly formatVersion: number;
	readonly sessionId: string;
	readonly outcomeFingerprint: string;
	readonly presentation: OutcomeSnapshot["presentation"];
	readonly visibility: OutcomeSnapshot["visibility"];
	readonly configuration: OutcomeSnapshot["configuration"];
	readonly initialSliderPosition: number;
	readonly branding: OutcomeSnapshot["branding"];
}

// The exact, mechanical Outcome-Snapshot-to-manifest mapping (see this
// file's own header comment for why no field here is invented). Image bytes
// and the optional branding asset are not part of this JSON — they are
// packaged as their own separate files alongside it, exactly like every
// other generated output already does (src/lib/generate-static-microsite.ts
// `images/reference.jpg` etc.).
export function buildComparisonManifest(
	snapshot: OutcomeSnapshot,
): ComparisonManifest {
	return {
		formatVersion: COMPARISON_MANIFEST_FORMAT_VERSION,
		sessionId: snapshot.session.id,
		outcomeFingerprint: snapshot.outcomeFingerprint,
		presentation: snapshot.presentation,
		visibility: snapshot.visibility,
		configuration: snapshot.configuration,
		initialSliderPosition: snapshot.initialSliderPosition,
		branding: snapshot.branding,
	};
}
