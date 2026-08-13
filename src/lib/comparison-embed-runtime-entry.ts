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
// - src/lib/comparison-presentation-runtime.ts `initInstance` (Phase 13's
//   own per-root initializer, exported in Phase 17 specifically so this
//   module can initialize one already-known, shadow-rooted canvas
//   directly — `initComparisonPresentation()`'s own `document.querySelectorAll`
//   scan cannot reach inside a Shadow Root, so it is not used here)
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
// docs/IMPLEMENTATION_PLAN_V1.md Phase 17 (Decision 75/76) — host isolation:
// each placement's markup is mounted inside its own Shadow Root, `mode:
// "open"` (inspectable via devtools/real browser tests — nothing about this
// markup is sensitive, and a closed root would block exactly the kind of
// real-browser isolation verification this phase's own Definition of Done
// requires). The Embed CSS is fetched once (module-level cached promise,
// never refetched per placement) and injected as a plain `<style>` element
// inside every Shadow Root — Decision 76 explicitly rules out Constructable
// Stylesheets/`adoptedStyleSheets` for V1. Fetching, not enqueuing via
// `<link>`, is required here specifically because a `<link>` in the host
// document's own `<head>` cannot reach into a Shadow Root at all — that is
// the entire point of using one.
//
// Exposed as `window.SameViewComparisonEmbed` for two consumption modes:
// - the public frontend calls nothing explicitly — `mountAll(document)` runs
//   once automatically, as soon as the DOM is ready, mirroring
//   src/lib/comparison-presentation-runtime-entry.ts's own
//   self-executing pattern;
// - the Block Editor's own editor script calls `mount()`/`mountAll()`
//   explicitly and repeatedly (once per selection change), since the
//   editor's preview container is created and repopulated dynamically
//   rather than once at page load. The exact same Shadow-DOM mounting
//   behavior applies there too — WordPress's own iframed editor canvas is a
//   separate, already-isolating document, but nothing here needs to know or
//   care which context it is running in (Decision 75: "use the same
//   Shadow-DOM mounting behavior in the WordPress frontend and inside
//   WordPress's own editor iframe").

import {
	type BuildComparisonArtifactMarkupInput,
	buildComparisonArtifactMarkup,
} from "./comparison-artifact-markup.ts";
import { initInstance } from "./comparison-presentation-runtime.ts";
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
const EMBED_CSS_FILENAME = "comparison-embed.css";
const EMBED_RUNTIME_FILENAME = "comparison-embed-runtime.js";

// Captured synchronously during this classic script's own top-level
// execution — `document.currentScript` is only ever set while a script is
// actually executing, so this must happen here, at module evaluation, never
// lazily inside `mount()`. Works identically for the public frontend's own
// `wp_enqueue_script()`-loaded copy and the Block Editor's own dynamically
// `document.createElement("script")`-injected copy
// (integrations/wordpress/sameview-comparisons/assets/block/index.js) — both
// are plain classic scripts, and `document.currentScript` is populated
// during a classic script's own synchronous execution regardless of how it
// was inserted. Derives the CSS URL from this script's own URL — the fixed,
// known-at-build-time sibling-file layout
// src/lib/generate-wordpress-package.ts already packages
// (`sameview-comparisons/assets/embed/`) — rather than requiring a second,
// separately-wired value from the WordPress PHP side.
const EMBED_SCRIPT_SRC: string | null =
	typeof document !== "undefined"
		? (document.currentScript?.getAttribute("src") ?? null)
		: null;

let cssTextPromise: Promise<string> | null = null;

// Fetched at most once per page load, however many placements it renders
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 17 Decision 76: "The CSS may be
// fetched/cached once by the Embed runtime and injected into each Shadow
// Root"). A fetch failure (or an environment where the script's own URL
// could not be determined) resolves to an empty string rather than
// rejecting — a placement still mounts and remains interactive, only
// visually unstyled, which is preferable to leaving every placement on the
// page permanently empty over one failed stylesheet fetch.
function loadEmbedCssText(): Promise<string> {
	if (cssTextPromise) return cssTextPromise;
	if (!EMBED_SCRIPT_SRC) {
		cssTextPromise = Promise.resolve("");
		return cssTextPromise;
	}
	const cssUrl = EMBED_SCRIPT_SRC.replace(
		EMBED_RUNTIME_FILENAME,
		EMBED_CSS_FILENAME,
	);
	cssTextPromise = fetch(cssUrl)
		.then((response) => (response.ok ? response.text() : ""))
		.catch(() => "");
	return cssTextPromise;
}

