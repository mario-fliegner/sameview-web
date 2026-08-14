// Generates the unified Joomla Comparison-package artifact
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 21/22; docs/JOOMLA_INTEGRATION.md
// "First Installation", "Persistent Integration"; docs/EMBED_IN_WEBSITE.md
// "Persistent Integration Model"). One ZIP, used identically both for a
// fresh native Joomla extension install and for a later `Add comparison`
// upload (docs/JOOMLA_INTEGRATION.md: "SameView Web generates the same kind
// of downloadable package for Joomla regardless of whether the target site
// already has the SameView integration installed") — this module never
// asks or infers which case applies, and never produces a second, smaller
// package shape.
//
// Structurally NOT a copy of src/lib/generate-wordpress-package.ts's own
// package shape: the generated ZIP is a real native Joomla package
// extension (`pkg_sameviewcomparisons.xml` at the package's own root,
// bundling the component + companion content/editors-xtd plugins + module
// as sibling folders, per docs/JOOMLA_INTEGRATION.md "Persistent
// Integration"). `seed/` is deliberately nested inside the
// `com_sameviewcomparisons/` sub-folder (sibling to its own
// `sameviewcomparisons.xml`), not declared anywhere in that component's own
// `<files>`/`<media>` manifest sections, so Joomla's installer never copies
// it into the permanent install location — confirmed empirically against
// real Joomla 6 and Joomla 5 instances (docs/IMPLEMENTATION_PLAN_V1.md
// Phase 22) that `Com_SameviewcomparisonsInstallerScript::install()` can
// still read it via `$parent->getParent()->getPath('source') . '/seed'`
// even when installed as a package child: Joomla's own PackageAdapter
// installs each bundled folder through a fresh `Installer` pointed directly
// at that folder (never a second unpack/copy step), so the component's own
// install-time "source" path is exactly its own sub-folder inside the
// already-extracted package — unchanged relative to the component-only
// Phase 21 package this replaces.
//
// `comparison.json` (src/lib/comparison-manifest.ts `buildComparisonManifest`)
// is the same platform-neutral manifest src/lib/generate-wordpress-package.ts
// uses — never a second, Joomla-specific semantic Outcome model.
//
// Packages the shared Embed runtime/CSS/fonts (docs/IMPLEMENTATION_PLAN_V1.md
// Phase 22, mirroring WordPress's own Phase 16) under
// `com_sameviewcomparisons/media/js/` and `.../media/fonts/` — the exact
// sibling-file layout src/lib/comparison-embed-runtime-entry.ts and the
// pre-built CSS already assume (runtime script + CSS as siblings inside
// `js/`; `fonts/` as a sibling of `js/`, matched by the CSS's own
// `../fonts/...` references). The `js/` folder name is not arbitrary:
// confirmed against real Joomla 6 core (Joomla\CMS\WebAsset\WebAssetItem::
// resolvePath()) that a script-type Web Asset's `uri` always resolves
// through a hardcoded `<extension>/js/<file>` path under `/media/` —
// see com_sameviewcomparisons/sameviewcomparisons.xml's own `<media>`
// comment for the full empirical trace. The CSS itself is never registered
// as a Web Asset (only fetched by the runtime script relative to its own
// URL), so it simply sits alongside the script in that same `js/` folder.
// `com_sameviewcomparisons/media/joomla.asset.json` is the one static,
// committed file registering `com_sameviewcomparisons/comparison-embed-runtime.js`
// as a native Joomla Web Asset — never committed as a generated file inside
// this integration area itself (mirrors the WordPress integration's own
// Phase 16 Decision 72).

import {
	TextReader,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipWriter,
} from "@zip.js/zip.js";
import {
	fetchComparisonEmbedCss,
	fetchComparisonEmbedRuntimeScript,
	fetchJoomlaExtensionFiles,
	fetchPresentationFontAsset,
} from "./comparison-artifact-assets.ts";
import { buildComparisonManifest } from "./comparison-manifest.ts";
import type { OutcomeSnapshot } from "./outcome-snapshot.ts";
import { PRESENTATION_FONT_IDS } from "./presentation-fonts.ts";

export const JOOMLA_PACKAGE_FILENAME = "sameview-comparisons-joomla.zip";

// Every bundled Comparison seed/runtime asset lives nested inside the
// component's own sub-folder within the package zip — see this module's own
// header comment for why.
const COMPONENT_DIR = "com_sameviewcomparisons";

export interface GenerateJoomlaPackageOptions {
	readonly snapshot: OutcomeSnapshot;
}

export async function generateJoomlaPackage(
	options: GenerateJoomlaPackageOptions,
): Promise<Uint8Array> {
	const { snapshot } = options;
	const [extensionFiles, embedRuntimeScript, embedCss, fontAssets] =
		await Promise.all([
			fetchJoomlaExtensionFiles(),
			fetchComparisonEmbedRuntimeScript(),
			fetchComparisonEmbedCss(),
			Promise.all(PRESENTATION_FONT_IDS.map(fetchPresentationFontAsset)),
		]);
	const manifest = buildComparisonManifest(snapshot);
	const hasBrandingAsset =
		snapshot.branding.kind === "asset" &&
		snapshot.brandingAssetBytes !== undefined;

	const zipWriter = new ZipWriter(new Uint8ArrayWriter());
	for (const file of extensionFiles) {
		await zipWriter.add(file.path, new Uint8ArrayReader(file.bytes));
	}
	await zipWriter.add(
		`${COMPONENT_DIR}/seed/comparison.json`,
		new TextReader(JSON.stringify(manifest, null, "\t")),
	);
	await zipWriter.add(
		`${COMPONENT_DIR}/seed/reference.jpg`,
		new Uint8ArrayReader(snapshot.referenceImageBytes),
	);
	await zipWriter.add(
		`${COMPONENT_DIR}/seed/capture.jpg`,
		new Uint8ArrayReader(snapshot.captureImageBytes),
	);
	if (hasBrandingAsset && snapshot.brandingAssetBytes) {
		await zipWriter.add(
			`${COMPONENT_DIR}/seed/branding.png`,
			new Uint8ArrayReader(snapshot.brandingAssetBytes),
		);
	}

	await zipWriter.add(
		`${COMPONENT_DIR}/media/js/comparison-embed-runtime.js`,
		new TextReader(embedRuntimeScript),
	);
	await zipWriter.add(
		`${COMPONENT_DIR}/media/js/comparison-embed.css`,
		new TextReader(embedCss),
	);
	for (const fontAsset of fontAssets) {
		for (const file of fontAsset.files) {
			await zipWriter.add(
				`${COMPONENT_DIR}/media/fonts/${file.path}`,
				new Uint8ArrayReader(file.bytes),
			);
		}
		await zipWriter.add(
			`${COMPONENT_DIR}/media/fonts/${fontAsset.asset.licensePath}`,
			new TextReader(fontAsset.licenseText),
		);
	}

	return zipWriter.close();
}
