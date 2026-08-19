# SameView Web – Version 1 Implementation Plan

## 1. Purpose

This plan translates the approved specifications and the current repository baseline into an executable order for the remaining Version 1 work. It is not a product specification and does not replace one. If this plan conflicts with an approved specification, the specification remains authoritative.

The browser-local workflow whose two outputs are downloadable Standalone HTML and a downloadable Static Microsite ZIP, both generated from the same shared presentation and interaction source, is complete (Phases 1–10 below). Version 1 scope has since expanded to include a third output, `Embed in website` — see [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) "Outputs", [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md), [WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md) and [JOOMLA_INTEGRATION.md](JOOMLA_INTEGRATION.md). `Embed in website` is approved Version 1 scope, implemented and verified for WordPress (Phases 11–18 below) and implemented and verified for Joomla (Phases 19–24 below); this plan does not duplicate either platform's normative contract, only the executable order used to build them. Webflow and Squarespace are approved product scope but require their own feasibility research and platform-specific technical contracts before they can be planned — see Section 8. Hosted Publication and its infrastructure remain out of scope for this plan.

## 2. Current Baseline

The repository is not an empty Astro starter. The following is present and verified in code:

- `package.json`, `astro.config.mjs` and `tsconfig.json` provide Astro 7, React 19, strict TypeScript and the Node middleware adapter. React is used throughout the interactive application.
- `src/pages/index.astro` and `src/layouts/AppLayout.astro` render only the document shell (`<html>`/`<head>`/skip link); the interactive application — header with SameView identity and DE/EN language selector, the polished `No Workspace` import section, and the footer with legal navigation to `sameview.app` — is a single hydrated React root (`src/components/App.tsx`), per `docs/APPLICATION_LAYOUT.md`. Localization uses ordinary React context (`src/i18n/LocaleContext.tsx`, `src/i18n/translations.ts`), not routing, so switching language never reloads the page or resets the active workspace.
- `src/styles/global.css` provides a responsive dark foundation, visible keyboard focus, a skip link and colors aligned with the current web values in `BRAND_GUIDE.md`. It now also styles the header, footer and import dropzone; it is not yet a viewer or editor UI.
- `app.js` and `astro.config.mjs` implement the proven Netcup/Plesk Passenger startup and static-asset delivery path.
- `test/app.test.mjs` and `test/passenger-boot.test.mjs` use Node's built-in test runner to cover request failure containment and Passenger-style boot. Parser, workspace, component and browser tests are part of the current repository.
- The existing scripts are `build`, `typecheck`, `lint`, `test` and database commands. Biome covers TypeScript, JavaScript and the existing tests.
- `src/lib/db-health.ts`, `src/db/**`, Drizzle migrations, `compose.yaml` and the database panel on `index.astro` are an existing publication-oriented technical/smoke-test foundation. They do not implement any current V1 feature and must not become a dependency of import, workspace editing, viewing or Standalone HTML generation.
- ZIP import, imported comparison model, workspace state, comparison viewer and replacement workflow are implemented. Remaining work focuses on editing, presentation configuration, branding and output generation.
- The planned `src/features/**` structure from `ARCHITECTURE.md` does not exist and is not treated as implemented or as a mandatory target structure.

## 3. Implementation Principles

- Deliver one coherent, reviewable behavior per iteration; keep changes minimal and reversible.
- Prefer Astro for the document shell and static content. Hydrate React only around interaction that needs persistent client state, file APIs or live updates.
- Keep all V1 import data, Source Data, Current Working State, processed assets and outcomes in the browser. Do not call the database or a server endpoint for them.
- Create immutable Source Data only after complete import validation. Initialize a separate Current Working State from it and make that state the sole source of new outcomes.
- Commit workspace replacement atomically. Cancellation or any failed import leaves the active workspace and previous outcomes unchanged.
- Derive display and snapshot values instead of duplicating them in mutable state. Generating an outcome must not mutate Source Data or Current Working State.
- Keep viewer rendering reusable by the workspace, generated Standalone HTML and generated Static Microsite without coupling it to ZIP import UI or adding a future service layer. Never implement an independent slider, tooltip, branding or presentation implementation per output type; both outputs are packaging layers over the same shared presentation and interaction source.
- Add no repository, service, database, upload or publication abstraction without a demonstrated V1 responsibility.
- Extend the current test stack where it is sufficient. Use Playwright for critical browser workflows that cannot be proportionately covered by Node unit tests alone, per the approved Testing strategy in `AI_ENGINEERING_GUIDE.md`.
- Every iteration ends in a buildable, type-safe state with focused automated tests where supported and explicit manual verification where browser behavior is involved.

## 4. Implementation Phases

### Phase 1 – (Completed) Establish the V1 Browser Boundary

- **Goal:** Make the existing shell an accurate starting point for the browser-local V1 workflow.
- **Specs/features:** `PRODUCT_SCOPE.md`, `ARCHITECTURE.md`, `DATA_AND_PRIVACY.md`, User Workflow `No Workspace`.
- **Existing basis:** Astro layout, header, static workspace placeholder, global styles, working Node deployment path.
- **Implement:** Stop invoking and presenting the database smoke check as part of the user-facing V1 page; retain the proven deployment boot path. Present the no-workspace context and an accessible import entry without implementing ZIP parsing yet.
- **Likely areas:** `src/pages/index.astro`, `src/components/Workspace.astro`, `src/styles/global.css`.
- **Dependency:** None.
- **Definition of Done:** `/` renders the V1 no-workspace state without needing `DATABASE_URL` or querying MySQL, and clearly exposes the next import action.
- **Tests/manual:** Existing server tests remain green; build, typecheck and lint; keyboard and narrow/wide viewport check.
- **Not included:** Import logic, DB deletion/refactoring, viewer, publishing.
- **Risk/open decision:** None; existing DB files may remain dormant and are not V1 product dependencies.

### Phase 2 – (Completed) Define and Validate Imported Comparison Data (F-001)

- **Goal:** Accept only a structurally valid SameView export while preserving supported and unknown metadata.
- **Specs/features:** F-001; `IMPORTED_COMPARISON_V1.md` Supported Metadata Versions, Import Validity, Metadata Preservation; `ARCHITECTURE.md` Upload Limits and Export Structure.
- **Existing basis:** Strict TypeScript only; no archive or parser implementation exists.
- **Implement:** First add pure metadata parsing/validation and current-field-before-legacy-fallback resolution. Then add browser ZIP inspection with size, file-count, uncompressed-size, nested-archive and path-safety checks. Finally resolve exactly one referenced reference file and capture file plus accepted optional files, validating actual file content where specified.
- **Likely areas:** `src/lib/import-metadata.ts`, `src/lib/import-archive.ts`, `src/lib/import-resolve.ts`, `src/lib/import-image.ts`; layered fixtures under `test/unit`, `test/integration` and `test/e2e`.
- **Dependencies:** Phase 1. Resolved: ZIP reading uses `@zip.js/zip.js`, chosen specifically because its entry-listing API exposes central-directory metadata (declared sizes) without decompressing content, required to reject an oversized archive before decompression is attempted.
- **Definition of Done:** Valid metadata versions 2–6 normalize into a lossless accepted representation; invalid JSON, unsupported/missing fields, unsafe archives, missing/ambiguous required files, multi-session archives and undecodable/oversized required images fail with typed product-level results and no workspace side effects.
- **Tests/manual:** Node unit tests (`test/unit`) for parser, fallbacks, unknown-field preservation and archive/path/resolver rules against plain literal data; Node integration tests (`test/integration`) for the same modules against real ZIP bytes, including the committed canonical real-export fixture (`test/fixtures/android-export/`); Playwright tests (`test/e2e`, `pnpm test:e2e`) for browser-only image decode validation and one complete import flow against the real export fixture — introduced here because `createImageBitmap` has no Node equivalent (see Section 6).
- **Not included:** Workspace creation, UI editing, image optimization, uploads.
- **Risks/open decisions:** None remaining for this phase; the ZIP library and fixture-provenance decisions noted in Section 9 are resolved.

### Phase 3 – (Completed) Create the Atomic Single Workspace (F-001)

- **Goal:** Turn one fully accepted import into immutable Source Data and an editable Current Working State.
- **Specs/features:** F-001; User Workflow Workspace Model, Operational States and Error Handling; `IMPORTED_COMPARISON_V1.md` terminology and ownership.
- **Existing basis:** Static `No Workspace` presentation; no client state implementation.
- **Implement:** Define the smallest workspace/state transitions for `No Workspace` and exactly one `Workspace Active`; create Source Data and a lossless independent working copy only after validation; add explicit replace/cancel behavior; preserve current workspace and generated outcomes on cancellation or failure.
- **Likely areas:** The interactive workspace boundary, pure state transition helpers and import UI integration. React hydration is justified here by file input plus shared live state; its boundary should remain as small as practical.
- **Dependencies:** Phase 2; local-retention decision before promising reload persistence.
- **Definition of Done:** One successful import creates one workspace; Source Data cannot be changed through supported transitions; a second import replaces it only after confirmation and complete success.
- **Tests/manual:** Unit tests for immutable transitions, atomic replacement and failure preservation; automated Playwright E2E tests for select, cancel, failure and replace paths.
- **Not included:** Multiple workspaces, autosave, server persistence, viewer behavior.
- **Risks/open decisions:** The specifications leave browser persistence technology undefined; decide whether V1 is session-memory only or survives reload before this phase is finalized.

### Phase 3b – (Completed) Establish the Permanent Application Shell and Polished `No Workspace` Experience

- **Goal:** Bring the always-visible application shell and the `No Workspace` state up to `docs/APPLICATION_LAYOUT.md` before further workspace features are built on top of it.
- **Specs/features:** `APPLICATION_LAYOUT.md` Header, Footer, State A (`No Workspace`), Import Section, Import States, Internationalization, Language Selector, Reference Implementation.
- **Existing basis:** The workspace creation logic from Phase 3 (unchanged); a static, English-only header and a bare file input.
- **Implement:** A single hydrated React application (header, workspace content, footer as one tree; Astro renders only the document shell) so language switching can update the whole UI through ordinary React context without reloading the page or losing the in-memory workspace; a SameView header identity with a DE/EN language selector; a footer linking to the existing `sameview.app` legal pages; and a polished import section (title, description, accessible drag-and-drop dropzone with a hidden native file input, privacy notice, supported-format notice, and idle/drag-active/importing/import-failed presentation).
- **Likely areas:** `src/components/App.tsx`, `src/components/AppHeader.tsx`, `src/components/AppFooter.tsx`, `src/components/ImportSection.tsx`, `src/i18n/*`, `src/layouts/AppLayout.astro`, `src/styles/global.css`.
- **Dependencies:** Phase 3 (workspace creation). Does not depend on replacement, the viewer or any later phase.
- **Definition of Done:** The shell and `No Workspace` experience match `APPLICATION_LAYOUT.md`; switching language updates header, footer and import text immediately, never navigates, and never resets an active workspace; the existing import/validation/workspace-creation behavior from Phase 3 is unchanged.
- **Tests/manual:** Unit test for translation key parity between locales; automated Playwright E2E tests for the language switch preserving an active workspace, dropzone keyboard operation (Enter/Space), drag-active state and the import-failure alert; manual assistive-technology and responsive spot checks.
- **Not included:** Comparison viewer, fullscreen, editing, branding, output section, replace-export flow, workspace persistence.
- **Risks/open decisions:** None remaining; the React-architecture and localization-strategy questions for this phase are resolved (single React root, ordinary context — no cross-island store).

### Phase 4 – (Completed) Render the Interactive Comparison (F-002)

