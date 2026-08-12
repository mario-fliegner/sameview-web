// Generates the self-contained Standalone HTML artifact
// (docs/APPLICATION_LAYOUT.md "Standalone HTML"; docs/IMPLEMENTATION_PLAN_V1.md
// Phase 9): a single, fully self-contained `sameview-comparison.html` file
// with a semantic `<main>`... — see src/lib/comparison-artifact-scaffold.ts
// for the shared document structure this composes. CSS, JS, images,
// branding and the selected Presentation Font are all embedded inline
// (Base64 for binary assets); no external request of any kind. Shares
// every actual rendering/behavior source with
// src/lib/generate-static-microsite.ts — the two differ only in how each
// section's content is packaged (inline vs. external file).

import type { Locale } from "../i18n/translations.ts";
import frameCssRaw from "../styles/comparison-artifact-frame.css?raw";
import presentationCssRaw from "../styles/comparison-presentation.css?raw";
import { bytesToDataUrl } from "./base64.ts";
import {
	fetchFaviconBytes,
	fetchPresentationFontAsset,
	fetchPresentationRuntimeScript,
} from "./comparison-artifact-assets.ts";
import {
	buildComparisonArtifactMarkup,
	type ComparisonArtifactCopy,
} from "./comparison-artifact-markup.ts";
import {
	buildArtifactDocument,
	composeArtifactCss,
} from "./comparison-artifact-scaffold.ts";
import { escapeClosingTag } from "./html-escape.ts";
import type { OutcomeSnapshot } from "./outcome-snapshot.ts";
import { buildFontFaceCss } from "./presentation-font-assets.ts";
import { resolvePresentationFontFamily } from "./presentation-fonts.ts";

export const STANDALONE_HTML_FILENAME = "sameview-comparison.html";

export interface GenerateStandaloneHtmlOptions {
	readonly snapshot: OutcomeSnapshot;
	// The active SameView Web locale at generation time — forwarded unchanged
	// to src/lib/comparison-artifact-scaffold.ts `buildArtifactDocument`,
	// which alone decides `<html lang>` and the source-branding comment
	// language; this module makes no locale decision of its own.
	readonly locale: Locale;
	readonly copy: ComparisonArtifactCopy;
	readonly titleText: string;
	readonly metaDescriptionText: string;
	readonly themeColor: string;
	readonly noscriptText: string;
}

// The reference/capture images are always original JPEG for V1
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 8: "the reference and capture
// images keep their original JPEG format"); the branding asset, when
// present, is always the Phase 6-normalized 512×512 PNG.
const COMPARISON_IMAGE_MIME = "image/jpeg";
const BRANDING_IMAGE_MIME = "image/png";
const FAVICON_MIME = "image/svg+xml";

export async function generateStandaloneHtml(
	options: GenerateStandaloneHtmlOptions,
): Promise<Uint8Array> {
	const {
		snapshot,
		locale,
		copy,
		titleText,
		metaDescriptionText,
		themeColor,
		noscriptText,
	} = options;
	const fontId = snapshot.configuration.presentationFont;

	const [fontAsset, faviconBytes, runtimeScriptText] = await Promise.all([
		fetchPresentationFontAsset(fontId),
		fetchFaviconBytes(),
		fetchPresentationRuntimeScript(),
	]);

	const fontFaceCss = buildFontFaceCss(fontId, (file) => {
		const fetched = fontAsset.files.find(
			(candidate) => candidate.path === file.path,
		);
		if (!fetched) {
			throw new Error(`Missing fetched font file for "${file.path}"`);
		}
		return bytesToDataUrl(fetched.bytes, "font/woff2");
	});
	const css = composeArtifactCss(fontFaceCss, presentationCssRaw, frameCssRaw);

	const brandingSrc =
		snapshot.branding.kind === "asset" && snapshot.brandingAssetBytes
			? bytesToDataUrl(snapshot.brandingAssetBytes, BRANDING_IMAGE_MIME)
			: undefined;

	const presentationMarkup = buildComparisonArtifactMarkup({
		presentation: snapshot.presentation,
		visibility: snapshot.visibility,
		configuration: snapshot.configuration,
		branding: snapshot.branding,
		assets: {
			referenceSrc: bytesToDataUrl(
				snapshot.referenceImageBytes,
				COMPARISON_IMAGE_MIME,
			),
			captureSrc: bytesToDataUrl(
				snapshot.captureImageBytes,
				COMPARISON_IMAGE_MIME,
			),
			brandingSrc,
		},
		copy,
		presentationFontFamily: resolvePresentationFontFamily(fontId),
		initialSliderPosition: snapshot.initialSliderPosition,
		// Standalone HTML always renders exactly one instance per document
		// (docs/IMPLEMENTATION_PLAN_V1.md Phase 13) — preserves every existing
		// `sameview-*` id byte-for-byte.
		instanceMode: { kind: "single-instance-legacy" },
	});

	const faviconMarkup = `<link rel="icon" type="${FAVICON_MIME}" href="${bytesToDataUrl(faviconBytes, FAVICON_MIME)}">`;

	const html = buildArtifactDocument({
		locale,
		titleText,
		metaDescriptionText,
		themeColor,
		includeOpenGraph: false,
		faviconMarkup,
		cssMarkup: `<style>\n${css}\n</style>`,
		presentationMarkup,
		scriptMarkup: `<script>\n${escapeClosingTag(runtimeScriptText, "script")}\n</script>`,
		fontLicenseText: fontAsset.licenseText,
		noscriptText,
	});

	return new TextEncoder().encode(html);
}
