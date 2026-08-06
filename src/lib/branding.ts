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
import type { CurrentWorkingState } from "./workspace-state.ts";

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

function withBranding(
	cws: CurrentWorkingState,
	branding: Record<string, unknown> | undefined,
	brandingHandleBytes: Uint8Array | undefined,
): CurrentWorkingState {
	const nextRaw = { ...cws.metadata.raw };
	if (branding === undefined) delete nextRaw.branding;
	else nextRaw.branding = branding;
	return {
		...cws,
		metadata: { ...cws.metadata, raw: nextRaw },
		files: { ...cws.files, brandingHandleBytes },
	};
}

export function applyBrandingNone(
	cws: CurrentWorkingState,
): CurrentWorkingState {
	return withBranding(cws, undefined, undefined);
}

// Every fresh symbol selection made in SameView Web clears any previously
// imported `brandingHandleBytes` (docs/IMPORTED_COMPARISON_V1.md "Session
// Branding" F-004 addendum: a newly selected built-in symbol is rendered
// from the shared registry, never from a raster asset) — including when the
// user re-selects the very same id an import already carried, so
// `resolveHandleBranding` below can tell "imported, still has its PNG"
// apart from "freshly chosen in the browser" without a separate flag.
export function applyBrandingSymbol(
	cws: CurrentWorkingState,
	builtinId: BuiltinSymbolId,
): CurrentWorkingState {
	return withBranding(
		cws,
		{ type: "builtin", builtinId, updatedAtMs: Date.now() },
		undefined,
	);
}

export function applyBrandingImage(
	cws: CurrentWorkingState,
	bytes: Uint8Array,
): CurrentWorkingState {
	return withBranding(cws, { type: "image", updatedAtMs: Date.now() }, bytes);
}

export type HandleBranding =
	| { readonly kind: "none" }
	| { readonly kind: "asset" }
	| { readonly kind: "symbol"; readonly builtinId: BuiltinSymbolId };

// The single place that decides Raster-vs-Vektor-vs-none for the Handle
// (docs/COMPARISON_PRESENTATION.md Part 2 "Handle"). An imported built-in
// branding is displayed via its existing `branding-handle.png`
// (`files.brandingHandleBytes`) for as long as that asset is still present;
// a freshly chosen symbol (which never has an asset — see
// `applyBrandingSymbol` above) falls back to the shared registry instead.
// Any other inconsistency (`type` present without a usable asset or a
// recognized `builtinId`) resolves to "none", the same tolerant behavior
// docs/IMPORTED_COMPARISON_V1.md already documents for the Android reader.
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
		return builtinId ? { kind: "symbol", builtinId } : { kind: "none" };
	}
	return { kind: "none" };
}
