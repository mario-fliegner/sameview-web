// Framework-independent registry for the six SameView built-in branding
// symbols (docs/IMPORTED_COMPARISON_V1.md "Session Branding";
// docs/IMPLEMENTATION_PLAN_V1.md Phase 6). The six `builtinId` values are
// adopted unchanged from the Android built-in symbol catalog
// (sameview/app/src/main/java/com/isardomains/sameview/branding/BuiltinBrandingSymbol.kt)
// and must never change or grow — "No additional symbols are introduced in
// V1" (sameview/docs/SESSION_BRANDING_V1.md §6.1), mirrored here.
//
// Deliberately pure data (no React, no DOM): the same registry must be
// reusable unchanged by a future Standalone HTML/Microsite/CMS generator
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 8+), which runs without a React
// runtime — see src/lib/comparison-presentation.ts's own header comment for
// the identical "later generator can call this unchanged" reasoning already
// established in this codebase.
//
// Each icon is imported individually via Font Awesome's own documented deep
// import path (https://docs.fontawesome.com/apis/javascript/tree-shaking:
// "import { faCoffee } from '@fortawesome/free-solid-svg-icons/faCoffee'"),
// confirmed against the actually installed package version — every one of
// these six subpaths exists as its own file and is resolvable per that
// package's `exports` map (`"./*": "./*.js"`) — rather than importing the
// package's barrel export, so exactly six icon modules ever reach the
// client bundle, independent of the bundler's own tree-shaking. Each
// module already exports pre-parsed `width`/`height`/`svgPathData` as plain
// typed values (confirmed against the installed faHeart.d.ts) — no parsing
// of third-party SVG markup happens anywhere in this file, only composition
// of already-clean data.
//
// No @fortawesome/fontawesome-svg-core, no @fortawesome/react-fontawesome:
// neither the CSS/webfont runtime nor a React-only rendering component is
// needed for six static path lookups, and the latter would defeat the
// point of this being usable outside React.

import {
	svgPathData as camera,
	height as cameraHeight,
	width as cameraWidth,
} from "@fortawesome/free-solid-svg-icons/faCamera";
import {
	svgPathData as fire,
	height as fireHeight,
	width as fireWidth,
} from "@fortawesome/free-solid-svg-icons/faFire";
import {
	svgPathData as heart,
	height as heartHeight,
	width as heartWidth,
} from "@fortawesome/free-solid-svg-icons/faHeart";
import {
	svgPathData as house,
	height as houseHeight,
	width as houseWidth,
} from "@fortawesome/free-solid-svg-icons/faHouse";
import {
	svgPathData as locationDot,
	height as locationDotHeight,
	width as locationDotWidth,
} from "@fortawesome/free-solid-svg-icons/faLocationDot";
import {
	svgPathData as star,
	height as starHeight,
	width as starWidth,
} from "@fortawesome/free-solid-svg-icons/faStar";

// docs/APPLICATION_LAYOUT.md "Branding"; builtinId values confirmed against
// a real Android export (test/fixtures/android-export/sample-v6-session_full.zip:
// "branding":{"type":"builtin","builtinId":"star"}).
export type BuiltinSymbolId =
	| "heart"
	| "star"
	| "camera"
	| "home"
	| "pin"
	| "fire";

export interface BuiltinSymbolDefinition {
	readonly id: BuiltinSymbolId;
	readonly viewBoxWidth: number;
	readonly viewBoxHeight: number;
	readonly pathData: string;
}

// Order is the order the Edit Inspector's Symbol grid renders in
// (docs/APPLICATION_LAYOUT.md "Branding").
const SYMBOLS: readonly BuiltinSymbolDefinition[] = [
	{
		id: "heart",
		viewBoxWidth: heartWidth,
		viewBoxHeight: heartHeight,
		pathData: heart,
	},
	{
		id: "star",
		viewBoxWidth: starWidth,
		viewBoxHeight: starHeight,
		pathData: star,
	},
	{
		id: "camera",
		viewBoxWidth: cameraWidth,
		viewBoxHeight: cameraHeight,
		pathData: camera,
	},
	{
		// Android's `home` builtinId maps to the FA6 `faHouse` icon (FA6
		// renamed the older `home` glyph to `house`) — the stable `builtinId`
		// string itself is unaffected by which FA icon renders it.
		id: "home",
		viewBoxWidth: houseWidth,
		viewBoxHeight: houseHeight,
		pathData: house,
	},
	{
		// Android's `pin` builtinId maps to FA6's `faLocationDot` (a map
		// location pin), matching Android's own "Map location pin" visual
		// description (sameview/docs/SESSION_BRANDING_V1.md §6.1) and its
		// confirmed German label "Standort" (sameview/docs/SESSION_BRANDING_V2_UX_REWORK.md).
		id: "pin",
		viewBoxWidth: locationDotWidth,
		viewBoxHeight: locationDotHeight,
		pathData: locationDot,
	},
	{
		id: "fire",
		viewBoxWidth: fireWidth,
		viewBoxHeight: fireHeight,
		pathData: fire,
	},
];

export const BUILTIN_BRANDING_SYMBOLS: readonly BuiltinSymbolDefinition[] =
	SYMBOLS;

const BY_ID: ReadonlyMap<BuiltinSymbolId, BuiltinSymbolDefinition> = new Map(
	SYMBOLS.map((symbol) => [symbol.id, symbol]),
);

// A uniform safety margin added around every symbol's own declared viewBox
// before rendering, as a fraction of that symbol's own width/height. Not
// precautionary: confirmed against the installed package via a real
// browser `getBBox()` measurement that faStar's tip reaches y≈-32 (of its
// own 512-unit height) and faFire's flame tip reaches y≈-32 the same way —
// both ~6.25% above the declared box — which a plain `viewBox="0 0 W H"`
// silently clips, since a nested <svg> viewport clips to its viewBox by
// default. 15% comfortably covers that with visible margin to spare. The
// other four symbols do not need it, but receive the identical padding
// anyway so every symbol renders at the same relative scale within its own
// box rather than four unpadded icons sitting visually larger than two
// padded ones.
const SYMBOL_VIEWBOX_PADDING_RATIO = 0.15;

// The one place a symbol's padded viewBox is computed — used identically by
// the Branding selector (src/components/BrandingSection.tsx) and the
// Handle preview (src/components/ComparisonSliderHandle.tsx), so neither
// can drift from the other. Padding is symmetric on every axis, so it only
// ever shrinks the rendered icon within its existing content box; it does
// not change that box's own size, position or centering (both callers keep
// their already-correct `preserveAspectRatio="xMidYMid meet"`).
export function getSymbolViewBox(symbol: BuiltinSymbolDefinition): string {
	const padX = symbol.viewBoxWidth * SYMBOL_VIEWBOX_PADDING_RATIO;
	const padY = symbol.viewBoxHeight * SYMBOL_VIEWBOX_PADDING_RATIO;
	const width = symbol.viewBoxWidth + 2 * padX;
	const height = symbol.viewBoxHeight + 2 * padY;
	return `${-padX} ${-padY} ${width} ${height}`;
}

// Accepts a plain `string` (not just `BuiltinSymbolId`) so callers reading
// an imported or otherwise untrusted `branding.builtinId` value never need
// their own separate type guard first — this is the one place that decides
// whether a given id string is one of the six supported symbols.
export function getBuiltinBrandingSymbol(
	id: string,
): BuiltinSymbolDefinition | undefined {
	return BY_ID.get(id as BuiltinSymbolId);
}

export function isBuiltinSymbolId(value: string): value is BuiltinSymbolId {
	return BY_ID.has(value as BuiltinSymbolId);
}
