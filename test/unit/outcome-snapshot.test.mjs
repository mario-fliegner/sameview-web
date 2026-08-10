// Coverage for src/lib/outcome-snapshot.ts against
// docs/IMPORTED_COMPARISON_V1.md "Outcome Snapshot", docs/FEATURE_SPECIFICATION.md
// F-005 and docs/COMPARISON_PRESENTATION.md Part 2 "Initial Slider Position".
// Pure, deterministic logic — no browser API involved — so this belongs in
// the Node unit suite, not Playwright.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyTitle } from "../../src/lib/comparison-edit.ts";
import {
	createOutcomeSnapshot,
	DEFAULT_INITIAL_SLIDER_POSITION,
} from "../../src/lib/outcome-snapshot.ts";
import {
	createWorkspace,
	DEFAULT_BRANDING_DRAFT,
	DEFAULT_PRESENTATION_CONFIGURATION,
	DEFAULT_PRESENTATION_VISIBILITY,
} from "../../src/lib/workspace-state.ts";

const LOCALE = "en";
const OPTIONS = {
	referenceFallbackLabel: "Then",
	sliderLabelFallbacks: {
		past: "Past",
		present: "Present",
		reference: "Reference",
		current: "Current",
	},
	durationLabelFallbacks: {
		year: "year",
		years: "years",
		month: "month",
		months: "months",
		sameYear: "Same year",
	},
};

function fakeCurrentWorkingState(raw = {}, filesPatch = {}, statePatch = {}) {
	return {
		sessionDirectory: "2024-01-15_10-30-00",
		metadata: {
			version: 6,
			sessionId: undefined,
			captureTimestampMs: 1700000000000,
			referenceFile: "reference.jpg",
			captureFile: "capture.jpg",
			raw,
		},
		files: {
			referenceBytes: new Uint8Array([1, 2, 3]),
			captureBytes: new Uint8Array([4, 5, 6]),
			referenceOriginalBytes: undefined,
			captureOriginalBytes: undefined,
			referenceSourceOriginalBytes: undefined,
			brandingHandleBytes: undefined,
			...filesPatch,
		},
		presentationVisibility: DEFAULT_PRESENTATION_VISIBILITY,
		presentationConfiguration: DEFAULT_PRESENTATION_CONFIGURATION,
		brandingDraft: DEFAULT_BRANDING_DRAFT,
		...statePatch,
	};
}

