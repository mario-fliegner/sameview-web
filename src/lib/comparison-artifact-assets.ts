// Fetches the static, build-time-known bytes a generated Standalone
// HTML/Static Microsite needs beyond the Outcome Snapshot itself: the
// selected Presentation Font's own file(s) and license text
// (src/lib/presentation-font-assets.ts), the application's existing favicon
// (`public/favicon.svg`), the Comparison Presentation runtime script (in its
// readable and Static-Microsite-only minified variants) and the
// Static-Microsite-only minified Presentation CSS — all already deployed,
// same-origin static assets, fetched once at generation time
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 9). A fetch failure here fails
// generation atomically — no partial artifact is ever produced
// (docs/APPLICATION_LAYOUT.md "Progress"; the caller, not this module,
// decides how that surfaces in the Output Inspector).

import {
	getPresentationFontAsset,
	type PresentationFontAsset,
} from "./presentation-font-assets.ts";
import type { PresentationFontId } from "./presentation-fonts.ts";

export interface FetchedFontFile {
	readonly path: string;
	readonly weight: number;
	readonly format: "woff2";
	readonly bytes: Uint8Array;
}

export interface FetchedFontAsset {
	readonly asset: PresentationFontAsset;
	readonly files: readonly FetchedFontFile[];
	readonly licenseText: string;
}

async function fetchBytes(publicPath: string): Promise<Uint8Array> {
	const response = await fetch(`/fonts/${publicPath}`);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch font asset "${publicPath}": ${response.status}`,
		);
	}
	return new Uint8Array(await response.arrayBuffer());
}

export async function fetchPresentationFontAsset(
	id: PresentationFontId,
): Promise<FetchedFontAsset> {
	const asset = getPresentationFontAsset(id);
	const files = await Promise.all(
		asset.files.map(async (file) => ({
			path: file.path,
			weight: file.weight,
			format: file.format,
			bytes: await fetchBytes(file.path),
		})),
	);
	const licenseResponse = await fetch(`/fonts/${asset.licensePath}`);
	if (!licenseResponse.ok) {
		throw new Error(
			`Failed to fetch font license "${asset.licensePath}": ${licenseResponse.status}`,
		);
	}
	const licenseText = await licenseResponse.text();
	return { asset, files, licenseText };
}

export async function fetchFaviconBytes(): Promise<Uint8Array> {
	const response = await fetch("/favicon.svg");
	if (!response.ok) {
		throw new Error(`Failed to fetch favicon: ${response.status}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

// The bundled, self-contained Comparison Presentation runtime script —
// pre-built by scripts/build-presentation-runtime.mjs (`pnpm build:runtime`,
// wired into both `pnpm dev` and `pnpm build`) into `public/generated/`,
// served as an ordinary static asset identically in dev and production,
// exactly like `public/fonts/**`. See that script's own header comment for
// why a Vite `?worker&url` import (the first approach tried here) does not
// work: it only yields a truly pre-bundled file during `vite build`, not
// `vite dev`. Fetched as text, never executed here — both generators
// embed/copy it unchanged.
//
// Two variants exist, both built from the exact same runtime source
// (scripts/build-presentation-runtime.mjs `buildPresentationRuntimeCode`):
// "readable" is the existing script Standalone HTML embeds; "minified" is
// used exclusively by src/lib/generate-static-microsite.ts.
const PRESENTATION_RUNTIME_SCRIPT_PATH: Record<
	"readable" | "minified",
	string
> = {
	readable: "/generated/comparison-presentation-runtime.js",
	minified: "/generated/comparison-presentation-runtime.min.js",
};

export async function fetchPresentationRuntimeScript(
	variant: "readable" | "minified" = "readable",
): Promise<string> {
	const response = await fetch(PRESENTATION_RUNTIME_SCRIPT_PATH[variant]);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch presentation runtime script (${variant}): ${response.status}`,
		);
	}
	return response.text();
}

// The minified Presentation CSS (src/styles/comparison-presentation.css +
// src/styles/comparison-artifact-frame.css), pre-built by
// scripts/build-presentation-runtime.mjs `buildPresentationCssCode` into
// `public/generated/comparison-presentation.min.css` — used exclusively by
// src/lib/generate-static-microsite.ts. Standalone HTML never calls this: it
// keeps reading these same two source files unminified via its own existing
// `?raw` imports.
const PRESENTATION_CSS_MINIFIED_PATH =
	"/generated/comparison-presentation.min.css";

export async function fetchPresentationCssMinified(): Promise<string> {
	const response = await fetch(PRESENTATION_CSS_MINIFIED_PATH);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch minified presentation CSS: ${response.status}`,
		);
	}
	return response.text();
}
