// Generates the Static Microsite artifact (docs/APPLICATION_LAYOUT.md
// "Static Microsite"; docs/IMPLEMENTATION_PLAN_V1.md Phase 9): a
// `sameview-comparison.zip` with no additional outer root folder,
// containing exactly `index.html`, `favicon.svg`, `css/sameview-comparison.css`,
// `js/sameview-comparison.js`, `images/reference.jpg`, `images/capture.jpg`,
// `images/branding.png` (only when a branding asset is actually present)
// and `fonts/<only the selected Presentation Font's own file(s)>` plus its
// license file. Shares every actual rendering/behavior source with
// src/lib/generate-standalone-html.ts — the two differ only in how each
// section's content is packaged (external file vs. inline).

import {
	TextReader,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipWriter,
} from "@zip.js/zip.js";
import frameCssRaw from "../styles/comparison-artifact-frame.css?raw";
import presentationCssRaw from "../styles/comparison-presentation.css?raw";
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
import type { OutcomeSnapshot } from "./outcome-snapshot.ts";
import { buildFontFaceCss } from "./presentation-font-assets.ts";
import { resolvePresentationFontFamily } from "./presentation-fonts.ts";

export const STATIC_MICROSITE_FILENAME = "sameview-comparison.zip";

export interface GenerateStaticMicrositeOptions {
	readonly snapshot: OutcomeSnapshot;
	readonly copy: ComparisonArtifactCopy;
	readonly titleText: string;
	readonly metaDescriptionText: string;
	readonly themeColor: string;
}

function basename(path: string): string {
	const parts = path.split("/");
	return parts[parts.length - 1] ?? path;
}

export async function generateStaticMicrosite(
	options: GenerateStaticMicrositeOptions,
): Promise<Uint8Array> {
	const { snapshot, copy, titleText, metaDescriptionText, themeColor } =
		options;
	const fontId = snapshot.configuration.presentationFont;

	const [fontAsset, faviconBytes, runtimeScriptText] = await Promise.all([
		fetchPresentationFontAsset(fontId),
		fetchFaviconBytes(),
		fetchPresentationRuntimeScript(),
	]);

	// Relative from `css/sameview-comparison.css` up to the zip-root-level
	// `fonts/` folder — see this module's own header comment for the exact
	// packaged structure.
	const fontFaceCss = buildFontFaceCss(
		fontId,
		(file) => `../fonts/${basename(file.path)}`,
	);
	const css = composeArtifactCss(fontFaceCss, presentationCssRaw, frameCssRaw);

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
	});

	const html = buildArtifactDocument({
		titleText,
		metaDescriptionText,
		themeColor,
		faviconMarkup:
			'<link rel="icon" type="image/svg+xml" href="favicon.svg" />',
		cssMarkup: '<link rel="stylesheet" href="css/sameview-comparison.css" />',
		presentationMarkup,
		scriptMarkup: '<script src="js/sameview-comparison.js"></script>',
		fontLicenseText: fontAsset.licenseText,
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
