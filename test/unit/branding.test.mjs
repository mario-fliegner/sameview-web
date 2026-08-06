// Coverage for src/lib/branding.ts against docs/FEATURE_SPECIFICATION.md
// F-004 (Configure Comparison Branding) and docs/IMPORTED_COMPARISON_V1.md
// "Session Branding": the None/Built-in Symbol/Custom Image transitions,
// Source Data independence, and — the single most load-bearing behavior of
// this module — that a freshly chosen web symbol always renders as the
// shared vector registry, never as a stale imported raster asset. Pure,
// deterministic logic — no browser API — so this belongs in the Node unit
// suite, not Playwright.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	applyBrandingImage,
	applyBrandingNone,
	applyBrandingSymbol,
	getBrandingBuiltinId,
	getBrandingType,
	resolveHandleBranding,
} from "../../src/lib/branding.ts";
import {
	DEFAULT_PRESENTATION_CONFIGURATION,
	DEFAULT_PRESENTATION_VISIBILITY,
} from "../../src/lib/workspace-state.ts";

function fakeCurrentWorkingState(raw = {}, filesPatch = {}) {
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
	};
}

describe("getBrandingType", () => {
	test("no branding block is 'none'", () => {
		assert.equal(getBrandingType(fakeCurrentWorkingState()), "none");
	});

	test("reads branding.type when it is 'builtin' or 'image'", () => {
		assert.equal(
			getBrandingType(
				fakeCurrentWorkingState({ branding: { type: "builtin" } }),
			),
			"builtin",
		);
		assert.equal(
			getBrandingType(fakeCurrentWorkingState({ branding: { type: "image" } })),
			"image",
		);
	});

	test("an unrecognized branding.type is tolerated as 'none'", () => {
		assert.equal(
			getBrandingType(
				fakeCurrentWorkingState({ branding: { type: "future-type" } }),
			),
			"none",
		);
		assert.equal(
			getBrandingType(fakeCurrentWorkingState({ branding: "not-an-object" })),
			"none",
		);
	});
});

describe("getBrandingBuiltinId", () => {
	test("reads a recognized builtinId", () => {
		assert.equal(
			getBrandingBuiltinId(
				fakeCurrentWorkingState({
					branding: { type: "builtin", builtinId: "fire" },
				}),
			),
			"fire",
		);
	});

	test("returns undefined for a missing or unrecognized builtinId", () => {
		assert.equal(
			getBrandingBuiltinId(
				fakeCurrentWorkingState({ branding: { type: "builtin" } }),
			),
			undefined,
		);
		assert.equal(
			getBrandingBuiltinId(
				fakeCurrentWorkingState({
					branding: { type: "builtin", builtinId: "future-symbol" },
				}),
			),
			undefined,
		);
	});
});

describe("applyBrandingNone", () => {
	test("removes the branding block and any branding asset", () => {
		const cws = fakeCurrentWorkingState(
			{ branding: { type: "image" }, other: "kept" },
			{ brandingHandleBytes: new Uint8Array([9, 9]) },
		);
		const next = applyBrandingNone(cws);

		assert.equal(getBrandingType(next), "none");
		assert.equal(next.files.brandingHandleBytes, undefined);
		// Every other known and unknown field is preserved.
		assert.equal(next.metadata.raw.other, "kept");
	});

	test("does not mutate Source Data (Source Data is not part of this module's contract, but the input object itself must stay untouched)", () => {
		const raw = { branding: { type: "image" } };
		const cws = fakeCurrentWorkingState(raw, {
			brandingHandleBytes: new Uint8Array([9, 9]),
		});
		applyBrandingNone(cws);

		assert.equal(cws.metadata.raw.branding.type, "image");
		assert.notEqual(cws.files.brandingHandleBytes, undefined);
	});
});

describe("applyBrandingSymbol", () => {
	test("sets branding.type/builtinId and clears any branding asset", () => {
		const cws = fakeCurrentWorkingState(
			{ branding: { type: "image" } },
			{ brandingHandleBytes: new Uint8Array([1]) },
		);
		const next = applyBrandingSymbol(cws, "star");

		assert.equal(getBrandingType(next), "builtin");
		assert.equal(getBrandingBuiltinId(next), "star");
		assert.equal(next.files.brandingHandleBytes, undefined);
	});

	// The crux of the whole feature: re-selecting the very same id an import
	// already carried a raster asset for must still clear that asset, so the
	// Handle switches from the imported PNG to the shared vector registry —
	// otherwise a fresh web selection could be silently indistinguishable
	// from an untouched import.
	test("clears an already-imported branding asset even when re-selecting the same builtinId", () => {
		const cws = fakeCurrentWorkingState(
			{ branding: { type: "builtin", builtinId: "star" } },
			{ brandingHandleBytes: new Uint8Array([1, 2, 3]) },
		);
		const next = applyBrandingSymbol(cws, "star");

		assert.equal(next.files.brandingHandleBytes, undefined);
		assert.deepEqual(resolveHandleBranding(next), {
			kind: "symbol",
			builtinId: "star",
		});
	});
});

describe("applyBrandingImage", () => {
	test("sets branding.type to 'image' and stores the given bytes", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "heart" },
		});
		const bytes = new Uint8Array([5, 6, 7]);
		const next = applyBrandingImage(cws, bytes);

		assert.equal(getBrandingType(next), "image");
		assert.equal(getBrandingBuiltinId(next), undefined);
		assert.equal(next.files.brandingHandleBytes, bytes);
	});
});

describe("resolveHandleBranding", () => {
	test("no branding block resolves to 'none'", () => {
		assert.deepEqual(resolveHandleBranding(fakeCurrentWorkingState()), {
			kind: "none",
		});
	});

	test("type 'image' with bytes present resolves to 'asset'", () => {
		const cws = fakeCurrentWorkingState(
			{ branding: { type: "image" } },
			{ brandingHandleBytes: new Uint8Array([1]) },
		);
		assert.deepEqual(resolveHandleBranding(cws), { kind: "asset" });
	});

	test("type 'image' without bytes (inconsistent import) resolves to 'none'", () => {
		const cws = fakeCurrentWorkingState({ branding: { type: "image" } });
		assert.deepEqual(resolveHandleBranding(cws), { kind: "none" });
	});

	test("type 'builtin' with an imported asset resolves to 'asset', not 'symbol'", () => {
		const cws = fakeCurrentWorkingState(
			{ branding: { type: "builtin", builtinId: "star" } },
			{ brandingHandleBytes: new Uint8Array([1]) },
		);
		assert.deepEqual(resolveHandleBranding(cws), { kind: "asset" });
	});

	test("type 'builtin' without an asset resolves to 'symbol' with the builtinId", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "fire" },
		});
		assert.deepEqual(resolveHandleBranding(cws), {
			kind: "symbol",
			builtinId: "fire",
		});
	});

	test("type 'builtin' with neither an asset nor a recognized builtinId resolves to 'none'", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "future-symbol" },
		});
		assert.deepEqual(resolveHandleBranding(cws), { kind: "none" });
	});
});
