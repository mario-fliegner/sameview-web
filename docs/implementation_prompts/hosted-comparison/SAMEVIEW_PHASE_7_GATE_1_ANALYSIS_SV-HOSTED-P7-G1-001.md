# SameView Hosted Comparison — Phase 7 Gate 1 Analysis
## Prompt ID: SV-HOSTED-P7-G1-001

You are continuing implementation of SameView Hosted Comparison in the `sameview-web` repository.

This is a **new Claude session**. Do not rely on prior Claude-session context. Reconstruct the relevant state from the repository and the approved specifications.

Phase 6 — Hosted Publish API has been completed, accepted at Gate 4, documented as `Completed`, committed, and pushed.

The next task is:

```text
Phase 7 – Hosted Update API
Gate 1 – Analysis only
```

Do not implement anything in this prompt.

---

# Workflow rules

Follow the repository/project workflow strictly:

1. Analysis first.
2. No code during Gate 1.
3. Inspect only relevant specifications and implementation.
4. Establish the actual current repository state before reasoning.
5. Never guess behavior that can be proven from code/spec/tests.
6. If documentation and implementation conflict, identify the conflict explicitly.
7. Prefer the approved specification over accidental implementation behavior.
8. Do not expand scope into later phases.
9. Do not modify files, database rows, runtime assets, migrations, documentation, dependencies, deployment, or configuration.
10. STOP after the Gate-1 report.

One problem only: determine the exact technical contract and implementation shape for **authorized Hosted Update**.

---

# Phase 7 plan entry

Read the current entry in:

```text
docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md
```

The intended Phase 7 responsibility is:

```text
Phase 7 – Hosted Update API

Objective:
Implement authorized Update: atomically replace a Publication's active
state with newly processed content while preserving its public link.

Prerequisite:
Phase 6.

Analysis:
Confirm the exact transaction boundary for switching
active_asset_version and Publication state atomically against the actual
Drizzle/MySQL setup.

Scope Approval:
Report the exact new route/module, exact authorization check, and exact
prepare → validate → store → activate sequence as it maps to Phases 4/5.

Implementation:
Prepare a complete new version under a new asset-version key; process it;
verify readiness; atomically switch active_asset_version and Publication
row. On failure before activation, leave the previous version fully active
and make the new version merely an eventual cleanup candidate.

Non-goals:
Cleanup execution itself (Phase 10) and rate limiting (Phase 11).

Gate-4 verification:
- successful update preserves public link;
- old-version content is superseded;
- simulated processing failure leaves previous Publication fully intact;
- invalid/mismatched management token modifies nothing.

Completion:
A tested, atomic Update operation exists.
```

Treat the actual current plan file as authoritative if wording differs.

---

# Required sources of truth

Read the relevant current sections of:

```text
docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md
docs/ARCHITECTURE.md
docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md
docs/FEATURE_SPECIFICATION.md
docs/DATA_AND_PRIVACY.md
docs/USER_WORKFLOW.md
docs/APPLICATION_LAYOUT.md
```

At minimum inspect:

- `ARCHITECTURE.md`
  - Hosted Comparison Architecture
  - Data Model
  - Asset Storage
  - Publication Update Atomicity
  - Cleanup and Orphan Handling
  - Identifiers / management capability
  - failure/security behavior relevant to Update

- Revision 4
  - Hosted API product operations → Update
  - management capability
  - Hosted update atomicity
  - cleanup/orphan handling
  - image processing/privacy rules

- `FEATURE_SPECIFICATION.md`
  - F-006
  - Hosted Presentation
  - Update online
  - Accountless management

- `DATA_AND_PRIVACY.md`
  - Management Credential Privacy
  - Hosted Client-Side Privacy Preprocessing
  - Image Processing
  - Temporary Processing Data

- `USER_WORKFLOW.md`
  - Update Online
  - Existing Hosted Publication

Do not reopen already-approved product decisions merely because a different design is possible.

---

# Current implementation to inspect

Inspect the current Phase 3–6 implementation that Phase 7 must build on:

```text
hosted/src/db/schema.ts
hosted/src/db/client.ts
hosted/src/lib/asset-storage.ts
hosted/src/lib/temp-storage.ts
hosted/src/lib/image-processing.ts
hosted/src/lib/branding-processing.ts
hosted/src/lib/hosted-identifiers.ts
hosted/src/lib/publish.ts
hosted/src/pages/api/comparisons.ts
hosted/test/publish.test.mjs
hosted/test/comparisons-route.test.mjs
hosted/test/hosted-identifiers.test.mjs
hosted/package.json
hosted/astro.config.mjs
```

Also inspect the generated Hosted migrations only as needed to prove the current table shape:

```text
hosted/drizzle/**
```

Do not inspect WordPress/Joomla/Android implementation unless a concrete unresolved Phase-7 question genuinely requires it.

Phase 6 established patterns that should be reused where appropriate rather than reimplemented differently without evidence, including:

- Hosted Presentation request parsing/validation;
- Phase-5 image processing;
- Phase-4 immutable/versioned Asset Storage;
- management-token SHA-256 hashing helper;
- DB pool/test teardown;
- real local MySQL integration-test pattern;
- multipart Astro API route pattern.

Determine from the current code exactly what can be reused and what must be new.

---

# Pre-flight repository check

Before analysis, report:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected high-level state:

- branch `main`;
- Phase 6 already committed/pushed;
- working tree should be clean.

If it is not clean, do not alter or clean anything. Report the actual state and determine whether safe read-only analysis is still possible.

Also confirm the Phase 6 plan status currently reads `Completed`.

---

# Questions Gate 1 must resolve

## 1. Update identity and authorization

Determine the exact lookup/authorization inputs.

The approved model says:

- `public_id` is public identity, not authority;
- `comparison_id` is not authority;
- only possession of the management token grants Update authority;
- DB stores only `management_token_hash`;
- plaintext token must never be logged or persisted.

Establish from specs and Phase-6 implementation:

- whether Update should target `publicId`, `comparisonId`, or another existing identifier alongside the management token;
- how the incoming token is hashed;
- how authorization is checked;
- whether the SQL operation itself should be guarded by the token hash rather than doing an unsafe read-then-unconditional-update;
- what “constant-time hash comparison” from the Phase-7 plan should mean with the actual DB/hash design.

Do not silently assume an application-side `timingSafeEqual()` is required if the correct atomic SQL predicate makes that wording inapplicable. Conversely, do not discard the requirement without explaining how the actual design satisfies the security intent.

Explicitly analyze race behavior if the management token is valid/invalid or if the Publication disappears concurrently.

---

## 2. Request contract

Determine whether Update should reuse the complete Phase-6 Hosted Presentation payload and multipart asset contract.

The approved behavior says Update publishes the **complete new Hosted state**, not a patch.

Confirm exactly:

- required structured fields;
- required `reference` and `capture` files;
- optional custom-branding file;
- `showDate`;
- title/description/location visibility representation;
- branding representation;
- background/corner style;
- management authority field;
- target-publication identifier.

Do not introduce PATCH-like partial semantics unless a source explicitly requires them.

Determine the natural HTTP method/path based on the actual Phase-6 route and Phase-12 deferral. Treat route naming as an implementation decision for Phase 7, not as an excuse to redesign Phase 6.

---

## 3. Atomic update boundary

This is the central Gate-1 task.

Prove the smallest correct DB operation that guarantees:

- old Publication remains active until the complete new version is ready;
- successful activation switches all persisted presentation/content fields and `active_asset_version` together;
- `public_id` remains unchanged;
- `management_token_hash` remains unchanged;
- `comparison_id` remains unchanged;
- `id` remains unchanged;
- `created_at` remains unchanged;
- `updated_at` updates normally;
- no reader can observe a row pointing partly to old state and partly to new state.

Determine whether one guarded SQL `UPDATE` statement is sufficient or whether a DB transaction is genuinely required.

Do not introduce a transaction merely because “atomic update” sounds like it needs one. A single SQL `UPDATE` is itself atomic; verify whether all activation-state changes fit into that one statement.

Also determine whether the current `status` column has any role in Phase 7 or should simply remain `active`. Do not invent a staging state if versioned filesystem assets already provide staging outside the live row.

---

## 4. Prepare → validate → store → activate mapping

Map the approved lifecycle precisely onto current modules:

1. parse/validate request;
2. process all incoming assets through Phase 5;
3. generate a fresh asset version;
4. store complete processed version under the existing internal publication ID;
5. verify readiness;
6. atomically activate by updating the existing row;
7. return success while preserving public identity.

