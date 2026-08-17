// Pure F-004 transitions (docs/FEATURE_SPECIFICATION.md F-004 "Configure
// Comparison Branding"; docs/IMPORTED_COMPARISON_V1.md "Session Branding").
// No React, no DOM.
//
// `branding.type`/`branding.builtinId` have a documented Source Data
// counterpart (unlike `presentationVisibility`/`presentationConfiguration`
// in src/lib/workspace-state.ts, which explicitly do not) — so, exactly
// like Title/Description/Location in src/lib/comparison-edit.ts, edits
// target the corresponding field directly inside a cloned `metadata.raw`,
// never a separate duplicated model. Kept as its own module rather than
// folded into comparison-edit.ts because that module's own header comment
// explicitly scopes it to F-003.
//
// `files.brandingHandleBytes` is the one piece of Branding state with no
// `metadata.raw` representation (it is a sibling in `files`, exactly like
// `referenceBytes`/`captureBytes`) — every `apply*` function below keeps
// both in sync in one place, which is the whole reason this module exists
// rather than leaving raw/files patches to scattered call sites.

import {
	type BuiltinSymbolId,
	isBuiltinSymbolId,
} from "./builtin-branding-symbols.ts";
import {
	SYMBOL_COLOR,
	SYMBOL_COLOR_BRAND,
} from "./comparison-handle-geometry.ts";
import { normalizeHexColor } from "./hex-color.ts";
import type {
	BrandingDraft,
	BrandingSymbolColor,
	CurrentWorkingState,
} from "./workspace-state.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type BrandingType = "none" | "builtin" | "image";

// docs/IMPORTED_COMPARISON_V1.md: "`branding.type` is `builtin` or `image`."
// Absent, malformed or any other value is treated as no branding — the same
// tolerant reading already documented there for a mismatched
// `files.brandingHandle`/`branding` pair.
export function getBrandingType(cws: CurrentWorkingState): BrandingType {
	const block = cws.metadata.raw.branding;
	if (!isPlainObject(block)) return "none";
	return block.type === "builtin" || block.type === "image"
		? block.type
		: "none";
}

export function getBrandingBuiltinId(
	cws: CurrentWorkingState,
): BuiltinSymbolId | undefined {
	const block = cws.metadata.raw.branding;
	if (!isPlainObject(block)) return undefined;
	const id = block.builtinId;
	return typeof id === "string" && isBuiltinSymbolId(id) ? id : undefined;
}

// docs/IMPORTED_COMPARISON_V1.md "Session Branding": "`branding.symbolColor`
// is `dark`, `brand` or `custom`... When `branding.symbolColor` is absent...
// the effective color is `dark`." A `"custom"` claim with a missing or
// invalid `symbolColorHex` (re-validated through the same `normalizeHexColor`
// every other Custom Color control uses) tolerates the same way, per that
// document's own rule that this must never produce an invalid render state.
// Reads only the *active* branding block — never `brandingDraft` — so this
// is the single source of truth while a Built-in Symbol is active; see
// `applyBrandingSymbol` below for the one place `brandingDraft.lastSymbolColor`
// is ever read.
export function getBrandingSymbolColor(
	cws: CurrentWorkingState,
): BrandingSymbolColor {
	const block = cws.metadata.raw.branding;
	if (!isPlainObject(block)) return { kind: "dark" };
	if (block.symbolColor === "brand") return { kind: "brand" };
	if (block.symbolColor === "custom") {
		const hex = block.symbolColorHex;
		const normalized =
			typeof hex === "string" ? normalizeHexColor(hex) : undefined;
		if (normalized) return { kind: "custom", color: normalized };
	}
	return { kind: "dark" };
}

function withBranding(
	cws: CurrentWorkingState,
	branding: Record<string, unknown> | undefined,
	brandingHandleBytes: Uint8Array | undefined,
	brandingDraft: BrandingDraft,
): CurrentWorkingState {
	const nextRaw = { ...cws.metadata.raw };
	if (branding === undefined) delete nextRaw.branding;
	else nextRaw.branding = branding;
	return {
		...cws,
		metadata: { ...cws.metadata, raw: nextRaw },
		files: { ...cws.files, brandingHandleBytes },
		brandingDraft,
	};
}

// docs/FEATURE_SPECIFICATION.md F-004: "Selecting No Branding deactivates
// the active branding immediately, without discarding the most recently
// selected built-in symbol or the most recently valid custom branding
// image." — `brandingDraft` is passed through unchanged, never cleared.
export function applyBrandingNone(
	cws: CurrentWorkingState,
): CurrentWorkingState {
	return withBranding(cws, undefined, undefined, cws.brandingDraft);
}

