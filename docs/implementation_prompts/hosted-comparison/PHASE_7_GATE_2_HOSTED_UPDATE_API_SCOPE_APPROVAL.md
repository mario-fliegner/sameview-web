# Phase 7 Gate 2 --- Hosted Update API Scope Approval

## Context

Phase 6 --- Hosted Publish API is completed, accepted, committed, and
pushed.

Phase 7 Gate 1 analysis is complete. Its analysis report established
that Phase 7 can be implemented without schema, migration, dependency,
deployment, or product-spec changes.

Repository baseline reported by Gate 1:

-   Branch: `main`
-   HEAD: `10d7dcbd017a2ccf76546a99188877ffdba4026e`
-   Working tree: clean
-   Phase 6: `Completed`
-   Phase 7: `Planned`

Before doing anything else, verify the current repository state
yourself. If HEAD or working-tree state differs materially from this
baseline, STOP and report the discrepancy.

## Task

Perform **Phase 7 Gate 2 --- Scope Approval only** for the Hosted Update
API.

Do **not** implement anything yet.

Your job is to turn the accepted Gate-1 findings into one exact, minimal
implementation scope for Gate 3.

Follow the repository's AI implementation workflow strictly:

1.  inspect only the relevant source-of-truth documents and current
    Phase-6 implementation;
2.  confirm the Gate-1 conclusions against the actual repository;
3.  resolve the remaining implementation-level choices listed below;
4.  define exact files, exact changes, risks, and tests;
5.  STOP and wait for approval.

No code changes, no generated files, no database writes, no runtime
asset writes, no documentation changes, no commit, no push, no deploy.

## Source of truth

Consult only what is relevant, especially:

-   `docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md`
-   `docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md`
-   `docs/ARCHITECTURE.md`
-   `docs/FEATURE_SPECIFICATION.md`
-   `docs/USER_WORKFLOW.md`
-   `docs/DATA_AND_PRIVACY.md`
-   accepted Phase-6 implementation:
    -   `hosted/src/lib/publish.ts`
    -   `hosted/src/lib/hosted-identifiers.ts`
    -   `hosted/src/pages/api/comparisons.ts`
    -   `hosted/src/db/schema.ts`
    -   `hosted/src/db/client.ts`
    -   `hosted/src/lib/asset-storage.ts`
    -   `hosted/src/lib/image-processing.ts`
    -   `hosted/src/lib/branding-processing.ts`
    -   relevant Phase-6 tests

Do not broaden scope into Phase 8+.

## Gate-1 conclusions to verify and preserve unless repository evidence disproves them

Phase 7 Update is a **complete Hosted snapshot replacement**, not PATCH
semantics.

Expected behavior:

-   target is the existing `public_id`;
-   plaintext `management_token` is supplied in the request body, never
    in URL/query parameters;
-   valid management authority is required;
-   unknown `public_id` and wrong `management_token` must remain
    neutral/indistinguishable externally;
-   Update never creates or returns a replacement management token;
-   `public_id`, internal `id`, `comparison_id`,
    `management_token_hash`, and `created_at` remain unchanged;
-   Update replaces the Hosted presentation/content state;
-   a fresh immutable `assetVersion` is created for every successful
    preparation attempt;
-   new processed assets are stored under the existing internal
    publication ID and fresh asset version;
-   the old active version remains intact;
-   activation happens only after validation, processing, and storage
    have succeeded;
-   activation switches the row atomically to the complete new state and
    new `active_asset_version`;
-   no synchronous deletion of old or failed/unreferenced asset versions
    in Phase 7;
-   cleanup remains Phase 10;
-   no schema/migration change is required;
-   concurrent authorized Updates may use
    last-successful-activation-wins semantics, provided no mixed/partial
    state is possible.

## Decisions Gate 2 must make

### 1. Route and method

Evaluate and either approve or reject:

`PUT /api/comparisons/{publicId}`