Important: determine when the internal publication ID becomes known.

If authorization requires first locating the row, analyze how to do that without creating a race that can activate unauthorized content.

Clarify whether assets may be written before final authorization or whether authorization must be established before storage. Security and unnecessary orphan generation matter here.

---

## 5. Failure behavior

For every meaningful failure point, state exactly what remains unchanged.

At minimum:

- malformed payload;
- missing required file;
- invalid core image;
- invalid custom branding;
- unknown publication;
- invalid management token;
- asset write failure after one or more files were written;
- DB update failure;
- concurrent deletion;
- concurrent Update requests using the same valid management token.

The required invariant is:

```text
Until activation succeeds, the previously active Publication remains fully intact.
```

New unreferenced asset versions may become Phase-10 cleanup candidates; Phase 7 must not synchronously delete them unless the approved architecture explicitly requires that.

---

## 6. Concurrent authorized Updates

Analyze this explicitly.

Two valid Update requests may race for the same Publication.

Determine what the approved architecture and current schema imply:

- is “last successful atomic activation wins” acceptable;
- is optimistic locking/version matching required;
- is a transaction/row lock required;
- can either race create a partially active state;
- what happens to the losing/superseded new asset version.

Do not invent revision numbers, ETags, row-version columns, or locks without evidence.

---

## 7. Management-token comparison and information disclosure

Confirm the neutral failure semantics for:

- unknown `public_id`;
- known `public_id` + wrong management token.

The response must not unnecessarily reveal whether a Publication exists or who manages it.

Determine whether both should map to the same service result / HTTP response.

Also confirm:
- no plaintext token logging;
- no token returned on Update success;
- no replacement token minted;
- public URL/public ID remains stable.

---

## 8. Asset-version behavior

Determine whether Phase 6's asset-version generator can/should be reused.

Confirm:

- every Update creates a fresh immutable version;
- assets are never overwritten in the currently active version;
- custom branding presence/absence is represented correctly;
- switching from custom branding to built-in/no-branding does not require writing `branding.webp`;
- old version is not removed in Phase 7;
- newly written but never activated version is a Phase-10 cleanup candidate.

Identify whether Phase 4's current `AssetStorage` API is sufficient without modification.

---

## 9. Database schema adequacy

Verify the current schema, including the `show_date` correction, can represent the entire new state atomically.

Explicitly list the columns Update should modify and the columns it must preserve.

Determine whether any schema/migration change is genuinely required.

Expected answer should be **no schema change** unless proven otherwise.

If the current schema cannot satisfy Phase 7 without a migration, STOP and report the exact gap rather than inventing a migration during Gate 1.

---

## 10. Module/file design

Determine the smallest implementation shape.

Likely candidates may include:

```text
hosted/src/lib/update.ts
hosted/src/pages/api/comparisons/[publicId].ts
hosted/test/update.test.mjs
hosted/test/comparisons-update-route.test.mjs
```

These names are **not pre-approved**. Inspect Astro routing conventions and the existing Phase-6 route first.

Decide whether:
- Update orchestration belongs in one new `update.ts`;
- request parsing can reuse/extract Phase-6 code without refactoring Phase 6 unnecessarily;
- a shared payload validator is actually justified now or whether small duplication is safer;
- the route should be dynamic by `publicId`;
- any existing Phase-6 file must be modified.

Avoid speculative abstraction. Do not refactor Publish merely to make Update aesthetically symmetrical.

If reuse genuinely requires changing an existing Phase-6 module, identify that explicitly for Gate 2.

---

## 11. Dependency/configuration impact

Determine whether Phase 7 needs any change to:

```text
hosted/package.json
hosted/pnpm-lock.yaml
hosted/pnpm-workspace.yaml
hosted/astro.config.mjs
hosted/tsconfig.json
hosted/app.js
```

Expected result: none.

Use existing:
- Node crypto/helper;
- Fetch/FormData APIs;
- Drizzle/MySQL;
- Phase-4 storage;
- Phase-5 processing.

No dependency addition without proven necessity.

---

## 12. Exact Gate-4 test strategy

Define the minimum test matrix needed to prove Phase 7.

At minimum cover:

