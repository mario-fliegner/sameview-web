// Coverage for src/lib/generate-wordpress-package.ts `buildComparisonManifest`
// — docs/IMPLEMENTATION_PLAN_V1.md Phase 15's own constraint: the WordPress
// `comparison.json` manifest must be a direct, mechanical mapping of the
// existing approved Outcome Snapshot's own allowlisted fields, never a
// second, WordPress-specific semantic Outcome model. This test asserts
// exactly that correspondence, field for field, and that nothing beyond
// `formatVersion` is invented.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildComparisonManifest,
	COMPARISON_MANIFEST_FORMAT_VERSION,
} from "../../src/lib/generate-wordpress-package.ts";
import { DEFAULT_PRESENTATION_CONFIGURATION } from "../../src/lib/workspace-state.ts";

function buildSnapshot(overrides = {}) {
	return {
		session: { id: "2024-01-01_session-abc" },
		presentation: {
			title: "White wall portrait",
			description: "A short description",
			referenceLabel: "May 2019",
			captureLabel: "June 12, 2023",
			durationLabel: "4 years",
			location: {
				displayName: "Marienplatz",
				city: "Munich",
				country: "Germany",
			},
			sliderLabels: { left: "2019", right: "2023" },
		},
		visibility: {
			title: true,
			description: true,
			time: true,
			timeDifference: true,
			location: true,
		},
		configuration: DEFAULT_PRESENTATION_CONFIGURATION,
		branding: { kind: "none" },
		brandingAssetBytes: undefined,
		referenceImageBytes: new Uint8Array([1, 2, 3]),
		captureImageBytes: new Uint8Array([4, 5, 6]),
		initialSliderPosition: 0.5,
		outcomeFingerprint: "abc123fingerprint",
		...overrides,
	};
}

describe("buildComparisonManifest", () => {
	test("maps every manifest field to the exact, unmodified Outcome Snapshot value it came from", () => {
		const snapshot = buildSnapshot();
		const manifest = buildComparisonManifest(snapshot);

		assert.equal(manifest.formatVersion, COMPARISON_MANIFEST_FORMAT_VERSION);
		assert.equal(manifest.sessionId, snapshot.session.id);
		assert.equal(manifest.outcomeFingerprint, snapshot.outcomeFingerprint);
		assert.deepEqual(manifest.presentation, snapshot.presentation);
		assert.deepEqual(manifest.visibility, snapshot.visibility);
		assert.deepEqual(manifest.configuration, snapshot.configuration);
		assert.equal(
			manifest.initialSliderPosition,
			snapshot.initialSliderPosition,
		);
		assert.deepEqual(manifest.branding, snapshot.branding);
	});

	// docs/IMPORTED_COMPARISON_V1.md "Outcome and Publication Data": image
	// bytes are packaged as their own separate files (this module's own
	// header comment), never embedded in the JSON manifest itself.
	test("never embeds image bytes or the branding asset's own bytes in the manifest", () => {
		const snapshot = buildSnapshot({
			branding: { kind: "asset" },
			brandingAssetBytes: new Uint8Array([9, 9, 9]),
		});
		const manifest = buildComparisonManifest(snapshot);
		const serialized = JSON.stringify(manifest);

		assert.ok(!("referenceImageBytes" in manifest));
		assert.ok(!("captureImageBytes" in manifest));
		assert.ok(!("brandingAssetBytes" in manifest));
		assert.ok(!serialized.includes("9,9,9"));
	});

	// The manifest must carry only already-approved allowlisted Comparison/
	// Presentation content plus the one transport-only addition
	// (`formatVersion`) — never source paths, raw imported metadata, device
	// metadata or other non-Outcome fields (docs/IMPORTED_COMPARISON_V1.md
	// "Outcome and Publication Data").
	test("contains only the approved manifest keys — no invented fields", () => {
		const manifest = buildComparisonManifest(buildSnapshot());
		assert.deepEqual(
			Object.keys(manifest).sort(),
			[
				"branding",
				"configuration",
				"formatVersion",
				"initialSliderPosition",
				"outcomeFingerprint",
				"presentation",
				"sessionId",
				"visibility",
			].sort(),
		);
	});

	test("identical input produces byte-identical JSON (deterministic, no hidden randomness/timestamps)", () => {
		const snapshot = buildSnapshot();
		const first = JSON.stringify(buildComparisonManifest(snapshot));
		const second = JSON.stringify(buildComparisonManifest(snapshot));
		assert.equal(first, second);
	});
});
