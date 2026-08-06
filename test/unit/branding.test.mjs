// Coverage for src/lib/branding.ts against docs/FEATURE_SPECIFICATION.md
// F-004 (Configure Comparison Branding) and docs/IMPORTED_COMPARISON_V1.md
// "Session Branding": the None/Built-in Symbol/Custom Image transitions,
// Source Data independence, the Built-in Symbol Color option (Dark/Brand/
// Custom, docs/APPLICATION_LAYOUT.md "Branding" → "Color"), and — the
// single most load-bearing behavior of this module — that a freshly chosen
// web symbol always renders as the shared vector registry, never as a
// stale imported raster asset. Pure, deterministic logic — no browser API
// — so this belongs in the Node unit suite, not Playwright.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	applyBrandingImage,
	applyBrandingNone,
	applyBrandingSymbol,
	applyBrandingSymbolColor,
	getBrandingBuiltinId,
	getBrandingSymbolColor,
	getBrandingType,
	resolveHandleBranding,
} from "../../src/lib/branding.ts";
import {
	DEFAULT_BRANDING_DRAFT,
	DEFAULT_PRESENTATION_CONFIGURATION,
	DEFAULT_PRESENTATION_VISIBILITY,
} from "../../src/lib/workspace-state.ts";

function fakeCurrentWorkingState(
	raw = {},
	filesPatch = {},
	brandingDraft = {},
) {
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
		brandingDraft: { ...DEFAULT_BRANDING_DRAFT, ...brandingDraft },
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

// docs/IMPORTED_COMPARISON_V1.md "Session Branding": `branding.symbolColor`/
// `symbolColorHex` semantics — absent/invalid always tolerates to "dark",
// never an invalid render state.
describe("getBrandingSymbolColor", () => {
	test("no branding block is 'dark'", () => {
		assert.deepEqual(getBrandingSymbolColor(fakeCurrentWorkingState()), {
			kind: "dark",
		});
	});

	test("missing symbolColor on a builtin block is 'dark' (existing Android exports)", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "star" },
		});
		assert.deepEqual(getBrandingSymbolColor(cws), { kind: "dark" });
	});

	test("reads 'brand'", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "star", symbolColor: "brand" },
		});
		assert.deepEqual(getBrandingSymbolColor(cws), { kind: "brand" });
	});

	test("reads 'custom' with a valid symbolColorHex, normalized", () => {
		const cws = fakeCurrentWorkingState({
			branding: {
				type: "builtin",
				builtinId: "star",
				symbolColor: "custom",
				symbolColorHex: "ff00aa",
			},
		});
		assert.deepEqual(getBrandingSymbolColor(cws), {
			kind: "custom",
			color: "#FF00AA",
		});
	});

	test("'custom' with a missing symbolColorHex tolerates to 'dark'", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "star", symbolColor: "custom" },
		});
		assert.deepEqual(getBrandingSymbolColor(cws), { kind: "dark" });
	});

	test("'custom' with an invalid symbolColorHex tolerates to 'dark'", () => {
		const cws = fakeCurrentWorkingState({
			branding: {
				type: "builtin",
				builtinId: "star",
				symbolColor: "custom",
				symbolColorHex: "not-a-color",
			},
		});
		assert.deepEqual(getBrandingSymbolColor(cws), { kind: "dark" });
	});

	test("an unrecognized symbolColor value tolerates to 'dark'", () => {
		const cws = fakeCurrentWorkingState({
			branding: {
				type: "builtin",
				builtinId: "star",
				symbolColor: "future-color",
			},
		});
		assert.deepEqual(getBrandingSymbolColor(cws), { kind: "dark" });
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

	// docs/FEATURE_SPECIFICATION.md F-004: "Selecting No Branding deactivates
	// the active branding immediately, without discarding the most recently
	// selected built-in symbol or the most recently valid custom branding
	// image." — now also covers the remembered Built-in Symbol color
	// (docs/IMPORTED_COMPARISON_V1.md "Session Branding": "None deactivates
	// Branding, verwirft die gemerkte Symbolfarbe aber nicht").
	test("leaves brandingDraft (the remembered symbol id, custom image and symbol color) unchanged", () => {
		const draft = {
			lastBuiltinId: "fire",
			lastCustomImageBytes: new Uint8Array([7, 8, 9]),
			lastSymbolColor: { kind: "brand" },
		};
		const cws = fakeCurrentWorkingState(
			{ branding: { type: "image" } },
			{ brandingHandleBytes: new Uint8Array([9, 9]) },
			draft,
		);
		const next = applyBrandingNone(cws);

		assert.deepEqual(next.brandingDraft, draft);
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
			color: "#17202F",
		});
	});

	// docs/FEATURE_SPECIFICATION.md F-004: "A click activates it and the
	// retained memory remembers the id."
	test("records the builtinId into brandingDraft.lastBuiltinId, leaving lastCustomImageBytes untouched", () => {
		const existingCustomBytes = new Uint8Array([4, 4, 4]);
		const cws = fakeCurrentWorkingState(
			{},
			{},
			{
				lastBuiltinId: "heart",
				lastCustomImageBytes: existingCustomBytes,
			},
		);
		const next = applyBrandingSymbol(cws, "fire");

		assert.equal(next.brandingDraft.lastBuiltinId, "fire");
		assert.equal(next.brandingDraft.lastCustomImageBytes, existingCustomBytes);
	});

	// docs/IMPORTED_COMPARISON_V1.md "Session Branding": "The configured color
	// belongs to the built-in branding as a whole... selecting a different
	// built-in symbol... preserves the currently configured
	// `branding.symbolColor`/`branding.symbolColorHex`."
	test("a direct symbol-to-symbol switch (Heart -> Star -> Fire) keeps the currently active color", () => {
		let cws = fakeCurrentWorkingState();
		cws = applyBrandingSymbol(cws, "heart");
		cws = applyBrandingSymbolColor(cws, { kind: "brand" });
		cws = applyBrandingSymbol(cws, "star");
		cws = applyBrandingSymbol(cws, "fire");

		assert.equal(getBrandingBuiltinId(cws), "fire");
		assert.deepEqual(getBrandingSymbolColor(cws), { kind: "brand" });
	});

	test("no color configured yet defaults the newly active symbolColor to 'dark'", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyBrandingSymbol(cws, "pin");

		assert.deepEqual(getBrandingSymbolColor(next), { kind: "dark" });
		assert.equal(next.metadata.raw.branding.symbolColor, "dark");
	});

	// Required test: "Custom-Farbe bleibt über Symbol -> None -> Symbol
	// erhalten" — the remembered color is seeded from brandingDraft on the
	// next explicit tile click, even though the active branding block was
	// fully cleared by applyBrandingNone in between.
	test("a Custom color survives a Symbol -> None -> Symbol detour", () => {
		let cws = fakeCurrentWorkingState();
		cws = applyBrandingSymbol(cws, "heart");
		cws = applyBrandingSymbolColor(cws, { kind: "custom", color: "#123ABC" });
		cws = applyBrandingNone(cws);
		assert.equal(getBrandingType(cws), "none");

		cws = applyBrandingSymbol(cws, "star");

		assert.deepEqual(getBrandingSymbolColor(cws), {
			kind: "custom",
			color: "#123ABC",
		});
		assert.equal(getBrandingBuiltinId(cws), "star");
	});

	// Required test: "Custom-Farbe bleibt über Symbol -> Custom Image ->
	// Symbol erhalten".
	test("a Custom color survives a Symbol -> Custom Image -> Symbol detour", () => {
		let cws = fakeCurrentWorkingState();
		cws = applyBrandingSymbol(cws, "heart");
		cws = applyBrandingSymbolColor(cws, { kind: "custom", color: "#00FF00" });
		cws = applyBrandingImage(cws, new Uint8Array([1, 2, 3]));
		assert.equal(getBrandingType(cws), "image");

		cws = applyBrandingSymbol(cws, "fire");

		assert.deepEqual(getBrandingSymbolColor(cws), {
			kind: "custom",
			color: "#00FF00",
		});
	});

	// Required test: "Brand bleibt über denselben Wechsel erhalten" — the
	// same None/Custom Image detours, for the non-custom "brand" color.
	test("Brand survives a Symbol -> None -> Symbol detour", () => {
		let cws = fakeCurrentWorkingState();
		cws = applyBrandingSymbol(cws, "heart");
		cws = applyBrandingSymbolColor(cws, { kind: "brand" });
		cws = applyBrandingNone(cws);

		cws = applyBrandingSymbol(cws, "camera");

		assert.deepEqual(getBrandingSymbolColor(cws), { kind: "brand" });
	});

	test("Brand survives a Symbol -> Custom Image -> Symbol detour", () => {
		let cws = fakeCurrentWorkingState();
		cws = applyBrandingSymbol(cws, "heart");
		cws = applyBrandingSymbolColor(cws, { kind: "brand" });
		cws = applyBrandingImage(cws, new Uint8Array([9, 9, 9]));

		cws = applyBrandingSymbol(cws, "camera");

		assert.deepEqual(getBrandingSymbolColor(cws), { kind: "brand" });
	});
});

