// Pure coverage for src/lib/workspace-state.ts: the No Workspace -> Workspace
// Active transition, and the independence of Current Working State from
// Source Data. No async, no ZIP, no browser API involved.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createWorkspace,
	DEFAULT_BRANDING_DRAFT,
	DEFAULT_PRESENTATION_CONFIGURATION,
	DEFAULT_PRESENTATION_VISIBILITY,
	initialWorkspaceState,
	withCurrentWorkingState,
} from "../../src/lib/workspace-state.ts";

function fakeSourceData({ branding, brandingHandleBytes } = {}) {
	const raw = { version: 6, nested: { value: 1 } };
	if (branding !== undefined) raw.branding = branding;
	return {
		sessionDirectory: "2024-01-15_10-30-00",
		metadata: {
			version: 6,
			sessionId: "2024-01-15_10-30-00",
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
			brandingHandleBytes,
		},
	};
}

describe("initialWorkspaceState", () => {
	test("starts as no-workspace", () => {
		assert.deepEqual(initialWorkspaceState(), { status: "no-workspace" });
	});
});

describe("createWorkspace", () => {
	test("produces an active state wrapping the given Source Data", () => {
		const sourceData = fakeSourceData();
		const state = createWorkspace(sourceData);

		assert.equal(state.status, "active");
		assert.equal(state.workspace.sourceData, sourceData);
		assert.equal(
			state.workspace.sourceData.sessionDirectory,
			"2024-01-15_10-30-00",
		);
	});

	test("Current Working State mirrors Source Data's own fields, reference-distinct, plus default presentation visibility", () => {
		const sourceData = fakeSourceData();
		const state = createWorkspace(sourceData);
		const cws = state.workspace.currentWorkingState;

		// Structurally equal to Source Data on every Source-Data-shaped field —
		// presentationVisibility is Current-Working-State-only (see
		// src/lib/workspace-state.ts) and deliberately excluded from this
		// comparison rather than expected to also exist on sourceData.
		assert.deepEqual(cws.sessionDirectory, sourceData.sessionDirectory);
		assert.deepEqual(cws.metadata, sourceData.metadata);
		assert.deepEqual(cws.files, sourceData.files);
		assert.notEqual(cws, sourceData);
		assert.notEqual(cws.files, sourceData.files);
		assert.notEqual(cws.files.referenceBytes, sourceData.files.referenceBytes);
		assert.notEqual(cws.metadata.raw, sourceData.metadata.raw);
		assert.notEqual(cws.metadata.raw.nested, sourceData.metadata.raw.nested);

		assert.deepEqual(
			cws.presentationVisibility,
			DEFAULT_PRESENTATION_VISIBILITY,
		);
		assert.equal(sourceData.presentationVisibility, undefined);

		// docs/COMPARISON_PRESENTATION.md Part 3: Background "Brand", Frame
		// "None", Corner Radius "Rounded", Text "Automatic", Show Slider Date
		// Labels "On", Font "Inter" — same Current-Working-State-only reasoning
		// as presentationVisibility above.
		assert.deepEqual(
			cws.presentationConfiguration,
			DEFAULT_PRESENTATION_CONFIGURATION,
		);
		assert.equal(sourceData.presentationConfiguration, undefined);

		// docs/IMPLEMENTATION_PLAN_V1.md Phase 8b: a fresh import defaults to
		// Inter, called out explicitly rather than relying only on the
		// DEFAULT_PRESENTATION_CONFIGURATION deep-equal above.
		assert.equal(cws.presentationConfiguration.presentationFont, "inter");

		// docs/FEATURE_SPECIFICATION.md F-004: no imported branding means no
		// remembered symbol or custom image either — same Current-Working-
		// State-only reasoning as presentationVisibility/presentationConfiguration
		// above, but see the "brandingDraft seeding" suite below for the case
		// where an import *does* carry branding.
		assert.deepEqual(cws.brandingDraft, DEFAULT_BRANDING_DRAFT);
	});

	test("mutating the Current Working State's bytes never affects Source Data", () => {
		const sourceData = fakeSourceData();
		const state = createWorkspace(sourceData);

		state.workspace.currentWorkingState.files.referenceBytes[0] = 255;

		assert.equal(sourceData.files.referenceBytes[0], 1);
	});

	test("preserves undefined optional files without inventing values", () => {
		const sourceData = fakeSourceData();
		const state = createWorkspace(sourceData);

		assert.equal(
			state.workspace.currentWorkingState.files.referenceOriginalBytes,
			undefined,
		);
		assert.equal(
			state.workspace.currentWorkingState.files.brandingHandleBytes,
			undefined,
		);
	});
});