export async function mount(
	container: HTMLElement,
	payload: ComparisonEmbedPayload,
): Promise<void> {
	const fontId = payload.configuration.presentationFont;
	const presentationFontFamily = resolvePresentationFontFamily(
		isPresentationFontId(fontId) ? fontId : "inter",
	);
	const markup = buildComparisonArtifactMarkup({
		...payload,
		presentationFontFamily,
		instanceMode: { kind: "multi-instance" },
	});

	// docs/IMPLEMENTATION_PLAN_V1.md Phase 17 (Decision 75): one Shadow Root
	// per placement, `mode: "open"` — host CSS can never reach in, and this
	// instance's own CSS/DOM/identifiers can never leak out, in either
	// direction, regardless of how many placements share the page.
	const shadowRoot =
		container.shadowRoot ?? container.attachShadow({ mode: "open" });
	const cssText = await loadEmbedCssText();
	// `comparison-presentation-runtime.ts` `requireInstanceFrame()` requires
	// `.presentation-canvas` to have its own parent *element* to measure
	// available space from, deliberately distinct from the canvas itself —
	// the same established Presentation-model invariant every other consumer
	// already satisfies (Standalone HTML's own `<main id="sameview-output-frame">`;
	// the live Workspace Preview's own `.workspace-active__canvas-area`).
	// `.presentation-canvas` cannot be a *direct* child of the Shadow Root
	// itself here for exactly that reason: a `ShadowRoot` is not an
	// `Element`, so `.parentElement` on a direct child of one is always
	// `null`. This wrapper `<div>` is this instance's own frame — an
	// ordinary block-level element already has a genuine, immediately-
	// available width from its own containing block (the Shadow Host's, in
	// turn whatever the WordPress page's own layout provides), with no
	// fixed-viewport positioning trick needed the way Standalone HTML's own
	// single-page frame requires one.
	const frame = document.createElement("div");
	frame.className = "sameview-embed-frame";
	frame.innerHTML = markup;
	shadowRoot.replaceChildren(frame);
	if (cssText) {
		const style = document.createElement("style");
		// `textContent`, never a template-literal-concatenated `innerHTML`
		// string: assigning a text node's content never parses its value as
		// markup, so a stray `</style>` sequence inside the fetched CSS text
		// (never expected from this build, but never assumed either) cannot
		// terminate the element early the way it could via `innerHTML`.
		//
		// docs/IMPLEMENTATION_PLAN_V1.md Phase 17 (Decision 75, "host CSS must
		// not affect the SameView Presentation"): a Shadow Root blocks the
		// *host's own selectors* from ever matching content inside it, but it
		// does not, by itself, block ordinary CSS *inheritance* of inherited
		// properties (`color`, `font-family`, `text-transform`,
		// `letter-spacing`, `line-height`, etc.) from the Shadow Host's own
		// computed style — confirmed empirically against a real hostile-theme
		// simulation whose global `div { text-transform: uppercase; ... }`
		// rule matches the Shadow Host element itself (an ordinary `<div>` in
		// the light DOM) and, absent this reset, was inherited straight
		// through into Presentation Information text that
		// comparison-presentation.css never explicitly sets `text-transform`
		// for. `all: initial` on this wrapper — prepended here, before the
		// fetched Presentation CSS, so the latter's own explicit rules still
		// win by source order at equal specificity — resets every property
		// (inherited or not) to its specified initial value at exactly this
		// boundary, the standard Shadow DOM "reset boundary" pattern; `display:
		// block` immediately restores this element's own required layout
		// role, since `all: initial` would otherwise also reset `display`
		// itself to its own initial value (`inline`); `box-sizing: border-box`
		// (declared after `all: initial` in the same rule, so it wins for
		// that one property) restores the same baseline the second rule below
		// gives every descendant.
		//
		// `box-sizing: border-box` on every descendant: `.presentation-canvas`'s
		// own rule (src/styles/comparison-presentation.css) sets an exact
		// pixel `padding`/`border` alongside a `--canvas-width`/`--canvas-height`
		// computed by src/lib/canvas-geometry.ts that already assumes
		// border-box sizing (that file's own comment: "the box-sizing:
		// border-box reset ... draws the frame border fully inside the
		// already-computed width/height rather than growing the box
		// further") — every other consumer already provides this reset from
		// elsewhere (the live Preview via src/styles/global.css's own
		// site-wide reset; Standalone HTML via src/styles/comparison-artifact-frame.css,
		// deliberately excluded from this embed CSS payload for being
		// single-instance-only). The Embed context has neither, so it must
		// provide the same baseline explicitly, here, rather than silently
		// depending on it.
		style.textContent = `.sameview-embed-frame { all: initial; display: block; box-sizing: border-box; }\n.sameview-embed-frame *, .sameview-embed-frame *::before, .sameview-embed-frame *::after { box-sizing: border-box; }\n${cssText}`;
		shadowRoot.prepend(style);
	}
	const canvas = shadowRoot.querySelector<HTMLElement>(".presentation-canvas");
	if (!canvas) return;
	// docs/IMPLEMENTATION_PLAN_V1.md Phase 17, Decision 77: the Embed context
	// has no externally bounded height (it sits in arbitrary host-page
	// content flow) — `"width-constrained"` derives the required height from
	// the available width instead of reading `outputFrame.clientHeight`,
	// which for this wrapper is only ever an echo of the canvas's own
	// already-rendered height, never an independent constraint.
	initInstance(canvas, { kind: "width-constrained" });
}

function mountFromContainer(container: HTMLElement): void {
	if (container.dataset[MOUNTED_DATA_KEY] === "true") return;
	const raw = container.getAttribute(CONTAINER_ATTR);
	if (!raw) return;
	// Marked before parsing/mounting so a malformed payload — or a second
	// `mountAll()` call arriving before the first placement's own
	// asynchronous mount (CSS fetch) has resolved — is never retried or
	// double-mounted; this one placement simply stays empty on a genuine
	// failure.
	container.dataset[MOUNTED_DATA_KEY] = "true";
	try {
		const payload = JSON.parse(raw) as ComparisonEmbedPayload;
		void mount(container, payload);
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