- **Goal:** Display and interact with both required images from Current Working State without mutating it.
- **Specs/features:** F-002; User Workflow Review and Responsive Principles; engineering accessibility and performance rules.
- **Existing basis:** Responsive shell and React dependency; no viewer component or interaction tests.
- **Implement:** A comparison presentation driven only by Current Working State, with an accessible keyboard/touch/pointer-operable slider, required information visibility, current labels and configured branding. Keep presentation independent from import controls and output generation.
- **Likely areas:** Hydrated workspace UI, comparison presentation component and scoped styles.
- **Dependencies:** Phase 3.
- **Definition of Done:** Both images can be inspected at common viewport sizes and input methods; interaction changes only presentation position, never workspace data.
- **Tests/manual:** Pure geometry/state tests where applicable; automated Playwright E2E tests for keyboard, touch, responsive, image-loading and no-mutation checks.
- **Not included:** Editing, marker editing, HTML generation.
- **Risks/open decisions:** None; the Playwright framework decision is settled at Phase 3 and reused here.

### Phase 5 – Edit Comparison Information and Visibility (F-003)

- **Goal:** Edit exactly the supported values and independent presentation visibility in Current Working State.
- **Specs/features:** F-003; `IMPORTED_COMPARISON_V1.md` Web-Editable Fields, text normalization, Reference Date, Capture Timestamp and Location Metadata; `APPLICATION_LAYOUT.md` Edit Inspector, Comparison Information.
- **Existing basis:** Shared workspace state and live viewer from Phases 3–4.
- **Implement:** Title, description, reference date and three user-authored location fields; visibility controls for the specified information; read-only capture date; normalization and reference-date semantics; immediate viewer updates. Preserve unknown, immutable and unrelated metadata.
- **Likely areas:** Workspace state transitions, the Edit Inspector's Comparison Information section, viewer presentation.
- **Dependencies:** Phases 3–4; explicit Current Working State representation for presentation visibility.
- **Definition of Done:** Supported changes are reflected live; hide differs from remove; capture timestamp and Source Data remain unchanged; invalid edits cannot partially apply.
- **Tests/manual:** Unit tests for normalization, date validation/mutation and immutable-field preservation; automated Playwright E2E tests for value/visibility changes; manual accessibility and responsive form spot checks.
- **Not included:** Tags, favorite/source metadata, GPS derivation, reverse geocoding, image replacement or alignment, or the Edit Inspector's Presentation section (Canvas Background, Frame, Corner Radius, Text and Show Slider Date Labels per `COMPARISON_PRESENTATION.md` Part 3). Show Map Preview is not part of this Presentation section's scope; it remains part of the product but is deferred to its own future iteration (`COMPARISON_PRESENTATION.md` Part 3, "Map").
- **Risks/open decisions:** The web visibility state is explicitly independent of imported `additional.visibility`, but its concrete working-state representation is unspecified and must be chosen before implementation.

### Phase 6 – Configure Branding (F-004)

- **Goal:** Support No Branding, Built-in Symbol and Custom Image as Current Working State choices reflected in the viewer.
- **Specs/features:** F-004; `IMPORTED_COMPARISON_V1.md` Session Branding; `BRAND_GUIDE.md`; `APPLICATION_LAYOUT.md` Edit Inspector, Branding; `COMPARISON_PRESENTATION.md` Comparison Stage → Handle.
- **Existing basis:** Viewer and shared state; the built-in symbol catalog is decided but its Font Awesome Free assets are not yet added to the codebase.
- **Implement:** Import existing branding when present; switch among the three specified options (None/Symbol/Custom); select one of the six supported built-in IDs (`heart`, `star`, `camera`, `home`, `pin`, `fire`), rendered from local Font Awesome Free icons bundled with the build (only the six needed icons imported, no CDN, no externally loaded webfont); select/replace a custom image by decoding it exactly once, validating it and normalizing it immediately into the final asset — a transparent 512×512 RGBA PNG, fit-scaled and centered with no crop — so that Current Working State and BrandingDraft retain only this normalized PNG, never the original upload bytes; preserve the selected asset for later outcomes. For Built-in Symbol, additionally support a configurable color — Dark (default, exactly `#17202F`), Brand (exactly `#4F8CFF`) or Custom (a normalized `#RRGGBB` value); no White option, since the Handle background is always white. This color applies exclusively to the Web-rendered vector symbol, never to Custom Image or an imported raster branding asset, both of which keep rendering their own pixel data unchanged; an imported comparison with no stored color fields uses Dark. The color and the active `builtinId` vary independently — a symbol switch keeps the configured color, a color change keeps the active `builtinId` — and the color itself lives in `metadata.raw.branding`; BrandingDraft additionally remembers the most recently configured color purely for restoration (it is read back only on the next explicit symbol-tile click, never by the renderer), so it survives a detour through None or Custom Image within the active workspace, exactly like the remembered `builtinId` and custom image already do. A color change never creates or modifies `brandingHandleBytes`. Preview and Fullscreen render the color through the same resolved SVG path.
- **Likely areas:** Branding state transitions, the Edit Inspector's Branding section, viewer Handle presentation and client asset handling.
- **Dependencies:** Phases 3–5; local Font Awesome Free assets for the six built-in symbols.
- **Definition of Done:** Every option switches cleanly and updates the viewer; Source Data stays unchanged; a Web-uploaded custom image is normalized to its final 512×512 PNG form immediately upon selection, with no original-resolution copy retained anywhere in Current Working State or BrandingDraft; invalid custom images leave the previous branding intact; a Built-in Symbol's color (Dark/Brand/Custom) resolves correctly, defaults to Dark when no color is stored, survives symbol switches and None/Custom Image detours, never colorizes Custom Image or an imported raster asset, and never touches `brandingHandleBytes`.
- **Tests/manual:** Unit tests for transitions, imported branding and Built-in Symbol color resolution/retention; automated Playwright E2E tests for switching/replacement/error paths and for the Color option (Dark/Brand/Custom, retention across None/Custom Image, the imported-raster special case); manual visual checks for scaling and contrast.
- **Not included:** New logo design, external asset hosting, server processing, converting or copying Android's VectorDrawable assets; Outcome Snapshot, Standalone HTML or any other output reusing the configured Built-in Symbol color (later phases).
- **Risks/open decisions:** None; the built-in symbol catalog (`heart`, `star`, `camera`, `home`, `pin`, `fire`, adopted unchanged from Android), Font Awesome Free as its local icon source, and the Built-in Symbol color options (Dark/Brand/Custom, no White) are decided.

### Phase 7 – (Completed) Create an Immutable Outcome Snapshot (F-005)

- **Goal:** Capture all and only the data needed for one output generation cycle, shared by every Version 1 output type.
- **Specs/features:** F-005; User Workflow Outcome Rules, Inspector Transition, Outcome Selection; `IMPORTED_COMPARISON_V1.md` Derived Slider Labels, Snapshot Semantics and outcome allowlist; `APPLICATION_LAYOUT.md` Output Inspector, Output Cards.
- **Existing basis:** Valid Current Working State, viewer presentation and branding.
- **Implement:** Enter the output-selection context through the Edit Inspector's **Create Output** action, switching the Context Inspector from the Edit Inspector to the Output Inspector while the Presentation Preview stays unchanged; select one of the two available V1 output types (Standalone HTML or Static Microsite); derive localized reference/capture labels at generation time; copy allowlisted presentation data, visibility, configuration and required assets — including the currently active branding asset, copied unchanged with no branding-specific image processing, since Phase 6 already normalizes it to its final form — into an immutable Outcome Snapshot shared by both output types; keep prior snapshots independent. A dedicated **Edit** action returns to the Edit Inspector without discarding the Current Working State or the selected output.
- **Likely areas:** Pure label derivation, snapshot builder and the Output Inspector's minimal outcome-selection state in the workspace UI.
- **Dependencies:** Phases 5–6.
- **Definition of Done:** Snapshots reflect generation-time state; later edits do not change them; unknown metadata, device URIs, GPS blocks, provenance and unused originals are excluded.
- **Tests/manual:** Unit tests across date precision, locale/time-zone seams and allowlist exclusion; snapshot immutability tests.
- **Not included:** HTML or microsite packaging/serialization, download, publication DTO/API.
- **Risks/open decisions:** Tests need deterministic locale/time-zone inputs without changing the browser-facing formatting requirement.

### Phase 8 – (Completed) Process Images Locally for Standalone HTML and Static Microsite

- **Goal:** Produce privacy-safe browser-local image assets for the snapshot, without server upload and without re-encoding, resizing or otherwise optimizing the reference and capture images.
- **Specs/features:** V1 Product Scope item 5; F-005 "Remove Embedded Location Data"; Architecture V1 image input limits; Data and Privacy local-output rules.
- **Existing basis:** Accepted, unmodified image bytes already carried through Source Data, Current Working State and the Outcome Snapshot (Phase 7); no image-processing code or dependency yet.
- **Implement:** For `Remove Embedded Location Data = Off`, pass the reference and capture bytes through unchanged. For `= On`, selectively remove only embedded location information (e.g. EXIF GPS, and any location fields within XMP or IPTC) from the two comparison images without decoding or re-encoding the compressed JPEG image data, without changing pixel dimensions, without cropping or stretching, and while preserving visual orientation (including EXIF Orientation) and every other embedded metadata field. If a present metadata structure cannot be edited this selectively and reliably, generation fails atomically for that image — the implementation must not fall back to removing an entire metadata segment or field group irrespective of its content, must not remove non-location metadata, must not silently produce a corrupted image, and must not fall back to a lossy decode/re-encode. The already-normalized branding asset from Phase 6, when present, is passed through unchanged — no further decode, scaling, optimization or re-encoding, since it is already the final asset — and any failure leaves the workspace and previous outcomes unaltered.
- **Likely areas:** Client-safe, selective image-metadata processing; outcome generation orchestration; focused tests/fixtures.
- **Dependencies:** Phase 7.
- **Definition of Done:** With the setting Off, the processed reference/capture bytes are unchanged from the Outcome Snapshot's own bytes. With the setting On, only embedded location information is removed; all other embedded metadata, pixel dimensions, aspect ratio and visual/EXIF orientation are unchanged; a comparison image whose metadata cannot be selectively edited fails generation atomically rather than falling back to a broader removal or a lossy re-encode.
- **Tests/manual:** Unit tests (Node test runner; no browser API is required for this segment-level processing) covering both setting states, selective EXIF/XMP/IPTC location removal, preserved non-location metadata, preserved orientation and dimensions, and the atomic failure path; manual spot-check that processed images remain visually identical to their originals.
- **Not included:** V2 WebP publication limits, server validation, upload pipeline, persistent files, any resizing or quality-driven re-encoding.
- **Risks/open decisions:** None remaining for the image profile itself (resolved: original JPEG format, dimensions and quality are always preserved for V1). The reliability of selective, non-destructive EXIF/XMP/IPTC location removal across real-world metadata variants, and the exact shape of the atomic failure path for a structure that cannot be safely edited, remain implementation-time engineering risks to validate before this phase is considered complete.

### Phase 8b – (Completed) Comparison Presentation Typography

