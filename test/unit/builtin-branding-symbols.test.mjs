// Coverage for src/lib/builtin-branding-symbols.ts: the fixed six-symbol
// catalog (docs/IMPLEMENTATION_PLAN_V1.md Phase 6 "the built-in symbol
// catalog ... is decided") and its lookup API. Pure, deterministic — no
// browser API — so this belongs in the Node unit suite.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	BUILTIN_BRANDING_SYMBOLS,
	getBuiltinBrandingSymbol,
	isBuiltinSymbolId,
} from "../../src/lib/builtin-branding-symbols.ts";

const EXPECTED_IDS = ["heart", "star", "camera", "home", "pin", "fire"];

describe("BUILTIN_BRANDING_SYMBOLS", () => {
	test("contains exactly the six Android-adopted builtinId values, in order", () => {
		assert.deepEqual(
			BUILTIN_BRANDING_SYMBOLS.map((symbol) => symbol.id),
			EXPECTED_IDS,
		);
	});

	test("every symbol has real path data and positive viewBox dimensions", () => {
		for (const symbol of BUILTIN_BRANDING_SYMBOLS) {
			assert.equal(typeof symbol.pathData, "string");
			assert.ok(symbol.pathData.length > 0, `${symbol.id} has empty pathData`);
			assert.ok(
				symbol.viewBoxWidth > 0,
				`${symbol.id} has non-positive viewBoxWidth`,
			);
			assert.ok(
				symbol.viewBoxHeight > 0,
				`${symbol.id} has non-positive viewBoxHeight`,
			);
		}
	});
});

describe("getBuiltinBrandingSymbol", () => {
	test("resolves each of the six known ids to its own definition", () => {
		for (const id of EXPECTED_IDS) {
			const symbol = getBuiltinBrandingSymbol(id);
			assert.ok(symbol, `expected a definition for "${id}"`);
			assert.equal(symbol.id, id);
		}
	});

	test("returns undefined for an unrecognized id", () => {
		assert.equal(getBuiltinBrandingSymbol("unknown-symbol"), undefined);
		assert.equal(getBuiltinBrandingSymbol(""), undefined);
		// Confirms the catalog is exactly the six adopted Android ids, not a
		// superset that happens to also include a plausible-looking seventh.
		assert.equal(getBuiltinBrandingSymbol("flag"), undefined);
	});
});

describe("isBuiltinSymbolId", () => {
	test("accepts exactly the six known ids", () => {
		for (const id of EXPECTED_IDS) {
			assert.equal(isBuiltinSymbolId(id), true);
		}
	});

	test("rejects anything else", () => {
		assert.equal(isBuiltinSymbolId("unknown-symbol"), false);
		assert.equal(isBuiltinSymbolId(""), false);
	});
});
