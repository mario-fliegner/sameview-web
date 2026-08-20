# Phase 7 Gate 3 --- Hosted Update API Implementation

## Context

Phase 7 Gate 1 analysis and Gate 2 scope approval are complete.

Gate 2 approved a deliberately isolated implementation:

### New files only

-   `hosted/src/lib/update.ts`
-   `hosted/src/pages/api/comparisons/[publicId].ts`
-   `hosted/test/update.test.mjs`
-   `hosted/test/comparisons-update-route.test.mjs`

### Existing files must remain untouched

In particular:

-   `hosted/src/lib/publish.ts`
-   `hosted/src/lib/hosted-identifiers.ts`
-   `hosted/src/pages/api/comparisons.ts`
-   all existing Phase-6 tests
-   `hosted/src/db/schema.ts`
-   `hosted/src/db/client.ts`
-   `hosted/src/lib/asset-storage.ts`
-   `hosted/src/lib/image-processing.ts`
-   `hosted/src/lib/branding-processing.ts`
-   `hosted/drizzle/**`
-   `hosted/package.json`
-   `hosted/pnpm-lock.yaml`
-   `hosted/pnpm-workspace.yaml`
-   `hosted/astro.config.mjs`
-   `hosted/tsconfig.json`
-   `hosted/app.js`
-   all `docs/**`

Do not refactor Phase 6.

Do not extract a shared validator.

Do not begin Phase 8.

## Pre-flight

Before implementation:

1.  verify branch, HEAD, and `git status --short`;
2.  confirm the working tree is clean;
3.  confirm Phase 6 is still `Completed` and Phase 7 is still `Planned`;
4.  re-read the four approved target areas plus only the existing
    Phase-6/Phase-4/Phase-5 files required to implement them correctly.

Expected baseline from Gate 2:

-   branch: `main`
-   HEAD: `10d7dcbd017a2ccf76546a99188877ffdba4026e`
-   status: clean

If repository state differs materially, STOP and report instead of
implementing.

## Approved implementation contract

Implement exactly the Gate-2-approved Hosted Update API.

### HTTP endpoint

`PUT /api/comparisons/{publicId}`

Astro route:

`hosted/src/pages/api/comparisons/[publicId].ts`

HTTP mappings:

-   success → `200`, body `{}`
-   validation failure → `400`, body `{"error":"validation_failed"}`
-   unknown `publicId` → `404`, body `{"error":"not_found"}`
-   wrong `managementToken` → exactly the same `404` + body as unknown
    `publicId`
-   final guarded UPDATE affects zero rows → exactly the same `404` +
    body
-   unexpected DB/storage/internal failure → `500`, body
    `{"error":"internal_failure"}`

Never expose whether a Publication exists when management authority is
invalid.

Never return a management token.

### Multipart request contract

Route parameter:

-   `publicId`

Multipart fields:

-   `managementToken` --- required non-empty plaintext string; secret
    exists only for request processing and must never be
    stored/logged/returned
-   `payload` --- required JSON string containing the complete desired
    Hosted Presentation state
-   `reference` --- required image file
-   `capture` --- required image file
-   `branding` --- required only for custom branding;
    forbidden/inconsistent when presentation state does not permit it

Structured `payload` contains the same Hosted Presentation fields as
Publish except **no `comparisonId`**:

Required:

-   `referenceLabel`
-   `captureLabel`
-   `showDate`
-   `background`
-   `cornerStyle`

Optional/nullable according to the already-approved Publish rules:

-   `title`
-   `description`
-   `locationDisplayName`
-   `locationCity`
-   `locationCountry`
-   `brandingType`
-   `brandingBuiltinId`

Copy the accepted Phase-6 validation behavior into private Update
validation logic as needed.

Do not modify or refactor Publish.

Do not add PATCH semantics.

Do not accept unknown structured payload keys if Publish rejects them.

Branding consistency rules must remain equivalent to Publish.

### Authorization

Use the existing `hashManagementToken()` from `hosted-identifiers.ts`.

Never store, return, or log plaintext management tokens.

Approved two-gate design:

1.  hash supplied token;
2.  early DB lookup using **both** `public_id` and
    `management_token_hash`;
3.  if no row matches, return the neutral `"not-found"` result **before
    image processing and before permanent asset writes**;
4.  after all validation, processing, and storage succeed, final
    activation must again use a guarded DB UPDATE using **both**
    `public_id` and `management_token_hash`.

The final guarded UPDATE is authoritative.

Do not rely solely on the early SELECT.

No JS-side `timingSafeEqual()` is required because plaintext is hashed
first and authorization comparison occurs as DB equality against the
stored hash.

### Prepare → validate → store → activate

Required sequence:

1.  validate request/presentation structure and binary consistency;
2.  hash management token;
3.  perform early authorized target lookup;
4.  process required core images through existing Phase-5 processing;
5.  process custom branding through existing Phase-5 processing when
    required;
6.  generate a fresh `assetVersion` with `randomUUID()`;
7.  store the complete new asset set under the **existing internal
    publication ID** returned by the authorized lookup;
8.  perform one final guarded atomic UPDATE;
9.  classify by affected-row count/result.

Never generate a new internal publication ID.

Never generate a new public ID.

Never generate a new management token.

### Asset behavior

Use existing Phase-4 `AssetStorage`.

Every Update prepares a fresh immutable asset version.

Write:

-   `reference.webp`
-   `capture.webp`
-   `branding.webp` only for custom branding

Do not overwrite the active version.

Do not delete the old version.

Do not synchronously delete partially written or unreferenced new
versions on failure.

Those remain Phase-10 cleanup candidates.

If switching away from custom branding, the new version simply has no
`branding.webp`.

### Atomic activation

Use one guarded Drizzle/MySQL UPDATE on the existing row.

Mutable columns to replace:

-   `title`
-   `description`
-   `reference_label`
-   `capture_label`
-   `show_date`
-   `location_display_name`
-   `location_city`
-   `location_country`
-   `branding_type`
-   `branding_builtin_id`
-   `background`
-   `corner_style`
-   `active_asset_version`

Must remain unchanged:

-   `id`
-   `comparison_id`
-   `public_id`
-   `management_token_hash`
-   `created_at`
-   `status`

`updated_at` remains handled by the existing schema's `.onUpdateNow()`
behavior.

Do not introduce a staging status.

Do not add an explicit multi-statement transaction unless implementation
proves the single guarded UPDATE cannot meet the approved contract. If
such a problem appears, STOP and report rather than expanding scope.

### Concurrency

Two concurrent authorized Updates may both succeed.

Expected semantics:

**last successful atomic activation wins.**

Required invariant:

The final row must represent one complete coherent Update snapshot. It
must never contain a mixture of fields from the two Updates.

Do not introduce ETags, optimistic locking, new version columns,
application locks, or schema changes.

## File-specific implementation scope

### 1. `hosted/src/lib/update.ts`

New orchestration module.

Follow the established Phase-6 dependency-injection/testability pattern
where useful.

Expected responsibilities:

-   Update request/result/dependency types;
-   private structured-payload validation;
-   private binary consistency validation;
-   management-token hashing;
-   early authorized target lookup;
-   Phase-5 image processing;
-   fresh asset-version generation;
-   Phase-4 asset storage;
-   final guarded atomic UPDATE;
-   result classification.

Expected result categories:

-   `"updated"`
-   `"validation-failed"`
-   `"not-found"`
-   `"internal-failure"`

Do not include a plaintext token in any result type.

### 2. `hosted/src/pages/api/comparisons/[publicId].ts`

New HTTP adapter only.

Responsibilities:

-   read `params.publicId`;
-   parse `request.formData()`;
-   extract `managementToken`, `payload`, `reference`, `capture`,
    optional `branding`;
-   call `update()`;
-   map result to the exact approved HTTP contract.

Keep business logic in `update.ts`, not the route.

### 3. `hosted/test/update.test.mjs`

New orchestration tests.

Use existing Phase-6 conventions.

Required coverage includes:

-   successful authorized Update;
-   stable `public_id`;
-   stable internal `id`;
-   stable `comparison_id`;
-   stable `management_token_hash`;
-   stable `created_at`;
-   no plaintext management token in result/DB;
-   all mutable fields replaced;
-   `showDate=true`;
-   `showDate=false`;
-   fresh `active_asset_version`;
-   new WebP core assets under existing internal ID;
-   old active asset version remains physically present;
-   custom branding success;
-   switching away from custom branding creates a new version without
    `branding.webp`;
-   malformed payload;
-   missing required file;
-   invalid core image;
-   invalid custom branding;
-   wrong token;
-   unknown public ID;
-   identical result shape for wrong token and unknown public ID;
-   prove early auth rejection performs no image processing/permanent
    asset storage;
-   partial AssetStorage failure leaves live row unchanged;
-   final guarded UPDATE zero-row condition returns `"not-found"` and
    does not corrupt the prior live state;
-   concurrent authorized Updates yield one coherent complete final
    snapshot, never mixed state.

Use real local MySQL only where DB behavior itself is under test.

Use disposable filesystem paths.

Do not touch migration metadata.

### 4. `hosted/test/comparisons-update-route.test.mjs`

New thin route tests.

Required coverage:

-   valid multipart PUT → `200` + `{}`
-   malformed payload → `400` + validation error
-   missing required file → `400`
-   wrong token → `404` + `{"error":"not_found"}`
-   unknown public ID → identical `404` + identical body
-   no management token appears in any response
-   internal failure mapping where the existing route-testing pattern
    allows it without broadening production code

Reuse the accepted `closeDb()` teardown mechanism when importing the
shared DB client.

## Implementation discipline

Only the four approved new files may be created/modified.

If implementation appears to require touching any existing file, STOP
and report the concrete reason before doing so.

Forbidden:

-   modifying Phase-6 code;
-   modifying Phase-6 tests;
-   schema changes;
-   migrations;
-   dependency changes;
-   config changes;
-   docs changes;
-   cleanup scheduler;
-   delete/resolve/view behavior;
-   rate limiting;
-   deployment work;
-   unrelated refactoring;
-   architecture changes.

## Verification

After implementation, run only relevant verification.

Required:

``` text
node --test hosted/test/update.test.mjs
node --test hosted/test/comparisons-update-route.test.mjs
pnpm --dir hosted test
pnpm --dir hosted typecheck
pnpm --dir hosted build
pnpm typecheck
```

If command working-directory conventions require running the isolated
tests from inside `hosted/`, use the correct equivalent and report the
exact command actually executed.

Do not run unrelated root build/lint/test suites unless a concrete
failure requires them.

### DB cleanup verification

Before DB-touching tests, establish the local test baseline.

After tests:

-   confirm synthetic test rows are removed;
-   confirm migration metadata is unchanged;
-   do not delete unrelated rows;
-   call the accepted `closeDb()` teardown so Node exits normally.

### Runtime asset cleanup verification

Before testing, inspect whether `hosted/data/` already contains
anything.

Do not blindly delete pre-existing runtime data.

After testing, remove only directories/files that are provably
attributable to this Gate-3 test run.

If unreferenced versions are intentionally produced by
failure/concurrency tests, report them before removing only the proven
test artifacts.

## Gate-3 report

Return a complete but concise report with:

1.  pre-flight repository state;
2.  changed files;
3.  Update request/HTTP contract implemented;
4.  authorization implementation;
5.  atomic activation implementation;
6.  asset-version behavior;
7.  validation behavior;
8.  concurrency behavior;
9.  isolated Update test result;
10. isolated route test result;
11. full Hosted test result;
12. Hosted typecheck/build result;
13. root typecheck result;
14. DB cleanup/state verification;
15. runtime asset cleanup/state verification;
16. protected-file/scope verification;
17. remaining failures/risks;
18. Gate result.

Explicitly report exact test totals/pass/fail.

Also report final `git status --short`.

## Final constraints

-   Do not mark Phase 7 Completed.
-   Do not update documentation.
-   Do not commit.
-   Do not push.
-   Do not deploy.
-   Do not begin Phase 8.
-   STOP after Gate 3.