Expected Astro implementation location:

`hosted/src/pages/api/comparisons/[publicId].ts`

The route is provisional until Phase 12, just as the Publish route was,
but Gate 3 needs one concrete route.

Define the exact success and failure HTTP mappings for this phase.

The unauthorized/wrong-token and unknown-public-ID cases must use the
**same status and same response shape**.

Do not expose whether the Publication exists.

### 2. Update request contract

Define the exact multipart contract.

Expected shape:

-   route parameter: `publicId`
-   body field: `managementToken`
-   structured Hosted Presentation payload equivalent to Publish, except
    no `comparisonId`
-   required binary files:
    -   `reference`
    -   `capture`
-   optional `branding`, required only when the presentation uses custom
    branding

Explicitly list the required/optional structured fields and confirm how
`showDate`, nullable content fields, branding consistency, and binary
consistency are validated.

Do not invent partial-update semantics.

### 3. Shared validation vs duplication

Gate 1 identified a real tradeoff: Publish currently owns substantial
private payload/binary validation logic that Update would need almost
identically.

Resolve this conservatively under the project rules.

Default preference for Gate 2:

**Do not refactor the already-accepted Phase-6 Publish implementation
merely for symmetry unless direct inspection proves that avoiding a
shared validator would create a concrete correctness problem in Phase
7.**

A little duplication is acceptable if it keeps Phase 7 isolated,
reversible, and prevents regression risk to accepted Phase 6.

If you nevertheless conclude extraction is necessary, you must prove
why, identify the exact Phase-6 behavior at risk, and include every
affected Phase-6 file/test in the proposed Gate-3 scope. Do not silently
refactor.

### 4. Authorization strategy

Gate 1 recommended:

1.  cheap early authorization/existence lookup using both `public_id`
    and `management_token_hash`;
2.  only after authorization succeeds: process/store assets;
3.  final activation still uses a guarded
    `UPDATE ... WHERE public_id = ? AND management_token_hash = ?`.

Evaluate this exact two-gate design.

The final guarded UPDATE must remain authoritative so
deletion/credential-state races cannot activate content incorrectly.

Confirm whether the early lookup is worth keeping specifically to
prevent unauthenticated callers from forcing image processing and
permanent filesystem writes.

Do not weaken neutral external failure behavior.

### 5. Token hashing/comparison

Confirm Update hashes the supplied plaintext token with the
already-approved Phase-6 SHA-256 helper and compares only the hash.

Do not store plaintext.

Do not return plaintext.

Do not log plaintext.

Do not invent a new credential format or KDF.

If using a DB predicate on `management_token_hash`, explain why no
JS-side `timingSafeEqual()` is required.

### 6. Atomic activation

Define the exact DB mutation.

Gate 1 proposes one guarded Drizzle/MySQL UPDATE statement that sets all
mutable Hosted content/presentation columns plus `active_asset_version`
in one atomic statement.

Confirm the exact set of columns that change and the exact
identity/security columns that must never change.

Do not introduce a staging DB status/state unless the approved
specifications actually require one.

Do not add an explicit multi-statement transaction unless there is a
demonstrated need beyond the atomic single-row UPDATE.

### 7. Failure semantics

Define behavior for at least:

-   malformed multipart/body;
-   malformed structured payload;
-   missing required core asset;
-   unexpected/forbidden branding binary;
-   invalid core image;
-   invalid branding image;
-   unknown `publicId`;
-   wrong `managementToken`;
-   filesystem write failure before all assets are stored;
-   final guarded UPDATE affects zero rows;
-   unexpected DB failure.

For each, state whether: - live DB row changes; - old active version
remains available; - new unreferenced assets can remain for Phase-10
cleanup; - HTTP/result classification is neutral where required.

### 8. Concurrency

Confirm the intended semantics for two concurrent Updates with the same
valid management token.

