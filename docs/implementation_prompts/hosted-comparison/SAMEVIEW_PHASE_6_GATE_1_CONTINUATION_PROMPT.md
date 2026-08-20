# SameView Hosted Comparison --- Phase 6 Continuation

## Resume Phase 6 Gate 1 after resolved persistence blocker

We are continuing the existing SameView Hosted Comparison implementation
workflow.

IMPORTANT: This is NOT a fresh Phase-6 analysis.

Phase 6 Gate 1 was already substantially completed. During that
analysis, one real persistence gap was discovered: Hosted Presentation
supports Date visibility independently, but the Hosted schema had no
persisted representation for that state.

That blocker has now been fully resolved, accepted, committed, and
pushed.

## Current resolved state

The Hosted persistence schema now contains:

``` ts
showDate: boolean("show_date").notNull().default(true),
```

An incremental Drizzle migration was generated and verified:

`hosted/drizzle/0001_known_zombie.sql`

It adds only:

``` sql
ALTER TABLE `comparisons` ADD `show_date` boolean DEFAULT true NOT NULL;
```

The migration was verified against: - the existing local
`sameview_hosted` MySQL 8.0.46 database with migration 0000 already
applied; - a fresh disposable database applying 0000 → 0001 from zero.

Both paths succeeded.

Database semantics were directly verified as:

`show_date = tinyint(1) NOT NULL DEFAULT 1`

A synthetic insert omitting `show_date` confirmed the database default
produces `1`.

Phase 3 is now documented as `Completed`.

This correction has been committed and pushed.

## Your task

Resume Phase 6 Gate 1 from the prior analysis.

Do NOT repeat the entire Phase-6 investigation from scratch.

First inspect the current repository state and the relevant sources of
truth to confirm the committed Date-visibility correction is present.

Then re-read the prior Phase-6 analysis conclusions against the
now-corrected schema.

The purpose of this continuation is:

1.  confirm that the `show_date` persistence blocker is actually
    resolved;
2.  identify whether ANY other genuine blocker or unresolved
    specification issue remains for Phase 6;
3.  resolve implementation-level questions where the approved
    specifications already provide enough evidence;
4.  distinguish real product decisions from ordinary implementation
    choices;
5.  if no genuine blocker remains, produce the final Phase-6 Gate-1
    addendum needed to proceed to Gate 2.

Do not implement anything.

------------------------------------------------------------------------

# Previously established Phase-6 Gate-1 findings

Treat these as prior analysis to VERIFY against current sources, not as
questions that automatically need reopening.

## Prerequisites

Phases 3--5 are implemented:

### Phase 3

Hosted `comparisons` persistence schema and Drizzle migrations.

Important current state includes the new:

`show_date`

column described above.

### Phase 4

Filesystem-backed provider-neutral:

-   `AssetStorage`
-   `TempStorage`

Versioned permanent asset layout.

### Phase 5

Server-side image validation/processing:

Core images: - canonical publication inputs are JPEG - defensive server
validation - metadata stripping - orientation handling - bounded
resize - fresh WebP encoding

Branding: - canonical publication input is PNG - client already
normalizes branding to 512×512 RGBA PNG - server nevertheless
independently validates/processes it - output is WebP

Do not reopen the JPEG/PNG publication-input discussion unless the
current committed specification contradicts this.

## Atomic uniqueness

Previously established:

`comparison_id` has a database-level UNIQUE constraint.

Publish must rely on the atomic INSERT/constraint result rather than a
check-then-insert race.

Conceptual flow established previously:

1.  validate/process input;
2.  create publication/internal identity and asset version;
3.  persist processed versioned assets;
4.  generate public ID + management token;
5.  hash management token;
6.  attempt the DB INSERT with `active_asset_version` already pointing
    to the stored version;
7.  let UNIQUE(comparison_id) arbitrate concurrent Publish requests.

If `comparison_id` conflicts: - Publish does not create a second
Publication.

If generated `public_id` or `management_token_hash` collides: -
collision may be retried with newly generated credentials using a
bounded retry mechanism.

Asset files written before a failed DB insert may temporarily become
orphaned. Actual cleanup/removal is NOT Phase 6 behavior if the
implementation plan delegates cleanup execution to Phase 10.

