// Coverage for src/lib/outcome-fingerprint.ts directly (docs/IMPORTED_COMPARISON_V1.md
// "Outcome Fingerprint"; docs/IMPLEMENTATION_PLAN_V1.md Phase 11) — the
// canonicalization/hashing mechanism in isolation from Outcome Snapshot
// construction, which test/unit/outcome-snapshot.test.mjs already covers at
// the integration level (which inputs participate, sourced correctly).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeOutcomeFingerprint } from "../../src/lib/outcome-fingerprint.ts";

function baseInput(overrides = {}) {
	return {
		title: "A Title",
		description: "A description.",
		location: { displayName: "The Place", city: "Berlin", country: "Germany" },
		referenceDateRaw: "2020-05-01",
		captureTimestampMs: 1700000000000,
		visibility: {
			title: true,
			description: false,
			time: true,
			timeDifference: false,
			location: true,
		},
		configuration: {
			canvasBackground: "brand",
			frame: "none",
			cornerRadius: "rounded",
			textColor: "automatic",
			showSliderDateLabels: true,
			presentationFont: "inter",
		},
		initialSliderPosition: 0.5,
		branding: { kind: "none" },
		brandingAssetBytes: undefined,
		referenceImageBytes: new Uint8Array([1, 2, 3]),
		captureImageBytes: new Uint8Array([4, 5, 6]),
		...overrides,
	};
}

describe("computeOutcomeFingerprint", () => {
	test("is deterministic for identical input", async () => {
		const first = await computeOutcomeFingerprint(baseInput());
		const second = await computeOutcomeFingerprint(baseInput());

		assert.equal(typeof first, "string");
		assert.ok(first.length > 0);
		assert.equal(first, second);
	});

	test("is a lowercase hex SHA-256 digest (64 hex characters)", async () => {
		const fingerprint = await computeOutcomeFingerprint(baseInput());

		assert.match(fingerprint, /^[0-9a-f]{64}$/);
	});

	test("changes when any one field changes", async () => {
		const base = await computeOutcomeFingerprint(baseInput());

		const variants = [
			baseInput({ title: "Different Title" }),
			baseInput({ description: "Different description." }),
			baseInput({ location: { displayName: "Elsewhere" } }),
			baseInput({ referenceDateRaw: "2021-05-01" }),
			baseInput({ captureTimestampMs: 1700000000001 }),
			baseInput({
				visibility: { ...baseInput().visibility, description: true },
			}),
			baseInput({
				configuration: {
					...baseInput().configuration,
					presentationFont: "manrope",
				},
			}),
			baseInput({ initialSliderPosition: 0.75 }),
			baseInput({
				branding: { kind: "symbol", builtinId: "star", color: "#4F8CFF" },
			}),
			baseInput({ brandingAssetBytes: new Uint8Array([9, 9, 9]) }),
			baseInput({ referenceImageBytes: new Uint8Array([9, 9, 9]) }),
			baseInput({ captureImageBytes: new Uint8Array([9, 9, 9]) }),
		];

		for (const variant of variants) {
			const fingerprint = await computeOutcomeFingerprint(variant);
			assert.notEqual(fingerprint, base);
		}
	});

	test("is independent of object key insertion order (canonicalization)", async () => {
		const input = baseInput();
		const reordered = {
			captureImageBytes: input.captureImageBytes,
			referenceImageBytes: input.referenceImageBytes,
			brandingAssetBytes: input.brandingAssetBytes,
			branding: input.branding,
			initialSliderPosition: input.initialSliderPosition,
			configuration: {
				presentationFont: input.configuration.presentationFont,
				showSliderDateLabels: input.configuration.showSliderDateLabels,
				textColor: input.configuration.textColor,
				cornerRadius: input.configuration.cornerRadius,
				frame: input.configuration.frame,
				canvasBackground: input.configuration.canvasBackground,
			},
			visibility: {
				location: input.visibility.location,
				timeDifference: input.visibility.timeDifference,
				time: input.visibility.time,
				description: input.visibility.description,
				title: input.visibility.title,
			},
			captureTimestampMs: input.captureTimestampMs,
			referenceDateRaw: input.referenceDateRaw,
			location: {
				country: input.location.country,
				city: input.location.city,
				displayName: input.location.displayName,
			},
			description: input.description,
			title: input.title,
		};

		const original = await computeOutcomeFingerprint(input);
		const fromReordered = await computeOutcomeFingerprint(reordered);

		assert.equal(original, fromReordered);
	});

	test("treats an absent brandingAssetBytes distinctly from a present one", async () => {
		const withoutAsset = await computeOutcomeFingerprint(
			baseInput({ brandingAssetBytes: undefined }),
		);
		const withAsset = await computeOutcomeFingerprint(
			baseInput({ brandingAssetBytes: new Uint8Array([1]) }),
		);

		assert.notEqual(withoutAsset, withAsset);
	});
});
