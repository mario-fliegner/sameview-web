// Generates the unified WordPress Comparison-package artifact
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 15; docs/WORDPRESS_INTEGRATION.md
// "First Installation"; docs/EMBED_IN_WEBSITE.md "Persistent Integration
// Model"). One ZIP, used identically both for a fresh native WordPress
// plugin install and for a later `SameView → Add comparison` upload
// (docs/WORDPRESS_INTEGRATION.md: "SameView Web generates the same kind of
// downloadable package ... regardless of whether the target site already
// has the SameView plugin installed") — this module never asks or infers
// which case applies, and never produces a second, smaller package shape.
//
// Contains the Phase 14 plugin's own static PHP files, copied verbatim at
// SameView Web's own build time (scripts/build-wordpress-plugin-assets.mjs,
// fetched here via src/lib/comparison-artifact-assets.ts
// `fetchWordPressPluginFiles()`) — never generated, transformed or
// duplicated in this module — plus one `seed/comparison.json` manifest and
// the Outcome Snapshot's own already privacy-processed image bytes, under
// `sameview-comparisons/seed/`.
//
// `comparison.json` (see `buildComparisonManifest` below) is a direct,
// mechanical serialization of the existing approved Outcome Snapshot's own
// allowlisted fields (docs/IMPORTED_COMPARISON_V1.md "Outcome and
// Publication Data") — never a second, WordPress-specific semantic Outcome
// model. The only addition is `formatVersion`, a transport/package concern,
// not Comparison content (docs/WORDPRESS_INTEGRATION.md "Persistent
// Integration Versioning": "If a newer Comparison format is imported into an
// older integration that cannot fully understand it, the import is rejected
// completely").
//
// docs/IMPLEMENTATION_PLAN_V1.md Phase 16 additionally packages the WordPress
// Embed runtime/CSS/fonts here — see `WORDPRESS_EMBED_ASSET_PATHS` below —
// the one place SameView Web's own compiled build output
// (scripts/build-presentation-runtime.mjs `buildComparisonEmbedRuntimeCode()`/
// `buildComparisonEmbedCssCode()`) enters the generated ZIP. These are never
// committed as generated files inside integrations/wordpress/ itself
// (Phase 16 Decision 72) — the plugin's own PHP never builds Presentation
// markup; it only resolves data and hands it to this same compiled runtime
// at WordPress render time (docs/WORDPRESS_INTEGRATION.md "Placement": "no
// PHP reimplementation of Presentation rendering").

import {
	TextReader,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipWriter,
} from "@zip.js/zip.js";
import {
	fetchComparisonEmbedCss,
	fetchComparisonEmbedRuntimeScript,
	fetchPresentationFontAsset,
	fetchWordPressPluginFiles,
} from "./comparison-artifact-assets.ts";
import type { OutcomeSnapshot } from "./outcome-snapshot.ts";
import { PRESENTATION_FONT_IDS } from "./presentation-fonts.ts";

export const WORDPRESS_PACKAGE_FILENAME = "sameview-comparisons-wordpress.zip";

// Bumped only if this manifest's own shape changes in a way an older
// integration could not safely interpret (docs/WORDPRESS_INTEGRATION.md
// "Persistent Integration Versioning") — never for ordinary Comparison
// content changes, which `outcomeFingerprint` already exists to detect.
export const COMPARISON_MANIFEST_FORMAT_VERSION = 1;

// Every field here already exists, unchanged, on the Outcome Snapshot
// itself (src/lib/outcome-snapshot.ts) — this is a transport shape, not a
// second semantic model. `formatVersion` is the one addition, and is a
// package/transport concern, not Comparison content.
export interface ComparisonManifest {
	readonly formatVersion: number;
	readonly sessionId: string;
	readonly outcomeFingerprint: string;
	readonly presentation: OutcomeSnapshot["presentation"];
	readonly visibility: OutcomeSnapshot["visibility"];
	readonly configuration: OutcomeSnapshot["configuration"];
	readonly initialSliderPosition: number;
	readonly branding: OutcomeSnapshot["branding"];
}