Verify this against the current plan/specification before accepting it.

## Publish and management authority

Previously identified:

The approved Publish input does NOT contain a management token.

Therefore Publish cannot establish management authority over an existing
Publication.

Management authority belongs to later Update/Delete behavior.

Verify this against the current approved product decisions.

Do not invent an authority mechanism inside Publish merely because an
existing `comparison_id` may be encountered.

## TempStorage

Previously identified:

Phase-5 processing accepts in-memory Buffer input and does not require
TempStorage.

Therefore TempStorage may not be required in the Phase-6 Publish path at
all.

Verify whether any approved source explicitly requires raw Publish
uploads to be persisted temporarily.

If not, prefer the simplest implementation and do not introduce
TempStorage orchestration merely because the abstraction exists.

## Date visibility

Previously unresolved.

Now resolved by:

`show_date boolean NOT NULL DEFAULT true`

The Publish payload must therefore be capable of persisting the approved
Date visibility state independently from the required derived
`reference_label` / `capture_label`.

Verify that this closes the issue.

------------------------------------------------------------------------

# Areas that still require final Gate-1 resolution

Inspect the approved sources and current code before deciding these.

## 1. Exact Publish payload

Determine the smallest complete request contract required by the
approved product behavior.

This includes at least consideration of:

-   `comparisonId`
-   Hosted Presentation fields
-   Date visibility
-   required reference image
-   required capture image
-   optional branding asset where applicable

Determine exact required/optional fields from the approved sources.

Do not add speculative metadata.

## 2. reference_label / capture_label ownership

The schema requires both labels.

Determine from the approved Android/Web behavior and specifications
whether:

A. the publishing client sends the final derived display labels;

or

B. Hosted receives raw date values and derives them server-side.

Do not choose based on preference.

Use repository/spec evidence.

If the evidence genuinely does not resolve this, identify it as a
product decision rather than silently guessing.

## 3. Hosted Presentation persistence semantics

Now that `show_date` exists, verify how the approved visibility states
map to persistence for:

-   title
-   description
-   date
-   location
-   branding
-   background
-   corner style

Do not invent new visibility columns unless the approved semantics
actually require them.

## 4. Identifier generation

Resolve implementation details from the approved Identifier Formats:

-   `public_id`: 12 characters / approximately 72 bits
-   management token: approximately 43 characters / approximately 256
    bits
-   plaintext management token returned once
-   only hash persisted

Determine an implementation that produces these properties using Node's
existing crypto facilities.

Do not introduce a dependency if unnecessary.

Also determine: - exact alphabet/encoding if already specified; -
SHA-256 hash representation consistent with `varchar(64)`.

If the approved sources intentionally leave the alphabet open, treat
choosing a safe implementation as an implementation-level decision
rather than escalating it unnecessarily.

## 5. Asset version generation

`active_asset_version` is `varchar(36)`.

Determine the simplest safe generation mechanism consistent with Phase
4's storage abstraction and the approved architecture.

Do not reopen the already-approved column type.

## 6. Database duplicate-error discrimination

This was explicitly left as a concrete verification gap in the earlier
Gate-1 analysis.

Determine how the current `mysql2`/Drizzle stack exposes duplicate-key
errors for:

-   comparison_id
-   public_id
-   management_token_hash

Do not rely on an assumed `sqlMessage` shape if it can be verified
locally against the existing MySQL 8.0.46 database.

A narrow read/test against the local development DB is allowed during
analysis if necessary, but:

-   do not change repository files;
-   do not leave synthetic rows behind;
-   do not modify production;
-   report exactly what was observed.

The goal is to establish a robust implementation strategy for
distinguishing: - existing Comparison Publication; - generated public-ID
collision; - generated management-token collision.

If parsing constraint names from driver errors is brittle and a better
proven mechanism exists in the actual driver error object, use the
evidence.

## 7. HTTP route and multipart shape

The implementation plan says final API path/method details are finalized
together with Phase 12.

Do not accidentally make a Phase-12 product decision prematurely.

For Phase 6, determine only what is necessary to implement and test
Publish now.

If a concrete route path is required by Astro, propose the smallest
conventional internal contract and explicitly note whether it is
provisional pending Phase 12.

