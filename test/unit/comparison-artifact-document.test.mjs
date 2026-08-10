// Coverage for the FINAL composed Standalone HTML / Static Microsite
// `index.html` document — not just individual markup fragments. Reproduces
// src/lib/generate-standalone-html.ts's and src/lib/generate-static-microsite.ts's
// own composition (buildComparisonArtifactMarkup + composeArtifactCss +
// buildFontFaceCss + buildArtifactDocument) with real on-disk CSS and font
// license assets, bypassing only their browser `fetch()` wrapper
// (src/lib/comparison-artifact-assets.ts, pure I/O with no generation logic
// of its own) — so these assertions run against the same bytes a real
// generation produces. Guards the W3C/Nu HTML validator findings fixed
// earlier (no XHTML-style void-element slashes, no unprefixed `line-clamp`,
// the font license moved out of an HTML comment into an inert `<template>`,
// the inline runtime script guarded against a literal `</script>`) and the
// Microsite-only Open Graph tags / shared localized `<noscript>` hint added
// here (docs/APPLICATION_LAYOUT.md "Standalone HTML"/"Static Microsite").

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { translations } from "../../src/i18n/translations.ts";
import { buildComparisonArtifactMarkup } from "../../src/lib/comparison-artifact-markup.ts";
import {
	buildArtifactDocument,
	composeArtifactCss,
} from "../../src/lib/comparison-artifact-scaffold.ts";
import { escapeClosingTag, escapeHtml } from "../../src/lib/html-escape.ts";
import { buildFontFaceCss } from "../../src/lib/presentation-font-assets.ts";
import { resolvePresentationFontFamily } from "../../src/lib/presentation-fonts.ts";
import { DEFAULT_PRESENTATION_CONFIGURATION } from "../../src/lib/workspace-state.ts";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

