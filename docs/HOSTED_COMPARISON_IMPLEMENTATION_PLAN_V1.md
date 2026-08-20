# SameView Hosted Comparison – Version 1 Implementation Plan

## 1. Purpose

This plan translates the approved Hosted Comparison specifications into an executable, cross-repository implementation sequence. It is not a product specification and does not replace one. If this plan conflicts with an approved specification, the specification remains authoritative.

It coordinates work across two repositories:

- `sameview-web` (`C:\data\work\privat\git-repos\sameview-web`) — the Hosted application/service and public/management web surfaces, added alongside the existing, unchanged root Web application.
- `sameview` (`C:\data\work\privat\git-repos\sameview`) — the Android publishing/management client.

This plan does **not** replace, extend or reopen [docs/IMPLEMENTATION_PLAN_V1.md](IMPLEMENTATION_PLAN_V1.md). That plan documents the completed, historical SameView Web V1 (browser-local workflow, WordPress and Joomla Embed) and remains unchanged. Hosted Comparison is a separate approved capability with its own implementation sequence, per [IMPLEMENTATION_PLAN_V1.md](IMPLEMENTATION_PLAN_V1.md) Section 8's own forward pointer to this document.

## 2. Scope

In scope: the Hosted application foundation, persistence, asset storage, image processing, Publish/Update/Delete/Resolve APIs, the public Viewer, the browser management surface, reporting, Android's Hosted identity/network/registry/UX/sharing work, deployment of the Hosted application, and cross-repository integration/production acceptance for Hosted Comparison Version 1, exactly as approved in Revision 4.

Out of scope: everything listed in Section 16 "Deferred / Future Work", and any change to the existing SameView Web root application or existing Android behavior outside Hosted Comparison.

## 3. Sources of Truth

Authoritative Hosted product-decision baseline:

- [docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) (Revision 4)

SameView Web canonical specifications:

- [docs/FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) (F-006, F-007)
- [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md)
- [docs/PRODUCT_SCOPE.md](PRODUCT_SCOPE.md)
- [docs/USER_WORKFLOW.md](USER_WORKFLOW.md)
- [docs/APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md)
- [docs/IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md)
- [docs/COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md)
- [docs/deployment.md](deployment.md)
- [docs/AI_ENGINEERING_GUIDE.md](AI_ENGINEERING_GUIDE.md)

Android canonical specifications (in `sameview`):

- `docs/SESSION_METADATA_V1.md` (§6.8 already defines `session.comparisonId`)
- `docs/CLAUDE_PROJECT_INSTRUCTION.md` (Addendum "2026-08-19 – Hosted Comparison Network Capability" already approves the network exception)
- `docs/SESSION_BACKUP_EXPORT_V1.md`
- `docs/GPS_RECREATION_SYSTEM_V1.md` (§11 "Hosted Comparison exception" already reconciled)
- `docs/SESSION_ORIGINALS_PRIVACY_V1.md`

This plan does not duplicate any of the above; each phase cross-references the relevant section instead of restating it, per [docs/AI_ENGINEERING_GUIDE.md](AI_ENGINEERING_GUIDE.md) "Specification Discipline".

## 4. Architecture Boundaries

The following are approved and are **not** reconsidered by this plan (see Revision 4 and the specifications in Section 3 for the full rationale):

- One Git repository, `sameview-web`; the existing root application remains unchanged and continues to serve `web.sameview.app`.
- A separate Hosted application under a conceptual `hosted/` directory in the same repository, deployed as its own Node.js/Plesk application instance, independent runtime/deploy lifecycle, no Host-header multiplexing.
- Canonical Hosted domain `my.sameview.app`; public route `/<public_id>`, no `/v/` prefix; management routes `/<public_id>/manage/<management_token>` → `/<public_id>/manage`; report route `/<public_id>/report`.
- SameView Android is the first Hosted publishing client. A future SameView Web Hosted-publishing client is explicitly out of scope for this plan.
- MySQL stores structured Hosted state only (never binary images); Asset Storage is a small, provider-neutral boundary, filesystem-backed initially, with an immutable, versioned asset layout; publication updates activate atomically.
- Accountless management: a secret management token (never `session.id`/`session.comparisonId`/`public_id`) is the sole management authority; at most one active Hosted Publication per Comparison.
- The public Viewer is shared runtime/application logic resolving stored Publication state, not a generated file per Publication.
- Hosted Comparison is publication, not cloud backup; the Viewer is unlisted/`noindex`, not a searchable gallery; local Comparison deletion and Hosted deletion are separate user decisions.
- Android: `session.comparisonId` is additive/optional within metadata version 6 (no version 7); assigned to new Comparisons at creation and lazily to legacy Comparisons only when genuinely required (initially `Host online`); `session.id` keeps its existing, unrelated role; Hosted is a narrow, explicit network exception — normal SameView use remains fully offline; privacy-preprocessed temporary upload copies are used, originals are never modified; `capture.jpg`/`reference.jpg` are the Hosted source images, never `reference-original.jpg`.

## 5. Implementation Workflow

Every phase in Section 8 follows the same four gates. No phase's implementation step may begin before its own Scope Approval gate has been explicitly granted; no phase may substitute a later gate for an earlier one.