Determine whether standard `Request.formData()` is sufficient for the
required multipart payload.

Do not add a multipart dependency without evidence it is needed.

## 8. Response semantics

Determine what Publish must return on successful creation from the
approved product decisions.

At minimum inspect whether the response needs:

-   `public_id`
-   public URL
-   management token
-   management URL

Do not invent additional response fields.

Also determine the neutral response/error semantics when the Comparison
is already published and Publish has no management authority.

Do not finalize broad HTTP status conventions that belong to Phase 12
unless Phase 6 genuinely requires a minimal choice for
implementation/tests.

## 9. Atomicity / failure behavior

Analyze the complete failure sequence:

-   validation failure
-   processing failure
-   partial asset write
-   DB insert failure
-   generated-ID collision
-   existing comparison_id
-   unexpected DB error

Determine what Phase 6 itself must clean up immediately versus what
Phase 10's orphan cleanup owns.

Do not silently expand Phase 6 into Phase 10.

## 10. Tests

Determine the minimum relevant Phase-6 tests.

They should prove the actual Phase-6 completion criteria, especially:

-   first Publish creates one Publication;
-   concurrent Publish attempts for the same `comparison_id` cannot
    create two active Publications;
-   generated identifier collision handling behaves correctly;
-   plaintext management token is never persisted;
-   stored hash corresponds to returned token;
-   active asset version points at the written assets;
-   processed assets are stored under the expected versioned keys;
-   Date visibility is persisted correctly;
-   invalid image input is rejected through the existing Phase-5
    pipeline;
-   existing Publication without authority does not create another
    Publication.

Do not drag Phase-7+ behavior into these tests.

------------------------------------------------------------------------

# Sources of truth

Consult the relevant current files in `docs/`, especially:

-   `docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md`
-   `docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md`
-   `docs/ARCHITECTURE.md`
-   `docs/DATA_AND_PRIVACY.md`
-   `docs/FEATURE_SPECIFICATION.md`
-   `docs/APPLICATION_LAYOUT.md`
-   `docs/USER_WORKFLOW.md`

Also inspect only relevant current Hosted implementation files:

-   `hosted/src/db/schema.ts`
-   `hosted/src/db/client.ts`
-   `hosted/src/lib/asset-storage.ts`
-   `hosted/src/lib/temp-storage.ts`
-   `hosted/src/lib/image-processing.ts`
-   `hosted/src/lib/branding-processing.ts`
-   `hosted/astro.config.mjs`
-   `hosted/package.json`
-   existing Hosted tests where relevant

Do not inspect unrelated CMS/WordPress/Joomla code unless a specific
unresolved question actually requires it.

------------------------------------------------------------------------

# Workflow

This is still Gate 1.

NO CODE.

NO repository modification.

NO migration generation.

NO documentation changes.

NO Phase-6 implementation.

NO commit/push/deploy.

If you find a genuine unresolved product decision: STOP and report it
precisely with the conflicting/missing source evidence.

Do not manufacture a decision merely to continue.

If no genuine blocker remains: produce the final Gate-1 addendum with a
concrete recommendation for Gate 2.

# Required report

## Phase 6 Gate 1 Continuation --- Post-Persistence-Correction Analysis

### 1. Repository / prerequisite state

### 2. Date-visibility blocker resolution

### 3. Final Publish request contract

### 4. Label derivation ownership

### 5. Hosted Presentation persistence mapping

### 6. Identifier generation

### 7. Asset-version generation

### 8. Duplicate-key discrimination

### 9. TempStorage decision

### 10. Route / multipart contract

### 11. Success and existing-publication response semantics

### 12. Atomicity and failure behavior

### 13. Minimum Phase-6 test matrix

### 14. Exact likely Gate-2 file scope

### 15. Remaining unresolved decisions / blockers

### 16. Gate result

End with either:

`Phase 6 is ready for Gate 2 scope approval.`

or:

`Phase 6 is blocked before Gate 2.`

If blocked, state exactly what user/product decision is required.

Finally report:

-   No files changed.
-   No implementation performed.
-   No database residue left by analysis.
-   No deployment performed.
-   No commit or push performed.

STOP after Gate 1 continuation.
