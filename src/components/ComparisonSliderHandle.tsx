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
// cases.
//
// Ring/circle geometry is the Android CompareScreen.kt transcription
// ComparisonSlider.tsx already used before this split (see that component's
// own header comment for the exact dp constants each figure comes from) —
// unchanged by this split, only relocated.
//
// The "same white ring and circle, only the inner content changes" rule and
// the 72%-of-circle-diameter content sizing are the SameView Android app's
// own branding handle design (sameview/docs/SESSION_BRANDING_V1.md §8.3/
// §8.4) — Web V1 adopts them unchanged rather than inventing new figures,
// since docs/COMPARISON_PRESENTATION.md documents only "the Handle
// automatically increases in size", not concrete numbers.

import type { HandleBranding } from "../lib/branding";
import { getBuiltinBrandingSymbol } from "../lib/builtin-branding-symbols";

interface ComparisonSliderHandleProps {
	readonly branding: HandleBranding;
	// An already-resolved object URL for `files.brandingHandleBytes`
	// (src/lib/use-object-url.ts) — this component never reads bytes or
	// Current Working State directly, for the same reason it never reads
	// locale or i18n copy.
	readonly brandingSrc: string | undefined;
}

const RING_STROKE_WIDTH_PX = 2;
const HANDLE_RADIUS_PX = 24;
// Android's accent color (SameViewAccent = 0xFF4F8CFF) — reused as-is,
// exactly as ComparisonSlider.tsx already did before this split.
const ACCENT_COLOR = "#4f8cff";

// Two broken ring arcs (viewBox 0 0 54 54, center 27,27, radius 26 — the
// stroke's own centerline so a 2px stroke spans radius 25–27) with a 12°
// gap top and bottom for the divider line to visually pass through,
// transcribed from Android's CompareSliderRingGapAngle = 12f and the two
// drawArc() calls in CompareDivider.
const RING_ARC_LEFT = "M 21.594 52.432 A 26 26 0 0 1 21.594 1.568";
const RING_ARC_RIGHT = "M 32.406 1.568 A 26 26 0 0 1 32.406 52.432";
// Chevron paths, transcribed from CompareDivider's Canvas: unit = 48/48 = 1,
// arrowCenterOffset = 9, halfDepth = 4, halfH = 7, centered on (27, 27).
const CHEVRON_LEFT = "M 22 20 L 14 27 L 22 34";
const CHEVRON_RIGHT = "M 32 20 L 40 27 L 32 34";

// sameview/docs/SESSION_BRANDING_V1.md §8.3: "Rendered at 72% of the
// branding circle diameter, centered … Fit semantics: logo scaled to fit in
// 72% area, aspect ratio preserved."
const BRANDING_CONTENT_RATIO = 0.72;
const BRANDING_CONTENT_SIDE_PX = HANDLE_RADIUS_PX * 2 * BRANDING_CONTENT_RATIO;
const BRANDING_CONTENT_OFFSET_PX =
	HANDLE_RADIUS_PX - BRANDING_CONTENT_SIDE_PX / 2;

export default function ComparisonSliderHandle({
	branding,
	brandingSrc,
}: ComparisonSliderHandleProps) {
	const isBranded = branding.kind !== "none";
	const symbol =
		branding.kind === "symbol"
			? getBuiltinBrandingSymbol(branding.builtinId)
			: undefined;

	return (
		<svg
			className={`comparison-slider__handle-visual${
				isBranded ? " comparison-slider__handle-visual--branded" : ""
			}`}
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
						stroke={ACCENT_COLOR}
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<path
						d={CHEVRON_RIGHT}
						fill="none"
						stroke={ACCENT_COLOR}
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</>
			)}
			{branding.kind === "asset" && brandingSrc && (
				<image
					href={brandingSrc}
					x={BRANDING_CONTENT_OFFSET_PX}
					y={BRANDING_CONTENT_OFFSET_PX}
					width={BRANDING_CONTENT_SIDE_PX}
					height={BRANDING_CONTENT_SIDE_PX}
					preserveAspectRatio="xMidYMid meet"
				/>
			)}
			{branding.kind === "symbol" && symbol && (
				// A nested <svg> with its own viewBox lets preserveAspectRatio fit
				// each icon's own (non-square, e.g. faLocationDot's 384×512)
				// geometry into the fixed content square without this component
				// computing per-icon aspect-ratio math itself.
				<svg
					x={BRANDING_CONTENT_OFFSET_PX}
					y={BRANDING_CONTENT_OFFSET_PX}
					width={BRANDING_CONTENT_SIDE_PX}
					height={BRANDING_CONTENT_SIDE_PX}
					viewBox={`0 0 ${symbol.viewBoxWidth} ${symbol.viewBoxHeight}`}
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
					focusable="false"
				>
					{/* docs/BRAND_GUIDE.md "Brand Accent Color" — a freshly selected
					    symbol is this app's own vector rendering (not a user-supplied
					    image), so it uses the existing brand accent already used
					    throughout this component and the wider app rather than an
					    arbitrary or undocumented color. */}
					<path d={symbol.pathData} fill={ACCENT_COLOR} />
				</svg>
			)}
		</svg>
	);
}
