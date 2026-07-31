// Pure coverage for src/lib/workspace-state.ts: the No Workspace -> Workspace
// Active transition, and the independence of Current Working State from
// Source Data. No async, no ZIP, no browser API involved.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createWorkspace,
	DEFAULT_PRESENTATION_CONFIGURATION,
	DEFAULT_PRESENTATION_VISIBILITY,
	initialWorkspaceState,
	withCurrentWorkingState,
} from "../../src/lib/workspace-state.ts";

function fakeSourceData() {
	return {
		sessionDirectory: "2024-01-15_10-30-00",
		metadata: {
			version: 6,
			sessionId: "2024-01-15_10-30-00",
			captureTimestampMs: 1700000000000,
			referenceFile: "reference.jpg",
			captureFile: "capture.jpg",
			raw: { version: 6, nested: { value: 1 } },
		},
		files: {
			referenceBytes: new Uint8Array([1, 2, 3]),
			captureBytes: new Uint8Array([4, 5, 6]),
			referenceOriginalBytes: undefined,
			captureOriginalBytes: undefined,
			referenceSourceOriginalBytes: undefined,
			brandingHandleBytes: undefined,
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
		// "None", Corner Radius "Rounded", Show Slider Date Labels "On" —
		// same Current-Working-State-only reasoning as presentationVisibility
		// above.
		assert.deepEqual(
			cws.presentationConfiguration,
			DEFAULT_PRESENTATION_CONFIGURATION,
		);
		assert.equal(sourceData.presentationConfiguration, undefined);
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