1. **Analysis** — inspect only the specifications, code and reference projects relevant to that phase; establish current state and proven technical constraints; resolve only the implementation details this specific phase genuinely requires (see each phase's "Implementation decisions resolved here"); identify any conflict between specification and code explicitly rather than silently choosing one; no code changes during this gate.
2. **Scope Approval** — before touching any file, report: the exact files expected to change; the exact intended changes; risks; relevant tests/verification; documentation impact. Implementation does not begin until this is explicitly approved.
3. **Implementation** — only after approval: modify only the approved files; keep changes minimal, targeted and reversible; preserve existing behavior outside the approved scope; no unrelated refactoring; no renaming unrelated to the phase; no architecture changes without separate approval; no speculative abstractions.
4. **Report** — after implementation, always report: changed files; unchanged areas; tests executed; tests skipped (and why); remaining manual verification; remaining risks; documentation requiring synchronization (see Section 13).

## 6. Status Model

- `Planned` — not yet started.
- `In Analysis` — Gate 1 underway.
- `Approved for Implementation` — Gate 2 passed; Gate 3 may begin.
- `Completed` — Gate 4 report accepted.
- `Blocked` — cannot proceed; blocking reason recorded on the phase.

Every phase in Section 8 begins at `Planned`. No phase in this document is marked `Completed`; the existence of approved specifications does not constitute implementation.

## 7. Dependency / Critical Path Overview

**Can start immediately, in parallel, with no cross-dependency:**

- Phase 1 (Hosted Application Scaffold — sameview-web)
- Phase 13 (Android Metadata Identity Foundation — sameview)
- Phase 14 (Android Network and Privacy Foundation — sameview)

**Critical path** (the longest true dependency chain):

Phase 1 → Phase 3 (Persistence) & Phase 4 (Storage) → Phase 5 (Upload/Processing) → Phase 6 (Publish API) → Phase 7/8 (Update/Delete API) → Phase 11 (Rate Limiting) → **Phase 12 (Cross-Repository API Contract Checkpoint)** → Phase 17 (Android Publish Integration, also requires Phases 13–16) → Phase 20 (Android Existing-Publication Management) → Phase 26 (Integration and Production Acceptance).

**Safe parallel work once its own prerequisites are met, independent of the critical path above:**

- Phase 2 (Hosted Deployment Foundation) — runs right after Phase 1, in parallel with Phases 3–11.
- Phase 9 (Resolve/View API) and Phase 18 (Public Viewer) — depend only on Phase 3, not on Publish/Update/Delete; can proceed alongside Phases 5–11.
- Phase 19 (Browser Management Surface) and Phase 24 (Reporting) — depend on Phases 6/7/8 and 3/18 respectively, not on the Android track.
- Phases 13–16 (Android identity, network/privacy, registry, Host-online UI) — depend only on each other and on existing Android code, not on any Hosted API being live; they use the contract fixtures produced at Phase 12 to build/test against, and only their *real end-to-end* verification waits for Phase 12/17.
- Phase 21 (Local Deletion Interaction), Phase 22 (`Online comparisons`) and Phase 23 (QR Sharing) — depend on Phase 20, not on each other; may proceed in any order once Phase 20 is complete.
- Phase 25 (Production Release Readiness) depends on all Hosted-side functional phases (3–11, 18, 19, 24) and Phase 2, not on the Android track.

Phase 26 (Integration and Production Acceptance) is the sole final phase and depends on every other phase.

## 8. Detailed Implementation Phases

---

### Phase 1 – Hosted Application Scaffold

**Status:** Completed
**Primary Repository:** `sameview-web`

- **Objective:** Establish the `hosted/` application as a second, independently buildable/runnable Node.js/Astro application in the same repository, with no product behavior yet.
- **Prerequisites:** None.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Repository and Application Boundary", "Hosting"; [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Application and deployment boundary".
- **Analysis (Gate 1):** Inspect the existing root application's `package.json`, `astro.config.mjs`, `tsconfig.json` and `app.js` (per [deployment.md](deployment.md)) to determine the minimal second-application structure that (a) builds/runs independently, (b) does not require moving or restructuring the root application, and (c) can later reuse selected `src/lib/` modules without duplicating them. Confirm current `pnpm` workspace behavior (or absence of one) does not block a second top-level application directory.
- **Scope Approval (Gate 2):** Report exactly which new files/directories are created (e.g. `hosted/package.json`, `hosted/astro.config.mjs`, `hosted/tsconfig.json`, a minimal `hosted/src/pages/index.astro` placeholder) and confirm zero existing files change.
- **Implementation (Gate 3):** Create the minimal `hosted/` application skeleton: its own `package.json`, build/dev scripts, TypeScript config, and a placeholder page proving the app builds and starts locally. No database, no storage, no product routes yet.
- **Not included / Non-goals:** Any Hosted product behavior; any deployment; any database/storage code; any reuse wiring (deferred to the phase that first needs a specific shared module).
- **Implementation decisions resolved here:** Exact `hosted/` internal directory/file structure; exact package/Astro configuration; exact shared-module import mechanism is *not* decided here — only that the boundary allows it later.
- **Verification/Tests (Gate 4):** `hosted/` builds and starts locally (`pnpm dev`/`pnpm build` equivalents) independently of the root application; running the root application's existing test/build/lint continues to pass unmodified, proving no regression.
- **Completion criteria:** Two independently buildable applications exist in one repository; the root application is provably untouched (diff-clean outside `hosted/`).
- **Downstream dependencies:** Phases 2–11, 18, 19, 24 all build inside `hosted/`.

---

### Phase 2 – Hosted Deployment Foundation

**Status:** Completed
**Primary Repository:** `sameview-web`

- **Objective:** Prove, early and cheaply, that the approved two-application Netcup/Plesk architecture is operationally real — deploy the Phase 1 scaffold to a reachable `my.sameview.app` — before investing further engineering effort on top of an unverified deployment assumption.
- **Prerequisites:** Phase 1.
- **Sources of truth:** [deployment.md](deployment.md) (the proven `web.sameview.app` Passenger/CommonJS/static-asset pattern); [ARCHITECTURE.md](ARCHITECTURE.md) "Hosting".
- **Analysis (Gate 1) — Reference-Project/Current-Deployment Gate:** Inspect `deployment.md` in full for the already-proven Netcup/Plesk/Passenger constraints (CommonJS Startup File requirement, `mode: "middleware"` static-asset caveat, FTP-only deploy, no SSH) and determine the minimal analogous setup for a second Plesk Node.js application: whether the Netcup account/plan supports adding a second Application Root/domain, and whether an analogous hand-written CommonJS `app.js`-style entrypoint is required for `hosted/` as it was for the root application. Do not assume a different deployment model is needed; reuse the proven pattern unless analysis shows it cannot apply.
- **Scope Approval (Gate 2):** Report the exact deployment artifact shape for `hosted/` (mirroring `deployment.md`'s "Deployment artifact" section), and explicitly flag that exact Plesk Application Root path, GitHub Actions job/workflow structure and environment-variable/secret names remain open per Section 12 below — this phase proves reachability, not final production readiness (see Phase 25).
- **Implementation (Gate 3):** Deploy the Phase 1 scaffold to a real, reachable `my.sameview.app` (or an interim subdomain if DNS/TLS for the final domain is not yet available — report this explicitly rather than assuming it), verifying it serves its placeholder page.
- **Not included / Non-goals:** Any database, storage, or product route; final production hardening, backup verification or the full release checklist (Phase 25).
- **Implementation decisions resolved here:** Whether the second application requires its own hand-written CommonJS entrypoint, or whether Plesk/Netcup's actual panel capabilities allow a simpler path — resolved by direct verification against the real panel, not assumed.
- **Verification/Tests (Gate 4):** `https://my.sameview.app` (or the interim domain) responds with HTTP 200 from the placeholder page, independently of `web.sameview.app`, which remains unaffected and independently reachable.
- **Completion criteria:** Two independently deployed, independently reachable Node.js applications exist in production.
- **Downstream dependencies:** De-risks Phases 3–25; Phase 25 (Production Release Readiness) builds on this foundation rather than repeating it.

---

### Phase 3 – Hosted Persistence Schema Foundation

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Establish the Hosted `comparisons` table (and any small adjacent tables it genuinely requires) matching [ARCHITECTURE.md](ARCHITECTURE.md) "Hosted Comparison Architecture" → "Data Model", with no API behavior yet.
- **Prerequisites:** Phase 1.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Data Model", "MySQL Logical Separation"; [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Stored Data".
- **Analysis (Gate 1):** Read the current `src/db/schema.ts` and `drizzle/0000_smart_zaran.sql` in the root application in full. Confirm they are a documented-but-unmigrated, unrelated-to-Hosted-implementation artifact (per [deployment.md](deployment.md) "Migrations": not yet applied to production, not a V1 dependency). Determine, per "MySQL Logical Separation", whether Hosted's schema lives in a dedicated database/schema or clearly namespaced tables within the existing one, based on the actual current Netcup MySQL provisioning (verify, do not assume).
- **Scope Approval (Gate 2):** Report the exact new Drizzle schema file(s)/migration(s) inside `hosted/`, the exact table/column list (matching ARCHITECTURE.md's Data Model: `id`, `comparison_id`, `public_id`, `management_token_hash`, `title`, `description`, `reference_label`, `capture_label`, `location_*`, `branding_*`, `background`, `corner_style`, `active_asset_version`, operational state, timestamps), and whether the existing root-app `src/db/schema.ts` is touched (expected: no).
- **Implementation (Gate 3):** Create the Hosted schema and its first migration inside `hosted/`, with the `comparison_id` and `public_id` uniqueness constraints enforced at the database level (an explicit `UNIQUE` index on `comparison_id`, not application-level-only checking, to prevent the race condition identified in prior analysis). No report-record table is added yet unless Phase 24's analysis shows earlier introduction is safer.
- **Not included / Non-goals:** Any API reading/writing this schema; the existing root-app schema/migration; report-data model (Phase 24 decides whether it needs its own table now or can wait).
- **Implementation decisions resolved here:** Exact MySQL database/schema naming; exact migration command/tooling invocation; exact column types (within the Data Model's already-approved field list).
- **Verification/Tests (Gate 4):** Migration applies cleanly against a local MySQL 8.0.46 instance (matching production per [ARCHITECTURE.md](ARCHITECTURE.md) "MySQL Configuration"); a uniqueness-constraint violation on `comparison_id` is rejected at the database level in a direct test, not only application logic.
- **Completion criteria:** A queryable, correctly constrained Hosted schema exists, unused by any route yet.
- **Downstream dependencies:** Phases 6–10, 18, 19, 24.

---

### Phase 4 – Hosted Asset Storage Foundation

**Status:** Completed
**Primary Repository:** `sameview-web`

- **Objective:** Establish the small, provider-neutral Asset Storage boundary and its initial Netcup-filesystem implementation, with the approved versioned layout, and no upload/API behavior yet.
- **Prerequisites:** Phase 1.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Asset Storage", "Publication Update Atomicity", "Cleanup and Orphan Handling".
- **Analysis (Gate 1):** Confirm no existing storage-abstraction code exists anywhere in the repository to reuse (prior analysis found none); confirm the target persistent-filesystem location/permissions model available under the current/planned Netcup hosting (informed by Phase 2's deployment findings).
- **Scope Approval (Gate 2):** Report the exact small interface/contract (put/get/delete-by-key, or equivalent minimal shape) and the exact `comparisons/<internal-publication-id>/versions/<asset-version>/...` filesystem implementation files inside `hosted/`.
- **Implementation (Gate 3):** Implement the storage contract and its filesystem-backed implementation only; a temporary, non-public processing area for transient uploads (per "Temporary Processing Data" in [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md)); no S3 implementation of any kind.
- **Not included / Non-goals:** Any S3-compatible implementation (speculative, explicitly deferred); upload validation or image processing (Phase 5); cleanup scheduling (Phase 10).
- **Implementation decisions resolved here:** Exact storage-interface method names/signatures; exact on-disk key-to-path mapping (within the approved versioned-layout shape).
- **Verification/Tests (Gate 4):** Unit tests for put/get/delete against the filesystem implementation, including the versioned-path convention and rejection of any path-traversal-unsafe key.
- **Completion criteria:** A working, tested, provider-neutral storage boundary exists, unused by any route yet.
- **Downstream dependencies:** Phases 5–10.

---

### Phase 5 – Hosted Upload Validation and Image Processing Pipeline

**Status:** Completed
**Primary Repository:** `sameview-web`

- **Objective:** Implement server-side validation and processing of uploaded `capture.jpg`/`reference.jpg`/optional branding input into the canonical Hosted WebP assets, as a pure processing pipeline with no API route yet.
- **Prerequisites:** Phase 4.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Image Limits", "Upload and Processing"; [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Image Processing (Hosted Publication)", "Size and Processing Constraints".
- **Analysis (Gate 1):** Confirm no image-processing dependency currently exists in either application beyond the root app's browser-side, EXIF-GPS-only stripping (`src/lib/jpeg-location-metadata.ts` and siblings, which is browser-only and not reusable server-side). Identify the minimal Node-compatible image library capable of decode/validate/resize/WebP-encode server-side; this is a new dependency for `hosted/` specifically (not the root app) and must be reported explicitly at Scope Approval.
- **Scope Approval (Gate 2):** Report the exact new dependency (if any) proposed for `hosted/` only, the exact validation limits enforced (per ARCHITECTURE.md: ~20 MB/40 MP/~8000 px per core image; ~10 MB/24 MP for branding), and the exact pipeline module(s).
- **Implementation (Gate 3):** Decode → validate actual content (not just MIME/extension) → strip all embedded metadata → resize to the 1920 px long-edge bound (no upscaling) → encode WebP, for the two core images; a parallel, smaller-bound pipeline for optional branding (~512×512, alpha preserved where needed). Reject inputs exceeding limits before attempting decode. Temporary inputs are written only to the Phase 4 temporary area and never treated as permanent.
- **Not included / Non-goals:** Any API route; any client-side (Android) preprocessing (Phase 14); WebP quality tuning beyond a first reasonable default (final quality constant is an engineering judgment made here with evidence, per Revision 4, not a product decision).
- **Implementation decisions resolved here:** Exact image-processing library/dependency; exact WebP encoder quality constant (chosen here, after evidence, per Revision 4's explicit deferral of this detail to implementation).
- **Verification/Tests (Gate 4):** Unit/integration tests for valid inputs, oversized/invalid inputs, malformed images, and confirmation that output assets carry no EXIF/XMP/IPTC/GPS metadata.
- **Completion criteria:** A tested, pure processing pipeline exists, producing correct Hosted assets from valid inputs and rejecting invalid ones, unused by any route yet.
- **Downstream dependencies:** Phases 6, 7.

---

### Phase 6 – Hosted Publish API

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Implement the initial Publish operation: given `comparisonId` and a Hosted Presentation payload plus required assets, create exactly one active Publication and return its public identity and management capability.
- **Prerequisites:** Phases 3, 4, 5.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Identifiers", "Data Model", "Client/API Boundary"; [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Hosted API product operations" → "Publish"; [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-006 "Publish behavior".
- **Analysis (Gate 1):** Confirm the exact atomic-uniqueness mechanism available (Phase 3's database `UNIQUE` constraint on `comparison_id`) is sufficient to prevent a second active Publication under concurrent requests without additional locking; identify the simplest correct pattern (e.g. an `INSERT` relying on the unique constraint, with the conflict path returning the existing-publication/no-authority response rather than a generic error).
- **Scope Approval (Gate 2):** Report the exact new route/module inside `hosted/`, the exact request/response shape at a conceptual level (not literal wire format yet — see Phase 12), and how the "already published, no management authority" case is handled without disclosing ownership.
- **Implementation (Gate 3):** Validate the request (reusing Phase 5's pipeline and Phase 3's schema); generate `public_id`/`management_token` per the approved formats (Revision 4 "Identifier formats"); persist the hash only; activate the first asset version (using Phase 4/7's atomic-activation pattern degenerately for the create case); return the public identity and the one-time plaintext management token.
- **Not included / Non-goals:** Update/Delete (Phases 7, 8); rate limiting (Phase 11, applied here once both exist); the literal HTTP contract (Phase 12).
- **Implementation decisions resolved here:** Exact API route path/method (internal to this phase, finalized together with Phase 12); exact response field names.
- **Verification/Tests (Gate 4):** Integration tests: successful first Publish; a second Publish attempt for the same `comparisonId` without management authority creates nothing and discloses nothing; management token is returned exactly once and never persisted in plaintext (assert against the database row).
- **Completion criteria:** A tested Publish operation exists and is callable in a local/dev environment; not yet exposed to Android.
- **Downstream dependencies:** Phases 7, 8, 12, 17.

---

### Phase 7 – Hosted Update API

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Implement authorized Update: atomically replace a Publication's active state with newly processed content while preserving its public link.
- **Prerequisites:** Phase 6.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Publication Update Atomicity"; [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Hosted API product operations" → "Update"; [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-006 "Update online".
- **Analysis (Gate 1):** Confirm the exact transaction boundary for "switch `active_asset_version` and Publication state atomically" against the actual Drizzle/MySQL setup (a single `UPDATE` guarded by management-token-hash match and existing-row check is likely sufficient; verify against Phase 3's schema before assuming more is needed).
- **Scope Approval (Gate 2):** Report the exact new route/module, the exact authorization check (constant-time hash comparison against `management_token_hash`), and the exact prepare→validate→store→activate sequence as it maps to Phases 4/5's primitives.
- **Implementation (Gate 3):** Prepare the complete new version under a new asset-version key (Phase 4); process it (Phase 5); verify readiness; atomically switch `active_asset_version` and Publication row; on any failure before activation, leave the previous version fully active and mark the new one a cleanup candidate (Phase 10 executes actual removal).
- **Not included / Non-goals:** Cleanup execution itself (Phase 10 — this phase only marks candidates); rate limiting (Phase 11).
- **Implementation decisions resolved here:** Exact SQL/transaction implementation for the atomic switch.
- **Verification/Tests (Gate 4):** Integration tests: successful update preserves the public link and old-version content is superseded; a failed update (simulated processing failure) leaves the previous Publication fully intact and serving correctly; an update attempt with an invalid/mismatched management token is rejected without modifying anything.
- **Completion criteria:** A tested, atomic Update operation exists.
- **Downstream dependencies:** Phases 10, 12, 20.

---

### Phase 8 – Hosted Delete API

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Implement authorized hard deletion of a Publication.
- **Prerequisites:** Phase 6.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Publication Deletion"; [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Publication Lifetime and Deletion"; [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Hosted API product operations" → "Delete".
- **Analysis (Gate 1):** Confirm the exact ordering guaranteeing "public accessibility ends immediately/logically first" — i.e. the database row is removed/marked unreachable before physical asset cleanup is even attempted, so a cleanup failure can never restore public accessibility.
- **Scope Approval (Gate 2):** Report the exact new route/module and the exact logical-delete-then-cleanup-candidate sequence.
- **Implementation (Gate 3):** Verify management authority; remove the database row (making the Publication immediately unreachable via Phase 9's Resolve/View); mark its asset tree as a cleanup candidate for Phase 10. No soft delete, no `deleted_at`, no tombstone.
- **Not included / Non-goals:** Physical asset removal itself (Phase 10); rate limiting (Phase 11).
- **Implementation decisions resolved here:** Exact deletion-marking mechanism feeding Phase 10's cleanup query.
- **Verification/Tests (Gate 4):** Integration tests: successful delete makes the Publication immediately unreachable via Resolve/View; an unauthorized delete attempt is rejected and changes nothing; no row remains after deletion (hard delete verified directly against the database).
- **Completion criteria:** A tested, hard-delete Delete operation exists.
- **Downstream dependencies:** Phases 10, 12, 20.

---

### Phase 9 – Hosted Resolve/View API

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Implement the public, unauthenticated read operation that resolves a `public_id` to its currently active, allowlisted Presentation state for the Viewer.
- **Prerequisites:** Phase 3.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Client/API Boundary"; [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Hosted API product operations" → "Resolve/View"; [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Public Hosted Semantics".
- **Analysis (Gate 1):** Enumerate precisely which fields must never appear in this response (management token/hash, internal storage paths, unnecessary internal IDs, private operational state), cross-checked against Phase 3's full column list, so the allowlist is complete rather than assembled ad hoc.
- **Scope Approval (Gate 2):** Report the exact route/module and the exact allowlisted response shape.
- **Implementation (Gate 3):** Implement the read-only resolve query and its allowlist projection; distinguish "does not exist" from "exists but temporarily unavailable" per [ARCHITECTURE.md](ARCHITECTURE.md) "Public Viewer Failure States" (this phase only needs to expose enough state for that distinction; the Viewer, Phase 18, renders it).
- **Not included / Non-goals:** The Viewer's own rendering (Phase 18); rate limiting is explicitly *not* applied to normal Viewer traffic per Revision 4, so this phase does not gate on Phase 11.
- **Implementation decisions resolved here:** Exact response field names/shape (within the approved allowlist).
- **Verification/Tests (Gate 4):** Integration tests confirming a forbidden field (e.g. `management_token_hash`) is structurally impossible to appear in this response, not merely absent in current test data; not-found vs. temporarily-unavailable distinction is testable.
- **Completion criteria:** A tested, public read operation exists.
- **Downstream dependencies:** Phases 12, 18.

---

### Phase 10 – Hosted Cleanup and Orphan Handling

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Physically remove cleanup-candidate asset versions and stale temporary processing data, safely and idempotently.
- **Prerequisites:** Phases 4, 7, 8.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Cleanup and Orphan Handling"; [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Temporary Processing Data".
- **Analysis (Gate 1):** Confirm, per [deployment.md](deployment.md) and Phase 2's findings, what periodic-job mechanism is realistically available on the Netcup/Plesk environment (e.g. a Plesk-scheduled task invoking a script) without introducing Redis/a queue/a worker service, per the explicit V1 constraint.
- **Scope Approval (Gate 2):** Report the exact cleanup entry point (script/route) and the exact safety-age check re-querying live references before deleting anything.
- **Implementation (Gate 3):** A cleanup routine that lists cleanup-candidate asset versions and stale temporary inputs older than a safety age, re-verifies they are not the currently active version/reference, and deletes them; logs only operational information needed for diagnosis, never building a long-lived history of deleted content.
- **Not included / Non-goals:** Any queue/worker infrastructure; exact scheduling mechanics beyond "periodic and Plesk-compatible" (finalized at Phase 25 alongside production deployment).
- **Implementation decisions resolved here:** Exact cleanup safety-age values; exact scheduling mechanism/interval.
- **Verification/Tests (Gate 4):** Unit/integration tests: a cleanup-candidate asset is removed after the safety age and re-verification; an asset that became active again in the interim (race scenario) is never removed; deletion failures are logged without crashing the routine.
- **Completion criteria:** A tested, idempotent, safe cleanup routine exists (not yet scheduled in production — Phase 25).
- **Downstream dependencies:** Phase 25.

---

### Phase 11 – Hosted Rate Limiting and Abuse Protection

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Apply server-side rate limiting to anonymous Hosted write operations (Publish, Update, Delete) without introducing an account, CAPTCHA or third-party anti-abuse dependency.
- **Prerequisites:** Phases 6, 7, 8.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Abuse Protection"; [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Rate limiting / abuse protection".
- **Analysis (Gate 1):** Determine the simplest correct in-process mechanism (e.g. an in-memory sliding-window keyed by source IP and/or `comparisonId`) appropriate for a single Hosted application instance, explicitly noting the approved requirement that it "remain replaceable if multiple server instances later require shared rate-limit state" without building that shared state now.
- **Scope Approval (Gate 2):** Report the exact middleware/module applied to the three write routes and the exact (initial, adjustable) threshold values proposed.
- **Implementation (Gate 3):** Apply the limiter to Publish/Update/Delete only, not to Resolve/View; ensure failed attempts count toward limits; ensure responses never reveal whether a `comparisonId`/`public_id` belongs to another requester, rate-limited or not.
- **Not included / Non-goals:** CAPTCHA; third-party anti-abuse services; device fingerprinting; any account requirement; shared/distributed rate-limit state.
- **Implementation decisions resolved here:** Exact threshold values; exact in-process storage mechanism.
- **Verification/Tests (Gate 4):** Integration tests confirming limits trigger correctly, Resolve/View is unaffected, and limited/unauthorized responses remain indistinguishable in wording.
- **Completion criteria:** Write operations are protected; thresholds are documented as operational configuration, adjustable without a spec change.
- **Downstream dependencies:** Phase 12.

---

### Phase 12 – Cross-Repository API Contract Checkpoint

**Status:** Planned
**Primary Repository:** Both (owned by `sameview-web` as the API provider; reviewed and consumed by `sameview`)

- **Objective:** Establish a concrete, shared reference for the Hosted API's request/response semantics, error categories, authorization behavior, upload structure and identifier representation — sufficient for Android to begin real implementation — without reopening any approved product behavior.
- **Prerequisites:** Phases 6, 7, 8, 9, 11.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Client/API Boundary"; [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Hosted API product operations", "Client/API security boundaries".
- **Analysis (Gate 1):** Review Phases 6–9's actually-implemented request/response shapes; determine the simplest contract representation appropriate to this project's existing conventions (a short, versioned Markdown reference plus a handful of example request/response JSON fixtures is likely sufficient; an OpenAPI document is not required unless this analysis finds a concrete need it does not already meet).
- **Scope Approval (Gate 2):** Report the exact contract artifact location and format (e.g. a new `hosted/` internal reference plus fixture files) and confirm it documents Phases 6–9's actual behavior rather than aspirational behavior.
- **Implementation (Gate 3):** Produce the contract reference and fixtures; both repositories' teams/agents review it together at this checkpoint before any Android code calls a real endpoint.
- **Not included / Non-goals:** Any change to already-implemented Hosted behavior; any new product decision; Android implementation itself (Phase 17).
- **Implementation decisions resolved here:** Exact API route names/paths and exact HTTP request/response contracts (finalized here, based on what Phases 6–9 actually built).
- **Verification/Tests (Gate 4):** The fixtures are exercised against the real Phase 6–9 endpoints in a local/dev environment and match exactly.
- **Completion criteria:** A concrete, verified contract reference exists that Android Phase 17 can implement against without further Hosted-side discovery.
- **Downstream dependencies:** Phase 17 (Android may not call a real Hosted endpoint before this phase completes).

---

### Phase 13 – Android Metadata Identity Foundation

**Status:** Planned
**Primary Repository:** `sameview`

- **Objective:** Implement `session.comparisonId` generation for new Comparisons and lazy assignment for legacy ones, per the already-approved [SESSION_METADATA_V1.md](../sameview/docs/SESSION_METADATA_V1.md) §6.8, with no network or UI dependency.
- **Prerequisites:** None (may start immediately, in parallel with Phase 1).
- **Sources of truth:** `SESSION_METADATA_V1.md` §6.8; `CLAUDE_PROJECT_INSTRUCTION.md`; [IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md) "Global Comparison Identity" (Web-side counterpart, for consistency).
- **Analysis (Gate 1):** Confirm, by direct code inspection, that `SessionStorage.kt`'s writer (`METADATA_VERSION = 6` at line 79, the `session` JSON block built around line 731-736) and `SessionScanner.kt`'s reader (`SUPPORTED_VERSIONS = {2,3,4,5,6}` at line 31, which never enumerates the full `session` key set) permit adding `comparisonId` as a pure additive field with no restructuring, exactly as already verified in prior analysis. Confirm the existing targeted read/patch/write pattern used by `updateContent`/`updateReferenceDate`/etc. is the correct mechanism for lazy assignment to a legacy Comparison, preserving all other fields.
- **Scope Approval (Gate 2):** Report the exact new function(s) added to `SessionStorage.kt`/`SessionScanner.kt` and confirm no metadata version bump, no restructuring of existing read/write logic.
- **Implementation (Gate 3):** Generate a UUID v4 (canonical lowercase hyphenated form) for every newly created Comparison, written into the `session` block at creation time; add a lazy-assignment function usable by a later phase (Phase 16) when `Host online` first requires the identity for a Comparison that lacks it; do not assign it during ordinary scan/open/edit/export.
- **Not included / Non-goals:** Any network call (this field is generated fully offline); any UI trigger (Phase 16 wires the trigger); any management-credential concept.
- **Implementation decisions resolved here:** Exact function/class names for generation and lazy assignment.
- **Verification/Tests (Gate 4):** Unit tests: a newly created session receives a valid UUID v4; a legacy session without the field imports/scans/edits/exports normally and is not silently assigned one; lazy assignment preserves every other known and unknown field byte-for-byte except the new key; metadata version remains 6 throughout.
- **Completion criteria:** `session.comparisonId` generation/lazy-assignment exists and is unit-tested, unused by any UI yet.
- **Downstream dependencies:** Phases 15, 16.

---

### Phase 14 – Android Network and Privacy Foundation

**Status:** Planned
**Primary Repository:** `sameview`

- **Objective:** Introduce the app's first-ever network capability (scoped narrowly to Hosted) and the client-side privacy-preprocessing pipeline for temporary upload copies, with no Hosted UI yet.
- **Prerequisites:** None (may start immediately, in parallel with Phase 1; does not require Phase 13).
- **Sources of truth:** `CLAUDE_PROJECT_INSTRUCTION.md` Addendum "Hosted Comparison Network Capability" (already approves this exception); `GPS_RECREATION_SYSTEM_V1.md` §11 "Hosted Comparison exception" (already reconciles this with GPS Recreation's own offline-only rules); [ARCHITECTURE.md](ARCHITECTURE.md) "Upload and Processing"; [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Hosted Client-Side Privacy Preprocessing".
- **Analysis (Gate 1):** Confirm, by direct manifest/Gradle inspection, that `INTERNET` is genuinely absent today and no HTTP client dependency exists (already verified in prior analysis; re-verify at implementation time in case of drift). Evaluate the minimal appropriate HTTP client choice given this is the app's first-ever network code — a small, well-vetted client library is a justified exception to the project's general "no new dependency" bias, specifically because hand-rolled TLS/timeout/retry handling is a correctness/security risk not worth taking for the app's first networking surface; a zero-dependency `HttpURLConnection`-based approach remains the alternative if this analysis finds it adequate. Confirm the existing decode/re-encode pattern already used for `strip_originals_metadata` (`SessionStorage.kt` around lines 1152-1178, 1242-1250+) and `BrandingNormalizer.kt` is directly reusable for stripping EXIF/GPS from temporary `capture.jpg`/`reference.jpg` copies.
- **Scope Approval (Gate 2):** Report the exact `AndroidManifest.xml` change (`INTERNET` permission), the exact network-client dependency decision (or explicit zero-dependency approach) with justification, and the exact new module(s) for temporary-copy creation/stripping/cleanup.
- **Implementation (Gate 3):** Add the `INTERNET` permission; add the chosen HTTPS-only client wiring (no live endpoint calls yet — this phase proves the client compiles/connects to a test endpoint, not real Hosted traffic); implement temporary upload-copy creation from `capture.jpg`/`reference.jpg` with EXIF/GPS/XMP/IPTC stripping via the reused pattern, leaving originals untouched, plus cleanup of the temporary copies after their lifecycle.
- **Not included / Non-goals:** Any real Hosted endpoint call (Phase 17, gated by Phase 12); any UI; any background/continuous network use — this remains a narrow, explicit, on-demand capability.
- **Implementation decisions resolved here:** Exact Android networking library (or confirmed zero-dependency approach); exact temporary-copy file naming/location/cleanup mechanics.
- **Verification/Tests (Gate 4):** Unit/instrumented tests: temporary copies contain no EXIF/GPS/XMP/IPTC metadata while originals are provably byte-identical to before; temporary copies are deleted after use; existing fully-offline app behavior (capture, compare, edit, local export, Share Image, Video Export) is unaffected — run the existing relevant regression suites for those features to confirm.
- **Completion criteria:** The app can make an HTTPS request and can produce a privacy-stripped temporary image copy, with zero effect on any existing feature; not yet wired into any Hosted flow.
- **Downstream dependencies:** Phase 17.

---

### Phase 15 – Android Hosted Registry and Credential Security

**Status:** Planned
**Primary Repository:** `sameview`

- **Objective:** Implement the local, encrypted Hosted management registry (DataStore under `noBackupFilesDir`, Keystore-backed AES-256-GCM for the management token only), independent of the local Comparison lifecycle.
- **Prerequisites:** Phase 13 (registry entries are keyed by `comparisonId`).
- **Sources of truth:** [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Android management persistence" (Storage technology, Physical location, Registry representation, Minimal registry fields, No `session.id` lookup cache, Secret protection, No new dependency, No biometric or StrongBox requirement, Key lifecycle, Credential/key loss behavior, Registry corruption behavior, Logging and privacy).
- **Analysis (Gate 1):** Confirm the existing `DataStore<Preferences>` + Hilt-module + qualifier + repository pattern already used by `GuideModule.kt`/`SettingsModule.kt` is directly reusable for a third such DataStore, per prior analysis. Confirm `context.noBackupFilesDir` is a valid, available API at the app's `minSdk = 29`. Confirm no existing Keystore/crypto code exists to reuse or conflict with (prior analysis found none).
- **Scope Approval (Gate 2):** Report the exact new DataStore module/file, the exact Keystore key-generation/encryption module, and the exact registry JSON shape (matching Revision 4's conceptual `{version, publications: [...]}` structure) — without inventing product behavior beyond what Revision 4 already approved.
- **Implementation (Gate 3):** Implement the registry (comparisonId, publicId, encrypted managementToken, displayTitleSnapshot, publishedAtMs, updatedAtMs) under `noBackupFilesDir`; implement lazy Keystore key creation and AES-256-GCM encryption of the token only; implement corruption-tolerant read (per-entry, not whole-registry, per Revision 4) and credential/key-loss handling (public-only actions remain available, no replacement authority ever fabricated); implement matching a registry entry's local Comparison existence via `session.comparisonId` (Phase 13), never a cached `session.id`/path.
- **Not included / Non-goals:** Any UI presenting this registry (Phases 16, 20, 21, 22); any network call; StrongBox or biometric gating (explicitly not required).
- **Implementation decisions resolved here:** Exact DataStore key name; exact Hilt qualifier/class names; exact JSON serialization key names; exact AES helper class names; exact Keystore alias string; exact GCM ciphertext/IV encoding; exact registry migration/versioning function shape.
- **Verification/Tests (Gate 4):** Unit tests: entry survives app-process restart; entry is excluded from a simulated backup path check (verifying it lives under `noBackupFilesDir`); a corrupted single entry does not invalidate the rest of the registry; simulated Keystore-key unavailability degrades to public-only-actions state without fabricating authority; token is never observable in plaintext in the persisted file.
- **Completion criteria:** A tested, encrypted, corruption-tolerant local registry exists, unused by any UI yet.
- **Downstream dependencies:** Phases 16, 17, 20, 21, 22.

---

### Phase 16 – Android Host-Online Configuration and Preview

**Status:** Planned
**Primary Repository:** `sameview`

- **Objective:** Add the `Host online` entry point to the existing Comparison action context and the Hosted configuration/preview screen exposing exactly the approved controls, with no real network Publish yet.
- **Prerequisites:** Phase 13.
- **Sources of truth:** [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Android `Host online` UX"; [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-006 "Configurable Hosted Presentation", "Initial slider position"; [APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md) "Android Hosted Layout" → "Host Online Entry", "Hosted Configuration and Preview".
- **Analysis (Gate 1):** Confirm `CompareScreen.kt`'s existing overflow-menu (`DropdownMenu`/`DropdownMenuItem` pattern already holding "Edit Session"/"Backup Session") and dedicated-icon precedent (the Delete action's own "dedicated icon, not in overflow" comment) as the two viable, already-proven placement patterns for `Host online`; select one via this analysis rather than inventing a third pattern.
- **Scope Approval (Gate 2):** Report the exact `CompareScreen.kt` change (new menu item or dedicated icon), the exact new configuration/preview screen and its composables, and confirm no other screen (in particular `EditSessionScreen.kt`) is touched.
- **Implementation (Gate 3):** Add the entry point; build the configuration/preview screen exposing exactly: Title/Description/Date/Location visibility (sourced from existing F-003/F-004-equivalent Android state), slider branding selection, Dark/Light background, Rounded/Sharp corners — and nothing else (no Side-by-Side, no Quality, no custom colors/fonts). Default initial slider position 50/50, not exposed as a user control. Trigger Phase 13's lazy `session.comparisonId` assignment at this screen's entry if the Comparison lacks one yet.
- **Not included / Non-goals:** The actual Publish network call (Phase 17); any Update-mode reuse of this screen (Phase 20 wires that once Update exists); any Web-only Presentation control.
- **Implementation decisions resolved here:** Exact Compose widgets/icons/menu placement within the chosen pattern.
- **Verification/Tests (Gate 4):** UI tests: the screen shows exactly the approved controls and no others; confirming Publish is not yet wired (a placeholder/disabled action, or explicitly deferred to Phase 17 per Scope Approval); lazy identity assignment happens on entry for a Comparison lacking `comparisonId`, and not otherwise.
- **Completion criteria:** The configuration/preview screen exists and is reachable, with correct control scope, no real Publish yet.
- **Downstream dependencies:** Phase 17.

---

### Phase 17 – Android Publish and Result Integration

**Status:** Planned
**Primary Repository:** `sameview`

- **Objective:** Wire the Phase 16 screen's confirmed Publish action to a real Hosted Publish call, handle the result, and persist it into the Phase 15 registry.
- **Prerequisites:** Phase 12 (contract checkpoint), Phases 14, 15, 16, and Phase 6 (Hosted Publish API live).
- **Sources of truth:** Phase 12's contract reference; [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Publish behavior", "Successful Hosted Result"; [USER_WORKFLOW.md](USER_WORKFLOW.md) "First Publish", "Successful Hosted Result".
- **Analysis (Gate 1):** Review Phase 12's contract fixtures to confirm the exact request Android must send (privacy-preprocessed temporary copies from Phase 14, configuration from Phase 16, identity from Phase 13) and the exact success/failure response shapes to handle.
- **Scope Approval (Gate 2):** Report the exact new networking/orchestration module(s) and how they compose Phases 13–16's existing pieces; confirm no product behavior is being newly decided here (this phase wires already-approved pieces together).
- **Implementation (Gate 3):** On confirmed Publish: prepare temp copies (Phase 14) → send the request (per Phase 12's contract) → on success, persist the returned identity/credential into the Phase 15 registry and surface View online/Copy public link/Share/QR/Private management link; on failure, remain on the configuration screen with selections preserved and a clear error, per F-006 "Failure Conditions".
- **Not included / Non-goals:** Update/Delete (Phase 20); `Online comparisons` (Phase 22); QR's own UI (Phase 23, though the *result* surface's QR affordance is included here per Revision 4's "Successful Hosted Result").
- **Implementation decisions resolved here:** Exact request/response DTOs' Kotlin representation; exact retry/error-mapping details not already fixed by the contract.
- **Verification/Tests (Gate 4):** Instrumented tests against Phase 6's real (dev-environment) API: successful Publish populates the registry correctly and exposes the correct result actions; a simulated network failure leaves no registry entry and a clear, recoverable UI state; an "already published, no authority" response from the server is handled without fabricating anything locally.
- **Completion criteria:** A real, working, offline-tolerant Publish flow exists end-to-end against a live dev Hosted instance.
- **Downstream dependencies:** Phases 20, 21, 22, 23.

---

### Phase 18 – Public Viewer

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Implement the public Hosted Viewer at `/<public_id>` as shared runtime/application logic rendering Resolve/View state, reusing SameView's existing framework-independent Presentation modules where proven compatible.
- **Prerequisites:** Phase 9.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Hosted Public Viewer Architecture", "Search and Indexing", "Public Viewer Failure States"; [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-007; [APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md) "Hosted Public Web Application"; [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md).
- **Analysis (Gate 1):** Confirm, by direct inspection, that `src/lib/comparison-artifact-markup.ts`, `comparison-artifact-scaffold.ts`, `comparison-presentation-runtime.ts` and `overflow-tooltip.ts` in the root application are genuinely reusable from `hosted/` (they are pure/framework-independent per prior verified analysis) and determine the concrete import/reuse mechanism approved in Phase 1's Architecture Boundary (selective reuse, no duplication, no forced shared package). Determine the minimal adaptation `comparison-artifact-assets.ts` needs, since its relative `fetch()` calls assume a browser context and this is now a server-rendering context.
- **Scope Approval (Gate 2):** Report exactly which root-app modules are imported into `hosted/` (and confirm the root app itself is not modified to enable this), the exact new `hosted/` route/page, and the exact full-viewport/responsive implementation approach.
- **Implementation (Gate 3):** Implement `/<public_id>` resolving Phase 9's data and rendering it through the reused markup/runtime, full-viewport sizing (no cropping/stretching, no internal scroll, responsive to orientation), Dark/Light background and Rounded/Sharp corners per the resolved Presentation, `noindex` behavior, and the four failure states (not-available, temporary-technical, missing-core-asset, missing-optional-branding) per ARCHITECTURE.md.
- **Not included / Non-goals:** The service footer/report entry point itself beyond a placeholder link (Phase 24 completes it); the browser management surface (Phase 19); asset delivery/caching tuning beyond a functionally correct first pass (finalized at Phase 25 if needed).
- **Implementation decisions resolved here:** Exact full-viewport CSS/sizing algorithm; exact adaptation of `comparison-artifact-assets.ts` for server-side use.
- **Verification/Tests (Gate 4):** Browser/E2E tests: the Viewer renders correctly for portrait/landscape/square Comparisons at multiple viewport sizes; all four failure states render correctly and distinctly; no editor or management control is ever shown; `noindex` header/meta is present.
- **Completion criteria:** A working, tested public Viewer exists for any Publication created via Phase 6.
- **Downstream dependencies:** Phase 24, Phase 26.

---

### Phase 19 – Browser Management Surface

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Implement the private management-link entry (`/<public_id>/manage/<management_token>` → `/<public_id>/manage`) and its minimal management UI, structurally distinct from the public Viewer, usable from any browser/device — which is also the approved management-link recovery mechanism (no separate implementation is needed for "recovery" beyond this phase working correctly from a device other than the one that published).
- **Prerequisites:** Phases 6, 7, 8.
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Main Routes", "Identifiers"; [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Canonical Hosted domain and URLs" → "Management URL"; [APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md) "Hosted Browser Management"; [USER_WORKFLOW.md](USER_WORKFLOW.md) "Management-Link Recovery".
- **Analysis (Gate 1):** Determine the simplest correct session mechanism for "verify the token once, then continue at a token-free URL without re-exposing the secret" (an HttpOnly, Secure, SameSite=Strict short-lived session cookie scoped to `my.sameview.app` is the natural fit given the existing SSR-capable Astro/Node stack; confirm no existing session infrastructure exists to reuse or conflict with).
- **Scope Approval (Gate 2):** Report the exact two routes, the exact session mechanism, and the exact management actions exposed (View online/Copy public link/Share/QR, Update online if in scope by this point, Delete online).
- **Implementation (Gate 3):** Implement capability verification (constant-time hash comparison against Phase 6's stored hash) at the token-bearing route, establishing the session and redirecting to the token-free route; implement the management UI exposing the approved actions; ensure no third-party resource load could leak the token via `Referer`.
- **Not included / Non-goals:** Any account/profile concept; any implication that the original Android Comparison can be restored from here.
- **Implementation decisions resolved here:** Exact management browser-session implementation; exact CSRF protection mechanism for management write actions.
- **Verification/Tests (Gate 4):** Browser/E2E tests: a valid management link from a fresh browser session (simulating "another device") successfully establishes management access; an invalid/expired token is rejected; the secret token does not appear in the URL bar after the initial redirect; Delete online from this surface works without the original Android Comparison present.
- **Completion criteria:** A working, tested browser management surface exists, usable as the approved recovery path.
- **Downstream dependencies:** Phase 26.

---

### Phase 20 – Android Existing-Publication Management

**Status:** Planned
**Primary Repository:** `sameview`

- **Objective:** Recognize an already-published Comparison locally and expose Update online/View online/Share/Delete online from the same Comparison action context.
- **Prerequisites:** Phase 17, and Phases 7, 8 (Hosted Update/Delete APIs live).
- **Sources of truth:** [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Existing Hosted Publication", "Update online", "Delete online"; [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-006.
- **Analysis (Gate 1):** Confirm the exact condition for "this Comparison already has a locally managed Publication" (a Phase 15 registry lookup keyed by the Comparison's `session.comparisonId`) and how Phase 16's entry point branches on it without duplicating the configuration screen.
- **Scope Approval (Gate 2):** Report the exact branching added to Phase 16's entry point and the exact new Update/Delete wiring, confirming `EditSessionScreen.kt` remains untouched.
- **Implementation (Gate 3):** When a managed Publication exists, `Host online`'s entry presents management (not a fresh configuration flow); implement Update online (reopens Phase 16's screen pre-filled, submits via Phase 7's API, preserves the public link, keeps the previous version live on failure); implement Delete online (confirmation, calls Phase 8's API, removes the registry entry only on success, per Revision 4's failure-handling rules).
- **Not included / Non-goals:** The local-deletion-vs-Hosted-deletion two-decision flow (Phase 21, a distinct trigger); `Online comparisons` (Phase 22).
- **Implementation decisions resolved here:** None beyond ordinary wiring; no new product decision.
- **Verification/Tests (Gate 4):** Instrumented tests: Update online succeeds and preserves the link; a failed Update leaves the previous version live and the registry unchanged; Delete online succeeds and removes the registry entry only on confirmed server success; a failed Delete leaves the registry entry intact and retryable.
- **Completion criteria:** Full owner-side lifecycle management works from the Comparison action context.
- **Downstream dependencies:** Phases 21, 22, 23.

---

### Phase 21 – Android Local Deletion Interaction

**Status:** Planned
**Primary Repository:** `sameview`

- **Objective:** Insert the second, separate Hosted-deletion decision into the existing local Comparison deletion flow, without destabilizing existing deletion behavior.
- **Prerequisites:** Phases 15, 20.
- **Sources of truth:** [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Local deletion behavior"; [USER_WORKFLOW.md](USER_WORKFLOW.md) "Local Comparison Deletion When a Hosted Publication Exists"; [APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md) "Local Deletion Dialog Sequencing".
- **Analysis (Gate 1):** Confirm the exact existing deletion call sites (`CameraViewModel.deleteSessions`/`deleteSession`, both entry points in `CompareLibraryScreen.kt` and `CompareScreen.kt`) and the seam identified in prior analysis — `SessionDeleter` itself has no hook; the extension point is at the ViewModel call site, immediately after a successful local delete.
- **Scope Approval (Gate 2):** Report the exact ViewModel-level change and the exact new confirmation dialog, confirming the base local-delete confirmation dialogs themselves are unmodified.
- **Implementation (Gate 3):** After a successful local delete, if a Phase 15 registry entry exists for that Comparison's `session.comparisonId`, show the second dialog (default No/keep online); local deletion has already completed unconditionally by this point regardless of network state; if the user opts to also delete online, invoke Phase 20's Delete online and handle success/failure per the approved messaging (local succeeded; online succeeded or failed, retryable via Phase 22).
- **Not included / Non-goals:** Any change to the base local-delete confirmation itself; any blocking of local deletion on network/Hosted availability.
- **Implementation decisions resolved here:** Exact dialog copy/wording.
- **Verification/Tests (Gate 4):** Instrumented tests: deleting a Comparison with no Hosted Publication behaves exactly as before (no regression); deleting one with a Publication, keeping it online, leaves the registry entry intact; deleting one and also deleting online, with a simulated network failure, completes the local deletion and leaves the registry entry retryable.
- **Completion criteria:** The two-decision flow works correctly in both branches without regressing existing deletion behavior.
- **Downstream dependencies:** Phase 26.

---

### Phase 22 – Android `Online comparisons`

**Status:** Planned
**Primary Repository:** `sameview`

- **Objective:** Add the secondary `Online comparisons` navigation destination and its registry-backed list.
- **Prerequisites:** Phases 15, 20.
- **Sources of truth:** [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "Local Android `Online comparisons`"; [USER_WORKFLOW.md](USER_WORKFLOW.md) "`Online Comparisons`"; [APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md) "`Online Comparisons` Navigation", "`Online Comparisons` List".
- **Analysis (Gate 1):** Confirm the existing `CameraScreen.kt` overflow `DropdownMenu` (already holding Settings/Guide/About) as the identified, proven placement, and `MainActivity.kt`'s flat, additive `NavHost` route pattern as the mechanism for the new destination — both already confirmed structurally compatible by prior analysis.
- **Scope Approval (Gate 2):** Report the exact new menu item, the exact new route/composable, and confirm no existing navigation destination is altered.
- **Implementation (Gate 3):** Add the overflow menu item and route; list Phase 15's registry entries; for each, show local display info if the Comparison still exists (via `session.comparisonId` matching against the existing scan, not a path cache) or the retained `displayTitleSnapshot`/timestamp fallback if not; expose View/Copy/Share/QR/Private-link/Delete, plus Open/Update only where the local Comparison still exists.
- **Not included / Non-goals:** Any server-side "my publications" account lookup; any background sync.
- **Implementation decisions resolved here:** Exact row/card layout, list ordering, copy/error wording.
- **Verification/Tests (Gate 4):** Instrumented tests: the screen renders correctly with zero, one and multiple entries; an entry whose local Comparison was deleted (Phase 21, kept online) shows the correct fallback and reduced action set; the screen works fully offline (data is local-only).
- **Completion criteria:** `Online comparisons` is reachable and functionally complete per its approved scope.
- **Downstream dependencies:** Phase 26.

---

### Phase 23 – Android QR Sharing

**Status:** Planned
**Primary Repository:** `sameview`

- **Objective:** Add QR display/share/save for the public Hosted link.
- **Prerequisites:** Phase 17 (a stable public URL must exist).
- **Sources of truth:** [Revision 4](HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) "QR code and public sharing"; [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-007 "Public sharing".
- **Analysis (Gate 1):** Confirm, per prior analysis, that no QR-generation code or dependency exists anywhere in the app today — this is the one place a new Android dependency is essentially unavoidable (a small, well-established QR-generation library). Identify the minimal such library.
- **Scope Approval (Gate 2):** Report the exact new dependency and its justification, and the exact new UI surface (Share QR/Save QR/Copy link) attached to the Phase 17 result surface and Phase 20/22 management surfaces.
- **Implementation (Gate 3):** Generate a QR encoding exactly the canonical public URL (never the private management link); wire Share QR (system share sheet, image), Save QR (system save), Copy link.
- **Not included / Non-goals:** SVG QR generation (PNG is sufficient for V1 per Revision 4); any second server-side QR identity (none is created — this is purely local rendering of an already-known URL).
- **Implementation decisions resolved here:** Exact QR file format/resolution/library.
- **Verification/Tests (Gate 4):** Unit/instrumented tests: the QR decodes back to exactly the public URL; the private management link is never encodable through this surface (structurally, not just by convention).
- **Completion criteria:** QR sharing works from every surface that exposes a public link.
- **Downstream dependencies:** Phase 26.

---

### Phase 24 – Reporting

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Implement `Report this content` at `/<public_id>/report` and its minimal secure operator-review boundary.
- **Prerequisites:** Phase 3 (report data model), Phase 18 (Viewer's entry point).
- **Sources of truth:** [ARCHITECTURE.md](ARCHITECTURE.md) "Reporting Architecture"; [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Report Data", "Operator and Legal Takedown"; [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-007 "Report this content".
- **Analysis (Gate 1):** Determine whether the report data model needs its own table now (likely yes, per ARCHITECTURE.md's explicit "separate from the Hosted Publication itself") and the minimal secure, non-public operator-review mechanism realistically available (a simple authenticated internal route or direct, documented database access is sufficient per Revision 4's explicit "no full moderation dashboard required for V1" — do not build a dashboard unless this analysis finds a concrete need).
- **Scope Approval (Gate 2):** Report the exact new table/route/module and the exact operator-access mechanism proposed, flagging that exact legal fields/categories/retention remain a production gate (Section 14) pending external legal review, not decided here.
- **Implementation (Gate 3):** Implement the report table (associated with a `public_id`, minimal required fields, reporter contact never exposed to the publisher), the public route/form, rate limiting reusing Phase 11's mechanism, and the operator-review mechanism — architecturally separate from management-token ownership (an operator action never discloses or substitutes for management authority).
- **Not included / Non-goals:** Any automatic Publication removal/suspension on report submission; a full moderation dashboard; final legal copy/fields (Section 14 gate).
- **Implementation decisions resolved here:** Exact report table schema (within the "separate model" requirement); exact minimal operator-access mechanism; placeholder legal field set to be finalized at the Section 14 gate.
- **Verification/Tests (Gate 4):** Integration tests: a report submits successfully without an account; the associated Publication is not modified; reporter contact information (if collected) is not retrievable via any public/publisher-facing surface.
- **Completion criteria:** The report flow is functionally complete; legal field finalization is explicitly tracked as a separate, non-blocking gate.
- **Downstream dependencies:** Phase 26; Section 14 (production gate).

---

### Phase 25 – Hosted Production Release Readiness

**Status:** Planned
**Primary Repository:** `sameview-web`

- **Objective:** Verify and finalize the operational aspects of running Hosted in production, building on Phase 2's proven deployment foundation.
- **Prerequisites:** Phase 2, and functional completion of Phases 3–11, 18, 19, 24.
- **Sources of truth:** [deployment.md](deployment.md); Sections 12, 14 of this plan.
- **Analysis (Gate 1) — Reference-Project/Current-Deployment Gate:** Re-verify, against the real Netcup/Plesk panel at this later point (configuration may have evolved since Phase 2), the exact Application Root, deploy path, and whether the existing `SamKirkland/FTP-Deploy-Action`-based GitHub Actions pattern (already proven for the root application) can be duplicated for `hosted/` with its own job/environment, per Section 12's deployment/release gates.
- **Scope Approval (Gate 2):** Report the exact deployment workflow change (a new job/environment, not a modification of the existing root-app workflow), exact required secrets (names only decided here; values remain operator-provisioned), and exact backup/cleanup-scheduling configuration.
- **Implementation (Gate 3):** Finalize the production deployment workflow for `hosted/`; schedule Phase 10's cleanup routine; verify backup coverage of the Hosted database/asset storage per [ARCHITECTURE.md](ARCHITECTURE.md) "Backup"; complete every item in Section 12 "Deployment and Release Gates" and Section 11 "Security and Privacy Gates".
- **Not included / Non-goals:** Any change to the root application's own deployment workflow.
- **Implementation decisions resolved here:** Exact Plesk Application Root/deploy path; exact GitHub Actions job/workflow structure; exact environment-variable/secret names; exact cleanup schedule/cron; exact cache durations (if not already finalized at Phase 18).
- **Verification/Tests (Gate 4):** Full deployment dry run; the root application's own deploy/restart is verified unaffected; backup coverage confirmed against actual Netcup backup configuration (not assumed).
- **Completion criteria:** Every item in Sections 11 and 12 below is verified, not merely architecturally possible.
- **Downstream dependencies:** Phase 26.

---

### Phase 26 – Integration and Production Acceptance

**Status:** Planned
**Primary Repository:** Both

- **Objective:** Verify the complete, real, cross-repository Hosted Comparison V1 journey end-to-end before general availability.
- **Prerequisites:** All preceding phases.
- **Sources of truth:** All documents in Section 3; this plan's Section 15 "Final Completion Criteria".
- **Analysis (Gate 1):** Compile the full acceptance checklist from Section 15 and this phase's own list below; identify any gap surfaced only once every prior phase's real behavior is observed together.
- **Scope Approval (Gate 2):** Report the exact verification environment (real dev/staging Hosted deployment plus a real or emulated Android build) and the exact checklist to be executed.
- **Implementation (Gate 3):** Close only integration defects surfaced by the checklist below; no new feature work.
- **Not included / Non-goals:** Any new product behavior; any deferred/future item from Section 16.
- **Implementation decisions resolved here:** None — this phase verifies, it does not decide.
- **Verification/Tests (Gate 4) — minimum checklist:** Android intentionally publishes a Comparison; a legacy Comparison receives a stable `session.comparisonId` only when `Host online` is used; the public Viewer works without SameView installed; the public URL is stable across an Update; a failed Update leaves the previous version live; Delete online works; local deletion with keep-online works; a Hosted Publication remains manageable after local Comparison deletion; `Online comparisons` works fully offline for its local data; the browser management surface works from a different browser/device (recovery); QR/share works and never encodes the management link; privacy stripping is verified on real uploads; `reference-original.jpg` is never published; original upload inputs are not retained; the management credential does not leak into public URLs, metadata, logs or normal Comparison exports; `noindex` is present; the report flow works; all four public-Viewer failure states are reproducible and correct; a normal Hosted redeploy does not delete Publication assets/data; `web.sameview.app` and existing Android local/offline workflows are provably unaffected throughout.
- **Completion criteria:** Every item above passes against a real deployment and a real Android build.
- **Downstream dependencies:** None — this is the final phase.

---

## 9. Cross-Repository Contract Strategy

The single mandatory cross-repository checkpoint is Phase 12. Android must not call a real Hosted endpoint before Phase 12 completes; Phases 13–16 build and unit-test against Phase 15's registry and Phase 14's client independent of a live server, using local fixtures/mocks derived from the same specifications, so they are not blocked waiting for the Hosted-side phases. The contract artifact itself (Phase 12) is a lightweight, versioned reference plus example fixtures — not a heavyweight interface-definition-language document — consistent with this project's existing documentation conventions; if a later phase's Analysis gate finds concrete evidence that a more formal contract (e.g. OpenAPI) is genuinely needed, that decision is made at that phase's own Analysis gate, not here.

## 10. Testing Strategy

### `sameview-web` / Hosted

- Unit tests: identifier formats, allowlist projections, rate-limit logic, cleanup safety-age logic.
- Persistence/migration tests: schema constraints (Phase 3), atomic activation (Phase 7).
- Storage tests: versioned key layout, path-traversal safety (Phase 4).
- Image-pipeline tests: validation limits, metadata stripping, WebP output (Phase 5).
- API/integration tests: Publish/Update/Delete/Resolve behavior and failure paths (Phases 6-9).
- Viewer browser/E2E tests: responsive/full-viewport rendering, failure states (Phase 18).
- Management/report tests: capability verification, report submission (Phases 19, 24).
- Deployment smoke tests: reachability, independence from the root application (Phases 2, 25).

### `sameview` (Android)

- Metadata unit tests: `session.comparisonId` generation/lazy assignment (Phase 13).
- Registry/security tests: encryption, corruption tolerance, key-loss behavior (Phase 15).
- Network/client tests: request/response handling against Phase 12 fixtures (Phases 14, 17).
- Privacy-preprocessing tests: metadata stripping on temporary copies, original-file integrity (Phase 14).
- Compose/UI tests: control scope, navigation placement (Phases 16, 20-22).
- Existing regression tests: full relevant existing suites re-run wherever a touched area (deletion, navigation, capture, export) could regress (Phases 14, 21, 22).
- Device/manual acceptance: real-device verification for camera/network/permission interplay.

### Cross-repository

- Phase 12's contract fixtures, exercised on both sides.
- Real Publish/Update/Delete flow against a live dev Hosted instance (Phase 17, Phase 26).
- Asset/content verification: published images match what was previewed and contain no stripped-away metadata.
- Privacy verification: end-to-end confirmation that `reference-original.jpg` never reaches the server and temporary uploads are cleaned up.
- Identifier consistency: `session.comparisonId` round-trips correctly between Android and Hosted.
- Authorization-failure verification: unauthorized Update/Delete attempts across both sides.
- Network-failure/retry verification: Android behavior when Hosted is unreachable.
- Local-deletion/keep-online and management-link-recovery verification (Phase 26).
- Deployment integration verification (Phase 25/26).

Each phase runs only the tests relevant to its own approved scope; the full checklist above is reserved for Phase 26.

## 11. Security and Privacy Gates

Before production (tracked explicitly, verified at Phase 25/26, not assumed):

- Management-token generation/storage/leakage (Phases 6, 15, 19).
- Logs never contain plaintext tokens, capability URLs, raw uploaded image content or embedded EXIF/GPS (Phases 6-9, 14, 15).
- Temporary processing files (server and Android) are cleaned up reliably (Phases 5, 10, 14).
- EXIF/GPS stripping is verified both client-side (defense-in-depth) and server-side (final trust boundary) (Phases 5, 14).
- Upload byte/pixel/dimension limits and content-type validation are enforced, not merely documented (Phase 5).
- Malformed-image and decompression/resource-exhaustion handling is verified (Phase 5).
- Rate limiting and abuse protection are live, not theoretical (Phase 11).
- Path-traversal and storage isolation are verified against the real filesystem implementation (Phase 4).
- Cache behavior after Update/Delete does not serve stale/deleted content (Phase 18/25).
- `noindex` is verified present on real responses (Phase 18).
- Report-abuse handling does not itself become an abuse vector (Phase 24).
- Backup/deletion semantics are verified against the real Netcup backup configuration, not assumed (Phase 25).
- Local Android credential protection is verified against simulated key-loss/corruption (Phase 15).
- No management credential appears in a normal SameView Comparison export (Phase 26).

## 12. Deployment and Release Gates

Before production (Phase 25/26):

- Actual Netcup/Plesk capabilities for a second application verified, not assumed (Phase 2).
- Proven deployment patterns (CommonJS Startup File, `mode: "middleware"` static handling) reused, not redesigned (Phase 2).
- Second Node.js application configuration verified end-to-end.
- `my.sameview.app` DNS/TLS verified.
- Persistent storage paths, filesystem ownership/permissions verified.
- Database connectivity verified against production MySQL.
- Backup behavior/retention verified against actual configuration.
- Passenger/application restart behavior verified for the second application.
- Migration/deploy ordering and rollback verified.
- Environment secrets provisioned and verified present (names decided at Phase 25; values are operator-provisioned, never committed).
- Cleanup job scheduling verified running in production.
- Deploy process verified to never delete Publication assets (mirroring the root application's existing "never delete what it didn't upload" FTP-deploy protection, per `deployment.md`).
- Root Web application verified independently deployable and unaffected throughout.

None of the above is assumed solved merely because the architecture permits it; each is a Phase 25/26 verification item.

## 13. Documentation Update Gates

As concrete implementation decisions become known, the following require synchronization (not performed by this plan itself):

### `sameview-web`

- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — once exact schema/storage/route implementation details diverge from its current conceptual description.
- [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) — once exact retention/cleanup timings are finalized (Phase 25).
- [docs/deployment.md](deployment.md) — once the second Plesk application's real deployment configuration exists (Phase 25).
- A new API contract reference (Phase 12's own artifact) — kept current as the API evolves.
- Hosted operational documentation (runbooks for cleanup, rollback, incident response) — created as part of Phase 25 if not already covered elsewhere.

### `sameview` (Android)

- Implementation notes / `IMPLEMENTATION_NOTES.md`-equivalent — updated once Hosted networking/registry code exists.
- `CLAUDE_PROJECT_INSTRUCTION.md` — verify its existing Hosted addendum still matches actual shipped behavior once Phase 14/15/17 land.
- `GPS_RECREATION_SYSTEM_V1.md` — verify its existing "Hosted Comparison exception" still matches actual shipped behavior.
- `SESSION_METADATA_V1.md` §6.8 — verify actual `session.comparisonId` implementation matches once Phase 13 lands.
- Release/privacy documentation (e.g. release-hardening audit conventions) — a new, dated audit entry once Hosted ships, per that document family's own point-in-time convention; existing audits remain historical and are not rewritten.

Each phase's own Report gate (Section 5) states explicitly whether it requires any of the above.

## 14. Production / Legal Gates

Tracked explicitly, not treated as solved:

- Required Report-form legal fields/categories (Phase 24) — external legal review required before production.
- Final Report copy/wording.
- Operator/moderation process — beyond the minimal secure mechanism built in Phase 24, any broader process is an operational decision outside this plan.
- Public legal/footer copy/links (Phase 18/19).
- Actual infrastructure backup retention period (Phase 25) — must be verified, not invented.
- Deletion-vs-backup interaction implications (Phase 25).
- Any required privacy-policy/legal-notice updates on `sameview.app`/Play Store listings, resulting from Android's new network capability and Data Safety disclosure — outside both repositories' code, tracked here for visibility.

These do not block the engineering phases that do not directly depend on them (per Revision 4's own explicit instruction not to let unresolved legal wording block unrelated engineering foundations).

## 15. Final Completion Criteria

Hosted Comparison V1 is complete only when every item in Phase 26's checklist passes, which requires:

- Android can intentionally publish a Comparison (Phases 13-17).
- The Hosted service persists the approved publication state (Phases 3-9).
- The public Hosted Viewer works independently of SameView being installed (Phase 18).
- The public URL is stable across updates (Phase 7).
- Update works atomically; Delete/management works (Phases 7, 8, 19, 20).
- Accountless management works throughout (Phases 6, 15, 19).
- The local Hosted registry works, including surviving local Comparison deletion (Phases 15, 21, 22).
- Management-link recovery works as approved (Phase 19).
- QR/share works (Phase 23).
- The report flow exists (Phase 24).
- Security/privacy requirements are verified (Section 11).
- Production deployment is operational (Phase 25).
- Required legal/operational gates are satisfied or explicitly, visibly still open with no engineering dependency on them (Section 14).
- Existing SameView Web (`web.sameview.app`) remains unaffected (verified at every phase touching `sameview-web`, confirmed at Phase 26).
- Existing Android local/offline behavior remains unaffected (verified at Phases 14, 21, confirmed at Phase 26).
- Required documentation is synchronized with actual implementation (Section 13).

## 16. Deferred / Future Work

Outside Hosted Comparison V1 unless separately, explicitly approved later:

- SameView Web as a Hosted publishing client.
- SameView accounts.
- A cloud library/dashboard.
- Cloud backup/restore of local Comparisons through Hosted.
- More than one active Hosted Publication per Comparison.
- A public, searchable Hosted gallery.
- A SameView-operated email-delivery service.
- Responsive multi-size image variants for Hosted output.
- S3-compatible object storage implementation (the storage boundary from Phase 4 remains ready for this; it is not built now).
- Background/continuous Hosted synchronization; push notifications.
- iframe embed code for Hosted Comparisons, unless separately approved.
- Future duplicate/copy/restore semantics for `session.comparisonId`.
- Android management-capability import/App Link flow (Revision 4 explicitly defers this).

This plan does not create phases for any of the above.