- **Goal:** Add a user-selectable Presentation Font for the Comparison Presentation's text elements, live in the Workspace Preview and carried into future Outcome Snapshots, without changing the application UI's own typography.
- **Specs/features:** COMPARISON_PRESENTATION.md Part 3 "Typography" and Part 4 "Semantic Presentation Configuration"; APPLICATION_LAYOUT.md "Presentation" → "Typography"; BRAND_GUIDE.md "Comparison Presentation Typography".
- **Existing basis:** Presentation Configuration (Phase 5's Background/Frame/Corner Radius/Text/Show Slider Date Labels) and its existing Current Working State / Outcome Snapshot plumbing; the application UI's own system font stack, unchanged.
- **Implement:** Add a `presentationFont` semantic value (Inter/Manrope/Space Grotesk, default Inter) to Presentation Configuration, edited through a new Typography group's Font dropdown in the Edit Inspector's Presentation section, reflected immediately in the Workspace Preview for exactly the text elements COMPARISON_PRESENTATION.md Part 3 "Typography" names (Title, Description, Time, Time Difference, Location, Slider Date Labels and their Overflow Tooltips). The application UI's own typography (header, footer, both Inspectors, controls, loading/status text) is never affected. No pixel value, file path or font-format detail becomes part of the Current Working State — only the semantic font identifier, per Part 4.
- **Likely areas:** Presentation Configuration state and its edit function, the Edit Inspector's Presentation section, the Comparison Presentation's text rendering and its Canvas-based text measurement, the Overflow Tooltip styling of the affected items.
- **Dependencies:** Phase 8. Phase 9 does not begin until this phase is complete — Phase 9 depends on the Presentation Font already being a stable, live-editable part of the Workspace Preview and the Outcome Snapshot.
- **Definition of Done:** All three Presentation Fonts render correctly and exclusively within the Comparison Presentation's named text elements and their Overflow Tooltips; Inter is the default for a fresh import; switching fonts updates the Workspace Preview immediately; the application UI's own typography is provably unaffected; the selection is carried into the Outcome Snapshot unchanged, ready for later output use.
- **Tests/manual:** Unit tests for the new Presentation Configuration default/value and its unchanged carry-through into the Outcome Snapshot; automated Playwright E2E tests for live preview switching between all three fonts and for confirming the application UI's own typography remains the system stack throughout; manual visual/contrast spot checks.
- **Not included:** Any Standalone HTML or Static Microsite font embedding or packaging (Phase 9 scope); any font asset packaging structure inside a generated output (Phase 9 scope).
- **Risks/open decisions:** None remaining. Resolved: Inter and Space Grotesk each ship as their official variable WOFF2 file — `public/fonts/inter/InterVariable.woff2` and `public/fonts/spacegrotesk/SpaceGrotesk-Variable.woff2` — since both cover the full 400/500/600 weight range this presentation needs from a single file. Manrope has no official prebuilt variable WOFF2, so its three needed weights ship as three separate static WOFF2 instances of the same family name instead — `public/fonts/manrope/Manrope-Regular.woff2` (400), `Manrope-Medium.woff2` (500) and `Manrope-SemiBold.woff2` (600) — with the browser selecting the matching instance by `font-weight`. All five files are declared via `@font-face` in `src/styles/global.css`.

### Phase 9 – (Completed) Generate and Download Standalone HTML and Static Microsite (F-005)

- **Goal:** Generate both Version 1 output artifacts — a self-contained interactive HTML document and a static microsite ZIP — entirely in the browser, from the same shared presentation and interaction source, and download them.
- **Specs/features:** V1 Product Scope and Outputs; F-005; User Workflow Generate/Make Outcome Available, Download; `APPLICATION_LAYOUT.md` Output Inspector, Download Flow, Progress, Completion; privacy rules.
- **Existing basis:** Immutable snapshot, processed assets and reusable comparison behavior; the artifact contract below.
- **Implement:** Both output types render from one single, central HTML/Presentation document scaffold — never two independent generators or scattered string fragments duplicating the same markup. The scaffold keeps clearly separable sections for head/meta, favicon, fonts, the Presentation markup itself, CSS, JS and the closing license/attribution comments. Standalone HTML and Static Microsite differ only in how each section's content is referenced and packaged, never in a second document structure or a second slider/tooltip/branding/presentation implementation. No new templating engine or dependency is introduced for this without a demonstrated need beyond the string composition already used elsewhere in the codebase. The shared scaffold's `<body>` always includes a localized `<noscript>` hint — the same locale resolution already used for every other Output Inspector string, in both output types, since neither has any content without its embedded/linked runtime script actually running.

  Standalone HTML (`sameview-comparison.html`): a single, fully self-contained file — a clean, readable HTML5 document with a semantic `<main>`, no React or Astro runtime. CSS, JavaScript, the reference/capture images, the branding asset (when present) and the selected Presentation Font's own file(s) are all embedded inline (Base64 for binary assets); the existing favicon (`public/favicon.svg`) is embedded the same way. No external request of any kind. The full license text of the actually embedded font family is included, inert and never rendered, in the document via a `<template>` element — not an HTML comment, since XML/HTML comment syntax cannot safely contain arbitrary third-party license text (e.g. a `--` sequence). No Open Graph metadata: a `file://`-opened single document has no shareable URL for Open Graph unfurling to apply to.

  Static Microsite (`sameview-comparison.zip`): a ZIP archive with no additional outer root folder, containing exactly:

  ```text
  index.html
  favicon.svg
  css/sameview-comparison.css
  js/sameview-comparison.js
  images/reference.jpg
  images/capture.jpg
  images/branding.png        (only when a branding asset is actually present)
  fonts/<only the selected Presentation Font's own file(s)>
  fonts/LICENSE.txt or fonts/OFL.txt (whichever the selected font family ships)
  ```

  No file or folder is generated unless actually needed by the snapshot being packaged (no `images/branding.png` without an active branding asset, no font family other than the one actually selected). `favicon.svg` is a separate, independently replaceable file, not inlined into the microsite's own HTML.

  `css/sameview-comparison.css` and `js/sameview-comparison.js` are packaged in minified form, built from the same shared presentation and interaction source as Standalone HTML; `index.html` remains readable and unminified. Standalone HTML is not affected by this packaging rule and remains readable and unminified as specified above.

  Static Microsite alone additionally carries Open Graph metadata in its `index.html` — `og:type` fixed to `website`, `og:title` and `og:description` set to the exact same already-resolved values as `<title>` and `<meta name="description">`, through the same escaping — since this output type, unlike Standalone HTML, may end up hosted at a shareable URL. No `og:url`, `og:image` or canonical link.

  The branding asset is embedded via Base64 for Standalone HTML and copied as a local asset file for Static Microsite, in both cases never re-encoded or reprocessed; prevent user text from executing as markup in both. Drive the Output Inspector's progress indicator through its generation phases (preparing the comparison, processing images, building the output, starting the download) while workspace interactions stay temporarily disabled.

  Download behavior (resolved: no browser API reliably reports whether a programmatic Blob/anchor download actually started or was blocked — see this phase's own Risks below for the evidence). The artifact is generated fully in the browser first; only once generation has completed successfully is the normal Blob-/anchor-based browser download triggered exactly once, automatically, with no detection of its outcome. The Output Inspector then shows a Completion state that never claims the download was actually saved — no dedicated success screen — the progress UI disappears and the primary action becomes a `Download again` action — `Download again` remains available in this state for as long as the selected output type and output-specific settings match what was generated, and re-triggers the browser download of the same already-generated artifact byte-for-byte, without regenerating it; changing either reverts the primary action to its normal generate/download form for the newly selected configuration, which must itself be generated before it can be downloaded (a Presentation Preview slider movement alone does not have this effect). No timeout, no heuristic blocked-download detection, no `showSaveFilePicker()`; identical behavior across Chrome/Edge/Firefox/Safari. If generation itself fails, no download (partial or otherwise) is ever triggered and the Output Inspector shows its specified error state instead of the Completion state.
- **Likely areas:** The shared HTML/Presentation document scaffold and its section boundaries; a font-ID-to-asset-file(s) packaging map; Standalone HTML self-contained document assembly; Static Microsite ZIP assembly; client download orchestration (single generated artifact retained for a repeatable `Download again`); Output Inspector progress/completion/error presentation; reusable viewer behavior with no dependency on the workspace page.
- **Dependencies:** Phases 7–8b (all completed).
- **Definition of Done:** Downloaded Standalone HTML opens without network/server access as `sameview-comparison.html`; a downloaded `sameview-comparison.zip`, once unpacked, works the same way on ordinary static webspace with exactly the file/folder structure above and no unneeded files; both present the snapshot interactively and accessibly from the same shared HTML/Presentation document scaffold, contain only allowlisted data and the one actually selected Presentation Font (with its license text/file included), and remain unchanged after workspace edits; the Completion state never asserts a successful save, and `Download again` reliably re-downloads the identical already-generated artifact without a new generation cycle for as long as the selected output configuration is unchanged since that generation; a generation failure never triggers any download and always reaches the specified error state instead.
- **Tests/manual:** Unit tests for escaping, allowlist serialization, the font-ID-to-asset-file(s) map (only the selected font's file(s) and license are ever included), and deterministic document/package structure (including the "no unneeded file" rule); build/typecheck/lint; automated Playwright E2E tests for download, offline execution (Standalone HTML) and unpack-and-serve execution (Static Microsite), and responsive/keyboard checks inside each artifact; manual spot checks in additional real browsers/devices.
- **Not included:** Hosted output, URL, QR/iframe code, upload or management; the third Output Card was not implemented as a functioning output at the time of this phase (then a placeholder labeled "CMS Package"; since superseded by the approved `Embed in website` output — see Phases 11–18 below and `EMBED_IN_WEBSITE.md`).
- **Risks/open decisions:** None remaining at the product/contract level — filenames, both artifact contracts, the shared-scaffold principle and the download/completion behavior are decided above. Resolved (download detection): neither the HTML nor the Fetch/File APIs define a completion or blocked event for a `Blob` + anchor `download` attribute click — confirmed against MDN's `HTMLAnchorElement.download`/`Window.showSaveFilePicker()` documentation; the only genuinely Promise-based success/cancel signal, the File System Access API's `showSaveFilePicker()`, is Chromium-only (Chrome/Edge/Opera) with no Firefox or Safari support on any platform, which is why this phase deliberately does not use it and instead relies on an always-available `Download again` action rather than detection. The concrete module/function boundary implementing the shared scaffold, and the exact wording/formatting of the embedded font license comment, are ordinary implementation-time choices within that contract, not open product decisions.

### Phase 10 – (Completed) V1 Integration and Release Readiness

- **Goal:** Verify the complete browser-local journey and quality gates without broadening scope.
- **Specs/features:** F-001–F-005; User Workflow; engineering guide; deployment contract.
- **Existing basis:** Proven Astro/Passenger deployment and focused feature tests from prior phases.
- **Implement:** Close only integration defects across import → review → edit → brand → generate → download; ensure error recovery and repeated outcome cycles; update user-facing product metadata that still claims current publishing only if separately authorized by the implementation task.
- **Likely areas:** Existing V1 components, styles and tests; no new architectural layer.
- **Dependencies:** Phases 1–9.
- **Definition of Done:** Completion Criteria below pass on the deployed Node application with no database, upload or publication dependency in the V1 workflow.
- **Tests/manual:** Full `test`, `typecheck`, `lint`, `build` and the automated Playwright E2E suite from Phases 3–9; manual regression sweep limited to the supplementary checks defined in `AI_ENGINEERING_GUIDE.md`'s Testing section.
- **Not included:** Any deferred work below.
- **Risks/open decisions:** None; the testing strategy is settled (see Section 6).

## 4a. Embed in Website – WordPress Implementation Phases

Phases 11–18 deliver the WordPress platform for the approved `Embed in website` output ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md), [WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md)). They follow, and do not reopen, the completed browser-local V1 work in Phases 1–10.

These phases span two deliverables that must not be conflated: SameView Web's own generation code (this repository, Astro/React/TypeScript, extending the existing Standalone HTML/Static Microsite generation architecture) and the WordPress plugin itself (a separate PHP/WordPress deliverable, built and maintained in its own dedicated integration area inside this same repository, isolated from the Astro/React application structure under `src/` — see Phase 14 and Section 9). Phases below state explicitly which deliverable each belongs to.

None of these phases duplicate the normative contracts in `EMBED_IN_WEBSITE.md`/`WORDPRESS_INTEGRATION.md`; each cross-references the relevant section instead of restating it, per `AI_ENGINEERING_GUIDE.md` "Specification Discipline".

### Phase 11 – SameView Web: Comparison Identity and Outcome Fingerprint

- **Goal:** Extend the Outcome Snapshot with the two new fields every persistent Embed platform needs, without changing Standalone HTML or Static Microsite behavior.
- **Deliverable:** SameView Web (this repository).
- **Specs/features:** `IMPORTED_COMPARISON_V1.md` "Comparison Identity (`session.id`)" and "Outcome Fingerprint"; "Outcome and Publication Data" allowlist.
- **Existing basis:** `src/lib/outcome-snapshot.ts` already builds the Outcome Snapshot from Current Working State; `sessionDirectory` is already resolved at import time (`src/lib/import-resolve.ts`, `src/lib/workspace-state.ts`) but not currently carried into the snapshot.
- **Implement:** Carry the already-resolved, authoritative session directory identity into the Outcome Snapshot as `session.id`, per `IMPORTED_COMPARISON_V1.md`. Add a deterministically generated Outcome Fingerprint to the Outcome Snapshot, computed from the same allowlisted content already captured there. Both fields are additive to the existing snapshot shape; Standalone HTML and Static Microsite continue to ignore them.
- **Likely areas:** `src/lib/outcome-snapshot.ts` and its existing unit tests.
- **Dependencies:** None beyond the completed Phase 7 (Outcome Snapshot).
- **Definition of Done:** Every generated Outcome Snapshot carries `session.id` and an Outcome Fingerprint; regenerating an outcome from unchanged Current Working State produces the same fingerprint; regenerating after any allowlisted-content change produces a different one; Standalone HTML and Static Microsite output is unchanged byte-for-byte from before this phase.
- **Tests/manual:** Unit tests for `session.id` carry-through and fingerprint determinism/change-sensitivity; existing Standalone HTML/Static Microsite tests remain green unmodified.
- **Not included:** Any WordPress-facing packaging, the Output Inspector UI (Phase 12), the concrete fingerprint algorithm choice beyond "deterministic and change-sensitive" (implementation-time detail, not a product decision).
- **Risks/open decisions:** None; `IMPORTED_COMPARISON_V1.md` already resolves the identity-terminology question this phase depends on.

### Phase 12 – SameView Web: Embed in Website Output Selection

- **Goal:** Add the `Embed in website` Output Inspector card with an inline platform selector, WordPress the only selectable platform, without changing Standalone HTML/Static Microsite behavior.
- **Deliverable:** SameView Web (this repository).
- **Specs/features:** `EMBED_IN_WEBSITE.md` "Output Inspector Behavior", "Supported Platforms"; `APPLICATION_LAYOUT.md` "Output Cards"; `FEATURE_SPECIFICATION.md` F-005.
- **Existing basis:** `src/components/OutputInspector.tsx` already renders output-type cards and the two shared output-specific settings (Use Current Slider Position, Remove Embedded Location Data) for Standalone HTML and Static Microsite.
- **Implement:** Add the `Embed in website` card with its target-platform selector shown inline (not only after the card is selected), per `EMBED_IN_WEBSITE.md`. Only WordPress is selectable; other platforms are not offered, since they are not yet planned (see Section 8). Changing the selected platform changes only the next generated outcome's target, never the Current Working State, Workspace Preview or shared output-setting state. The two existing output-specific settings apply unchanged.
- **Likely areas:** `src/components/OutputInspector.tsx` and related Output Inspector state.
- **Dependencies:** Phase 11 (a `session.id`/fingerprint-bearing snapshot must exist before any Embed package can be meaningfully generated in Phase 15).
- **Definition of Done:** The Output Inspector shows three cards; selecting `Embed in website` shows WordPress as the only platform option; switching between output types and platforms never mutates the Current Working State; Standalone HTML/Static Microsite selection and generation are unaffected.
- **Tests/manual:** Automated Playwright E2E tests for card/platform-selector visibility and state-preservation across switches; existing Standalone HTML/Static Microsite E2E tests remain green.
- **Not included:** Actual WordPress package generation (Phase 15) or post-generation installation guidance content (Phase 15) — this phase adds selection UI only, no working "Generate" action yet for `Embed in website`.
- **Risks/open decisions:** None for this phase's own scope; the primary action's behavior once "Generate" is pressed depends on the artifact-format decision gate in Phase 15.

### Phase 13 – Shared Runtime Multiple-Instance Safety

- **Goal:** Make the shared Presentation markup/runtime safe for more than one simultaneous instance in one host document, per `COMPARISON_PRESENTATION.md` "Multiple Instances and Host Isolation", without changing Standalone HTML or Static Microsite behavior (both remain single-instance consumers).
- **Deliverable:** SameView Web (this repository) — shared foundation code also used by the already-shipped outputs.
- **Specs/features:** `COMPARISON_PRESENTATION.md` "Multiple Instances and Host Isolation"; `EMBED_IN_WEBSITE.md` "Independent Instance State", "Accessibility".
- **Existing basis:** `src/lib/comparison-presentation-runtime.ts` and `src/lib/comparison-artifact-markup.ts` currently assume exactly one instance per document: fixed literal `id="sameview-*"` values and a single unconditional `initComparisonPresentation()` call per script load — confirmed by prior repository analysis as a real but bounded, mechanical gap, not a redesign.
- **Implement:** Scope element lookups and generated identifiers to each rendered instance's own root (for example, one `init` call per `.presentation-canvas` root found in a given document/root, resolving elements relative to that root rather than via global `document` lookups) so multiple independent instances can coexist with no colliding IDs, ARIA relationships or shared interaction state, per `COMPARISON_PRESENTATION.md`. Standalone HTML and Static Microsite, which only ever render one instance, must continue to behave identically after this change.
- **Likely areas:** `src/lib/comparison-presentation-runtime.ts`, `src/lib/comparison-artifact-markup.ts`, `src/lib/overflow-tooltip.ts` (its own document-level portal/outside-click handling needs the same root-awareness).
- **Dependencies:** None beyond completed Phase 9. Independent of Phases 11–12.
- **Definition of Done:** Two or more instances of the shared runtime can run in the same document with fully independent slider/tooltip/focus state and no ID collisions; all existing Standalone HTML and Static Microsite Playwright E2E tests (`test/e2e/output-generation.spec.ts` and related) pass unmodified, proving no regression to the already-shipped, single-instance outputs.
- **Tests/manual:** New unit/Playwright coverage for genuine multi-instance behavior on one page; full existing Standalone HTML/Static Microsite regression suite green.
- **Not included:** Host CSS/JS isolation itself (Phase 17) — this phase only removes the multi-instance blocker in the shared runtime; it does not isolate that runtime from an uncontrolled host page.
- **Risks/open decisions:** None; scope and bound already established by prior repository analysis.

### Phase 14 – WordPress Plugin Foundation (Repository, Storage, Lifecycle)

- **Goal:** Establish where the WordPress plugin's own code lives and its basic persistent-integration lifecycle and storage model, with no Comparison-facing functionality yet.
- **Deliverable:** WordPress plugin, in its own dedicated integration area inside this repository (see Section 9).
- **Specs/features:** `WORDPRESS_INTEGRATION.md` "Persistent Integration", "Storage Model", "Supported WordPress Versions".
- **Existing basis:** A working proof of concept (temporary, isolated, already removed) confirmed a WordPress Block Editor block can reuse SameView Web's precompiled Presentation/runtime code and that `wp-env` is adequate for real-instance verification; no production plugin code exists yet.
- **Implement:** Plugin skeleton with activation/deactivation/uninstall covering only data lifecycle at this stage (deactivation preserves data; uninstall removes all SameView-owned data) — not yet the Comparison seed-bootstrap (Phase 15). Custom Post Type + Post Meta storage for Comparison metadata; a SameView-owned, non-Media-Library uploads subdirectory for Comparison assets; native WordPress capability registration for the administrative Comparison-library actions, per `WORDPRESS_INTEGRATION.md` "Storage Model" and "Permissions and Security".
- **Likely areas:** A new, dedicated WordPress plugin integration area inside this repository, isolated from the existing Astro/React application structure under `src/`; no changes to that existing application code.
- **Dependencies:** None from Phases 11–13; independent groundwork.
- **Definition of Done:** A plugin can be installed on a real `wp-env` WordPress instance, activated and deactivated without error, with no Comparison-facing behavior yet; its storage model (CPT + Post Meta + private uploads directory) exists and is exercised by at least a manually inserted test row; uninstall removes all of it.
- **Tests/manual:** Real, disposable WordPress instance (`wp-env`) verification of activation/deactivation/uninstall and storage presence/removal; no mocked environment.
- **Not included:** First installation/seed bootstrap, Add comparison, placement, frontend rendering, host isolation.
- **Risks/open decisions:** None; the WordPress plugin's repository location is resolved — it lives inside this repository, in its own dedicated integration area isolated from the existing Astro/React application structure under `src/`, reusing shared SameView Presentation/runtime code rather than duplicating it. See Section 9.

### Phase 15 – WordPress First Installation and Comparison Lifecycle

- **Goal:** Deliver the complete Add/Update/no-op Comparison lifecycle and the first-installation bootstrap.
- **Deliverable:** Both — SameView Web's WordPress package generation (this repository, extends Phase 12) and the WordPress plugin's own Add-comparison/activation handling (separate codebase, extends Phase 14).
- **Specs/features:** `EMBED_IN_WEBSITE.md` "First Installation", "Comparison Lifecycle", "Atomic Updates", "Asset Replacement", "Already-Loaded Pages", "Import Validation"; `WORDPRESS_INTEGRATION.md` "First Installation".
- **Existing basis:** Phase 11's `session.id`/Outcome Fingerprint, Phase 12's Output Inspector selection, Phase 14's storage model and plugin skeleton.
- **Implement:** On the SameView Web side, complete the `Embed in website` → WordPress "Generate" action, producing a real downloadable package once the artifact-format decision below is resolved. On the WordPress side, implement the `Add comparison` admin workflow (unknown `session.id` → add; changed Outcome Fingerprint → atomic update; unchanged → no-op, with the specified neutral message) and the first-installation bootstrap that makes a freshly installed plugin's bundled Comparison available without a second manual import, per `WORDPRESS_INTEGRATION.md` "First Installation". Atomic updates, asset replacement (including removal of superseded image variants) and rejected-import handling per `EMBED_IN_WEBSITE.md`.
- **Likely areas:** SameView Web: a new `generate-*` module alongside the existing `generate-standalone-html.ts`/`generate-static-microsite.ts`. WordPress plugin: the Add-comparison admin screen, activation handling, import validation.
- **Dependencies:** Phases 11, 12, 14.
- **Definition of Done:** Installing a freshly generated package on a WordPress site with no prior SameView plugin makes the bundled Comparison available with no second import step; adding a second, different Comparison via `Add comparison` succeeds; re-adding an unchanged Comparison is a no-op that rewrites nothing; re-adding a changed Comparison atomically updates it and preserves existing placements (verified once placements exist, from Phase 16 onward — this phase verifies the lifecycle mechanics against a plugin with no placements yet); an invalid/incompatible artifact is rejected without side effects.
- **Tests/manual:** Real `wp-env` instance verification of install → activate → first Comparison available; Add/Update/no-op detection; rejected-import atomicity; no mocked environment, per `AI_ENGINEERING_GUIDE.md` "Testing".
- **Not included:** Placement (Phase 16), frontend rendering, host isolation.
- **Risks/open decisions:** None remaining. The Comparison-package artifact format decision gate is resolved — see Section 9.

### Phase 16 – WordPress Block Editor Placement

- **Goal:** Place an existing Comparison via a native Block Editor block, with a shortcode compatibility path, reusing the shared Presentation/Interaction source with no PHP rendering clone.
- **Deliverable:** WordPress plugin (separate codebase).
- **Specs/features:** `EMBED_IN_WEBSITE.md` "Placement", "Placement Behavior After Deletion", "Presentation and Interaction Parity", "Accessibility"; `WORDPRESS_INTEGRATION.md` "Placement".
- **Existing basis:** A completed proof of concept confirmed a Block Editor block can render a fully interactive Comparison by reusing SameView Web's precompiled markup/runtime, including inside the Block Editor's own (possibly iframed) canvas, without a PHP reimplementation. Phase 13's multi-instance-safe runtime; Phase 15's stored Comparisons.
- **Implement:** The native block as the primary placement mechanism, selecting only an existing Comparison (no Presentation controls at placement level); an interactive editor preview reusing the same Presentation/Interaction source, falling back to a static preview only where a live preview is not reliably achievable; a shortcode compatibility path rendered through the same underlying renderer as the block, for contexts without Block Editor support. The missing-Comparison editor state and public missing-placement behavior per `EMBED_IN_WEBSITE.md` "Placement Behavior After Deletion". Full accessibility parity (keyboard-operable slider, focus, ARIA, no colliding identifiers across multiple placements) as part of this phase's own Definition of Done, not deferred.
- **Likely areas:** WordPress plugin's block registration, editor script, shortcode handler, frontend render path.
- **Dependencies:** Phases 13, 14, 15.
- **Definition of Done:** The block can be inserted and shows a genuine, interactive Comparison preview in the editor; the same Comparison can be placed multiple times on one page and on multiple pages, each instance fully independent (Phase 13); the shortcode renders the same output via the same renderer; a deleted Comparison's placements show the specified missing states; accessibility behavior matches `EMBED_IN_WEBSITE.md` "Accessibility" for single and multiple placements.
- **Tests/manual:** Real `wp-env` + Playwright verification: block insertion, editor preview, multi-placement and multi-Comparison rendering on one page, independent interaction state, shortcode rendering, missing-Comparison states, keyboard/accessibility checks.
- **Not included:** Host CSS/JS isolation from the surrounding theme (Phase 17); conditional/performance-optimized asset loading (Phase 17).
- **Risks/open decisions:** None new; depends on Phase 13's multi-instance safety and Phase 15's lifecycle already being in place.

### Phase 17 – WordPress Frontend Delivery and Host Isolation

- **Goal:** Load SameView assets only where needed, keep updates reliably visible, and isolate the rendered Comparison from the host theme in both directions.
- **Deliverable:** WordPress plugin (separate codebase).
- **Specs/features:** `EMBED_IN_WEBSITE.md` "Local/Self-Contained Resources", "Performance and Resource Loading", "Caching and Updates", "Host Isolation"; `COMPARISON_PRESENTATION.md` "Multiple Instances and Host Isolation"; `WORDPRESS_INTEGRATION.md` "Frontend Delivery", "Host Isolation".
- **Existing basis:** Phase 16's placement rendering; Phase 13's multi-instance-safe runtime.
- **Implement:** Local, self-contained asset delivery (no third-party CDN); conditional loading limited to pages that actually contain a SameView placement, including placements outside ordinary singular post content; asset/cache versioning so a Comparison update is reliably reflected on new page loads. Host isolation bound by the mandatory outcome already defined in `COMPARISON_PRESENTATION.md`, using whichever concrete mechanism is chosen per the decision gate below.
- **Likely areas:** WordPress plugin's asset enqueue logic, cache-busting/versioning, the isolation boundary around rendered placements.
- **Dependencies:** Phases 13, 16.
- **Definition of Done:** SameView assets load only on pages with an actual placement; a Comparison update is visible on the next page load without a manual cache-clear (for caching under the plugin's own control); the rendered Comparison is unaffected by injected host theme CSS/JS resets in verification testing, and the rendered Comparison's own CSS/JS/identifiers do not leak into the surrounding page.
- **Tests/manual:** Real `wp-env` instance with a theme deliberately carrying aggressive CSS resets, verifying isolation holds in both directions; asset-loading-only-where-needed verification; cache/versioning verification.
- **Not included:** Any integration with third-party WordPress full-page-caching plugins' own purge APIs — explicitly not part of Version 1, per `WORDPRESS_INTEGRATION.md` "Frontend Delivery". A site relying on full-page caching may need to purge it manually after a Comparison update; this is a documented, accepted limitation, not a defect to fix in this phase.
- **Risks/open decisions:** None remaining. The host-isolation mechanism decision gate is resolved (Shadow DOM) — see Section 9.

### Phase 18 – (Completed) WordPress Real-Platform Integration and Release Readiness

- **Goal:** Verify the complete real WordPress customer workflow and quality gates before WordPress is offered as a supported Embed platform, mirroring Phase 10's role for the original browser-local scope.
- **Deliverable:** WordPress plugin + SameView Web, verified together.
- **Specs/features:** `EMBED_IN_WEBSITE.md` "Real-Platform Verification and Release Criteria"; `WORDPRESS_INTEGRATION.md` "Testing"; `AI_ENGINEERING_GUIDE.md` "Testing".
- **Existing basis:** Phases 11–17 complete.
- **Implement:** Close integration defects across the complete real workflow: generate → install → activate → first Comparison available → add another → Add/Update/no-op → place → render → update-preserves-placements → reject invalid atomically → delete → editor/public missing states → re-import restores placements → multiple Comparisons/instances on one page → independent interaction state → responsive sizing → accessibility → English/German localization with English fallback → local/self-contained assets → resource loading only where required → cache/update behavior → deactivation persistence → full uninstall cleanup — the complete list in `EMBED_IN_WEBSITE.md` "Real-Platform Verification and Release Criteria".
- **Likely areas:** Both deliverables; no new architectural layer.
- **Dependencies:** Phases 11–17.
- **Definition of Done:** The complete list in `EMBED_IN_WEBSITE.md` "Real-Platform Verification and Release Criteria" passes against a real, disposable WordPress instance covering the currently supported WordPress major version and the immediately previous major version (`WORDPRESS_INTEGRATION.md` "Supported WordPress Versions"); WordPress can be offered as a supported Embed platform.
- **Tests/manual:** Full real-instance Playwright verification across both supported WordPress versions; `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` for the SameView Web side.
- **Not included:** Joomla, Webflow, Squarespace (see Section 8); any Version 2 work.
- **Risks/open decisions:** None. The decision gates inherited from Phases 14, 15 and 17 (WordPress plugin repository location, Comparison-package artifact format, host-isolation mechanism) are resolved — see Section 9.

## 4b. Embed in Website – Joomla Implementation Phases

Phases 19–24 deliver the Joomla platform for the approved `Embed in website` output ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md), [JOOMLA_INTEGRATION.md](JOOMLA_INTEGRATION.md)). They follow, and do not reopen, the completed browser-local V1 baseline (Phases 1–10) and the completed WordPress track (Phases 11–18). Joomla does not need its own equivalents of Phase 11 (Comparison Identity and Outcome Fingerprint) or Phase 13 (Shared Runtime Multiple-Instance Safety): both are already-completed, platform-independent shared foundation that Joomla reuses unchanged, per [JOOMLA_INTEGRATION.md](JOOMLA_INTEGRATION.md) "Host Isolation" and "Placement".

