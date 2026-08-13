// The bundle entry point for the WordPress Embed runtime
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 16; docs/WORDPRESS_INTEGRATION.md
// "Placement"). Bundled by scripts/build-presentation-runtime.mjs
// `buildComparisonEmbedRuntimeCode()` into one self-contained,
// dependency-free plain-JS file, fetched by
// src/lib/comparison-artifact-assets.ts and packaged into the generated
// WordPress ZIP by src/lib/generate-wordpress-package.ts — never committed
// as a generated file inside integrations/wordpress/.
//
// Deliberately the smallest possible pairing of the two already-shared,
// unmodified modules every other output already uses:
// - src/lib/comparison-artifact-markup.ts `buildComparisonArtifactMarkup`
//   (always called with `instanceMode: { kind: "multi-instance" }` — see
//   that module's own header comment for why this mode has nothing to
//   collide, by construction, regardless of how many placements share a
//   page)
// - src/lib/comparison-presentation-runtime.ts `initComparisonPresentation`
//   (already Phase-13 multi-instance-safe: discovers and initializes every
//   `.presentation-canvas` root, and is itself a safe no-op for any root
//   already initialized)
//
// This is the one new thing neither of those modules does on its own: the
// WordPress plugin's PHP side never builds Presentation markup itself (no
// PHP rendering clone, per docs/WORDPRESS_INTEGRATION.md "Placement") — it
// only resolves `session.id`, the stored manifest, asset URLs and
// WordPress-localized copy strings, and emits one plain container element
// per placement carrying that data as a JSON payload
// (`data-sameview-embed="..."`). This module finds those containers, builds
// their markup client-side from the exact same source every other output
// uses, and wires up interaction — never a second renderer.
//
// Exposed as `window.SameViewComparisonEmbed` for two consumption modes:
// - the public frontend calls nothing explicitly — `mountAll(document)` runs
//   once automatically, as soon as the DOM is ready, mirroring
//   src/lib/comparison-presentation-runtime-entry.ts's own
//   self-executing pattern;
// - the Block Editor's own editor script calls `mount()`/`mountAll()`
//   explicitly and repeatedly (once per selection change), since the
//   editor's preview container is created and repopulated dynamically
//   rather than once at page load.

import {
	type BuildComparisonArtifactMarkupInput,
	buildComparisonArtifactMarkup,
} from "./comparison-artifact-markup.ts";
import { initComparisonPresentation } from "./comparison-presentation-runtime.ts";
import {
	isPresentationFontId,
	resolvePresentationFontFamily,
} from "./presentation-fonts.ts";

// Everything a placement's markup needs except `instanceMode` (always
// "multi-instance" here — see this file's own header comment) and
// `presentationFontFamily` (derived below from `configuration.presentationFont`,
// exactly like every other generator already does — the WordPress PHP side
// never resolves a font family itself, it only forwards the stored
// `configuration` object unchanged).
export type ComparisonEmbedPayload = Omit<
	BuildComparisonArtifactMarkupInput,
	"instanceMode" | "presentationFontFamily"
>;

const CONTAINER_ATTR = "data-sameview-embed";
const MOUNTED_DATA_KEY = "sameviewEmbedMounted";

export function mount(
	container: HTMLElement,
	payload: ComparisonEmbedPayload,
): void {
	const fontId = payload.configuration.presentationFont;
	const presentationFontFamily = resolvePresentationFontFamily(
		isPresentationFontId(fontId) ? fontId : "inter",
	);
	container.innerHTML = buildComparisonArtifactMarkup({
		...payload,
		presentationFontFamily,
		instanceMode: { kind: "multi-instance" },
	});
	initComparisonPresentation();
}

function mountFromContainer(container: HTMLElement): void {
	if (container.dataset[MOUNTED_DATA_KEY] === "true") return;
	const raw = container.getAttribute(CONTAINER_ATTR);
	if (!raw) return;
	// Marked before parsing so a malformed payload is never retried on every
	// subsequent `mountAll()` call (e.g. the editor re-running it after every
	// selection change) — this one placement simply stays empty.
	container.dataset[MOUNTED_DATA_KEY] = "true";
	try {
		const payload = JSON.parse(raw) as ComparisonEmbedPayload;
		mount(container, payload);
	} catch {
		// Malformed/missing payload: leave this one placement empty rather than
		// let it break every other placement on the same page.
	}
}

export function mountAll(root: ParentNode): void {
	for (const container of root.querySelectorAll<HTMLElement>(
		`[${CONTAINER_ATTR}]`,
	)) {
		mountFromContainer(container);
	}
}

declare global {
	interface Window {
		SameViewComparisonEmbed?: {
			readonly mount: typeof mount;
			readonly mountAll: typeof mountAll;
		};
	}
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
	window.SameViewComparisonEmbed = { mount, mountAll };
	const runInitialMount = () => mountAll(document);
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", runInitialMount);
	} else {
		runInitialMount();
	}
}