// A fresh symbol selection made in SameView Web clears any previously
// imported `brandingHandleBytes` (docs/IMPORTED_COMPARISON_V1.md "Session
// Branding" F-004 addendum: a newly selected built-in symbol is rendered
// from the shared registry, never from a raster asset) — including a
// selection reached via a detour through another symbol, None or Custom
// Image, so `resolveHandleBranding` below can tell "imported, still has its
// PNG" apart from "freshly chosen in the browser" without a separate flag.
//
// The one exception is the guard immediately below: re-selecting the exact
// `builtinId` that is *already* the active, still-asset-backed branding is
// not a "fresh" selection at all — nothing about the effective branding
// would change — so it is a true no-op rather than a second, indistinguishable
// path to the same "clear the asset" outcome. This still relies solely on
// already-existing state (`getBrandingType`/`getBrandingBuiltinId`/
// `files.brandingHandleBytes`), so the "tell imported apart from freshly
// chosen without a separate flag" property above is unaffected: the moment
// *any* other symbol, None or Custom Image becomes active in between, the
// asset is cleared exactly as before and this guard can never fire again for
// that `builtinId`, imported or not.
//
// Also records `builtinId` into `brandingDraft.lastBuiltinId` (docs/FEATURE_SPECIFICATION.md
// F-004: a click "activates it and" the retained memory "remembers the id")
// — `lastCustomImageBytes` is carried through unchanged, never cleared by a
// symbol selection.
//
// The newly active `symbolColor`/`symbolColorHex` is seeded from
// `brandingDraft.lastSymbolColor` — this is the one and only place that
// remembered value is ever read (docs/IMPORTED_COMPARISON_V1.md "Session
// Branding": "The configured color belongs to the built-in branding as a
// whole... selecting a different built-in symbol... preserves the currently
// configured `branding.symbolColor`/`branding.symbolColorHex`"). This single
// rule uniformly covers both required cases: a direct symbol-to-symbol
// switch (where `lastSymbolColor` was already kept in sync by
// `applyBrandingSymbolColor` below, so it equals the just-active color) and
// a switch back from None/Custom Image (where the active `branding` block
// was replaced or removed in between, but `lastSymbolColor` was never
// touched — see `applyBrandingNone`/`applyBrandingImage`, both of which pass
// `brandingDraft` through unchanged or spread it). `lastSymbolColor` itself
// is carried through unchanged here — it already equals the value being
// (re)applied.
export function applyBrandingSymbol(
	cws: CurrentWorkingState,
	builtinId: BuiltinSymbolId,
): CurrentWorkingState {
	// Re-selecting the exact symbol an import (or an earlier explicit
	// selection) already left active, while its raster asset is still
	// present, changes nothing observable — same convention as
	// `applyBrandingSymbolColor` below's own no-op guard: return `cws`
	// unchanged rather than manufacture an equivalent-but-different object.
	if (
		getBrandingType(cws) === "builtin" &&
		getBrandingBuiltinId(cws) === builtinId &&
		cws.files.brandingHandleBytes
	) {
		return cws;
	}

	const color = cws.brandingDraft.lastSymbolColor;
	const branding: Record<string, unknown> = {
		type: "builtin",
		builtinId,
		updatedAtMs: Date.now(),
		symbolColor: color.kind,
	};
	if (color.kind === "custom") branding.symbolColorHex = color.color;
	return withBranding(cws, branding, undefined, {
		...cws.brandingDraft,
		lastBuiltinId: builtinId,
	});
}

// Changes only `symbolColor`/`symbolColorHex` on the currently active
// built-in branding. `builtinId` and every other known field on the block
// are preserved via the `...block` spread below — a color change must never
// itself move to a different symbol. `files.brandingHandleBytes` is passed through exactly
// as it already is (always `undefined` in every state this is reachable
// from — the Color group is only ever shown while `resolveHandleBranding`
// already reports `"symbol"`, see src/components/BrandingSection.tsx) —
// never generated, regenerated or otherwise touched. Also updates
// `brandingDraft.lastSymbolColor`, kept in sync with the active value here
// for the identical reason `applyBrandingImage` above keeps `files.
// brandingHandleBytes` and `brandingDraft.lastCustomImageBytes` in sync: no
// second, independently drifting copy.
//
// A no-op (returns `cws` unchanged) if no built-in branding is currently
// active — defensive only; the UI never calls this outside that state.
export function applyBrandingSymbolColor(
	cws: CurrentWorkingState,
	color: BrandingSymbolColor,
): CurrentWorkingState {
	const block = cws.metadata.raw.branding;
	if (!isPlainObject(block) || block.type !== "builtin") return cws;
	const nextBranding: Record<string, unknown> = {
		...block,
		updatedAtMs: Date.now(),
		symbolColor: color.kind,
	};
	if (color.kind === "custom") nextBranding.symbolColorHex = color.color;
	else delete nextBranding.symbolColorHex;
	return withBranding(cws, nextBranding, cws.files.brandingHandleBytes, {
		...cws.brandingDraft,
		lastSymbolColor: color,
	});
}

