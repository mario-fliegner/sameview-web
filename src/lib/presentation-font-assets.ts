// Packaging metadata for the three Presentation Fonts (docs/BRAND_GUIDE.md
// "Comparison Presentation Typography"; docs/IMPLEMENTATION_PLAN_V1.md Phase
// 9) — which physical file(s) and license file back each
// src/lib/presentation-fonts.ts `PresentationFontId`, and the `@font-face`
// rule a generated output needs to actually use one of them. Deliberately
// separate from presentation-fonts.ts, which "never reads or refers to
// those files directly" (see that module's own header comment) — this
// module is the one place that does, and only Phase 9's generators import
// it; the live Workspace Preview keeps using global.css's own static
// `@font-face` rules unchanged.
//
// Only the one Presentation Font actually selected for a given comparison
// is ever bundled into a generated output (APPLICATION_LAYOUT.md "Standalone
// HTML"/"Static Microsite": "the selected Presentation Font embedded"/"only
// the selected Presentation Font included locally... no unnecessary fonts
// otherwise") — never all three.

import type { PresentationFontId } from "./presentation-fonts.ts";

export type FontAssetFormat = "woff2";

export interface PresentationFontFile {
	// Relative to `public/fonts/` — also the path segment used unchanged
	// under the Static Microsite's own `fonts/` folder.
	readonly path: string;
	readonly weight: number;
	readonly format: FontAssetFormat;
}

export interface PresentationFontAsset {
	// Must match the `font-family` src/lib/presentation-fonts.ts
	// `resolvePresentationFontFamily` resolves to for this id (quoted exactly
	// as a CSS `@font-face` `font-family` value needs).
	readonly fontFamily: string;
	readonly files: readonly PresentationFontFile[];
	// Relative to `public/fonts/`; the exact license filename each family
	// actually ships (docs/BRAND_GUIDE.md: SIL Open Font License 1.1 for all
	// three) — copied into the Static Microsite's `fonts/` folder unchanged,
	// and its full text is embedded inert inside a <template> element in
	// Standalone HTML.
	readonly licensePath: string;
	readonly licenseFileName: string;
}

// Weight ranges mirror docs/IMPLEMENTATION_PLAN_V1.md Phase 8b's resolved
// font-asset decision: Inter and Space Grotesk each ship as one official
// variable WOFF2 covering the full 400/500/600 range the Comparison
// Presentation uses from a single file; Manrope ships as three static
// WOFF2 instances at exactly those three weights, since Manrope has no
// official prebuilt variable WOFF2. File paths must stay in sync with the
// `@font-face` `src: url(...)` values in src/styles/global.css.
const PRESENTATION_FONT_ASSETS: Record<
	PresentationFontId,
	PresentationFontAsset
> = {
	inter: {
		fontFamily: '"Inter Variable"',
		files: [
			{ path: "inter/InterVariable.woff2", weight: 400, format: "woff2" },
		],
		licensePath: "inter/LICENSE.txt",
		licenseFileName: "LICENSE.txt",
	},
	manrope: {
		fontFamily: '"Manrope"',
		files: [
			{ path: "manrope/Manrope-Regular.woff2", weight: 400, format: "woff2" },
			{ path: "manrope/Manrope-Medium.woff2", weight: 500, format: "woff2" },
			{ path: "manrope/Manrope-SemiBold.woff2", weight: 600, format: "woff2" },
		],
		licensePath: "manrope/OFL.txt",
		licenseFileName: "OFL.txt",
	},
	"space-grotesk": {
		fontFamily: '"Space Grotesk Variable"',
		files: [
			{
				path: "spacegrotesk/SpaceGrotesk-Variable.woff2",
				weight: 400,
				format: "woff2",
			},
		],
		licensePath: "spacegrotesk/OFL.txt",
		licenseFileName: "OFL.txt",
	},
};

export function getPresentationFontAsset(
	id: PresentationFontId,
): PresentationFontAsset {
	return PRESENTATION_FONT_ASSETS[id];
}

// A variable font's single file legitimately covers a weight range (e.g.
// Inter Variable declares `font-weight: 100 900` in global.css) — this
// module's own per-file `weight` above only records one representative
// value (the lowest weight the Comparison Presentation actually uses) for
// static-instance families like Manrope, where each file really is exactly
// one weight. `buildFontFaceCss` below always emits the same weight range
// global.css itself declares per family, never a narrower one, so a
// generated output can never end up missing a weight the live Preview
// still supports.
const FONT_WEIGHT_RANGES: Record<PresentationFontId, string> = {
	inter: "100 900",
	manrope: "400",
	"space-grotesk": "300 700",
};

// Builds the `@font-face` rule(s) for exactly the selected font, with the
// `src: url(...)` resolved per output type by the caller — a plain data:
// URI for Standalone HTML, a relative `fonts/...` path for Static
// Microsite. The only place a generated output's CSS asset reference
// differs from the live Preview's (src/styles/comparison-presentation.css
// itself never references a font file — see that file's own header
// comment).
export function buildFontFaceCss(
	id: PresentationFontId,
	resolveUrl: (file: PresentationFontFile) => string,
): string {
	const asset = getPresentationFontAsset(id);
	return asset.files
		.map((file) => {
			const weightRange =
				asset.files.length === 1 ? FONT_WEIGHT_RANGES[id] : String(file.weight);
			return `@font-face {\n\tfont-family: ${asset.fontFamily};\n\tsrc: url("${resolveUrl(file)}") format("${file.format}");\n\tfont-weight: ${weightRange};\n\tfont-style: normal;\n\tfont-display: swap;\n}`;
		})
		.join("\n\n");
}
