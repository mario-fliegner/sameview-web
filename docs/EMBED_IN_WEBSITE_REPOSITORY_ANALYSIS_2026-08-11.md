# Embed in Website — Repository Analysis (Read-Only)

No files were changed. Findings below are organized as requested.

## 1. Relevant current files and responsibilities

**Shared derivation (pure, no DOM/React) — reused unchanged by both current outputs:**

- `src/lib/outcome-snapshot.ts` — builds the immutable `OutcomeSnapshot` (presentation, visibility, configuration, resolved branding, image bytes, `initialSliderPosition`) from `CurrentWorkingState`. **This is the single object both generators consume — neither reads ****`CurrentWorkingState`**** or ****`SourceData`**** directly.**
- `src/lib/comparison-presentation.ts`, `src/lib/branding.ts` — derive locale-baked presentation data and resolved handle branding.
- `src/lib/process-comparison-images.ts` + `jpeg-location-metadata.ts`/`exif-gps-removal.ts`/`iptc-location-removal.ts`/`xmp-location-removal.ts` — the `Remove Embedded Location Data` privacy pipeline, output-agnostic.

**Shared markup/scaffold (pure string building, no DOM/React):**

- `src/lib/comparison-artifact-markup.ts` — `buildComparisonArtifactMarkup()` produces the exact `.presentation-canvas` HTML both outputs embed, with a fixed `id="sameview-*"` contract (`sameview-canvas`, `sameview-handle`, `sameview-title`, …).
- `src/lib/comparison-artifact-scaffold.ts` — `buildArtifactDocument()`, the outer `<!doctype html>…</html>` shell (head/meta/OG/favicon/CSS/script/noscript/font-license `<template>`), shared byte-for-byte in structure.

**Shared interactive runtime (vanilla DOM, framework-independent):**

- `src/lib/comparison-presentation-runtime.ts` — `initComparisonPresentation()`: slider drag/keyboard, adaptive text sizing, canvas geometry, handle scaling, overflow tooltips. Reuses the *same* pure modules the live React Workspace Preview uses (`canvas-geometry.ts`, `adaptive-text-size.ts`, `comparison-slider-interaction.ts`, `comparison-handle-geometry.ts`, `overflow-tooltip.ts`, `text-measurement.ts`).
- `src/lib/comparison-presentation-runtime-entry.ts` — bundle entry point; calls `initComparisonPresentation()` **once, unconditionally, at script load**.
- `scripts/build-presentation-runtime.mjs` — Vite/Rollup one-shot build producing a single dependency-free IIFE script (readable + minified) and minified CSS, written to `public/generated/` (`pnpm build:runtime`, part of `pnpm build`; served dev-time via `scripts/vite-plugin-presentation-runtime-dev.mjs`).

**Output-specific packaging layers (the only place the two outputs actually differ):**

- `src/lib/generate-standalone-html.ts` — inlines everything (Base64 images/fonts/favicon, inline `<style>`/`<script>`) into one file.
- `src/lib/generate-static-microsite.ts` — same content, packaged as a ZIP (`@zip.js/zip.js`) with external `css/`, `js/`, `images/`, `fonts/` files, minified CSS/JS.
- `src/lib/comparison-artifact-assets.ts` — fetches the pre-built runtime script/CSS and font assets as static `fetch()`.
- `src/lib/generate-comparison-output.ts` — top-level orchestration: snapshot → image processing → packaging, one atomic `Result`.

**UI:**

- `src/components/OutputInspector.tsx` — the Output Inspector: output-type cards (including a disabled "CMS Package — Coming Soon" card, which is exactly where "Embed in website" and its platform selector would land), the two shared output settings, progress/completion/error states, download orchestration via `src/lib/trigger-download.ts`.

**Identity-relevant (not currently used by any output):**