Do not invent ETags, optimistic version numbers, locks, or new schema
unless required by an existing approved specification.

The required invariant is that the active row is always one coherent
complete snapshot and never a mixture.

### 9. Exact Gate-3 file scope

Prefer the smallest implementation footprint.

Expected new files, if confirmed:

-   `hosted/src/lib/update.ts`
-   `hosted/src/pages/api/comparisons/[publicId].ts`
-   `hosted/test/update.test.mjs`
-   `hosted/test/comparisons-update-route.test.mjs`

Explicitly state whether **any existing file** must be modified.

Unless Gate 2 proves otherwise, these must remain untouched:

-   `hosted/src/lib/publish.ts`
-   `hosted/src/lib/hosted-identifiers.ts`
-   `hosted/src/pages/api/comparisons.ts`
-   existing Phase-6 tests
-   `hosted/src/db/schema.ts`
-   `hosted/src/db/client.ts`
-   `hosted/drizzle/**`
-   `hosted/package.json`
-   `hosted/pnpm-lock.yaml`
-   configuration files
-   docs

### 10. Test plan

Define the exact relevant Gate-3/Gate-4 verification matrix.

At minimum cover:

-   successful authorized complete Update;
-   stable `public_id`;
-   stable internal `id`;
-   stable `comparison_id`;
-   unchanged `management_token_hash`;
-   unchanged `created_at`;
-   no new/replacement plaintext management token;
-   all mutable presentation/content fields replaced;
-   `showDate=true` and `showDate=false`;
-   fresh `active_asset_version`;
-   new WebP assets stored under the existing internal publication ID;
-   old asset version remains present;
-   custom branding success;
-   transition away from custom branding produces a new version without
    `branding.webp`;
-   malformed payload;
-   missing required file;
-   invalid core image;
-   invalid custom branding;
-   wrong token;
-   unknown public ID;
-   identical external result for wrong token vs unknown public ID;
-   no processing/storage for requests rejected by the early
    authorization gate, if that design is approved;
-   partial AssetStorage failure leaves the live row unchanged;
-   final guarded UPDATE zero-row race/failure leaves the live row
    unchanged;
-   concurrent authorized Updates yield a coherent final snapshot;
-   route-level success/validation/neutral-auth/internal-error mapping;
-   test DB row cleanup;
-   DB pool teardown via the existing accepted `closeDb()` mechanism;
-   cleanup only of provably test-attributable runtime asset
    directories;
-   migration metadata unchanged.

Also specify the relevant commands to run. Keep them scoped. At minimum
consider:

-   isolated new Update orchestration test;
-   isolated new Update route test;
-   full Hosted test suite;
-   Hosted typecheck;
-   Hosted build;
-   root typecheck only if the same broad-root-tsconfig interaction
    still exists.

Do not add unrelated root build/lint/test runs without a concrete
reason.

## Required Gate-2 report format

Return a concise but complete report with these sections:

1.  Repository state
2.  Gate-1 findings reconfirmed / corrections
3.  Exact Update HTTP contract
4.  Exact authorization contract
5.  Exact atomic activation contract
6.  Shared-validation decision
7.  Exact approved files
8.  Exact changes per file
9.  Explicit exclusions
10. Test/verification plan
11. Risks / remaining unresolved items
12. Gate result

The final Gate result must be one of:

`Phase 7 Gate 2 scope is ready for user approval.`

or, if a real blocker remains:

`Phase 7 Gate 2 is blocked.`

If blocked, state the exact evidence-backed blocker.

## Critical constraints

-   Analysis/scope only.
-   No implementation.
-   No file edits.
-   No DB writes.
-   No runtime asset writes.
-   No migration generation/application.
-   No dependency changes.
-   No docs changes.
-   No commit.
-   No push.
-   No deploy.
-   Do not mark Phase 7 Completed.
-   Do not begin Phase 8.
-   Do not expand scope.
-   STOP after Gate 2.
