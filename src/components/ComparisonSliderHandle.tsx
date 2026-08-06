// The Comparison Stage's Handle visual — ring, circle and its inner content
// (docs/COMPARISON_PRESENTATION.md Part 2 "Handle"; docs/FEATURE_SPECIFICATION.md
// F-004). Deliberately separate from src/components/ComparisonSlider.tsx:
// that component owns drag/keyboard/pointer interaction only and never
// needs to know *what* the handle currently looks like — this component
// owns exactly that, and nothing else (no pointer/keyboard handling, no
// position state), so it stays a plain, "already-resolved value in, SVG
// out" component exactly like ComparisonSlider's own stated design
// (see that component's header comment). Reused unchanged for all three
// Session Branding states (None, Built-in Symbol, Custom Image), so a
// second, duplicate handle SVG never has to be maintained for the branded
// cases, and a Built-in Symbol and a Custom Image share the exact same
// centering formula below (src/lib/comparison-handle-geometry.ts
// `getContentBox`) rather than each carrying its own — only the content
// ratio differs between them, per docs/COMPARISON_PRESENTATION.md Part 2
// "Handle".
//
// Ring/circle geometry is the Android CompareScreen.kt transcription
// ComparisonSlider.tsx already used before this split (see that component's
// own header comment for the exact dp constants each figure comes from) —
// unchanged by this split, only relocated. Every number that must also stay
// consistent with ComparisonSlider.tsx's own date-label placement (the
// branding enlargement factor, the content centering coordinate) lives in
// src/lib/comparison-handle-geometry.ts instead of being redeclared here —
// see that module's header comment for why, and for the exact Android
// source values each constant below is derived from.

import type { HandleBranding } from "../lib/branding";
import { getBuiltinBrandingSymbol } from "../lib/builtin-branding-symbols";
import {
	BRANDED_HANDLE_VISUAL_REM,
	getContentBox,
	HANDLE_RADIUS_PX,
	IMAGE_CONTENT_RATIO,
	RING_STROKE_WIDTH_PX,
	STANDARD_ARROW_COLOR,
	STANDARD_HANDLE_VISUAL_REM,
	SYMBOL_COLOR,
	SYMBOL_CONTENT_RATIO,
} from "../lib/comparison-handle-geometry";

interface ComparisonSliderHandleProps {
	readonly branding: HandleBranding;
	// An already-resolved object URL for `files.brandingHandleBytes`
	// (src/lib/use-object-url.ts) — this component never reads bytes or
	// Current Working State directly, for the same reason it never reads
	// locale or i18n copy.
	readonly brandingSrc: string | undefined;
}

// Two broken ring arcs (viewBox 0 0 54 54, center 27,27, radius 26 — the
// stroke's own centerline so a 2px stroke spans radius 25–27) with a 12°
// gap top and bottom for the divider line to visually pass through,
// transcribed from Android's CompareSliderRingGapAngle = 12f and the two
// drawArc() calls in CompareDivider. Unaffected by the regression fixes
// (the gap is an angular sweep, so it stays correctly aligned at any
// uniform scale) — kept as literal path data, not derived from the shared
// geometry module, exactly as before.
const RING_ARC_LEFT = "M 21.594 52.432 A 26 26 0 0 1 21.594 1.568";
const RING_ARC_RIGHT = "M 32.406 1.568 A 26 26 0 0 1 32.406 52.432";
// Chevron paths, transcribed from CompareDivider's Canvas: unit = 48/48 = 1,
// arrowCenterOffset = 9, halfDepth = 4, halfH = 7, centered on (27, 27).
const CHEVRON_LEFT = "M 22 20 L 14 27 L 22 34";
const CHEVRON_RIGHT = "M 32 20 L 40 27 L 32 34";

// Fixed ratios in, fixed boxes out — computed once at module scope rather
// than per render, since neither input ever changes.
const imageBox = getContentBox(IMAGE_CONTENT_RATIO);
const symbolBox = getContentBox(SYMBOL_CONTENT_RATIO);

export default function ComparisonSliderHandle({
	branding,
	brandingSrc,
}: ComparisonSliderHandleProps) {
	const isBranded = branding.kind !== "none";
	const symbol =
		branding.kind === "symbol"
			? getBuiltinBrandingSymbol(branding.builtinId)
			: undefined;
	// The rendered CSS box size is set here, from the one shared constant
	// (src/lib/comparison-handle-geometry.ts), rather than via a second
	// `--branded` CSS class carrying its own independent 5.0625rem value —
	// the exact duplication that let the label placement and the visual
	// size drift apart before this fix.
	const visualSizeRem = isBranded
		? BRANDED_HANDLE_VISUAL_REM
		: STANDARD_HANDLE_VISUAL_REM;

	return (
		<svg
			className="comparison-slider__handle-visual"
			style={{ width: `${visualSizeRem}rem`, height: `${visualSizeRem}rem` }}
			viewBox="0 0 54 54"
			aria-hidden="true"
			focusable="false"
			data-testid="comparison-slider-handle"
			data-branding-kind={branding.kind}
		>
			<path
				d={RING_ARC_LEFT}
				fill="none"
				stroke="#ffffff"
				strokeWidth={RING_STROKE_WIDTH_PX}
			/>
			<path
				d={RING_ARC_RIGHT}
				fill="none"
				stroke="#ffffff"
				strokeWidth={RING_STROKE_WIDTH_PX}
			/>
			<circle cx="27" cy="27" r={HANDLE_RADIUS_PX} fill="#ffffff" />
			{branding.kind === "none" && (
				<>
					<path
						d={CHEVRON_LEFT}
						fill="none"
						stroke={STANDARD_ARROW_COLOR}
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<path
						d={CHEVRON_RIGHT}
						fill="none"
						stroke={STANDARD_ARROW_COLOR}
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</>
			)}
			{branding.kind === "asset" && brandingSrc && (
				<image
					href={brandingSrc}
					x={imageBox.offset}
					y={imageBox.offset}
					width={imageBox.side}
					height={imageBox.side}
					preserveAspectRatio="xMidYMid meet"
				/>
			)}
			{branding.kind === "symbol" && symbol && (
				// A nested <svg> with its own viewBox lets preserveAspectRatio fit
				// each icon's own (non-square, e.g. faLocationDot's 384×512)
				// geometry into its own content square without this component
				// computing per-icon aspect-ratio math itself. A smaller square
				// than the "asset" case above (docs/COMPARISON_PRESENTATION.md
				// Part 2 "Handle": SYMBOL_CONTENT_RATIO vs. IMAGE_CONTENT_RATIO) —
				// both still go through the exact same getContentBox formula, only
				// the ratio input differs.
				<svg
					x={symbolBox.offset}
					y={symbolBox.offset}
					width={symbolBox.side}
					height={symbolBox.side}
					viewBox={`0 0 ${symbol.viewBoxWidth} ${symbol.viewBoxHeight}`}
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
					focusable="false"
				>
					{/* sameview/app/src/main/res/drawable/ic_branding_*.xml:
					    fillColor="#17202F" for all six built-in symbols — not this
					    app's own interactive brand accent (that stays reserved for
					    the standard handle's arrows above). */}
					<path d={symbol.pathData} fill={SYMBOL_COLOR} />
				</svg>
			)}
		</svg>
	);
}
