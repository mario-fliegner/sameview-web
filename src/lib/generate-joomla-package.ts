// Generates the unified Joomla Comparison-package artifact
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 21; docs/JOOMLA_INTEGRATION.md
// "First Installation"; docs/EMBED_IN_WEBSITE.md "Persistent Integration
// Model"). One ZIP, used identically both for a fresh native Joomla
// extension install and for a later `Add comparison` upload
// (docs/JOOMLA_INTEGRATION.md: "SameView Web generates the same kind of
// downloadable package for Joomla regardless of whether the target site
// already has the SameView integration installed") — this module never
// asks or infers which case applies, and never produces a second, smaller
// package shape.
//
// Structurally NOT a copy of src/lib/generate-wordpress-package.ts's own
// package shape: confirmed against real Joomla 6.1.2/5.4.7 instances
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 19) that a Joomla install package
// needs its manifest XML (`sameviewcomparisons.xml`) and `script.php` at
// the package's own root, never nested under a slug folder the way
// WordPress's plugin folder convention requires. `seed/` is deliberately
// its own root-level directory, not declared anywhere in the extension's
// own `<files>` manifest section, so Joomla's installer never copies it
// into the permanent install location — confirmed empirically
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 21) that
// `Com_SameviewcomparisonsInstallerScript::install()` can read it directly
// from the installer's own temporary extraction directory
// (`$parent->getParent()->getPath('source')`) before Joomla's own
// post-install cleanup removes it.
//
// `comparison.json` (src/lib/comparison-manifest.ts `buildComparisonManifest`)
// is the same platform-neutral manifest src/lib/generate-wordpress-package.ts
// uses — never a second, Joomla-specific semantic Outcome model.
//
// Does not yet package the shared Embed runtime/CSS/fonts
// (src/lib/generate-wordpress-package.ts does, since WordPress Phase 16 —
// see that module's own header comment): Joomla Placement is Phase 22, per
// docs/IMPLEMENTATION_PLAN_V1.md Phase 21 "Not included". Adding those
// assets here now would pull Phase 22 work forward.

import {
	TextReader,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipWriter,
} from "@zip.js/zip.js";
import { fetchJoomlaExtensionFiles } from "./comparison-artifact-assets.ts";
import { buildComparisonManifest } from "./comparison-manifest.ts";
import type { OutcomeSnapshot } from "./outcome-snapshot.ts";

export const JOOMLA_PACKAGE_FILENAME = "sameview-comparisons-joomla.zip";

export interface GenerateJoomlaPackageOptions {
	readonly snapshot: OutcomeSnapshot;
}

export async function generateJoomlaPackage(
	options: GenerateJoomlaPackageOptions,
): Promise<Uint8Array> {
	const { snapshot } = options;
	const extensionFiles = await fetchJoomlaExtensionFiles();
	const manifest = buildComparisonManifest(snapshot);
	const hasBrandingAsset =
		snapshot.branding.kind === "asset" &&
		snapshot.brandingAssetBytes !== undefined;

	const zipWriter = new ZipWriter(new Uint8ArrayWriter());
	for (const file of extensionFiles) {
		await zipWriter.add(file.path, new Uint8ArrayReader(file.bytes));
	}
	await zipWriter.add(
		"seed/comparison.json",
		new TextReader(JSON.stringify(manifest, null, "\t")),
	);
	await zipWriter.add(
		"seed/reference.jpg",
		new Uint8ArrayReader(snapshot.referenceImageBytes),
	);
	await zipWriter.add(
		"seed/capture.jpg",
		new Uint8ArrayReader(snapshot.captureImageBytes),
	);
	if (hasBrandingAsset && snapshot.brandingAssetBytes) {
		await zipWriter.add(
			"seed/branding.png",
			new Uint8ArrayReader(snapshot.brandingAssetBytes),
		);
	}

	return zipWriter.close();
}
