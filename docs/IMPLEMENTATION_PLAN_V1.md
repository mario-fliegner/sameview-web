# SameView Web – Version 1 Implementation Plan

## 1. Purpose

This plan translates the approved specifications and the current repository baseline into an executable order for the remaining Version 1 work. It is not a product specification and does not replace one. If this plan conflicts with an approved specification, the specification remains authoritative.

Version 1 ends with a browser-local workflow whose only output is downloadable Standalone HTML. Hosted Publication and its infrastructure are not implementation steps in this plan.

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
- Keep viewer rendering reusable by the workspace and generated Standalone HTML without coupling it to ZIP import UI or adding a future service layer.
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
- **Existing basis:** Viewer and shared state; favicon assets are not evidence of a complete built-in-symbol catalog.
- **Implement:** Import existing branding when present; switch among the three specified options; select a supported built-in ID; select/replace a custom image with safe decode/validation; update only Current Working State and preserve the selected asset for later outcomes.
- **Likely areas:** Branding state transitions, the Edit Inspector's Branding section, viewer Handle presentation and client asset handling.
- **Dependencies:** Phases 3–5; supported built-in symbol/asset decision.
- **Definition of Done:** Every option switches cleanly and updates the viewer; Source Data stays unchanged; invalid custom images leave the previous branding intact.
- **Tests/manual:** Unit tests for transitions and imported branding; automated Playwright E2E tests for switching/replacement/error paths; manual visual checks for scaling and contrast.
- **Not included:** New logo design, external asset hosting, server processing.
- **Risks/open decisions:** The specs define `builtinId` but not the supported V1 ID/catalog; settle this before the phase without inventing symbols in code.

### Phase 7 – Create an Immutable Standalone Outcome Snapshot (F-005)

- **Goal:** Capture all and only the data needed for one Standalone HTML generation cycle.
- **Specs/features:** F-005; User Workflow Outcome Rules, Inspector Transition, Outcome Selection; `IMPORTED_COMPARISON_V1.md` Derived Slider Labels, Snapshot Semantics and outcome allowlist; `APPLICATION_LAYOUT.md` Output Inspector, Output Cards.
- **Existing basis:** Valid Current Working State, viewer presentation and branding.
- **Implement:** Enter the output-selection context through the Edit Inspector's **Create Output** action, switching the Context Inspector from the Edit Inspector to the Output Inspector while the Presentation Preview stays unchanged; select the sole available V1 output type (Standalone HTML); derive localized reference/capture labels at generation time; copy allowlisted presentation data, visibility, configuration and required assets into an immutable Outcome Snapshot; keep prior snapshots independent. A dedicated **Edit** action returns to the Edit Inspector without discarding the Current Working State or the selected output.
- **Likely areas:** Pure label derivation, snapshot builder and the Output Inspector's minimal outcome-selection state in the workspace UI.
- **Dependencies:** Phases 5–6.
- **Definition of Done:** Snapshots reflect generation-time state; later edits do not change them; unknown metadata, device URIs, GPS blocks, provenance and unused originals are excluded.
- **Tests/manual:** Unit tests across date precision, locale/time-zone seams and allowlist exclusion; snapshot immutability tests.
- **Not included:** HTML serialization, download, publication DTO/API.
- **Risks/open decisions:** Tests need deterministic locale/time-zone inputs without changing the browser-facing formatting requirement.

### Phase 8 – Process Images Locally for Standalone HTML

