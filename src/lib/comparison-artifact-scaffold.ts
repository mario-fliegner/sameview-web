// The one central HTML/Presentation document scaffold
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 9: "Both output types render from
// one single, central HTML/Presentation document scaffold — never two
// independent generators or scattered string fragments duplicating the
// same markup"). Clearly separable sections — head/meta, favicon, fonts,
// the Presentation markup itself, CSS, JS, closing license/attribution
// comments — composed by src/lib/generate-standalone-html.ts and
// src/lib/generate-static-microsite.ts, which differ only in how each
// section's *content* is referenced/packaged (inline vs. external file),
// never in this structure itself. Pure string composition: no new
// templating engine or dependency.

import { escapeHtml } from "./html-escape.ts";

export interface ArtifactDocumentSections {
	readonly titleText: string;
	readonly metaDescriptionText: string;
	readonly themeColor: string;
	// Static Microsite only (docs/APPLICATION_LAYOUT.md "Static Microsite"):
	// emits `og:type`/`og:title`/`og:description` from the same already-resolved
	// `titleText`/`metaDescriptionText` above, through the same `escapeHtml`
	// already used for `<title>`/`<meta name="description">` — never a second
	// resolution or escaping path. Standalone HTML always passes `false`: a
	// `file://`-opened single document has no shareable URL for Open Graph
	// unfurling to apply to.
	readonly includeOpenGraph: boolean;
	// Already a complete `<link rel="icon" ...>` element (differs by output
	// type: an embedded `data:` URI for Standalone HTML, a relative
	// `favicon.svg` href for Static Microsite).
	readonly faviconMarkup: string;
	// Already a complete `<style>...</style>` or
	// `<link rel="stylesheet" href="...">` element — see
	// `composeArtifactCss` below for the shared CSS *content* both variants
	// wrap.
	readonly cssMarkup: string;
	// The Comparison Presentation's own markup
	// (src/lib/comparison-artifact-markup.ts `buildComparisonArtifactMarkup`),
	// not yet wrapped in the outer output frame — this module owns that one
	// wrapper element so both outputs share it byte-for-byte.
	readonly presentationMarkup: string;
	// Already a complete inline `<script>...</script>` or
	// `<script src="...">` element.
	readonly scriptMarkup: string;
	// The selected Presentation Font's full, unescaped license text
	// (docs/IMPLEMENTATION_PLAN_V1.md Phase 9: the full license text of the
	// actually embedded font family is included, inert and never rendered,
	// in the document) — this module escapes and wraps it in a `<template>`.
	readonly fontLicenseText: string;
	// The localized "JavaScript is required..." hint (docs/APPLICATION_LAYOUT.md
	// "Standalone HTML"/"Static Microsite"), already resolved for the active
	// locale exactly like every other Output Inspector string passed into this
	// module. Shown in both outputs: neither has any content without the
	// embedded/linked runtime script actually running.
	readonly noscriptText: string;
}

export function buildArtifactDocument(
	sections: ArtifactDocumentSections,
): string {
	const {
		titleText,
		metaDescriptionText,
		themeColor,
		includeOpenGraph,
		faviconMarkup,
		cssMarkup,
		presentationMarkup,
		scriptMarkup,
		fontLicenseText,
		noscriptText,
	} = sections;

	const openGraphMarkup = includeOpenGraph
		? `<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(titleText)}">
<meta property="og:description" content="${escapeHtml(metaDescriptionText)}">
`
		: "";

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titleText)}</title>
<meta name="description" content="${escapeHtml(metaDescriptionText)}">
<meta name="theme-color" content="${themeColor}">
${openGraphMarkup}${faviconMarkup}
${cssMarkup}
</head>
<body>
<noscript>${escapeHtml(noscriptText)}</noscript>
<main id="sameview-output-frame">
${presentationMarkup}
</main>
${scriptMarkup}
<template id="sameview-font-license">${escapeHtml(fontLicenseText)}</template>
</body>
</html>
`;
}

// Concatenates the three CSS sources every generated artifact needs, in a
// fixed order, so Standalone HTML (wrapped in one inline `<style>`) and
// Static Microsite (written verbatim to `css/sameview-comparison.css`)
// always contain byte-identical CSS content — packaging is the only
// difference (docs/IMPLEMENTATION_PLAN_V1.md Phase 9). `fontFaceCss` is the
// selected font's own `@font-face` rule(s)
// (src/lib/presentation-font-assets.ts `buildFontFaceCss`), `presentationCss`
// and `frameCss` are the raw text of src/styles/comparison-presentation.css
// and src/styles/comparison-artifact-frame.css respectively (read via Vite
// `?raw` by the two generators).
export function composeArtifactCss(
	fontFaceCss: string,
	presentationCss: string,
	frameCss: string,
): string {
	return [fontFaceCss, presentationCss, frameCss].join("\n\n");
}