### Successful authorized Update
- existing row/public ID preserved;
- internal ID preserved;
- comparison ID preserved;
- management-token hash preserved;
- plaintext token not persisted or returned;
- complete Presentation state replaced;
- `showDate=true/false` correctly replace prior value;
- new `active_asset_version` differs from old;
- new reference/capture assets exist under new version;
- custom branding behavior correct;
- old asset version remains physically present for later cleanup;
- updated row points only to complete new version.

### Failed processing
- simulate invalid core/custom-branding input;
- previous DB row unchanged;
- previous `active_asset_version` unchanged;
- previous assets untouched;
- no new permanent asset version if failure occurs before storage.

### Authorization
- wrong management token changes nothing;
- unknown target and wrong token are externally neutral/indistinguishable where required;
- no management token leakage.

### Asset/storage failure
- partial new version may exist as cleanup candidate;
- live DB row remains unchanged.

### Concurrency
- two authorized concurrent Updates never create partial mixed state;
- establish and test the intended race result from §6.

### Route
- valid multipart Update maps to success;
- malformed payload/missing file → validation response;
- unauthorized/unknown target → same neutral response;
- unexpected internal failure → internal error;
- no secret echoed.

Determine which tests need real MySQL and which can use disposable filesystem directories.

Reuse the Phase-6 DB cleanup discipline:
- inspect baseline row count;
- use unique synthetic IDs;
- delete only rows created by tests;
- do not alter migration metadata;
- inspect/remove only test-attributable runtime assets.

---

# Explicit exclusions

Phase 7 Gate 1 must not design or implement:

- Delete API (Phase 8);
- Resolve/View API (Phase 9);
- cleanup execution/scheduler (Phase 10);
- rate limiting (Phase 11);
- frozen cross-repository API contract (Phase 12);
- Android network integration;
- Android registry/UI;
- browser management session/cookie;
- Public Viewer;
- reporting;
- QR;
- S3/object storage;
- production DB provisioning/migration;
- deployment changes;
- documentation status changes;
- unrelated refactoring.

Do not mark Phase 7 Completed.

---

# Required Gate-1 report

Return exactly this structure:

# Phase 7 Gate 1 — Analysis Report

## 1. Repository / prerequisite state

Include branch, HEAD, working-tree state, Phase-6 status, and relevant implemented Phase-6 files.

## 2. Source-of-truth findings

Summarize only the Phase-7-relevant approved behavior and identify any conflict/gap.

## 3. Update target and authorization contract

State the exact target identifier, management-token handling, DB lookup/guard strategy, and neutral unauthorized/not-found behavior.

## 4. Complete Update request contract

State the complete payload/assets expected and whether it reuses Phase 6's contract.

## 5. Atomic DB activation boundary

State exactly whether one SQL UPDATE is sufficient or a transaction is required, with evidence from the current schema/Drizzle setup.

## 6. Prepare → validate → store → activate sequence

Give the exact proposed sequence mapped to current modules.

## 7. Failure behavior

Cover every failure point listed above and the old-version invariant.

## 8. Concurrent Update behavior

State the proven/intended race semantics and whether locking/versioning is required.

## 9. Asset-version lifecycle

State fresh-version behavior, branding behavior, old-version retention, and Phase-10 cleanup-candidate handling.

## 10. Database schema adequacy

List columns to update vs preserve and state whether any migration is required.

## 11. Route / module design

State the smallest likely route/module/test-file shape, but do not implement.

## 12. Dependency/configuration impact

State exact expected impact.

## 13. Exact Gate-4 verification matrix

List the focused tests required.

## 14. Likely Gate-2 file scope

List each likely New/Modified file and why. Do not use vague placeholders.

## 15. Risks / unresolved decisions

Distinguish:
- implementation details Phase 7 is allowed to resolve;
- genuine product/spec blockers that require user input.

Do not manufacture a blocker.

## 16. Documentation impact

State what, if anything, would require synchronization after Gate 4. Do not edit it now.

## 17. Gate result

End with exactly one:

```text
Phase 7 is ready for Gate 2 scope approval.
```

or:

```text
Phase 7 is blocked before Gate 2.
```

If blocked, identify the smallest exact unresolved decision and supporting source conflict.

Finally state:

- No files changed.
- No implementation performed.
- No database rows changed.
- No runtime asset data written.
- No migration generated/applied.
- No deployment performed.
- No commit or push performed.

STOP after Gate 1.