describe("createOutcomeSnapshot", () => {
	test("captures presentation, visibility, configuration and branding from the effective Current Working State", () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "White wall", description: "A description." },
			location: {
				displayName: "The Place",
				city: "Berlin",
				country: "Germany",
			},
			reference: { date: "2020-05-01" },
		});
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(snapshot.presentation.title, "White wall");
		assert.equal(snapshot.presentation.description, "A description.");
		assert.deepEqual(snapshot.presentation.location, {
			displayName: "The Place",
			city: "Berlin",
			country: "Germany",
		});
		assert.deepEqual(snapshot.visibility, DEFAULT_PRESENTATION_VISIBILITY);
		assert.deepEqual(
			snapshot.configuration,
			DEFAULT_PRESENTATION_CONFIGURATION,
		);
		assert.deepEqual(snapshot.branding, { kind: "none" });
	});

	test("carries a non-default Presentation Font through unchanged (docs/IMPLEMENTATION_PLAN_V1.md Phase 8b)", () => {
		const cws = fakeCurrentWorkingState(
			{},
			{},
			{
				presentationConfiguration: {
					...DEFAULT_PRESENTATION_CONFIGURATION,
					presentationFont: "space-grotesk",
				},
			},
		);
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(snapshot.configuration.presentationFont, "space-grotesk");
	});

	test("excludes unknown metadata.raw fields and unknown nested blocks", () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "Visible Title" },
			unknownTopLevel: "top-secret",
			unknownBlock: { nested: "also-secret" },
		});
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		const serialized = JSON.stringify(snapshot, (_key, value) =>
			value instanceof Uint8Array ? Array.from(value) : value,
		);
		assert.ok(!serialized.includes("top-secret"));
		assert.ok(!serialized.includes("also-secret"));
	});

	test("excludes brandingDraft content that does not match the active branding", () => {
		const cws = fakeCurrentWorkingState(
			{}, // no active branding block -> "none"
			{},
			{
				brandingDraft: {
					...DEFAULT_BRANDING_DRAFT,
					lastCustomImageBytes: new Uint8Array([9, 9, 9, 9]),
				},
			},
		);
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.deepEqual(snapshot.branding, { kind: "none" });
		assert.equal(snapshot.brandingAssetBytes, undefined);
	});

	test("derives reference/capture/duration/slider labels the same way the live viewer does", () => {
		const cws = fakeCurrentWorkingState({ reference: { date: "2019-05" } });
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(snapshot.presentation.referenceLabel, "May 2019");
		assert.equal(typeof snapshot.presentation.captureLabel, "string");
		assert.ok(snapshot.presentation.captureLabel.length > 0);
		assert.deepEqual(snapshot.presentation.sliderLabels, {
			left: "2019",
			right: "2023",
		});
	});

	test("resolves a built-in symbol with its configured color", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "star", symbolColor: "brand" },
		});
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.deepEqual(snapshot.branding, {
			kind: "symbol",
			builtinId: "star",
			color: "#4F8CFF",
		});
		assert.equal(snapshot.brandingAssetBytes, undefined);
	});

	test("copies a custom branding asset byte-for-byte via a defensive copy", () => {
		const originalBytes = new Uint8Array([10, 20, 30, 40]);
		const cws = fakeCurrentWorkingState(
			{ branding: { type: "image" } },
			{ brandingHandleBytes: originalBytes },
		);
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.deepEqual(snapshot.branding, { kind: "asset" });
		assert.notEqual(snapshot.brandingAssetBytes, originalBytes);
		assert.deepEqual(
			Array.from(snapshot.brandingAssetBytes),
			Array.from(originalBytes),
		);

		originalBytes[0] = 255;
		assert.equal(snapshot.brandingAssetBytes[0], 10);
	});

	test("copies reference and capture image bytes via defensive copies", () => {
		const referenceBytes = new Uint8Array([1, 2, 3]);
		const captureBytes = new Uint8Array([4, 5, 6]);
		const cws = fakeCurrentWorkingState({}, { referenceBytes, captureBytes });
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.notEqual(snapshot.referenceImageBytes, referenceBytes);
		assert.notEqual(snapshot.captureImageBytes, captureBytes);
		assert.deepEqual(Array.from(snapshot.referenceImageBytes), [1, 2, 3]);
		assert.deepEqual(Array.from(snapshot.captureImageBytes), [4, 5, 6]);

		referenceBytes[0] = 99;
		captureBytes[0] = 99;
		assert.equal(snapshot.referenceImageBytes[0], 1);
		assert.equal(snapshot.captureImageBytes[0], 4);
	});

	test("remains unchanged after the source Current Working State is edited", () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "Original Title" },
		});
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		const editedCws = applyTitle(cws, "Edited Title");

		assert.equal(snapshot.presentation.title, "Original Title");
		assert.equal(editedCws.metadata.raw.content.title, "Edited Title");
	});

	test("remains unchanged after a Replace Export creates a new workspace", () => {
		const sourceDataA = {
			sessionDirectory: "session-a",
			metadata: {
				version: 6,
				sessionId: undefined,
				captureTimestampMs: 1700000000000,
				referenceFile: "reference.jpg",
				captureFile: "capture.jpg",
				raw: { content: { title: "Comparison A" } },
			},
			files: {
				referenceBytes: new Uint8Array([1, 1, 1]),
				captureBytes: new Uint8Array([2, 2, 2]),
				referenceOriginalBytes: undefined,
				captureOriginalBytes: undefined,
				referenceSourceOriginalBytes: undefined,
				brandingHandleBytes: undefined,
			},
		};
		const workspaceA = createWorkspace(sourceDataA);
		const snapshotA = createOutcomeSnapshot(
			workspaceA.workspace.currentWorkingState,
			LOCALE,
			OPTIONS,
		);

		const sourceDataB = {
			sessionDirectory: "session-b",
			metadata: {
				...sourceDataA.metadata,
				raw: { content: { title: "Comparison B" } },
			},
			files: {
				referenceBytes: new Uint8Array([9, 9, 9]),
				captureBytes: new Uint8Array([8, 8, 8]),
				referenceOriginalBytes: undefined,
				captureOriginalBytes: undefined,
				referenceSourceOriginalBytes: undefined,
				brandingHandleBytes: undefined,
			},
		};
		createWorkspace(sourceDataB); // simulates the Replace Export commit

		assert.equal(snapshotA.presentation.title, "Comparison A");
		assert.deepEqual(Array.from(snapshotA.referenceImageBytes), [1, 1, 1]);
	});

	test("sets initialSliderPosition to the fixed V1 default", () => {
		const cws = fakeCurrentWorkingState();
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(snapshot.initialSliderPosition, 0.5);
		assert.equal(DEFAULT_INITIAL_SLIDER_POSITION, 0.5);
	});

	test("initialSliderPosition is independent of the Current Working State content", () => {
		const cwsOne = fakeCurrentWorkingState({ content: { title: "A" } });
		const cwsTwo = fakeCurrentWorkingState(
			{
				content: { title: "Completely different comparison" },
				branding: {
					type: "builtin",
					builtinId: "fire",
					symbolColor: "custom",
					symbolColorHex: "#123456",
				},
			},
			{ brandingHandleBytes: undefined },
		);

		const snapshotOne = createOutcomeSnapshot(cwsOne, LOCALE, OPTIONS);
		const snapshotTwo = createOutcomeSnapshot(cwsTwo, LOCALE, OPTIONS);

		assert.equal(snapshotOne.initialSliderPosition, 0.5);
		assert.equal(snapshotTwo.initialSliderPosition, 0.5);
	});

	// docs/COMPARISON_PRESENTATION.md "Use Current Slider Position": the
	// caller (src/components/OutputInspector.tsx) may pass an already-read
	// live Workspace Preview slider position as a [0, 1] fraction instead of
	// the default — this module accepts it as-is, 0 and 1 both valid
	// endpoints, no clamping or other new semantics for out-of-range values.
	test("an explicit initialSliderPosition overrides the default", () => {
		const cws = fakeCurrentWorkingState();

		assert.equal(
			createOutcomeSnapshot(cws, LOCALE, OPTIONS, 0).initialSliderPosition,
			0,
		);
		assert.equal(
			createOutcomeSnapshot(cws, LOCALE, OPTIONS, 1).initialSliderPosition,
			1,
		);
		assert.equal(
			createOutcomeSnapshot(cws, LOCALE, OPTIONS, 0.37).initialSliderPosition,
			0.37,
		);
	});

	test("produces one snapshot usable identically by two independent output consumers", () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "Shared Snapshot" },
			branding: { type: "builtin", builtinId: "heart", symbolColor: "dark" },
		});
		const snapshot = createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		// Deliberately generic — neither stub branches on an output-type field,
		// since OutcomeSnapshot carries none (docs/IMPLEMENTATION_PLAN_V1.md
		// Phase 7: "no separate Snapshot types for Standalone and Microsite
		// without a real need").
		function standaloneHtmlStub(outcomeSnapshot) {
			return {
				title: outcomeSnapshot.presentation.title,
				brandingKind: outcomeSnapshot.branding.kind,
				initialSliderPosition: outcomeSnapshot.initialSliderPosition,
				referenceByteLength: outcomeSnapshot.referenceImageBytes.length,
			};
		}
		function staticMicrositeStub(outcomeSnapshot) {
			return {
				title: outcomeSnapshot.presentation.title,
				brandingKind: outcomeSnapshot.branding.kind,
				initialSliderPosition: outcomeSnapshot.initialSliderPosition,
				referenceByteLength: outcomeSnapshot.referenceImageBytes.length,
			};
		}

		assert.deepEqual(
			standaloneHtmlStub(snapshot),
			staticMicrositeStub(snapshot),
		);
	});
});