function bytesToDataUrl(bytes, mime) {
	return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

const BASE_PRESENTATION = {
	title: "White wall portrait",
	description: "A short description.",
	referenceLabel: "May 2019",
	captureLabel: "June 12, 2023",
	durationLabel: "4 years",
	location: { displayName: "Marienplatz", city: "Munich", country: "Germany" },
	sliderLabels: { left: "2019", right: "2023" },
};

const FULL_VISIBILITY = {
	title: true,
	description: true,
	time: true,
	timeDifference: true,
	location: true,
};

const COPY = {
	referenceAlt: "Reference photo",
	captureAlt: "New photo",
	sliderLabel: "Comparison position",
	loadingLabel: "Loading comparison…",
};

const DEFAULT_NOSCRIPT_TEXT =
	translations.en.outputInspector.artifactNoscriptHint;

// Builds the exact same document src/lib/generate-standalone-html.ts
// (includeOpenGraph: false) or src/lib/generate-static-microsite.ts
// (includeOpenGraph: true) produces, given a real Presentation Font id, an
// injected runtime script text (to test the `</script>` guard) and a fake
// `-->`-adjacent, `--`-laden license text (to prove it survives the move out
// of an HTML comment).
function buildDocument({
	fontId = "inter",
	runtimeScriptText,
	licenseText,
	includeOpenGraph = false,
	noscriptText = DEFAULT_NOSCRIPT_TEXT,
	titleText = "Comparison — Test",
	metaDescriptionText = "Test description",
}) {
	const fontBytes = fs.readFileSync(
		path.join(ROOT, "public/fonts/inter/InterVariable.woff2"),
	);
	const fontFaceCss = buildFontFaceCss(fontId, () =>
		bytesToDataUrl(fontBytes, "font/woff2"),
	);
	const presentationCssRaw = fs.readFileSync(
		path.join(ROOT, "src/styles/comparison-presentation.css"),
		"utf8",
	);
	const frameCssRaw = fs.readFileSync(
		path.join(ROOT, "src/styles/comparison-artifact-frame.css"),
		"utf8",
	);
	const css = composeArtifactCss(fontFaceCss, presentationCssRaw, frameCssRaw);

	const tinyJpegBytes = Buffer.from("/9k=", "base64");
	const presentationMarkup = buildComparisonArtifactMarkup({
		presentation: BASE_PRESENTATION,
		visibility: FULL_VISIBILITY,
		configuration: DEFAULT_PRESENTATION_CONFIGURATION,
		branding: { kind: "none" },
		assets: {
			referenceSrc: bytesToDataUrl(tinyJpegBytes, "image/jpeg"),
			captureSrc: bytesToDataUrl(tinyJpegBytes, "image/jpeg"),
			brandingSrc: undefined,
		},
		copy: COPY,
		presentationFontFamily: resolvePresentationFontFamily(fontId),
		initialSliderPosition: 0.5,
	});

	const faviconBytes = fs.readFileSync(path.join(ROOT, "public/favicon.svg"));
	const faviconMarkup = `<link rel="icon" type="image/svg+xml" href="${bytesToDataUrl(faviconBytes, "image/svg+xml")}">`;

	return buildArtifactDocument({
		titleText,
		metaDescriptionText,
		themeColor: "#0f1115",
		includeOpenGraph,
		faviconMarkup,
		cssMarkup: `<style>\n${css}\n</style>`,
		presentationMarkup,
		scriptMarkup: `<script>\n${escapeClosingTag(runtimeScriptText, "script")}\n</script>`,
		fontLicenseText: licenseText,
		noscriptText,
	});
}

describe("the final composed Standalone HTML document", () => {
	const realLicenseText = fs.readFileSync(
		path.join(ROOT, "public/fonts/inter/LICENSE.txt"),
		"utf8",
	);

	test("real Inter license text contains multiple bare `--` sequences (the actual validator trigger)", () => {
		// Proves the fix is exercised against a real, not synthetic, edge case.
		const matches = realLicenseText.match(/--/g) ?? [];
		assert.ok(
			matches.length > 0,
			"expected the real license text to contain '--' sequences",
		);
	});

	test("contains no XHTML-style self-closing slash on meta/link/img", () => {
		const html = buildDocument({
			runtimeScriptText: "console.log('ok');",
			licenseText: realLicenseText,
		});
		const voidSlashes = html.match(/<(meta|link|img)\b[^<>]*\/>/g) ?? [];
		assert.deepEqual(voidSlashes, []);
		// Sanity: the elements themselves are still present, just without the slash.
		assert.match(html, /<meta charset="utf-8">/);
		assert.match(html, /<link rel="icon"/);
		assert.match(html, /<img src="data:image\/jpeg/);
	});

	test("SVG's own self-closing path/circle elements are left untouched", () => {
		const html = buildDocument({
			runtimeScriptText: "console.log('ok');",
			licenseText: realLicenseText,
		});
		assert.match(html, /<circle[^<>]*\/>/);
		assert.match(html, /<path[^<>]*\/>/);
	});

	test("the embedded CSS contains no unprefixed line-clamp, only -webkit-line-clamp", () => {
		const html = buildDocument({
			runtimeScriptText: "console.log('ok');",
			licenseText: realLicenseText,
		});
		assert.doesNotMatch(html, /[^-]line-clamp:/);
		assert.match(html, /-webkit-line-clamp: 2;/);
		assert.match(html, /-webkit-line-clamp: 3;/);
	});

	test("the full font license text is present, verbatim (only HTML-escaped), inside an inert <template>", () => {
		const html = buildDocument({
			runtimeScriptText: "console.log('ok');",
			licenseText: realLicenseText,
		});
		const match = html.match(
			/<template id="sameview-font-license">([\s\S]*?)<\/template>/,
		);
		assert.ok(
			match,
			'expected a <template id="sameview-font-license"> element',
		);
		assert.equal(match[1], escapeHtml(realLicenseText));
	});

	test("the license text is not embedded inside an HTML comment anywhere in the document", () => {
		const html = buildDocument({
			runtimeScriptText: "console.log('ok');",
			licenseText: realLicenseText,
		});
		const comments = html.match(/<!--[\s\S]*?-->/g) ?? [];
		for (const comment of comments) {
			assert.ok(
				!comment.includes("Copyright") &&
					!comment.includes("SIL Open Font License"),
				`license text leaked into an HTML comment: ${comment.slice(0, 80)}...`,
			);
		}
	});

	test("a literal </script> inside the runtime script text cannot terminate the document's own <script> early", () => {
		const maliciousRuntime = "const x = '</script><script>alert(1)</script>';";
		const html = buildDocument({
			runtimeScriptText: maliciousRuntime,
			licenseText: realLicenseText,
		});
		// The escaped form must appear, and the raw closing sequence must not.
		assert.match(html, /<\\\/script>/);
		assert.ok(
			!html.includes("</script><script>alert(1)</script>"),
			"a literal </script> in the runtime script broke out of the wrapping <script> element",
		);
	});

	test("Standalone HTML (includeOpenGraph: false) contains no Open Graph tags at all", () => {
		const html = buildDocument({
			runtimeScriptText: "console.log('ok');",
			licenseText: realLicenseText,
			includeOpenGraph: false,
		});
		assert.doesNotMatch(html, /property="og:/);
	});

	test('Static Microsite (includeOpenGraph: true) contains exactly og:type/og:title/og:description, using the same already-resolved and escaped values as <title>/<meta name="description">', () => {
		const titleText = 'A "special" & <tricky> title';
		const metaDescriptionText = 'A description with & and "quotes"';
		const html = buildDocument({
			runtimeScriptText: "console.log('ok');",
			licenseText: realLicenseText,
			includeOpenGraph: true,
			titleText,
			metaDescriptionText,
		});

		const ogTags = html.match(/<meta property="og:[^>]*>/g) ?? [];
		assert.equal(
			ogTags.length,
			3,
			`expected exactly 3 og: tags, found ${ogTags.length}`,
		);
		assert.match(html, /<meta property="og:type" content="website">/);

		const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
		const descriptionMatch = html.match(
			/<meta name="description" content="([^"]*)">/,
		);
		assert.ok(titleMatch && descriptionMatch);

		assert.match(
			html,
			new RegExp(
				`<meta property="og:title" content="${titleMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">`,
			),
		);
		assert.match(
			html,
			new RegExp(
				`<meta property="og:description" content="${descriptionMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">`,
			),
		);

		// Exact same escaping function/value as the pre-existing <title>/<meta
		// name="description"> — no second resolution or escaping path.
		assert.equal(titleMatch[1], escapeHtml(titleText));
		assert.equal(descriptionMatch[1], escapeHtml(metaDescriptionText));
	});

	test("Static Microsite never gets og:url, og:image or a canonical link — not requested by spec", () => {
		const html = buildDocument({
			runtimeScriptText: "console.log('ok');",
			licenseText: realLicenseText,
			includeOpenGraph: true,
		});
		assert.doesNotMatch(html, /property="og:url"/);
		assert.doesNotMatch(html, /property="og:image"/);
		assert.doesNotMatch(html, /rel="canonical"/);
	});

	for (const includeOpenGraph of [false, true]) {
		test(`both EN and DE localized <noscript> text appear verbatim (escaped) regardless of includeOpenGraph=${includeOpenGraph}`, () => {
			for (const locale of ["en", "de"]) {
				const noscriptText =
					translations[locale].outputInspector.artifactNoscriptHint;
				const html = buildDocument({
					runtimeScriptText: "console.log('ok');",
					licenseText: realLicenseText,
					includeOpenGraph,
					noscriptText,
				});
				assert.match(
					html,
					new RegExp(`<noscript>${escapeHtml(noscriptText)}</noscript>`),
				);
			}
		});
	}
});
