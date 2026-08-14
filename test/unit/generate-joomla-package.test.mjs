// Coverage for src/lib/generate-joomla-package.ts and the shared
// src/lib/comparison-manifest.ts it uses — docs/IMPLEMENTATION_PLAN_V1.md
// Phase 21's own constraint: the Joomla `comparison.json` manifest is the
// exact same platform-neutral mapping src/lib/generate-wordpress-package.ts
// uses (test/unit/generate-wordpress-package.test.mjs covers that mapping's
// own field-for-field correspondence in full; this file does not repeat
// those assertions, only confirms the Joomla-side import path and package
// filename are correct, plus what the Joomla package deliberately does
// NOT contain yet).
//
// generateJoomlaPackage() itself is not unit-tested here: it calls
// fetchJoomlaExtensionFiles(), which performs a same-origin `fetch()` only
// meaningful against a running app — exactly like generateWordPressPackage()
// (see that module's own test file for the same reasoning). The full,
// real generated package is instead verified by
// test/e2e/output-generation.spec.ts ("generating for Joomla downloads
// sameview-comparisons-joomla.zip...") and by
// integrations/joomla/tests/add-comparison-lifecycle.test.mjs against real
// Joomla instances.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildComparisonManifest,
	COMPARISON_MANIFEST_FORMAT_VERSION,
} from "../../src/lib/comparison-manifest.ts";
import { JOOMLA_PACKAGE_FILENAME } from "../../src/lib/generate-joomla-package.ts";
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

describe("Joomla package — comparison-manifest.ts reused unchanged", () => {
	test("JOOMLA_PACKAGE_FILENAME matches the name already established by Phase 19's own test tooling", () => {
		assert.equal(JOOMLA_PACKAGE_FILENAME, "sameview-comparisons-joomla.zip");
	});

	test("buildComparisonManifest imported from the shared module produces the same shape used for WordPress", () => {
		const snapshot = buildSnapshot();
		const manifest = buildComparisonManifest(snapshot);

		assert.equal(manifest.formatVersion, COMPARISON_MANIFEST_FORMAT_VERSION);
		assert.equal(manifest.sessionId, snapshot.session.id);
		assert.equal(manifest.outcomeFingerprint, snapshot.outcomeFingerprint);
		assert.deepEqual(manifest.presentation, snapshot.presentation);
		assert.deepEqual(manifest.visibility, snapshot.visibility);
		assert.deepEqual(manifest.configuration, snapshot.configuration);
		assert.deepEqual(manifest.branding, snapshot.branding);

		// docs/IMPLEMENTATION_PLAN_V1.md Phase 21 "Not included": nothing here
		// references the shared Embed runtime/CSS/fonts — those enter the
		// Joomla package only from Phase 22 onward, mirroring WordPress's own
		// Phase 15 (no runtime assets) vs. Phase 16 (adds them) split.
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
});
