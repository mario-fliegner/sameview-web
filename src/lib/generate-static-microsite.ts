// Generates the Static Microsite artifact (docs/APPLICATION_LAYOUT.md
// "Static Microsite"; docs/IMPLEMENTATION_PLAN_V1.md Phase 9): a
// `sameview-comparison.zip` with no additional outer root folder,
// containing exactly `index.html`, `favicon.svg`, `css/sameview-comparison.css`,
// `js/sameview-comparison.js`, `images/reference.jpg`, `images/capture.jpg`,
// `images/branding.png` (only when a branding asset is actually present)
// and `fonts/<only the selected Presentation Font's own file(s)>` plus its
// license file. Shares every actual rendering/behavior source with
// src/lib/generate-standalone-html.ts — the two differ only in how each
// section's content is packaged (external file vs. inline), and in that
// `css/sameview-comparison.css`/`js/sameview-comparison.js` are packaged in
// already-minified form (docs/IMPLEMENTATION_PLAN_V1.md Phase 9) — built
// from that exact same shared source via
// scripts/build-presentation-runtime.mjs, never a second implementation.
// `index.html` itself stays readable, exactly like Standalone HTML.

import {
	TextReader,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipWriter,
} from "@zip.js/zip.js";
import type { Locale } from "../i18n/translations.ts";
import {
	fetchFaviconBytes,
	fetchPresentationCssMinified,
	fetchPresentationFontAsset,
	fetchPresentationRuntimeScript,
} from "./comparison-artifact-assets.ts";
import {
	buildComparisonArtifactMarkup,
	type ComparisonArtifactCopy,
} from "./comparison-artifact-markup.ts";
import { buildArtifactDocument } from "./comparison-artifact-scaffold.ts";
import type { OutcomeSnapshot } from "./outcome-snapshot.ts";
import { buildFontFaceCss } from "./presentation-font-assets.ts";
import { resolvePresentationFontFamily } from "./presentation-fonts.ts";

export const STATIC_MICROSITE_FILENAME = "sameview-comparison.zip";

export interface GenerateStaticMicrositeOptions {
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

function basename(path: string): string {
	const parts = path.split("/");
	return parts[parts.length - 1] ?? path;
}

export async function generateStaticMicrosite(
	options: GenerateStaticMicrositeOptions,
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

	const [fontAsset, faviconBytes, runtimeScriptText, presentationCssMinified] =
		await Promise.all([
			fetchPresentationFontAsset(fontId),
			fetchFaviconBytes(),
			fetchPresentationRuntimeScript("minified"),
			fetchPresentationCssMinified(),
		]);

	// Relative from `css/sameview-comparison.css` up to the zip-root-level
	// `fonts/` folder — see this module's own header comment for the exact
	// packaged structure. `compact: true` keeps this dynamically generated
	// rule consistent with the already-minified `presentationCssMinified`
	// fetched above (src/lib/comparison-artifact-assets.ts
	// `fetchPresentationCssMinified`, built by
	// scripts/build-presentation-runtime.mjs `buildPresentationCssCode`) —
	// same fixed order as the shared `composeArtifactCss` uses for Standalone
	// HTML: `@font-face` first, then Presentation CSS, then Frame CSS (already
	// concatenated in that order inside `presentationCssMinified` itself).
	const fontFaceCss = buildFontFaceCss(
		fontId,
		(file) => `../fonts/${basename(file.path)}`,
		{ compact: true },
	);
	const css = `${fontFaceCss}\n${presentationCssMinified}`;

	const hasBrandingAsset =
		snapshot.branding.kind === "asset" &&
		snapshot.brandingAssetBytes !== undefined;

	const presentationMarkup = buildComparisonArtifactMarkup({
		presentation: snapshot.presentation,
		visibility: snapshot.visibility,
		configuration: snapshot.configuration,
		branding: snapshot.branding,
		assets: {
			referenceSrc: "images/reference.jpg",
			captureSrc: "images/capture.jpg",
			brandingSrc: hasBrandingAsset ? "images/branding.png" : undefined,
		},
		copy,
		presentationFontFamily: resolvePresentationFontFamily(fontId),
		initialSliderPosition: snapshot.initialSliderPosition,
		// Static Microsite always renders exactly one instance per document
		// (docs/IMPLEMENTATION_PLAN_V1.md Phase 13) — preserves every existing
		// `sameview-*` id byte-for-byte.
		instanceMode: { kind: "single-instance-legacy" },
	});

	const html = buildArtifactDocument({
		locale,
		titleText,
		metaDescriptionText,
		themeColor,
		includeOpenGraph: true,
		faviconMarkup: '<link rel="icon" type="image/svg+xml" href="favicon.svg">',
		cssMarkup: '<link rel="stylesheet" href="css/sameview-comparison.css">',
		presentationMarkup,
		scriptMarkup: '<script src="js/sameview-comparison.js"></script>',
		fontLicenseText: fontAsset.licenseText,
		noscriptText,
	});

	const zipWriter = new ZipWriter(new Uint8ArrayWriter());
	await zipWriter.add("index.html", new TextReader(html));
	await zipWriter.add("favicon.svg", new Uint8ArrayReader(faviconBytes));
	await zipWriter.add("css/sameview-comparison.css", new TextReader(css));
	await zipWriter.add(
		"js/sameview-comparison.js",
		new TextReader(runtimeScriptText),
	);
	await zipWriter.add(
		"images/reference.jpg",
		new Uint8ArrayReader(snapshot.referenceImageBytes),
	);
	await zipWriter.add(
		"images/capture.jpg",
		new Uint8ArrayReader(snapshot.captureImageBytes),
	);
	if (hasBrandingAsset && snapshot.brandingAssetBytes) {
		await zipWriter.add(
			"images/branding.png",
			new Uint8ArrayReader(snapshot.brandingAssetBytes),
		);
	}
	for (const file of fontAsset.files) {
		await zipWriter.add(
			`fonts/${basename(file.path)}`,
			new Uint8ArrayReader(file.bytes),
		);
	}
	await zipWriter.add(
		`fonts/${fontAsset.asset.licenseFileName}`,
		new TextReader(fontAsset.licenseText),
	);

	return zipWriter.close();
}