- `src/lib/import-resolve.ts` / `src/lib/import-source-data.ts` / `src/lib/workspace-state.ts` — `sessionDirectory` (the archive's session directory name, matching `session.id` per `IMPORTED_COMPARISON_V1.md`) is resolved at import and stored on `SourceData`/`CurrentWorkingState` (`workspace-state.ts:45,288`), but it is **not** carried into `OutcomeSnapshot` — no output today needs a stable identity.

## 2. Current output-generation flow

```
CurrentWorkingState
   │  createOutcomeSnapshot()              [outcome-snapshot.ts]
   ▼
OutcomeSnapshot (presentation, visibility, configuration, branding, image bytes, slider pos)
   │  processComparisonImages()            [process-comparison-images.ts]
   ▼
OutcomeSnapshot with processed image bytes
   │  buildComparisonArtifactMarkup()      [comparison-artifact-markup.ts]  → presentation HTML fragment
   │  buildArtifactDocument()              [comparison-artifact-scaffold.ts] → full document
   │  (+ fetched: runtime script, CSS, fonts, favicon)                      [comparison-artifact-assets.ts]
   ▼
generateStandaloneHtml()  →  single .html (Base64-inlined)
generateStaticMicrosite() →  .zip (external files, minified CSS/JS)

```

Both branches are packaging-only differences over one shared derivation → markup → runtime pipeline. This is exactly the "smallest reusable foundation" the approved decision baseline (§30–32) asks the analysis to identify — it already exists in a strong form.

## 3. Reusable foundations for Embed

**Directly reusable, no changes needed:**

- Outcome Snapshot derivation, image privacy processing, presentation markup builder, document scaffold, and the entire vanilla-DOM interaction runtime. All are framework-independent, pure/DOM-scoped, and already produced as a standalone build artifact (the runtime script), which is architecturally the closest thing to a "distributable embed asset" already in the codebase.
- The font/CSS/asset packaging model (`comparison-artifact-assets.ts`, `presentation-font-assets.ts`) generalizes directly to "assets a WordPress plugin bundles/serves."

**Reusable but requiring extension — the one significant architectural gap:**

- The runtime and markup assume **exactly one instance per document**: fixed literal IDs (`sameview-canvas`, `sameview-handle`, `sameview-title`, …), `document.getElementById()` lookups, and an entry point that calls `initComparisonPresentation()` once unconditionally at script load. The approved decision baseline explicitly requires multiple independent instances per page with no colliding DOM IDs/ARIA relationships (§17, §28) and no shared interaction state. Today's runtime cannot satisfy that without being changed to scope per-container (e.g., initialize once per `.presentation-canvas` root found in the document, using relative queries/data-attributes instead of global IDs) — a real but bounded refactor of `comparison-presentation-runtime.ts` and the ID contract `comparison-artifact-markup.ts` establishes. Both existing outputs (exactly one instance per document) would remain correct under such a refactor.
- `OutcomeSnapshot` has no stable identity field. Embed's Add/Update/no-op model (§7) needs `session.id` (already resolved as `sessionDirectory` upstream) carried through to the snapshot/output — a straightforward, additive extension, not a redesign.
- `OutcomeSnapshot` also has no outcome fingerprint/version field for no-op detection (§7) — genuinely new, not present anywhere today.

**Explicitly not reusable as-is:** the packaging layer itself (single-file inline vs. flat ZIP) doesn't map to "assets managed by a persistent CMS plugin with add/update/delete of multiple stored Comparisons," which is a materially different lifecycle than "generate → download once."

## 4. WordPress integration requirements (from the approved baseline, unresolved technically)

The baseline is explicit that these are **not yet decided** (§31) and repository analysis alone cannot resolve them — they need WordPress platform research:

- Plugin architecture: block vs. shortcode vs. both; how a Comparison is selected/placed in the block editor: a live interactive preview per §11, or an accepted static fallback.
- Storage layout inside WordPress (custom post type vs. custom table vs. options — for Comparison metadata) and where processed image/runtime assets physically live (uploads dir vs. plugin dir), consistent with §10 (management UI), §12 (missing-placement behavior), §13 (deactivation preserves data, uninstall removes it).
- First-install bootstrap: a single mechanism that both installs the plugin and makes the just-generated Comparison immediately available (§4) — this pairs a SameView Web "Generate for WordPress" output with a WordPress-side "install and auto-import" step; no such combined package format exists today.
- Subsequent-Comparison artifact/import format for the "Add comparison" flow into an already-installed integration (§7, §9).
- Fingerprint/version mechanism for exact-duplicate no-op detection (§7).
- Height-sync mechanism only if the plugin ends up needing an isolated container (e.g. iframe/Shadow DOM for host-CSS isolation, §15–16) — not needed if isolation is achieved by scoped classes/CSS custom properties instead, which the current CSS's naming (`.presentation-canvas`, `.comparison-slider__*`) already leans toward.
- WordPress capability mapping for who may Add/Update/Delete vs. merely place (§25).
- Supported WP version range and real verification environment/tooling (Docker, `wp-env`, etc.) (§29, §31).

None of this can be answered from `sameview-web` alone; it requires WordPress plugin-architecture and `wp-env`/plugin-repository research.

## 5. Spec conflicts / gaps against the approved baseline

- **No current specification names ****`Embed in website`****, a platform selector, or WordPress at all.** `PRODUCT_SCOPE.md` lists only Standalone HTML/Static Microsite (V1) plus `CMS Package` as a non-functional "Coming Soon" card, and `Hosted Comparison`/QR/iframe as Version 2. The approved baseline's product concept doesn't map cleanly onto either — it's neither the local-only V1 outputs nor exactly the planned Version 2 Hosted Comparison model (server-hosted, single public URL). This is a genuine scope/versioning question for the source-of-truth specs, not just an addition.
- **`ARCHITECTURE.md`****'s "Hard Constraint"** ("No S3 or other external object storage... one Netcup MySQL database... prepared for planned Version 2 Hosted Publication") doesn't contemplate a persistent per-site plugin storing its own Comparisons inside the *target* WordPress installation — that storage is entirely outside SameView Web's own MySQL/filesystem. This isn't a contradiction so much as an undocumented boundary: SameView Web's own architecture constraints don't govern the target platform's storage, and this should be stated explicitly wherever Embed is specified.
- **`OutcomeSnapshot`**** lacks ****`session.id`****/identity and a fingerprint** — required by §6–7 of the baseline; not a conflict, but a concrete extension gap in `IMPORTED_COMPARISON_V1.md`'s existing "Outcome and Publication Data" allowlist and in `src/lib/outcome-snapshot.ts`.
- **The runtime/markup's single-instance-per-document ID contract** conflicts with §17/§28's multi-instance requirement — this is a real code-level gap the future Embed spec must call out as a required change to shared foundation code (affecting, but not breaking, the two existing outputs).
- **`COMPARISON_PRESENTATION.md`****'s Fullscreen mode** (`APPLICATION_LAYOUT.md`) is explicitly excluded from Embed (§14 of the baseline: "does not include... Fullscreen mode"), which the existing Fullscreen spec doesn't currently scope by output type — future spec work needs to state Fullscreen applies to the Workspace Preview only, not to any generated output/embed.
- **Localization**: existing `en`/`de` i18n infrastructure (`src/i18n/translations.ts`) is reused for SameView Web's own UI; the baseline's requirement for the *embedded runtime itself* to resolve language from "current frontend page language" (§24) is a new runtime capability — today's runtime script has no locale awareness at all (locale is baked into the markup at generation time via `copy`/labels, not resolved at runtime in the browser). This is a materially new requirement for the shared runtime.

## 6. Open technical questions requiring external research (not resolvable from this repo)

- WordPress: block editor plugin APIs for a live interactive preview vs. static preview fallback; capability/role model; recommended storage pattern (CPT vs. custom table) for a "library of Comparisons" with usage/placement tracking; realistic `wp-env`/Docker-based real-instance test setup.
- Cross-platform: whether Joomla's module/extension model, Webflow's and Squarespace's embed mechanisms impose constraints on the *shared* runtime design (e.g., forcing an iframe somewhere) that should be decided before finalizing WordPress specifics, per the baseline's own preference for shared foundation + thin platform layers (§30). The baseline explicitly says not to over-analyze Joomla/Webflow/Squarespace now, but a WordPress-only design risks a dead end if, e.g., Webflow *requires* iframe isolation and WordPress does not — that single fact changes the shared responsive-height/isolation mechanism (§15–16).
- Package/upload limits: WordPress media/plugin upload limits are host-dependent; needs research into what SameView can detect vs. must defer to the integration.

## 7. Risks

- **Runtime refactor risk**: making the runtime multi-instance-safe touches code shared by the two already-shipped, tested V1 outputs. It's a bounded, mechanical change (ID scoping) but needs regression coverage across the existing `test/e2e/output-generation.spec.ts`, `comparison-slider-handle-geometry.spec.ts`, etc.
- **Scope ambiguity risk**: without an explicit product-scope decision reconciling `Embed in website` against the existing V1/V2 output taxonomy in `PRODUCT_SCOPE.md`, later spec work risks re-litigating what "V1" even means for this feature.
- **Real-platform verification cost**: §29 of the baseline sets a high bar (real WordPress install, activate, add/update/delete, multi-instance, accessibility, i18n, cache/versioning, deactivation/uninstall) that current test infrastructure (Node unit tests + Playwright against the SameView Web app itself) doesn't cover at all — a genuinely new test surface (real WP + probably `wp-env`), not an extension of `test/e2e`.
- **Identity/versioning design risk**: the fingerprint mechanism for no-op detection is unspecified in both product and code; a wrong early choice (e.g., naive byte-hash of the whole package) could be fragile against the "assets replaced, old variants deleted" requirement (§7 Asset Replacement).

## 8. Recommended next step

Do not start WordPress-specific architecture yet. The productive next step is narrow, targeted platform-feasibility research on exactly the points that would otherwise force premature commitments in a WordPress-only design:

1. Confirm whether any of Joomla/Webflow/Squarespace *require* an isolated container (iframe/Shadow DOM) for host isolation or responsive height — this single fact should be decided before extending the runtime, since it changes how the multi-instance/isolation refactor should be shaped.
2. Research WordPress's realistic storage/capability/block-editor-preview options enough to answer the §31 open questions for WordPress specifically, since it's first in the release order.
3. Only then turn the approved product baseline plus these findings into a specification update (extending `PRODUCT_SCOPE.md`, `FEATURE_SPECIFICATION.md`, `ARCHITECTURE.md`, `IMPORTED_COMPARISON_V1.md` for `session.id`/fingerprint in the Outcome Snapshot, and a new `EMBED_PRESENTATION`/`WORDPRESS_INTEGRATION` doc) — before any `IMPLEMENTATION_PLAN_V1.md` phase is written, per the baseline's own §32 sequencing.