describe("applyBrandingSymbolColor", () => {
	test("changes only symbolColor/symbolColorHex, preserving builtinId", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "pin" },
		});
		const next = applyBrandingSymbolColor(cws, { kind: "brand" });

		assert.equal(getBrandingBuiltinId(next), "pin");
		assert.deepEqual(getBrandingSymbolColor(next), { kind: "brand" });
	});

	test("stores a normalized custom hex", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "pin" },
		});
		const next = applyBrandingSymbolColor(cws, {
			kind: "custom",
			color: "#AABBCC",
		});

		assert.equal(next.metadata.raw.branding.symbolColor, "custom");
		assert.equal(next.metadata.raw.branding.symbolColorHex, "#AABBCC");
	});

	test("never touches files.brandingHandleBytes", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "pin" },
		});
		const next = applyBrandingSymbolColor(cws, { kind: "brand" });

		assert.equal(next.files.brandingHandleBytes, undefined);
	});

	test("updates brandingDraft.lastSymbolColor to match the newly active color", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "pin" },
		});
		const next = applyBrandingSymbolColor(cws, {
			kind: "custom",
			color: "#112233",
		});

		assert.deepEqual(next.brandingDraft.lastSymbolColor, {
			kind: "custom",
			color: "#112233",
		});
	});

	test("is a no-op when no built-in branding is currently active", () => {
		const cws = fakeCurrentWorkingState({ branding: { type: "image" } });
		const next = applyBrandingSymbolColor(cws, { kind: "brand" });

		assert.equal(next, cws);
	});

	// docs/IMPORTED_COMPARISON_V1.md "Session Branding": a color change never
	// touches the raster asset — checked explicitly even though the UI only
	// ever calls this while no raster asset is active, so this documents the
	// guarantee at the state-transition level too, independent of the UI.
	test("does not regenerate or modify any branding image", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "pin" },
		});
		const before = cws.files.brandingHandleBytes;
		const next = applyBrandingSymbolColor(cws, { kind: "brand" });

		assert.equal(next.files.brandingHandleBytes, before);
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

	// docs/FEATURE_SPECIFICATION.md F-004: "A valid upload activates and
	// remembers the new image."
	test("records the bytes into brandingDraft.lastCustomImageBytes, leaving lastBuiltinId and lastSymbolColor untouched", () => {
		const cws = fakeCurrentWorkingState(
			{},
			{},
			{ lastBuiltinId: "pin", lastSymbolColor: { kind: "brand" } },
		);
		const bytes = new Uint8Array([1, 2, 3, 4]);
		const next = applyBrandingImage(cws, bytes);

		assert.equal(next.brandingDraft.lastCustomImageBytes, bytes);
		assert.equal(next.brandingDraft.lastBuiltinId, "pin");
		assert.deepEqual(next.brandingDraft.lastSymbolColor, { kind: "brand" });
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

	test("type 'builtin' without an asset resolves to 'symbol' with the builtinId and the resolved Dark color", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "fire" },
		});
		assert.deepEqual(resolveHandleBranding(cws), {
			kind: "symbol",
			builtinId: "fire",
			color: "#17202F",
		});
	});

	test("type 'builtin' with neither an asset nor a recognized builtinId resolves to 'none'", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "future-symbol" },
		});
		assert.deepEqual(resolveHandleBranding(cws), { kind: "none" });
	});

	test("resolves 'brand' to the exact Brand Accent Color", () => {
		const cws = fakeCurrentWorkingState({
			branding: { type: "builtin", builtinId: "fire", symbolColor: "brand" },
		});
		assert.deepEqual(resolveHandleBranding(cws), {
			kind: "symbol",
			builtinId: "fire",
			color: "#4F8CFF",
		});
	});

	test("resolves 'custom' to the stored normalized hex", () => {
		const cws = fakeCurrentWorkingState({
			branding: {
				type: "builtin",
				builtinId: "fire",
				symbolColor: "custom",
				symbolColorHex: "#010203",
			},
		});
		assert.deepEqual(resolveHandleBranding(cws), {
			kind: "symbol",
			builtinId: "fire",
			color: "#010203",
		});
	});

	// Required test: "Farb-Draft beeinflusst das Rendering niemals direkt" —
	// a brandingDraft.lastSymbolColor that disagrees with the active
	// metadata.raw.branding.symbolColor must never leak into the resolved
	// Handle color.
	test("brandingDraft.lastSymbolColor never influences the resolved color directly", () => {
		const cws = fakeCurrentWorkingState(
			{
				branding: { type: "builtin", builtinId: "fire", symbolColor: "brand" },
			},
			{},
			{ lastSymbolColor: { kind: "custom", color: "#ABCDEF" } },
		);
		assert.deepEqual(resolveHandleBranding(cws), {
			kind: "symbol",
			builtinId: "fire",
			color: "#4F8CFF",
		});
	});
});
