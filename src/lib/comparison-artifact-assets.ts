// Fetches the static, build-time-known bytes a generated Standalone
// HTML/Static Microsite needs beyond the Outcome Snapshot itself: the
// selected Presentation Font's own file(s) and license text
// (src/lib/presentation-font-assets.ts), and the application's existing
// favicon (`public/favicon.svg`) — both already deployed, same-origin
// static assets, fetched once at generation time and shared unchanged by
// both output types (docs/IMPLEMENTATION_PLAN_V1.md Phase 9). A fetch
// failure here fails generation atomically — no partial artifact is ever
// produced (docs/APPLICATION_LAYOUT.md "Progress"; the caller, not this
// module, decides how that surfaces in the Output Inspector).

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
// wired into both `pnpm dev` and `pnpm build`) into
// `public/generated/comparison-presentation-runtime.js`, served as an
// ordinary static asset identically in dev and production, exactly like
// `public/fonts/**`. See that script's own header comment for why a Vite
// `?worker&url` import (the first approach tried here) does not work: it
// only yields a truly pre-bundled file during `vite build`, not `vite dev`.
// Fetched as text, never executed here — both generators embed/copy it
// unchanged.
const PRESENTATION_RUNTIME_SCRIPT_PATH =
	"/generated/comparison-presentation-runtime.js";

export async function fetchPresentationRuntimeScript(): Promise<string> {
	const response = await fetch(PRESENTATION_RUNTIME_SCRIPT_PATH);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch presentation runtime script: ${response.status}`,
		);
	}
	return response.text();
}