These phases span two deliverables that must not be conflated: SameView Web's own generation code (this repository, Astro/React/TypeScript, extending the existing Standalone HTML/Static Microsite/WordPress generation architecture) and the Joomla extension package itself (a separate PHP/Joomla deliverable, built and maintained in its own dedicated integration area inside this same repository, isolated from the Astro/React application structure under `src/` and from the WordPress integration area — see Phase 19 and Section 9). Phases below state explicitly which deliverable each belongs to.

None of these phases duplicate the normative contracts in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md)/[JOOMLA_INTEGRATION.md](JOOMLA_INTEGRATION.md); each cross-references the relevant section instead of restating it, per [AI_ENGINEERING_GUIDE.md](AI_ENGINEERING_GUIDE.md) "Specification Discipline".

### Phase 19 – Joomla Extension Foundation (Repository, Storage, Lifecycle, ACL, Test Infrastructure)

- **Goal:** Establish where the Joomla extension package's own code lives and its basic persistent-integration lifecycle, storage model and permission, with no Comparison-facing functionality yet, verified from the start against a real Docker-based Joomla instance.
- **Deliverable:** Joomla extension package, in its own dedicated integration area inside this repository (see Section 9).
- **Specs/features:** `JOOMLA_INTEGRATION.md` "Persistent Integration", "Storage Model", "Supported Joomla Versions", "Permissions and Security", "Testing".
- **Existing basis:** The completed WordPress integration area (`integrations/wordpress/`) demonstrates the approved isolation pattern (own dependency management, own tooling, no imports to/from `src/`) that this phase follows for Joomla; no Joomla extension code exists yet.
- **Implement:** A Joomla component (`com_sameviewcomparisons`) bundled with its companion module and companion plugins (see "Placement", Phase 22) as a single native Joomla extension package, covering only data lifecycle at this stage (installation creates storage; full removal deletes all SameView-owned data) — not yet the Comparison seed bootstrap (Phase 21). A dedicated database table for Comparison metadata; a SameView-owned `media/` subdirectory for Comparison assets, outside Joomla's Media Manager root; the single native Joomla access-control permission gating administrative Comparison-library actions, per `JOOMLA_INTEGRATION.md` "Storage Model" and "Permissions and Security". A Docker-based real Joomla test environment (current and previous major version) and Playwright-driven real-instance verification, established from this phase onward per `JOOMLA_INTEGRATION.md` "Testing" — no dedicated PHP-level test harness unless this phase demonstrates a concrete need that cannot otherwise be met.
- **Likely areas:** A new, dedicated Joomla integration area inside this repository, isolated from the existing Astro/React application structure under `src/` and from `integrations/wordpress/`; no changes to either.
- **Dependencies:** None from Phases 11–18 or 20; independent groundwork.
- **Definition of Done:** The extension package can be installed on a real Dockerized Joomla instance (current and previous major version) via the native Extensions Manager without error, with no Comparison-facing behavior yet; its storage model (database table + `media/` subdirectory) exists and is exercised by at least a manually inserted test row; the access-control permission is registered and assignable through Joomla's native permissions interface; full removal deletes all of it.
- **Tests/manual:** Real, disposable Joomla instance (Docker + Playwright) verification of installation/removal and storage/permission presence and removal, across both supported major versions; no mocked environment.
- **Not included:** First installation/seed bootstrap, Add comparison, placement, frontend rendering, host isolation (already satisfied unchanged by the existing shared runtime, per `JOOMLA_INTEGRATION.md` "Host Isolation").
- **Risks/open decisions:** None blocking. The Joomla extension package's repository location is resolved — it lives inside this repository, in its own dedicated integration area isolated from the existing Astro/React application structure under `src/` and from `integrations/wordpress/`, reusing shared SameView Presentation/runtime code rather than duplicating it (see Section 9, "WordPress plugin repository location" row, which already generalizes to future Embed platform integrations). The exact database column names and the access-control permission's internal identifier are ordinary implementation-time choices, not open product decisions, per `JOOMLA_INTEGRATION.md` "Non-Goals".