// The exact, mechanical Outcome-Snapshot-to-manifest mapping (see this
// file's own header comment for why no field here is invented). Image
// bytes and the optional branding asset are not part of this JSON — they
// are packaged as their own separate files alongside it, exactly like
// every other generated output already does (src/lib/generate-static-microsite.ts
// `images/reference.jpg` etc.).
export function buildComparisonManifest(
	snapshot: OutcomeSnapshot,
): ComparisonManifest {
	return {
		formatVersion: COMPARISON_MANIFEST_FORMAT_VERSION,
		sessionId: snapshot.session.id,
		outcomeFingerprint: snapshot.outcomeFingerprint,
		presentation: snapshot.presentation,
		visibility: snapshot.visibility,
		configuration: snapshot.configuration,
		initialSliderPosition: snapshot.initialSliderPosition,
		branding: snapshot.branding,
	};
}

export interface GenerateWordPressPackageOptions {
	readonly snapshot: OutcomeSnapshot;
}

export async function generateWordPressPackage(
	options: GenerateWordPressPackageOptions,
): Promise<Uint8Array> {
	const { snapshot } = options;
	const [pluginFiles, embedRuntimeScript, embedCss, fontAssets] =
		await Promise.all([
			fetchWordPressPluginFiles(),
			fetchComparisonEmbedRuntimeScript(),
			fetchComparisonEmbedCss(),
			Promise.all(PRESENTATION_FONT_IDS.map(fetchPresentationFontAsset)),
		]);
	const manifest = buildComparisonManifest(snapshot);
	const hasBrandingAsset =
		snapshot.branding.kind === "asset" &&
		snapshot.brandingAssetBytes !== undefined;

	const zipWriter = new ZipWriter(new Uint8ArrayWriter());
	for (const file of pluginFiles) {
		await zipWriter.add(file.path, new Uint8ArrayReader(file.bytes));
	}
	await zipWriter.add(
		"sameview-comparisons/seed/comparison.json",
		new TextReader(JSON.stringify(manifest, null, "\t")),
	);
	await zipWriter.add(
		"sameview-comparisons/seed/reference.jpg",
		new Uint8ArrayReader(snapshot.referenceImageBytes),
	);
	await zipWriter.add(
		"sameview-comparisons/seed/capture.jpg",
		new Uint8ArrayReader(snapshot.captureImageBytes),
	);
	if (hasBrandingAsset && snapshot.brandingAssetBytes) {
		await zipWriter.add(
			"sameview-comparisons/seed/branding.png",
			new Uint8ArrayReader(snapshot.brandingAssetBytes),
		);
	}

	// docs/IMPLEMENTATION_PLAN_V1.md Phase 16: the shared Embed runtime/CSS,
	// plus every Presentation Font's own file(s) and license (unlike
	// Standalone HTML/Static Microsite, never just the one selected font —
	// see scripts/build-presentation-runtime.mjs `buildComparisonEmbedCssCode()`
	// for why). Placed under a fixed relative layout the pre-built
	// `comparison-embed.css` text above already assumes (`../fonts/...` from
	// its own `assets/embed/` location).
	await zipWriter.add(
		"sameview-comparisons/assets/embed/comparison-embed-runtime.js",
		new TextReader(embedRuntimeScript),
	);
	await zipWriter.add(
		"sameview-comparisons/assets/embed/comparison-embed.css",
		new TextReader(embedCss),
	);
	for (const fontAsset of fontAssets) {
		for (const file of fontAsset.files) {
			await zipWriter.add(
				`sameview-comparisons/assets/fonts/${file.path}`,
				new Uint8ArrayReader(file.bytes),
			);
		}
		await zipWriter.add(
			`sameview-comparisons/assets/fonts/${fontAsset.asset.licensePath}`,
			new TextReader(fontAsset.licenseText),
		);
	}

	return zipWriter.close();
}
