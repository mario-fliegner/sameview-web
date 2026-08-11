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

// Deliberate, intentional public branding content — not a development
// comment, and therefore explicitly exempt from the developer-information
// stripping this module and scripts/build-presentation-runtime.mjs perform
// elsewhere (no docs/src references, no repository file names, nothing
// internal). Shared by both Standalone HTML and Static Microsite, since
// both render through this one document builder — never duplicated per
// output type. Contains no `--` sequence (would prematurely terminate an
// HTML comment).
const SOURCE_BRANDING_COMMENT = `<!--
  \u{1F44B} Hey, you found the source!

  This comparison was created with SameView.

  Capture the same view again.
  Compare moments. Not just photos.

  Created with web.sameview.app
  Discover SameView and get the Android app at sameview.app
-->`;

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
${SOURCE_BRANDING_COMMENT}
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

// Strips CSS block comments (`/* ... */`) from a stylesheet's raw text.
// Applied only here, at the point a stylesheet's text becomes part of a
// distributed artifact — never to the `.css` files on disk (which keep
// their full developer documentation for maintenance) and never to the
// live Workspace Preview, which never calls this function at all: it
// consumes src/styles/comparison-presentation.css through Astro/Vite's own
// normal CSS pipeline (`global.css`'s `@import`), which already strips
// comments itself as part of its production build. Only the `?raw`-imported
// copy the two generators embed/copy verbatim needs this explicit step.
// Comments in these files are never nested and never contain a comment
// terminator inside a string value (verified: neither file uses a `content:`
// declaration), so a single non-greedy match-and-remove is sufficient —
// this is not a CSS parser and does not need to be one.
function stripCssComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, "");
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
// `?raw` by the two generators). Each source's own developer comments are
// stripped here, at this shared distribution boundary, before composing —
// see `stripCssComments` above for why only here.
export function composeArtifactCss(
	fontFaceCss: string,
	presentationCss: string,
	frameCss: string,
): string {
	return [fontFaceCss, presentationCss, frameCss]
		.map(stripCssComments)
		.join("\n\n");
}