- **Goal:** Produce privacy-safe, optimized browser-local image assets for the snapshot without server upload.
- **Specs/features:** V1 Product Scope item 5; Architecture V1 image input limits; Data and Privacy local-output rules.
- **Existing basis:** Accepted image files and snapshot boundary; no image-processing code or dependency.
- **Implement:** Decode and validate actual image content, enforce the 40-megapixel input limit, remove embedded metadata through decode/re-encode, optimize the two comparison images and applicable branding asset for embedding, and report failure without altering workspace or previous outcomes.
- **Likely areas:** Client-safe image processing, outcome generation orchestration and focused tests/fixtures.
- **Dependencies:** Phase 7; output image-format/quality/size decision.
- **Definition of Done:** Processed output contains no original binary payload or embedded metadata, remains visually usable, stays local, and failure is atomic.
- **Tests/manual:** Pure limit tests plus automated Playwright E2E tests with metadata-bearing, malformed, oversized and valid fixtures; manual quality/file-size review.
- **Not included:** V2 WebP publication limits, server validation, upload pipeline, persistent files.
- **Risks/open decisions:** Current specs do not define Standalone HTML image format, dimensions, quality or absolute size; define these before implementation rather than copying V2 hosted-output limits.

### Phase 9 – Generate and Download Standalone HTML (F-005)

- **Goal:** Generate one self-contained interactive HTML artifact entirely in the browser and download it.
- **Specs/features:** V1 Product Scope and Outputs; F-005; User Workflow Generate/Make Outcome Available, Download; `APPLICATION_LAYOUT.md` Output Inspector, Download Flow, Progress, Completion; privacy rules.
- **Existing basis:** Immutable snapshot, processed assets and reusable comparison behavior.
- **Implement:** Serialize a self-contained, safe HTML document from the snapshot; embed required styles, behavior and assets; prevent user text from executing as markup; drive the Output Inspector's progress indicator through its generation phases (preparing the comparison, processing images, building the HTML, starting the download) while workspace interactions stay temporarily disabled; create a browser download as one continuous action with generation; keep each generated artifact unchanged and independent from subsequent edits or generations; after the download starts, re-enable **Download HTML** and leave the Output Inspector open with no separate success screen.
- **Likely areas:** Standalone document renderer, client download orchestration, Output Inspector progress presentation and reusable viewer behavior with no dependency on the workspace page.
- **Dependencies:** Phases 7–8; standalone artifact contract decision.
- **Definition of Done:** Downloaded HTML opens without network/server access, presents the snapshot interactively and accessibly, contains only allowlisted data, and remains unchanged after workspace edits.
- **Tests/manual:** Unit tests for escaping, allowlist serialization and deterministic document structure; build/typecheck/lint; automated Playwright E2E tests for download, offline execution and responsive/keyboard checks inside the artifact; manual spot checks in additional real browsers/devices.
- **Not included:** Hosted output, URL, QR/iframe code, upload or management; the two other Output Cards remain visible as non-selectable "Coming Soon" placeholders and are not implemented as functioning outputs.
- **Risks/open decisions:** The specs do not define filename, exact self-contained document contract or code-sharing/build mechanism; settle these before this phase while preserving fully client-side generation.

### Phase 10 – V1 Integration and Release Readiness

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
11. **Configure branding:** import and switch No Branding/Built-in/Custom, including atomic invalid-image handling. Predecessor: 8 and built-in catalog decision.
12. **Derive labels and build Outcome Snapshots:** generation-time locale formatting, explicit allowlist and snapshot immutability. Predecessor: 10–11.
13. **Process comparison images in-browser:** content validation, 40 MP guard, metadata removal and agreed Standalone optimization. Predecessor: 12 and image-output decision.
14. **Generate safe self-contained HTML:** embed one snapshot, assets, style and viewer behavior without network dependencies. Predecessor: 13 and artifact-contract decision.
15. **Download and preserve independent outcomes:** browser download plus repeated generation without changing older artifacts or workspace state. Predecessor: 14.
16. **Run the complete V1 integration pass:** error recovery, accessibility, responsiveness, offline output and repository quality gates. Predecessor: 1–15.

Each iteration has one primary result, avoids V2 preparation and should remain independently reviewable and deployable when its predecessor state is present.

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
- F-007 Manage Hosted Comparisons
- Public comparison URLs
- QR codes and iframe embed code
- Private management links and publication update/deletion
- Server-side publication validation and image processing
- Persistent publication metadata and image storage
- Anonymous-publishing abuse protection
- Multiple active or managed workspaces
- Automatic Android-to-web transfer
- Static Microsite, CMS Package and all further output types