// docs/FEATURE_SPECIFICATION.md F-004: "Importing a comparison with
// built-in symbol branding initializes the most recently selected built-in
// symbol accordingly. Importing a comparison with custom image branding
// initializes the most recently valid custom branding image accordingly."
describe("brandingDraft seeding on import", () => {
	test("a built-in branding import seeds lastBuiltinId, not lastCustomImageBytes", () => {
		const sourceData = fakeSourceData({
			branding: { type: "builtin", builtinId: "fire" },
			brandingHandleBytes: new Uint8Array([1, 2, 3]),
		});
		const state = createWorkspace(sourceData);

		assert.equal(
			state.workspace.currentWorkingState.brandingDraft.lastBuiltinId,
			"fire",
		);
		assert.equal(
			state.workspace.currentWorkingState.brandingDraft.lastCustomImageBytes,
			undefined,
		);
	});

	// docs/IMPORTED_COMPARISON_V1.md "Session Branding": "When
	// `branding.symbolColor` is absent — including every existing Android
	// export, which does not write this field — the effective color is
	// `dark`." Required test: "Import ohne Farbfelder seedet Dark".
	test("a built-in branding import with no symbolColor field seeds lastSymbolColor as 'dark'", () => {
		const sourceData = fakeSourceData({
			branding: { type: "builtin", builtinId: "fire" },
		});
		const state = createWorkspace(sourceData);

		assert.deepEqual(
			state.workspace.currentWorkingState.brandingDraft.lastSymbolColor,
			{ kind: "dark" },
		);
	});

	test("a built-in branding import with symbolColor 'brand' seeds lastSymbolColor accordingly", () => {
		const sourceData = fakeSourceData({
			branding: { type: "builtin", builtinId: "fire", symbolColor: "brand" },
		});
		const state = createWorkspace(sourceData);

		assert.deepEqual(
			state.workspace.currentWorkingState.brandingDraft.lastSymbolColor,
			{ kind: "brand" },
		);
	});

	test("a built-in branding import with a valid symbolColor 'custom' seeds the normalized hex", () => {
		const sourceData = fakeSourceData({
			branding: {
				type: "builtin",
				builtinId: "fire",
				symbolColor: "custom",
				symbolColorHex: "abcdef",
			},
		});
		const state = createWorkspace(sourceData);

		assert.deepEqual(
			state.workspace.currentWorkingState.brandingDraft.lastSymbolColor,
			{ kind: "custom", color: "#ABCDEF" },
		);
	});

	test("a built-in branding import with an invalid symbolColorHex tolerates to 'dark'", () => {
		const sourceData = fakeSourceData({
			branding: {
				type: "builtin",
				builtinId: "fire",
				symbolColor: "custom",
				symbolColorHex: "not-a-color",
			},
		});
		const state = createWorkspace(sourceData);

		assert.deepEqual(
			state.workspace.currentWorkingState.brandingDraft.lastSymbolColor,
			{ kind: "dark" },
		);
	});

	test("an image branding import seeds lastCustomImageBytes (cloned, not aliased), not lastBuiltinId", () => {
		const originalBytes = new Uint8Array([4, 5, 6]);
		const sourceData = fakeSourceData({
			branding: { type: "image" },
			brandingHandleBytes: originalBytes,
		});
		const state = createWorkspace(sourceData);
		const seeded =
			state.workspace.currentWorkingState.brandingDraft.lastCustomImageBytes;

		assert.deepEqual(seeded, originalBytes);
		assert.notEqual(seeded, originalBytes);
		assert.equal(
			state.workspace.currentWorkingState.brandingDraft.lastBuiltinId,
			undefined,
		);
	});

	test("an unrecognized imported builtinId seeds an undefined lastBuiltinId, tolerantly", () => {
		const sourceData = fakeSourceData({
			branding: { type: "builtin", builtinId: "future-symbol" },
		});
		const state = createWorkspace(sourceData);

		assert.equal(
			state.workspace.currentWorkingState.brandingDraft.lastBuiltinId,
			undefined,
		);
	});

	test("no imported branding leaves brandingDraft at its defaults", () => {
		const sourceData = fakeSourceData();
		const state = createWorkspace(sourceData);

		assert.deepEqual(
			state.workspace.currentWorkingState.brandingDraft,
			DEFAULT_BRANDING_DRAFT,
		);
	});
});

describe("withCurrentWorkingState", () => {
	test("replaces only currentWorkingState, leaving sourceData untouched", () => {
		const sourceData = fakeSourceData();
		const state = createWorkspace(sourceData);
		const edited = {
			...state.workspace.currentWorkingState,
			presentationVisibility: {
				...state.workspace.currentWorkingState.presentationVisibility,
				description: true,
			},
		};

		const nextWorkspace = withCurrentWorkingState(state.workspace, edited);

		assert.equal(nextWorkspace.sourceData, state.workspace.sourceData);
		assert.equal(nextWorkspace.currentWorkingState, edited);
		assert.equal(nextWorkspace.sourceData.presentationVisibility, undefined);
	});
});