### Phase 20 – SameView Web: Embed in Website Joomla Output Selection

- **Goal:** Add Joomla as a second selectable platform in the existing `Embed in website` Output Inspector platform selector, without changing WordPress, Standalone HTML or Static Microsite behavior.
- **Deliverable:** SameView Web (this repository).
- **Specs/features:** `EMBED_IN_WEBSITE.md` "Output Inspector Behavior", "Supported Platforms"; `APPLICATION_LAYOUT.md` "Output Cards"; `FEATURE_SPECIFICATION.md` F-005.
- **Existing basis:** `src/components/OutputInspector.tsx` already renders the `Embed in website` card with an inline platform selector; its `EmbedPlatform` type is currently the single literal `"wordpress"`, with an explicit comment noting no other platform is offered yet.
- **Implement:** Widen `EmbedPlatform` to include `"joomla"`; add the corresponding selector option, shown inline per `EMBED_IN_WEBSITE.md` "Output Inspector Behavior". Switching between WordPress and Joomla changes only the next generated outcome's target, never the Current Working State, Workspace Preview or shared output-setting state. WordPress selection and generation are unaffected.
- **Likely areas:** `src/components/OutputInspector.tsx` and related Output Inspector state; new copy/localization keys for the Joomla platform label and (once Phase 21 exists) its download button and installation guide text.
- **Dependencies:** None; independent of Phase 19, and of the completed Phases 11–18.
- **Definition of Done:** The platform selector offers WordPress and Joomla; switching between them never mutates the Current Working State; WordPress and the other two outputs are unaffected; no working "Generate" action for Joomla yet.
- **Tests/manual:** Automated Playwright E2E tests for platform-selector visibility, selection and state-preservation across switches; existing WordPress/Standalone HTML/Static Microsite E2E tests remain green.
- **Not included:** Actual Joomla package generation (Phase 21) or post-generation installation guidance content (Phase 21) — this phase adds selection UI only.
- **Risks/open decisions:** None for this phase's own scope.