## 9. Open Decisions and Specification Conflicts

### Decisions required for V1

| Decision | Why it is open | Required before | Constraints |
|---|---|---|---|
| Local workspace retention | Architecture deliberately leaves local persistence technology undefined; current code has no client state. | Iteration 5 | Exactly one active workspace, local-only data, failure preservation; do not infer multi-workspace storage. |
| Presentation visibility representation | It must be independent of preserved imported `additional.visibility`, but no concrete working-state field is specified. | Iteration 10 | F-003 visibility table and metadata preservation rules. |
| Built-in branding catalog | `builtinId` exists conceptually, but supported V1 IDs/assets are not identified in the repository specs or assets. | Iteration 11 | Only No Branding, Built-in Symbol and Custom Image; Brand Guide; no new brand design. |
| Standalone image profile | V1 requires metadata removal and optimization, but does not specify format, dimensions, quality or size. V2 hosted WebP limits must not be copied silently. | Iteration 13 | 40 MP input limit, local processing, usable visual quality, no upload. |
| Standalone artifact contract | Filename, exact self-contained document shape and viewer code-sharing/build approach are unspecified. | Iteration 14 | Fully browser-generated, offline-capable, safe text handling, immutable snapshot, Standalone HTML only. |

These decisions need narrow technical or product clarification in their named iteration; they do not justify advance infrastructure.

### Evaluated conflicts

- `CLAUDE.md` and `AGENTS.md` still list MySQL, persistent image storage and hosted WebP images under “Hard Constraints (V1)”. Current `PRODUCT_SCOPE.md`, `ARCHITECTURE.md` and `DATA_AND_PRIVACY.md` place that publication infrastructure in V2. For this plan the approved product scope is authoritative: existing DB/deployment assets remain untouched but are not V1 feature dependencies. The instruction-file labels should be corrected separately before any task might otherwise interpret them as V1 publication work; they do not block browser-only iterations when this boundary is explicit.
- `IMPORTED_COMPARISON_V1.md` contains forward-looking publication rules despite its V1 name. Its workspace, snapshot and allowlist rules apply to V1; publication-specific persistence and server processing do not. This is an ambiguity, not a reason to implement publication, and should be clarified separately before F-006.
- `USER_WORKFLOW.md` includes product-wide public-viewing and management entry points. Because it explicitly complements rather than redefines Product Scope, those entry points are treated as future workflow context and create no V1 routes. Clarification is desirable before F-006, not before the local V1 workflow.
- The implemented DB schema, smoke check, Docker setup and deployment documentation predate the browser-only V1 boundary. They are real technical foundations, but no current V1 feature reads or writes publication data. The homepage's runtime smoke check is the only user-facing coupling and is addressed in Iteration 1; no schema or deployment change is planned.

## 10. Completion Criteria

Version 1 is complete when:

- a user can import a valid SameView ZIP within all archive, metadata and referenced-file rules, while invalid or cancelled imports cannot damage an active workspace;
- exactly one active workspace contains immutable Source Data and a separate Current Working State, all kept locally in the browser;
- the comparison can be reviewed through an accessible, responsive interactive viewer driven by Current Working State;
- every specified editable value and visibility can be changed, all immutable/preserved data remains intact, and branding supports exactly the three specified options;
- reference and capture labels are derived into an immutable Outcome Snapshot at generation time;
- required images are validated, stripped of embedded metadata and optimized locally under the agreed Standalone profile;
- a self-contained Standalone HTML file can be generated and downloaded without upload, database or network dependence, opens offline, and contains only allowlisted snapshot data;
- editing or regenerating never changes Source Data or previously generated outcomes;
- focused automated tests pass together with `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build`, and the defined manual browser/download/accessibility checks pass;
- none of the Deferred Work or preventative publication infrastructure has been implemented as part of V1.