// Records `bytes` into `brandingDraft.lastCustomImageBytes` alongside
// activating them (docs/FEATURE_SPECIFICATION.md F-004: "A valid upload
// activates and remembers the new image") — `lastBuiltinId` is carried
// through unchanged. `files.brandingHandleBytes` and
// `brandingDraft.lastCustomImageBytes` are assigned the exact same
// reference below, by construction — never two independently produced
// byte sequences that could drift apart.
//
// Callers must only invoke this with an already-normalized, final branding
// asset:
// - a fresh Web upload: src/components/BrandingSection.tsx normalizes it
//   via src/lib/branding-image-normalize.ts's `normalizeBrandingImage`
//   before calling this function; an invalid or unnormalizable upload must
//   never reach this function, which is what keeps both the active
//   branding and the remembered image untouched on failure.
// - reactivating a previously normalized or imported image (from
//   `brandingDraft.lastCustomImageBytes`): passed through unchanged, never
//   re-decoded, re-scaled or re-encoded — see this module's own header for
//   why this stays a pure state transition with no image processing of its
//   own.
export function applyBrandingImage(
	cws: CurrentWorkingState,
	bytes: Uint8Array,
): CurrentWorkingState {
	return withBranding(cws, { type: "image", updatedAtMs: Date.now() }, bytes, {
		...cws.brandingDraft,
		lastCustomImageBytes: bytes,
	});
}

export type HandleBranding =
	| { readonly kind: "none" }
	| { readonly kind: "asset" }
	| {
			readonly kind: "symbol";
			readonly builtinId: BuiltinSymbolId;
			// Already-resolved concrete `#RRGGBB` — never "dark"/"brand"/"custom"
			// itself (docs/COMPARISON_PRESENTATION.md Part 2 "Handle"; this is the
			// one place that semantic-to-concrete resolution happens, exactly
			// mirroring how src/components/WorkspaceActive.tsx resolves Text's
			// own Automatic/Light/Dark/Custom for the same reason: the renderer
			// — src/components/ComparisonSliderHandle.tsx — must never make a
			// semantic color decision itself, only paint an already-resolved
			// value).
			readonly color: string;
	  };

function resolveSymbolColorHex(color: BrandingSymbolColor): string {
	switch (color.kind) {
		case "dark":
			return SYMBOL_COLOR;
		case "brand":
			return SYMBOL_COLOR_BRAND;
		case "custom":
			return color.color;
	}
}

// The single place that decides Raster-vs-Vektor-vs-none for the Handle
// (docs/COMPARISON_PRESENTATION.md Part 2 "Handle"). An imported built-in
// branding is displayed via its existing `branding-handle.png`
// (`files.brandingHandleBytes`) for as long as that asset is still present;
// a freshly chosen symbol (which never has an asset — see
// `applyBrandingSymbol` above) falls back to the shared registry instead.
// Any other inconsistency (`type` present without a usable asset or a
// recognized `builtinId`) resolves to "none", the same tolerant behavior
// docs/IMPORTED_COMPARISON_V1.md already documents for the Android reader.
//
// Reads `getBrandingSymbolColor` — the *active* branding block — for the
// `"symbol"` case's resolved color, never `brandingDraft`: the remembered
// color only ever feeds back into the active truth at the moment of an
// explicit symbol-tile click (`applyBrandingSymbol`), so a change to
// `brandingDraft` alone (which never happens outside that function and
// `applyBrandingSymbolColor`) can never, by construction, change what this
// function returns.
export function resolveHandleBranding(
	cws: CurrentWorkingState,
): HandleBranding {
	const type = getBrandingType(cws);
	if (type === "image") {
		return cws.files.brandingHandleBytes ? { kind: "asset" } : { kind: "none" };
	}
	if (type === "builtin") {
		if (cws.files.brandingHandleBytes) return { kind: "asset" };
		const builtinId = getBrandingBuiltinId(cws);
		if (!builtinId) return { kind: "none" };
		return {
			kind: "symbol",
			builtinId,
			color: resolveSymbolColorHex(getBrandingSymbolColor(cws)),
		};
	}
	return { kind: "none" };
}