### Phase 21 – Joomla First Installation and Comparison Lifecycle

- **Goal:** Deliver the complete Add/Update/no-op Comparison lifecycle, Delete, and the first-installation bootstrap for Joomla.
- **Deliverable:** Both — SameView Web's Joomla package generation (this repository, extends Phase 20) and the Joomla extension's own Add-comparison/Delete/post-installation handling (separate codebase, extends Phase 19).
- **Specs/features:** `EMBED_IN_WEBSITE.md` "First Installation", "Comparison Lifecycle", "Atomic Updates", "Asset Replacement", "Already-Loaded Pages", "Import Validation", "Comparison Management", "Permissions"; `JOOMLA_INTEGRATION.md` "First Installation", "Permissions and Security".
- **Existing basis:** Phase 11's `session.id`/Outcome Fingerprint (already shared, no Joomla-specific work needed), Phase 20's Output Inspector selection, Phase 19's storage model, extension-package skeleton and single `core.manage` ACL permission (already sufficient to gate Delete alongside Add/Update, per `JOOMLA_INTEGRATION.md` "Permissions and Security" — no new permission needed); `src/lib/generate-wordpress-package.ts` demonstrates the approved unified-package pattern (one artifact used identically for first install and later Add comparison) that this phase adapts for Joomla's own package structure.
- **Implement:** On the SameView Web side, complete the `Embed in website` → Joomla "Generate" action, producing a real downloadable package once the artifact-format decision below is resolved. On the Joomla side, implement the `Add comparison` admin workflow (unknown `session.id` → add; changed Outcome Fingerprint → atomic update; unchanged → no-op, with the specified neutral message), the first-installation bootstrap that makes a freshly installed extension's bundled Comparison available without a second manual import, per `JOOMLA_INTEGRATION.md` "First Installation", using Joomla's native post-installation script mechanism, and Delete for a stored Comparison (removes its database row and stored assets), gated by the same `core.manage` permission as Add/Update — closing the gap identified during Phase 21 analysis, where Delete belonged to the Comparison Library/storage-lifecycle responsibility this phase already owns but was not previously named in any Joomla phase's own Implement/Definition of Done. Atomic updates, asset replacement (including removal of superseded image variants) and rejected-import handling per `EMBED_IN_WEBSITE.md`.
- **Likely areas:** SameView Web: a new `generate-joomla-package.ts` module alongside the existing `generate-wordpress-package.ts`. Joomla extension: the Add-comparison admin screen, the Delete action on the Comparison Library screen, the post-installation script, import validation.
- **Dependencies:** Phases 19, 20.
- **Definition of Done:** Installing a freshly generated package on a Joomla site with no prior SameView extension makes the bundled Comparison available with no second import step; adding a second, different Comparison via `Add comparison` succeeds; re-adding an unchanged Comparison is a no-op that rewrites nothing; re-adding a changed Comparison atomically updates it (placement preservation verified once placements exist, from Phase 22 onward — this phase verifies the lifecycle mechanics against an extension with no placements yet); an invalid/incompatible artifact is rejected without side effects; deleting a stored Comparison removes its database row and stored assets, gated by the same `core.manage` permission as Add/Update.
- **Tests/manual:** Real Dockerized Joomla instance (Playwright) verification of install → first Comparison available; Add/Update/no-op detection; Delete removing a stored Comparison's row and assets; rejected-import atomicity; no mocked environment, per `AI_ENGINEERING_GUIDE.md` "Testing".
- **Not included:** Placement (Phase 22), frontend rendering, host isolation (already satisfied unchanged), placement-aware delete warnings (no placements exist yet to warn about, per `EMBED_IN_WEBSITE.md` "Placement Behavior After Deletion" — relevant again once Phase 22 introduces placements).
- **Risks/open decisions:** The Comparison-package artifact format decision gate is open — see Section 9. Must be resolved before this phase closes.

### Phase 22 – Joomla Placement

- **Goal:** Place an existing Comparison via the two Joomla-native placement paths, reusing the shared Presentation/Interaction source with no PHP rendering clone and no editor preview, per the approved decision.
- **Deliverable:** Joomla extension (separate codebase).
- **Specs/features:** `EMBED_IN_WEBSITE.md` "Placement", "Placement Behavior After Deletion", "Presentation and Interaction Parity", "Accessibility"; `JOOMLA_INTEGRATION.md` "Placement", "No Editor Preview".
- **Existing basis:** Phase 19's extension foundation and access-control permission; Phase 21's stored Comparisons; the completed WordPress placement work confirms the shared runtime/markup already supports the multi-instance, no-PHP-reimplementation placement model that this phase reuses unchanged.
- **Implement:** The content placement path (native editor button inserting the `{sameview session="SESSION_ID"}` reference; a native content-rendering extension resolving it at render time) as the primary mechanism; the module placement path (a native module type storing the referenced `session.id` as a structured parameter) as the compatibility path for template/module-position placement. Both resolve through the same underlying render helper and the same compiled Embed runtime. No static or interactive preview in either placement path's own UI, per `JOOMLA_INTEGRATION.md` "No Editor Preview" — selection is by Comparison title and reference-to-capture period label only. The missing-Comparison states per `EMBED_IN_WEBSITE.md` "Placement Behavior After Deletion". Full accessibility parity (keyboard-operable slider, focus, ARIA, no colliding identifiers across multiple placements) as part of this phase's own Definition of Done, not deferred.
- **Likely areas:** Joomla extension's companion plugins (content-rendering, editor button) and companion module; shared render-helper code within the component.
- **Dependencies:** Phases 19, 21.
- **Definition of Done:** The content-placement reference can be inserted via the editor button and resolves to a genuine, interactive Comparison on the public page; the module placement path renders the same way from any module position; the same Comparison can be placed multiple times on one page and on multiple pages, each instance fully independent (reusing the already-completed shared multi-instance runtime); a deleted Comparison's placements show the specified missing states; accessibility behavior matches `EMBED_IN_WEBSITE.md` "Accessibility" for single and multiple placements; neither placement path renders any preview anywhere in the Joomla admin.
- **Tests/manual:** Real Dockerized Joomla instance + Playwright verification: reference insertion via the editor button, module configuration, multi-placement and multi-Comparison rendering on one page, independent interaction state, missing-Comparison states, keyboard/accessibility checks, absence of any editor-side preview.
- **Not included:** Host CSS/JS isolation from the surrounding template (Phase 23; already structurally satisfied by the reused Shadow DOM mechanism, verified there); conditional/performance-optimized asset loading (Phase 23).
- **Risks/open decisions:** None new; depends on Phase 19's foundation and Phase 21's lifecycle already being in place.

### Phase 23 – Joomla Frontend Delivery and Host Isolation

