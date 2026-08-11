// Coverage for src/lib/outcome-snapshot.ts against
// docs/IMPORTED_COMPARISON_V1.md "Outcome Snapshot", "Comparison Identity
// (`session.id`)" and "Outcome Fingerprint"; docs/FEATURE_SPECIFICATION.md
// F-005; docs/COMPARISON_PRESENTATION.md Part 2 "Initial Slider Position";
// docs/IMPLEMENTATION_PLAN_V1.md Phase 11. Pure, deterministic logic — no
// browser API involved beyond the native Web Crypto digest, available in
// both the browser and the Node test runner — so this belongs in the Node
// unit suite, not Playwright.

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

const GERMAN_OPTIONS = {
	referenceFallbackLabel: "Damals",
	sliderLabelFallbacks: {
		past: "Vorher",
		present: "Jetzt",
		reference: "Referenz",
		current: "Aktuell",
	},
	durationLabelFallbacks: {
		year: "Jahr",
		years: "Jahre",
		month: "Monat",
		months: "Monate",
		sameYear: "Gleiches Jahr",
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
	test("captures presentation, visibility, configuration and branding from the effective Current Working State", async () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "White wall", description: "A description." },
			location: {
				displayName: "The Place",
				city: "Berlin",
				country: "Germany",
			},
			reference: { date: "2020-05-01" },
		});
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

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

	test("carries a non-default Presentation Font through unchanged (docs/IMPLEMENTATION_PLAN_V1.md Phase 8b)", async () => {
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
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(snapshot.configuration.presentationFont, "space-grotesk");
	});

	test("excludes unknown metadata.raw fields and unknown nested blocks", async () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "Visible Title" },
			unknownTopLevel: "top-secret",
			unknownBlock: { nested: "also-secret" },
		});
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		const serialized = JSON.stringify(snapshot, (_key, value) =>
			value instanceof Uint8Array ? Array.from(value) : value,
		);
		assert.ok(!serialized.includes("top-secret"));
		assert.ok(!serialized.includes("also-secret"));
	});

	test("excludes brandingDraft content that does not match the active branding", async () => {
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
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.deepEqual(snapshot.branding, { kind: "none" });
		assert.equal(snapshot.brandingAssetBytes, undefined);
	});

	test("derives reference/capture/duration/slider labels the same way the live viewer does", async () => {
		const cws = fakeCurrentWorkingState({ reference: { date: "2019-05" } });
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(snapshot.presentation.referenceLabel, "May 2019");
		assert.equal(typeof snapshot.presentation.captureLabel, "string");
		assert.ok(snapshot.presentation.captureLabel.length > 0);
		assert.deepEqual(snapshot.presentation.sliderLabels, {
			left: "2019",
			right: "2023",
		});
	});

	test("resolves a built-in symbol with its configured color", async () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "star", symbolColor: "brand" },
		});
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.deepEqual(snapshot.branding, {
			kind: "symbol",
			builtinId: "star",
			color: "#4F8CFF",
		});
		assert.equal(snapshot.brandingAssetBytes, undefined);
	});

	test("copies a custom branding asset byte-for-byte via a defensive copy", async () => {
		const originalBytes = new Uint8Array([10, 20, 30, 40]);
		const cws = fakeCurrentWorkingState(
			{ branding: { type: "image" } },
			{ brandingHandleBytes: originalBytes },
		);
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.deepEqual(snapshot.branding, { kind: "asset" });
		assert.notEqual(snapshot.brandingAssetBytes, originalBytes);
		assert.deepEqual(
			Array.from(snapshot.brandingAssetBytes),
			Array.from(originalBytes),
		);

		originalBytes[0] = 255;
		assert.equal(snapshot.brandingAssetBytes[0], 10);
	});

	test("copies reference and capture image bytes via defensive copies", async () => {
		const referenceBytes = new Uint8Array([1, 2, 3]);
		const captureBytes = new Uint8Array([4, 5, 6]);
		const cws = fakeCurrentWorkingState({}, { referenceBytes, captureBytes });
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.notEqual(snapshot.referenceImageBytes, referenceBytes);
		assert.notEqual(snapshot.captureImageBytes, captureBytes);
		assert.deepEqual(Array.from(snapshot.referenceImageBytes), [1, 2, 3]);
		assert.deepEqual(Array.from(snapshot.captureImageBytes), [4, 5, 6]);

		referenceBytes[0] = 99;
		captureBytes[0] = 99;
		assert.equal(snapshot.referenceImageBytes[0], 1);
		assert.equal(snapshot.captureImageBytes[0], 4);
	});

	test("remains unchanged after the source Current Working State is edited", async () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "Original Title" },
		});
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		const editedCws = applyTitle(cws, "Edited Title");

		assert.equal(snapshot.presentation.title, "Original Title");
		assert.equal(editedCws.metadata.raw.content.title, "Edited Title");
	});

	test("remains unchanged after a Replace Export creates a new workspace", async () => {
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
		const snapshotA = await createOutcomeSnapshot(
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

	test("sets initialSliderPosition to the fixed V1 default", async () => {
		const cws = fakeCurrentWorkingState();
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(snapshot.initialSliderPosition, 0.5);
		assert.equal(DEFAULT_INITIAL_SLIDER_POSITION, 0.5);
	});

	test("initialSliderPosition is independent of the Current Working State content", async () => {
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

		const snapshotOne = await createOutcomeSnapshot(cwsOne, LOCALE, OPTIONS);
		const snapshotTwo = await createOutcomeSnapshot(cwsTwo, LOCALE, OPTIONS);

		assert.equal(snapshotOne.initialSliderPosition, 0.5);
		assert.equal(snapshotTwo.initialSliderPosition, 0.5);
	});

	// docs/COMPARISON_PRESENTATION.md "Use Current Slider Position": the
	// caller (src/components/OutputInspector.tsx) may pass an already-read
	// live Workspace Preview slider position as a [0, 1] fraction instead of
	// the default — this module accepts it as-is, 0 and 1 both valid
	// endpoints, no clamping or other new semantics for out-of-range values.
	test("an explicit initialSliderPosition overrides the default", async () => {
		const cws = fakeCurrentWorkingState();

		assert.equal(
			(await createOutcomeSnapshot(cws, LOCALE, OPTIONS, 0))
				.initialSliderPosition,
			0,
		);
		assert.equal(
			(await createOutcomeSnapshot(cws, LOCALE, OPTIONS, 1))
				.initialSliderPosition,
			1,
		);
		assert.equal(
			(await createOutcomeSnapshot(cws, LOCALE, OPTIONS, 0.37))
				.initialSliderPosition,
			0.37,
		);
	});

	test("produces one snapshot usable identically by two independent output consumers", async () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "Shared Snapshot" },
			branding: { type: "builtin", builtinId: "heart", symbolColor: "dark" },
		});
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

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

// docs/IMPORTED_COMPARISON_V1.md "Comparison Identity (`session.id`)";
// docs/IMPLEMENTATION_PLAN_V1.md Phase 11.
describe("createOutcomeSnapshot — session.id (Comparison Identity)", () => {
	test("session.id is sourced from the authoritative cws.sessionDirectory", async () => {
		const cws = fakeCurrentWorkingState();
		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(snapshot.session.id, cws.sessionDirectory);
	});

	// The critical identity boundary this phase must preserve: imported
	// metadata's own `session.id`/`sessionId` field
	// (cws.metadata.sessionId) is informational only and must never become
	// the outcome-level identity, even when present and different from the
	// authoritative sessionDirectory.
	test("session.id is never derived from the non-authoritative cws.metadata.sessionId, even when it conflicts with sessionDirectory", async () => {
		const cws = fakeCurrentWorkingState();
		cws.metadata.sessionId = "untrusted-imported-value";
		assert.notEqual(cws.metadata.sessionId, cws.sessionDirectory);

		const snapshot = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(snapshot.session.id, cws.sessionDirectory);
		assert.notEqual(snapshot.session.id, cws.metadata.sessionId);
	});
});

// docs/IMPORTED_COMPARISON_V1.md "Outcome Fingerprint";
// docs/IMPLEMENTATION_PLAN_V1.md Phase 11.
describe("createOutcomeSnapshot — outcomeFingerprint", () => {
	test("is deterministic: regenerating from an unchanged Current Working State produces the same fingerprint", async () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "Same Content", description: "Same description." },
			reference: { date: "2020-05-01" },
		});

		const first = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);
		const second = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);

		assert.equal(typeof first.outcomeFingerprint, "string");
		assert.ok(first.outcomeFingerprint.length > 0);
		assert.equal(first.outcomeFingerprint, second.outcomeFingerprint);
	});

	test("changes when the title changes", async () => {
		const before = await createOutcomeSnapshot(
			fakeCurrentWorkingState({ content: { title: "Title A" } }),
			LOCALE,
			OPTIONS,
		);
		const after = await createOutcomeSnapshot(
			fakeCurrentWorkingState({ content: { title: "Title B" } }),
			LOCALE,
			OPTIONS,
		);

		assert.notEqual(before.outcomeFingerprint, after.outcomeFingerprint);
	});

	test("changes when the description changes", async () => {
		const before = await createOutcomeSnapshot(
			fakeCurrentWorkingState({ content: { description: "A" } }),
			LOCALE,
			OPTIONS,
		);
		const after = await createOutcomeSnapshot(
			fakeCurrentWorkingState({ content: { description: "B" } }),
			LOCALE,
			OPTIONS,
		);

		assert.notEqual(before.outcomeFingerprint, after.outcomeFingerprint);
	});

	test("changes when a user-authored location field changes", async () => {
		const before = await createOutcomeSnapshot(
			fakeCurrentWorkingState({ location: { city: "Berlin" } }),
			LOCALE,
			OPTIONS,
		);
		const after = await createOutcomeSnapshot(
			fakeCurrentWorkingState({ location: { city: "Munich" } }),
			LOCALE,
			OPTIONS,
		);

		assert.notEqual(before.outcomeFingerprint, after.outcomeFingerprint);
	});

	test("changes when the raw reference.date value changes", async () => {
		const before = await createOutcomeSnapshot(
			fakeCurrentWorkingState({ reference: { date: "2019-05" } }),
			LOCALE,
			OPTIONS,
		);
		const after = await createOutcomeSnapshot(
			fakeCurrentWorkingState({ reference: { date: "2020-05" } }),
			LOCALE,
			OPTIONS,
		);

		assert.notEqual(before.outcomeFingerprint, after.outcomeFingerprint);
	});

	test("changes when presentationVisibility changes", async () => {
		const before = await createOutcomeSnapshot(
			fakeCurrentWorkingState(),
			LOCALE,
			OPTIONS,
		);
		const after = await createOutcomeSnapshot(
			fakeCurrentWorkingState(
				{},
				{},
				{
					presentationVisibility: {
						...DEFAULT_PRESENTATION_VISIBILITY,
						description: true,
					},
				},
			),
			LOCALE,
			OPTIONS,
		);

		assert.notEqual(before.outcomeFingerprint, after.outcomeFingerprint);
	});

	test("changes when presentationConfiguration changes (e.g. Presentation Font)", async () => {
		const before = await createOutcomeSnapshot(
			fakeCurrentWorkingState(),
			LOCALE,
			OPTIONS,
		);
		const after = await createOutcomeSnapshot(
			fakeCurrentWorkingState(
				{},
				{},
				{
					presentationConfiguration: {
						...DEFAULT_PRESENTATION_CONFIGURATION,
						presentationFont: "manrope",
					},
				},
			),
			LOCALE,
			OPTIONS,
		);

		assert.notEqual(before.outcomeFingerprint, after.outcomeFingerprint);
	});

	test("changes when branding changes (builtin symbol color)", async () => {
		const before = await createOutcomeSnapshot(
			fakeCurrentWorkingState({
				branding: { type: "builtin", builtinId: "star", symbolColor: "dark" },
			}),
			LOCALE,
			OPTIONS,
		);
		const after = await createOutcomeSnapshot(
			fakeCurrentWorkingState({
				branding: { type: "builtin", builtinId: "star", symbolColor: "brand" },
			}),
			LOCALE,
			OPTIONS,
		);

		assert.notEqual(before.outcomeFingerprint, after.outcomeFingerprint);
	});

	test("changes when a custom branding asset's bytes change", async () => {
		const before = await createOutcomeSnapshot(
			fakeCurrentWorkingState(
				{ branding: { type: "image" } },
				{ brandingHandleBytes: new Uint8Array([1, 2, 3, 4]) },
			),
			LOCALE,
			OPTIONS,
		);
		const after = await createOutcomeSnapshot(
			fakeCurrentWorkingState(
				{ branding: { type: "image" } },
				{ brandingHandleBytes: new Uint8Array([9, 9, 9, 9]) },
			),
			LOCALE,
			OPTIONS,
		);

		assert.notEqual(before.outcomeFingerprint, after.outcomeFingerprint);
	});

	test("changes when initialSliderPosition changes", async () => {
		const cws = fakeCurrentWorkingState();
		const before = await createOutcomeSnapshot(cws, LOCALE, OPTIONS, 0.5);
		const after = await createOutcomeSnapshot(cws, LOCALE, OPTIONS, 0.75);

		assert.notEqual(before.outcomeFingerprint, after.outcomeFingerprint);
	});

	// Decision 9(a): a UI-locale or generation-time-copy difference alone must
	// never move the fingerprint for an otherwise-unchanged Current Working
	// State — only the authoritative raw reference.date/captureTimestampMs
	// participate, never the locale-formatted referenceLabel/captureLabel/
	// durationLabel/sliderLabels those raw values produce.
	test("is stable across different UI locales/fallback copy for an unchanged Current Working State", async () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "Stable Across Locales" },
			reference: { date: "2019-05-01" },
		});

		const english = await createOutcomeSnapshot(cws, "en", OPTIONS);
		const german = await createOutcomeSnapshot(cws, "de", GERMAN_OPTIONS);

		// Sanity check that the two locales actually produced different
		// display text — otherwise this test would not exercise anything.
		assert.notEqual(
			english.presentation.referenceLabel,
			german.presentation.referenceLabel,
		);
		assert.equal(english.outcomeFingerprint, german.outcomeFingerprint);
	});

	// Decision 9(b): the fingerprint must describe the *final* allowlisted
	// image bytes, not the pre-processing Current Working State bytes — the
	// caller (src/lib/generate-comparison-output.ts) supplies these via the
	// `finalImages` parameter once Phase 8's Remove Embedded Location Data
	// processing has already run.
	test("reflects the final image bytes passed via finalImages, not the Current Working State's own pre-processing bytes", async () => {
		const cws = fakeCurrentWorkingState(
			{},
			{
				referenceBytes: new Uint8Array([1, 1, 1]),
				captureBytes: new Uint8Array([2, 2, 2]),
			},
		);

		const withoutOverride = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);
		const withOverride = await createOutcomeSnapshot(
			cws,
			LOCALE,
			OPTIONS,
			DEFAULT_INITIAL_SLIDER_POSITION,
			{
				referenceImageBytes: new Uint8Array([7, 7, 7]),
				captureImageBytes: new Uint8Array([8, 8, 8]),
			},
		);

		assert.deepEqual(Array.from(withOverride.referenceImageBytes), [7, 7, 7]);
		assert.deepEqual(Array.from(withOverride.captureImageBytes), [8, 8, 8]);
		assert.notEqual(
			withoutOverride.outcomeFingerprint,
			withOverride.outcomeFingerprint,
		);
	});

	test("omitting finalImages falls back to the Current Working State's own bytes unchanged, matching the pre-Phase-11 default", async () => {
		const referenceBytes = new Uint8Array([3, 3, 3]);
		const captureBytes = new Uint8Array([4, 4, 4]);
		const cws = fakeCurrentWorkingState({}, { referenceBytes, captureBytes });

		const implicit = await createOutcomeSnapshot(cws, LOCALE, OPTIONS);
		const explicit = await createOutcomeSnapshot(
			cws,
			LOCALE,
			OPTIONS,
			DEFAULT_INITIAL_SLIDER_POSITION,
			{ referenceImageBytes: referenceBytes, captureImageBytes: captureBytes },
		);

		assert.equal(implicit.outcomeFingerprint, explicit.outcomeFingerprint);
	});

	// Identity and content are orthogonal (docs/EMBED_IN_WEBSITE.md
	// "Comparison Lifecycle" only ever compares fingerprints after already
	// matching by session.id) — session.id/sessionDirectory itself must never
	// participate in the fingerprint.
	test("is independent of session.id/sessionDirectory", async () => {
		const rawAndFiles = {
			content: { title: "Same Content" },
		};
		const cwsA = fakeCurrentWorkingState(rawAndFiles);
		const cwsB = {
			...fakeCurrentWorkingState(rawAndFiles),
			sessionDirectory: "a-completely-different-session-directory",
		};

		const snapshotA = await createOutcomeSnapshot(cwsA, LOCALE, OPTIONS);
		const snapshotB = await createOutcomeSnapshot(cwsB, LOCALE, OPTIONS);

		assert.notEqual(snapshotA.session.id, snapshotB.session.id);
		assert.equal(snapshotA.outcomeFingerprint, snapshotB.outcomeFingerprint);
	});
});