- **Goal:** Load SameView assets only where needed, keep updates reliably visible, and confirm the already-established host isolation mechanism holds unchanged under Joomla.
- **Deliverable:** Joomla extension (separate codebase).
- **Specs/features:** `EMBED_IN_WEBSITE.md` "Local/Self-Contained Resources", "Performance and Resource Loading", "Caching and Updates", "Host Isolation"; `COMPARISON_PRESENTATION.md` "Multiple Instances and Host Isolation"; `JOOMLA_INTEGRATION.md` "Frontend Delivery", "Host Isolation".
- **Existing basis:** Phase 22's placement rendering; the Shadow DOM isolation mechanism is already implemented in the shared Embed runtime (established during the WordPress track) and requires no Joomla-specific change, per `JOOMLA_INTEGRATION.md` "Host Isolation" — this phase verifies, rather than newly builds, isolation.
- **Implement:** Local, self-contained asset delivery (no third-party CDN) via Joomla's own native web-asset system; conditional loading limited to pages that actually contain a SameView placement; asset/cache versioning so a Comparison update is reliably reflected on new page loads.
- **Likely areas:** Joomla extension's asset registration/loading logic, cache-busting/versioning.
- **Dependencies:** Phases 19, 22.
- **Definition of Done:** SameView assets load only on pages with an actual placement; a Comparison update is visible on the next page load without a manual cache-clear (for caching under the extension's own control); the rendered Comparison is unaffected by injected host template CSS/JS in verification testing, and the rendered Comparison's own CSS/JS/identifiers do not leak into the surrounding page.
- **Tests/manual:** Real Dockerized Joomla instance with a template deliberately carrying aggressive CSS resets, verifying isolation holds in both directions; asset-loading-only-where-needed verification; cache/versioning verification.
- **Not included:** Any integration with third-party Joomla full-page-caching or system-cache plugins' own purge mechanisms — explicitly not part of Version 1, per `JOOMLA_INTEGRATION.md` "Frontend Delivery". A site relying on such caching may need to purge it manually after a Comparison update; this is a documented, accepted limitation, not a defect to fix in this phase.
- **Risks/open decisions:** None remaining; the host-isolation mechanism is already resolved and reused unchanged (Shadow DOM) — see Section 9.

### Phase 24 – (Completed) Joomla Real-Platform Integration and Release Readiness

- **Goal:** Verify the complete real Joomla customer workflow and quality gates before Joomla is offered as a supported Embed platform, mirroring Phase 18's role for WordPress.
- **Deliverable:** Joomla extension + SameView Web, verified together.
- **Specs/features:** `EMBED_IN_WEBSITE.md` "Real-Platform Verification and Release Criteria"; `JOOMLA_INTEGRATION.md` "Testing"; `AI_ENGINEERING_GUIDE.md` "Testing".
- **Existing basis:** Phases 19–23 complete.
- **Implement:** Close integration defects across the complete real workflow: generate → install → first Comparison available → add another → Add/Update/no-op → place (both paths) → render → update-preserves-placements → reject invalid atomically → delete → editor/public missing states → re-import restores placements → multiple Comparisons/instances on one page → independent interaction state → responsive sizing → accessibility → English/German localization with English fallback → local/self-contained assets → resource loading only where required → cache/update behavior → full-removal cleanup — the complete list in `EMBED_IN_WEBSITE.md` "Real-Platform Verification and Release Criteria", read together with `JOOMLA_INTEGRATION.md`'s Joomla-specific lifecycle model (no single deactivate/reactivate toggle; see `JOOMLA_INTEGRATION.md` "Persistent Integration").
- **Likely areas:** Both deliverables; no new architectural layer.
- **Dependencies:** Phases 19–23.
- **Definition of Done:** The complete list in `EMBED_IN_WEBSITE.md` "Real-Platform Verification and Release Criteria" passes against a real, disposable Joomla instance covering the currently supported Joomla major version and the immediately previous major version (`JOOMLA_INTEGRATION.md` "Supported Joomla Versions"); Joomla can be offered as a supported Embed platform.
- **Tests/manual:** Full real-instance Playwright verification across both supported Joomla versions; `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` for the SameView Web side.
- **Not included:** Webflow, Squarespace (see Section 8); any Version 2 work.
- **Risks/open decisions:** None. The artifact-format decision gate from Phase 21 is resolved — see Section 9.

## 5. Recommended Iteration Order

1. **Align the homepage with browser-only V1:** remove the runtime DB check from the user journey and expose the accessible no-workspace import entry. Predecessor: none.
2. **Parse and validate `metadata.json`:** versions 2–6, required fields, legacy fallbacks and unknown-field preservation. Predecessor: 1.
3. **Inspect ZIPs safely in the browser:** enforce archive limits and reject unsafe/nested entries. Predecessor: ZIP decision and 2.
4. **Resolve and validate referenced files:** require exactly one reference and capture file based on metadata, never device URIs. Predecessor: 3.
5. **Create immutable Source Data and Current Working State:** commit a workspace only after complete acceptance. Predecessor: 4.
6. **Establish the permanent application shell and polished `No Workspace` experience:** SameView header identity, DE/EN language selector, footer legal navigation and an accessible import dropzone, built on a single hydrated React application so language switching never reloads the page or resets the active workspace. Predecessor: 5.
7. **Make replacement atomic:** explicit confirm/cancel and preservation on failed second import. Predecessor: 5.
8. **Render the interactive comparison:** Current Working State images, responsive slider and non-mutating interaction. Predecessor: 5.
9. **Edit textual values and reference date:** normalization, validation, immutable capture timestamp and live viewer updates. Predecessor: 8.
10. **Edit presentation visibility:** independent visibility without altering preserved `additional.visibility`. Predecessor: 9 and visibility-model decision.
11. **Configure branding:** import and switch No Branding/Built-in/Custom, including atomic invalid-image handling. Predecessor: 8.
12. **Derive labels and build Outcome Snapshots:** generation-time locale formatting, explicit allowlist and snapshot immutability. Predecessor: 10–11.
13. **Process comparison images in-browser:** content validation, 40 MP guard, and selective, optional embedded location-metadata removal (EXIF/XMP/IPTC), with pixel data, dimensions, orientation and all non-location metadata preserved unchanged. Predecessor: 12.
14. **Add the Comparison Presentation Typography control:** a selectable Presentation Font (Inter default, Manrope, Space Grotesk) in the Edit Inspector's Presentation → Typography, applied live to the Workspace Preview and carried into the Outcome Snapshot; the application UI's own typography is unaffected. Predecessor: 10.
15. **Generate safe self-contained HTML and static microsite packaging:** embed one shared snapshot, assets, style and viewer behavior into each output's packaging without network dependencies, per the artifact contract decided in Phase 9 above. Predecessor: 14.
16. **Download and preserve independent outcomes:** browser download plus repeated generation without changing older artifacts or workspace state. Predecessor: 15.
17. **Run the complete V1 integration pass:** error recovery, accessibility, responsiveness, offline output and repository quality gates. Predecessor: 1–16.

Each iteration has one primary result, avoids V2 preparation and should remain independently reviewable and deployable when its predecessor state is present.

### WordPress Embed Iteration Order (Phases 11–18)

This list is intentionally separate from 1–17 above: it follows the completed V1 baseline but numbers its own sequence, referencing phase numbers directly rather than continuing the count above, to avoid implying a single combined 1–25 sequence that does not exist.

1. **Carry Comparison Identity and Outcome Fingerprint into the Outcome Snapshot** (Phase 11): additive `session.id`/fingerprint fields, no change to existing outputs. Predecessor: the completed V1 baseline (1–17 above).
2. **Add the `Embed in website` Output Inspector card and WordPress platform selection** (Phase 12): selection UI only, no working generation yet. Predecessor: 1.
3. **Make the shared Presentation runtime/markup multi-instance-safe** (Phase 13): container-scoped identifiers, no regression to Standalone HTML/Static Microsite. Predecessor: the completed V1 baseline; independent of 1–2.
4. **Establish the WordPress plugin foundation** (Phase 14): activation/deactivation/uninstall lifecycle, Custom Post Type + Post Meta storage, private uploads directory, inside this repository's own dedicated WordPress integration area. Predecessor: independent groundwork; no predecessor within this list.
5. **Deliver WordPress first installation and the Add/Update/no-op Comparison lifecycle** (Phase 15): artifact-format decision, atomic updates, asset replacement. Predecessor: 1, 2, 4.
6. **Implement WordPress Block Editor placement and the shortcode compatibility path** (Phase 16): interactive editor preview, multi-placement/multi-instance rendering, accessibility parity. Predecessor: 3, 4, 5.
7. **Deliver WordPress frontend delivery and host isolation** (Phase 17): conditional loading, cache/versioning, bidirectional isolation once its mechanism is approved. Predecessor: 3, 6.
8. **Run the complete WordPress real-platform integration pass** (Phase 18): the full customer workflow from `EMBED_IN_WEBSITE.md` "Real-Platform Verification and Release Criteria" against a real WordPress instance. Predecessor: 1–7.

### Joomla Embed Iteration Order (Phases 19–24)

This list is intentionally separate from 1–17 and from the WordPress Embed Iteration Order above: it follows the completed V1 baseline and the completed WordPress track but numbers its own sequence, referencing phase numbers directly.

1. **Establish the Joomla extension foundation** (Phase 19): lifecycle via Joomla's native install/removal model, database-table storage, `media/` asset directory, single access-control permission, Docker+Playwright test infrastructure. Predecessor: independent groundwork; no predecessor within this list.
2. **Add the `Embed in website` Output Inspector Joomla platform selection** (Phase 20): selection UI only, no working generation yet. Predecessor: none; independent of 1.
3. **Deliver Joomla first installation, the Add/Update/no-op Comparison lifecycle and Delete** (Phase 21): artifact-format decision, atomic updates, asset replacement. Predecessor: 1, 2.
4. **Implement Joomla placement** (Phase 22): content-plugin/editor-button path and module path, no editor preview, accessibility parity. Predecessor: 1, 3.
5. **Deliver Joomla frontend delivery and host-isolation verification** (Phase 23): conditional loading, cache/versioning, Shadow DOM isolation confirmed unchanged. Predecessor: 4.
6. **Run the complete Joomla real-platform integration pass** (Phase 24): the full customer workflow from `EMBED_IN_WEBSITE.md` "Real-Platform Verification and Release Criteria" against a real Joomla instance. Predecessor: 1–5.

## 6. Test Strategy

- Use the existing Node test runner for pure metadata parsing, archive/path rules, normalization, date/label derivation, state transitions, allowlist construction, escaping and snapshot immutability.
- Keep fixture ZIPs and images minimal and purpose-specific. Cover current and legacy metadata, unknown fields, malformed/unsafe archives, missing references, oversized decoded images and metadata-bearing images.
- Preserve the existing `app.js` and Passenger regression suite; it validates deployment behavior, not V1 product behavior.
- Use Playwright for automated end-to-end coverage of behavior that genuinely has no Node equivalent or that exercises a full end-to-end path: workspace creation and replacement, slider interaction, live editing, branding, outcome generation, standalone HTML download and offline execution, and browser-only image decode validation. Introduced at Phase 2 (`createImageBitmap` has no Node equivalent, needed to validate reference/capture image content) rather than deferred to Phase 3 as originally assumed — see `AI_ENGINEERING_GUIDE.md`'s Testing section for the durable principle.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` at each applicable iteration boundary, together with the Playwright suite once introduced. Database migration/smoke testing is not a V1 product gate.
- Manual verification remains supplementary only, for what automation cannot realistically reach: native OS file-picker dialogs, real assistive-technology behavior and limited real-device spot checks.

## 7. V2 Compatibility Boundaries

- Keep workspace state separate from generated Outcome Snapshots; never let an outcome reference later-mutable workspace objects.
- Build snapshots from an explicit allowlist. Do not carry complete metadata, unknown fields, device URIs, GPS blocks, internal paths or unneeded originals into output representations.
- Keep the comparison presentation independent from import-page mechanics so a future hosted route can reuse product behavior deliberately without being implemented now.
- Keep Source Data full-fidelity and immutable locally while Current Working State remains the sole source for new outcomes.
- Require no server, database or network access for the V1 workspace or Standalone HTML artifact.
- Do not create a Publication API, upload pipeline, management route, persistent image storage, publication table usage, or preventative repository/service/database layer in V1.

## 8. Deferred Work

- F-006 Publish Hosted Comparison
- F-007 View Hosted Comparison
- Public comparison URLs
- QR codes and iframe embed code
- Private management links and publication update/deletion
- Server-side publication validation and image processing
- Persistent publication metadata and image storage
- Anonymous-publishing abuse protection
- Multiple active or managed workspaces
- Automatic Android-to-web transfer
- Webflow and Squarespace Embed platforms — approved product scope (`EMBED_IN_WEBSITE.md` "Supported Platforms") but not planned here; each requires its own feasibility research and platform-specific technical contract, analogous to `WORDPRESS_INTEGRATION.md`/`JOOMLA_INTEGRATION.md`, before implementation planning
- Any further comparison output type beyond Standalone HTML, Static Microsite and Embed in website (WordPress)

Hosted Comparison (F-006/F-007 above) is now an approved, specified
capability — see
[HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md),
[FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-006/F-007,
[ARCHITECTURE.md](ARCHITECTURE.md),
[DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md),
[PRODUCT_SCOPE.md](PRODUCT_SCOPE.md),
[USER_WORKFLOW.md](USER_WORKFLOW.md),
[APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md) and
[IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md) — with SameView
Android as the first publishing client and SameView Web publishing
planned for later. Its implementation is not appended to the phase
sequence above and does not reopen the completed V1/WordPress/Joomla
scope. It is planned separately, in a dedicated
`docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md` (not yet created),
coordinating work across both the `sameview-web` and `sameview`
(Android) repositories against the current canonical specifications
listed above as source of truth.

## 9. Open Decisions and Specification Conflicts

### Decisions required for V1

| Decision | Why it is open | Required before | Constraints |
|---|---|---|---|
| Local workspace retention | Architecture deliberately leaves local persistence technology undefined; current code has no client state. | Iteration 5 | Exactly one active workspace, local-only data, failure preservation; do not infer multi-workspace storage. |
| Presentation visibility representation | It must be independent of preserved imported `additional.visibility`, but no concrete working-state field is specified. | Iteration 10 | F-003 visibility table and metadata preservation rules. |
| Built-in branding catalog | Resolved: Web V1 adopts the Android built-in symbol catalog unchanged (`heart`, `star`, `camera`, `home`, `pin`, `fire`), rendered from local Font Awesome Free icons bundled with the build. | Iteration 11 | Only No Branding, Built-in Symbol and Custom Image; Brand Guide; no new brand design; no CDN or externally loaded webfont; only the six needed icons bundled. |
| Presentation Font catalog | Resolved: Version 1 offers exactly three Presentation Fonts — Inter (default), Manrope and Space Grotesk — selected via a Font dropdown in the Edit Inspector's Presentation → Typography group, applied only to the Comparison Presentation's own text elements (COMPARISON_PRESENTATION.md Part 3 "Typography"), never to the application UI. Resolved: Inter and Space Grotesk each ship as their official variable WOFF2 file (`public/fonts/inter/InterVariable.woff2`, `public/fonts/spacegrotesk/SpaceGrotesk-Variable.woff2`); Manrope, which has no official prebuilt variable WOFF2, ships as three static WOFF2 instances at exactly the needed weights — 400/500/600 (`public/fonts/manrope/Manrope-{Regular,Medium,SemiBold}.woff2`). | Iteration 14 | Self-hosted, no CDN; only the weights and formats actually required are bundled; licensing verified for local web embedding (SIL Open Font License 1.1 for all three); no artificial glyph-coverage restriction. |
| Standalone image profile | Resolved: the reference and capture images keep their original JPEG format, pixel dimensions and quality for V1 — no resize, crop, stretch or quality-driven re-encoding. Embedded location metadata (EXIF/XMP/IPTC) is optionally, selectively removed via `Remove Embedded Location Data` (F-005) with no other metadata removed; a structure that cannot be safely, selectively edited fails generation atomically rather than falling back to broader removal or lossy re-encoding. The branding asset's format is already fixed by Phase 6 and is not part of this decision. | Iteration 13 | 40 MP input limit, local processing, no upload; selective metadata removal must never fall back to full-segment/field-group deletion, non-location removal or lossy decode/re-encode. |
| Standalone and microsite artifact contract | Resolved: filenames `sameview-comparison.html` and `sameview-comparison.zip`; both render from one shared HTML/Presentation document scaffold with clearly separable sections (head/meta, favicon, fonts, Presentation markup, CSS, JS, closing license/attribution comments) — see Phase 9 above for the complete Standalone HTML self-containment rules and the exact Static Microsite ZIP file/folder structure, including font and font-license packaging. | Iteration 14 | Fully browser-generated, offline-capable, safe text handling, immutable snapshot shared by Standalone HTML and Static Microsite; no independent slider/tooltip/branding/presentation implementation per output type. |
| WordPress plugin repository location | Resolved: WordPress and future Embed platform integrations live inside this repository, in a dedicated integration area isolated from the existing Astro/React application structure under `src/`, reusing shared SameView Presentation/runtime code rather than duplicating it. A separate repository is not prohibited but is no longer the default; it may be adopted later only for a concrete technical or organizational reason. | WordPress Embed iteration 4 (Phase 14) | Must remain a clearly separated integration area, isolated from the Astro/React application structure under `src/`; platform-specific code/tooling stays inside that area; shared SameView Presentation/runtime code must be reused, not duplicated. |
| Comparison-package artifact format (WordPress) | Resolved: SameView Web generates one unified `sameview-comparisons-wordpress.zip` for every WordPress `Embed in website` generation, regardless of first-install or later `Add comparison` — never a second, smaller package shape. It bundles the plugin's own static PHP/JS/asset files (`sameview-comparisons.php`, `includes/*.php`, `languages/*`, `assets/block/*`, the compiled Embed runtime/CSS and every Presentation Font's own file(s) and license) alongside `sameview-comparisons/seed/comparison.json` plus `reference.jpg`/`capture.jpg`/optional `branding.png`. A native WordPress plugin install both installs the plugin and imports this `seed/` directory as the first Comparison; the `Add comparison` upload handler extracts and imports only that same `seed/` subdirectory from an otherwise identical package, never touching installed plugin code. | WordPress Embed iteration 5 (Phase 15) | Must satisfy `EMBED_IN_WEBSITE.md` "First Installation"/"Comparison Lifecycle" and `WORDPRESS_INTEGRATION.md` "First Installation" without SameView Web ever needing to ask or infer first-vs-later Comparison status. |
| WordPress host-isolation mechanism | Resolved: Shadow DOM. Each rendered placement gets its own open Shadow Root (`element.attachShadow({ mode: "open" })`), created and owned by the shared Embed runtime script; the Presentation's own CSS is injected as an ordinary `<style>` element inside each placement's own Shadow Root, never a host-page `<link>`. Sizing is width-constrained/height-derived: the runtime reads the placement's own available container width and computes the Presentation's required height from it, never a fixed height. | WordPress Embed iteration 7 (Phase 17) | Must satisfy `COMPARISON_PRESENTATION.md` "Multiple Instances and Host Isolation" (bidirectional isolation) regardless of which mechanism is chosen. |
| Joomla extension package artifact format | Resolved: SameView Web generates one unified `sameview-comparisons-joomla.zip` for every Joomla `Embed in website` generation, regardless of first-install or later `Add comparison` — never a second, smaller package shape. It contains the Joomla component's own manifest and installable extension structure (`sameviewcomparisons.xml`, `script.php`, `admin/**`) at the package root, plus a `seed/comparison.json` with `reference.jpg`/`capture.jpg`/optional `branding.png`. A native Joomla extension install both installs the component and imports this `seed/` directory as the first Comparison — `script.php::install()` reads it directly from the temporary install package's own directory, confirmed reliable against real Joomla 6 and Joomla 5 instances; `update()` deliberately does not re-import it, to avoid re-importing a stale bundled Comparison on a future code-only update. The `Add comparison` upload handler extracts and imports only that same `seed/` subdirectory from an otherwise identical package, never touching installed component code. | Joomla Embed iteration 3 (Phase 21) | Must satisfy `EMBED_IN_WEBSITE.md` "First Installation"/"Comparison Lifecycle" and `JOOMLA_INTEGRATION.md` "First Installation" without SameView Web ever needing to ask or infer first-vs-later Comparison status; must package the component together with its companion module/plugins as one native Joomla extension package, per `JOOMLA_INTEGRATION.md` "Persistent Integration". |

These decisions need narrow technical or product clarification in their named iteration; they do not justify advance infrastructure. All three WordPress-track rows above are resolved — repository location, artifact format and host-isolation mechanism were each implementation-time technical decisions, not open product questions; `EMBED_IN_WEBSITE.md` and `WORDPRESS_INTEGRATION.md` already settle every product-level requirement they must satisfy. The Joomla host-isolation mechanism needs no separate row: it reuses the already-resolved Shadow DOM mechanism unchanged, per `JOOMLA_INTEGRATION.md` "Host Isolation". The Joomla artifact-format row above is resolved as of Phase 21.

### Evaluated conflicts

- `CLAUDE.md` and `AGENTS.md` still list MySQL, persistent image storage and hosted WebP images under “Hard Constraints (V1)”. Current `PRODUCT_SCOPE.md`, `ARCHITECTURE.md` and `DATA_AND_PRIVACY.md` place that publication infrastructure in V2. For this plan the approved product scope is authoritative: existing DB/deployment assets remain untouched but are not V1 feature dependencies. The instruction-file labels should be corrected separately before any task might otherwise interpret them as V1 publication work; they do not block browser-only iterations when this boundary is explicit.
- `IMPORTED_COMPARISON_V1.md` contains forward-looking publication rules despite its V1 name. Its workspace, snapshot and allowlist rules apply to V1; publication-specific persistence and server processing do not. This is an ambiguity, not a reason to implement publication, and should be clarified separately before F-006.
- `USER_WORKFLOW.md` includes product-wide public-viewing and management entry points. Because it explicitly complements rather than redefines Product Scope, those entry points are treated as future workflow context and create no V1 routes. Clarification is desirable before F-006, not before the local V1 workflow.
- The implemented DB schema, smoke check, Docker setup and deployment documentation predate the browser-only V1 boundary. They are real technical foundations, but no current V1 feature reads or writes publication data. The homepage's runtime smoke check is the only user-facing coupling and is addressed in Iteration 1; no schema or deployment change is planned.

**Status update:** the clarifications named above for
`IMPORTED_COMPARISON_V1.md` and `USER_WORKFLOW.md` (both "before
F-006") have since been completed — see
[HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md)
and the current text of both documents. `FEATURE_SPECIFICATION.md`
F-006 and F-007 now have complete normative text. The `CLAUDE.md`
wording concern in the first bullet above also no longer applies: the
current `CLAUDE.md` in this repository already frames MySQL, persistent
image storage and hosted WebP images as prepared Version 2 Hosted
Publication foundation rather than a Version 1 hard constraint;
`AGENTS.md`'s current wording was not re-verified as part of this
update. This status update does not reopen any completed phase of this
plan; Hosted Comparison implementation itself remains tracked
separately — see Section 8.

## 10. Completion Criteria

### Browser-Local Scope (Complete)

This scope — Phases 1–10 — is complete; the criteria below describe the state already achieved, not a remaining target.

Version 1's browser-local scope is complete when:

- a user can import a valid SameView ZIP within all archive, metadata and referenced-file rules, while invalid or cancelled imports cannot damage an active workspace;
- exactly one active workspace contains immutable Source Data and a separate Current Working State, all kept locally in the browser;
- the comparison can be reviewed through an accessible, responsive interactive viewer driven by Current Working State;
- every specified editable value and visibility can be changed, all immutable/preserved data remains intact, and branding supports exactly the three specified options;
- the Comparison Presentation's own selectable Presentation Font (Inter default, Manrope, Space Grotesk) applies live to its text elements without affecting the application UI's own typography, and is carried into the Outcome Snapshot;
- reference and capture labels are derived into an immutable Outcome Snapshot at generation time;
- the two comparison images are validated and kept in their original JPEG format, pixel dimensions and quality, with embedded location metadata selectively removed only when `Remove Embedded Location Data` is On and all other embedded metadata preserved otherwise, and any active branding asset — already normalized to its final form when selected in Phase 6 — is embedded unchanged;
- a self-contained Standalone HTML file and a Static Microsite ZIP can each be generated and downloaded without upload, database or network dependence — the HTML opens offline and the unpacked microsite works on ordinary static webspace — both from the same shared presentation and interaction source, and both containing only allowlisted snapshot data;
- editing or regenerating never changes Source Data or previously generated outcomes;
- focused automated tests pass together with `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build`, and the defined manual browser/download/accessibility checks pass;
- none of the Deferred Work or preventative publication infrastructure has been implemented as part of V1.

### Embed in Website – WordPress Scope (Complete)

Version 1 scope has since expanded to include `Embed in website` ([PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) "Outputs"). WordPress, the first Embed platform implemented here (Phases 11–18 above), is complete: the complete list in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Real-Platform Verification and Release Criteria" has passed against real, disposable WordPress instances covering the currently supported WordPress major version and the immediately previous major version, per Phase 18's own Definition of Done above. Webflow and Squarespace remain outside implementation scope (Section 8) until each has its own feasibility research and platform-specific technical contract.

### Embed in Website – Joomla Scope (Complete)

Joomla, the second Embed platform implemented here (Phases 19–24 above), is complete: the complete list in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Real-Platform Verification and Release Criteria" has passed against real, disposable Joomla instances covering the currently supported Joomla major version and the immediately previous major version, per Phase 24's own Definition of Done above. Webflow and Squarespace remain outside implementation scope (Section 8) until each has its own feasibility research and platform-specific technical contract.
