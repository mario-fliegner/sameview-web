# SameView Hosted Comparison — Phase 6 Gate 3 — Implementation
## Prompt ID: SV-HOSTED-P6-G3-001

Proceed with:

# Phase 6 – Hosted Publish API
## Gate 3 – Implementation only

Phase 6 Gate 2 has been approved.

Implement exactly the approved Gate-2 scope below. Do not expand scope.

---

## 1. Pre-flight

Before changing anything, verify:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected:
- branch: `main`
- working tree: clean

Also re-read the current Phase 6 section in:

```text
docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md
```

and inspect only the implementation files required for this Gate.

If the working tree is not clean, or if the current repository materially differs from the approved Gate-2 assumptions, STOP and report the discrepancy.

Do not stash, reset, clean, or modify unrelated state.

---

## 2. Hard file scope

You may create only these files:

```text
hosted/src/pages/api/comparisons.ts
hosted/src/lib/hosted-identifiers.ts
hosted/src/lib/publish.ts
hosted/test/hosted-identifiers.test.mjs
hosted/test/publish.test.mjs
hosted/test/comparisons-route.test.mjs
```

No existing file is approved for modification.

In particular, do NOT modify:

```text
hosted/src/db/schema.ts
hosted/src/db/client.ts
hosted/src/lib/asset-storage.ts
hosted/src/lib/temp-storage.ts
hosted/src/lib/image-processing.ts
hosted/src/lib/branding-processing.ts
hosted/package.json
hosted/pnpm-lock.yaml
hosted/pnpm-workspace.yaml
hosted/astro.config.mjs
hosted/tsconfig.json
hosted/app.js
docs/**
.github/**
```

If implementation genuinely requires another file, STOP and report why. Do not touch it.

---

## 3. Final Publish request contract

Implement the structured Publish payload with these required fields:

```text
comparisonId
referenceLabel
captureLabel
showDate
background
cornerStyle
```

Rules:

- `comparisonId`: UUID v4 string.
- `referenceLabel`: non-empty string.
- `captureLabel`: non-empty string.
- `showDate`: REQUIRED strict boolean.
- `background`: exactly `"dark" | "light"`.
- `cornerStyle`: exactly `"rounded" | "sharp"`.

Optional structured fields:

```text
title
description
locationDisplayName
locationCity
locationCountry
brandingType
brandingBuiltinId
```

Rules:

- optional text values, when present, must be strings;
- title absent = hidden;
- description absent = hidden;
- location is one presentation group:
  - either all three location fields are absent;
  - or the submitted location representation must be internally valid according to the approved current payload model;
- `brandingType`: absent, `"builtin"`, or `"custom"`;
- absent brandingType = no branding;
- `"builtin"` requires `brandingBuiltinId`;
- allowed built-in IDs:

```text
heart
star
camera
home
pin
fire
```

- `"builtin"` must NOT include a branding file;
- `"custom"` must NOT include `brandingBuiltinId`;
- `"custom"` requires a branding file;
- no branding type must not include either a branding ID or branding file.

Unknown top-level structured payload fields must be rejected.

Do not add raw date fields.
Do not derive labels server-side.

---

## 4. Multipart contract

Implement provisional:

```text
POST /api/comparisons
```

using:

```text
hosted/src/pages/api/comparisons.ts
```

Request:

```text
multipart/form-data
```

Fields:

```text
payload    required JSON text field
reference  required file
capture    required file
branding   optional file, only for custom branding
```

Use standard `Request.formData()`.

Do not add a multipart dependency.

The route is an HTTP adapter only:
- parse multipart/form-data;
- extract fields;
- pass the request to the Publish service;
- map service results to HTTP responses.

Do not place DB/storage/image-processing orchestration in the route.

---

## 5. Success and HTTP result contract

Success:

```http
201
```

body:

```json
{
  "publicId": "...",
  "managementToken": "..."
}
```

Do NOT return:

```text
publicUrl
managementUrl
```

The plaintext management token is returned only on successful creation and must never be persisted.

Provisional result mapping for Phase 6:

```text
201 = created
400 = request/payload/file/image validation failure
409 = comparison_id already published / neutral conflict
500 = unexpected internal failure or generated-identifier retry exhaustion
```

For the 409 result:
- disclose no existing `publicId`;
- disclose no management token/hash/state;
- use only a neutral error/result body.

Do not over-design error wording. Keep it stable and minimal.

---

## 6. Identifier implementation

Create:

```text
hosted/src/lib/hosted-identifiers.ts
```

Implement:

```ts
generatePublicId(): string
generateManagementToken(): string
hashManagementToken(token: string): string
classifyInsertError(
  err: unknown
): "comparison_id" | "public_id" | "management_token_hash" | "unknown"
```

Algorithms:

### Public ID

```ts
randomBytes(9).toString("base64url")
```

Requirements:
- 72 random bits;
- exactly 12 Base64url characters;
- no padding.

### Management token

```ts
randomBytes(32).toString("base64url")
```

Requirements:
- 256 random bits;
- approximately/exactly 43 Base64url characters with Node's unpadded encoding.

### Hash

```ts
createHash("sha256").update(token).digest("hex")
```

Requirements:
- 64 lowercase hex chars;
- only the hash is persisted.

### Duplicate-key classification

The real Drizzle/mysql2 insertion path has already been verified to expose duplicate information under `err.cause`.

Classify only when the cause represents MySQL duplicate entry:

```text
cause.code === "ER_DUP_ENTRY"
cause.errno === 1062
cause.sqlState === "23000"
```

Then distinguish using `cause.sqlMessage` and the exact known constraint names:

```text
comparisons_comparison_id_unique
comparisons_public_id_unique
comparisons_management_token_hash_unique
```

Do not classify based on `err.code` directly if the actual driver error is wrapped.

Unknown/unexpected error shapes return `"unknown"`.

---

## 7. Publish service

Create:

```text
hosted/src/lib/publish.ts
```

Keep `PublishInput` and `PublishResult` types in this file.

The service owns:
- structured validation;
- binary-presence/branding consistency validation;
- Phase-5 processing;
- Phase-4 permanent asset writes;
- identifier generation;
- DB insert;
- duplicate classification;
- generated-ID retries;
- service-level result.

It must not own HTTP request parsing/status handling.

Reuse:

```text
hosted/src/db/client.ts
hosted/src/db/schema.ts
hosted/src/lib/asset-storage.ts
hosted/src/lib/image-processing.ts
hosted/src/lib/branding-processing.ts
```

Do not modify them.

Do NOT use `TempStorage`.

Raw multipart uploads remain in memory only and are passed as Buffers to Phase 5.

---

## 8. Publish sequence

Implement this order:

1. Validate structured payload.
2. Validate required/allowed binary presence.
3. Process reference through `processCoreImage`.
4. Process capture through `processCoreImage`.
5. Process branding through `processBrandingImage` only for custom branding.
6. If any processing fails, return validation failure before permanent writes.
7. Generate internal publication ID with `crypto.randomUUID()`.
8. Generate asset version with `crypto.randomUUID()`.
9. Store processed assets through `AssetStorage` under:

```text
{id, assetVersion, reference.webp}
{id, assetVersion, capture.webp}
{id, assetVersion, branding.webp}   only for custom branding
```

using the actual Phase-4 `AssetKey` field name:

```text
internalPublicationId: id
```

10. Only after every required asset write succeeds, generate:
    - public ID;
    - management token;
    - management-token hash.
11. Attempt one complete INSERT with `active_asset_version` already set.
12. On success, return `publicId` + plaintext `managementToken`.
13. On duplicate failure, classify the exact constraint.
14. `comparison_id` conflict → neutral conflict, no retry.
15. `public_id` / `management_token_hash` collision → bounded retry.
16. Unexpected DB failure → internal failure.
17. Retry exhaustion → internal failure.

No active DB row may reference assets that have not already been fully written.

---

## 9. Collision retry behavior

Maximum attempts:

```text
5
```

Interpret this as a bounded total number of INSERT attempts for the generated identifier state.

Do not retry `comparison_id`.

For generated collisions:

- `public_id` collision:
  - regenerate only `publicId`;
  - keep management token/hash;
  - keep internal publication ID;
  - keep asset version;
  - do not rewrite assets.

- `management_token_hash` collision:
  - regenerate management token + hash only;
  - keep `publicId`;
  - keep internal publication ID;
  - keep asset version;
  - do not rewrite assets.

After 5 unsuccessful generated-identifier attempts:
- return internal failure;
- do not create a DB row;
- leave the already-written asset version unreferenced;
- do not synchronously delete it.

Phase 10 owns actual orphan cleanup.

---

## 10. Persistence mapping

Persist:

```text
id                         <- internal UUID
comparison_id              <- comparisonId
public_id                  <- generated publicId
management_token_hash      <- SHA-256(managementToken)
title                      <- title or NULL
description                <- description or NULL
reference_label            <- referenceLabel
capture_label              <- captureLabel
show_date                  <- showDate
location_display_name      <- locationDisplayName or NULL
location_city              <- locationCity or NULL
location_country           <- locationCountry or NULL
branding_type              <- brandingType or NULL
branding_builtin_id        <- brandingBuiltinId or NULL
background                 <- background
corner_style               <- cornerStyle
active_asset_version       <- generated assetVersion
status                     <- existing/default active semantics
```

Do not persist the plaintext management token.

Do not add or derive other fields.

---

## 11. Asset behavior

Use the existing Phase-4 filesystem storage abstraction.

Default runtime storage should use the existing:

```text
DEFAULT_ASSET_STORAGE_BASE_DIR
createFilesystemAssetStorage(...)
```

or an equally direct composition of the existing Phase-4 API without modifying it.

Tests must be able to inject/use disposable filesystem storage rather than write to the real project runtime data directory.

Do not introduce a new storage abstraction.

Failure behavior:

- validation/processing failure before writes → no asset version;
- partial permanent write failure → no DB INSERT;
- partial/unreferenced version is left for later cleanup;
- comparison conflict after assets were written → unreferenced version remains;
- generated-ID collision retries reuse the same version;
- unexpected DB failure leaves the version unreferenced.

Do not implement synchronous cleanup.

---

## 12. Tests — exact files

Create exactly:

```text
hosted/test/hosted-identifiers.test.mjs
hosted/test/publish.test.mjs
hosted/test/comparisons-route.test.mjs
```

Do not create fixture binaries in the repository.
Generate image fixtures programmatically/in memory as already done by Phase 5.

Use disposable filesystem directories for AssetStorage tests.

Use the real local `sameview_hosted` MySQL database only for cases where DB-level atomicity/constraint behavior must genuinely be proven.

Tests must clean up their own synthetic DB rows.

Do not alter production data or any production database.

---

## 13. Identifier tests

Cover:

- public ID length = 12;
- public ID uses Base64url-compatible characters only;
- management token length = 43;
- management token uses Base64url-compatible characters only;
- SHA-256 hash = 64 lowercase hex;
- hash deterministic for same token;
- plaintext token is not equal to its hash;
- duplicate-key classifier:
  - comparison constraint;
  - public ID constraint;
  - management-token-hash constraint;
  - non-duplicate error → unknown;
  - malformed/wrapper without expected cause → unknown.

For the duplicate classification, use the real Drizzle/MySQL error shape where practical so the test proves the `err.cause` behavior that Gate 1 verified.

---

## 14. Publish tests

Cover at least:

### Success

- fresh `comparisonId` creates exactly one row;
- `showDate: true` persists true/1;
- `showDate: false` persists false/0;
- title/description/location present → persisted;
- absent title/description/location → NULL;
- built-in branding persists semantic configuration;
- built-in branding writes no `branding.webp`;
- custom branding writes `branding.webp`;
- reference/capture stored and retrievable;
- `active_asset_version` matches the stored version;
- success returns `publicId`;
- success returns plaintext `managementToken`;
- DB contains only management-token hash;
- SHA-256(returned token) equals persisted hash.

### Validation

- malformed/invalid structured input rejected;
- unknown structured field rejected;
- missing reference rejected;
- missing capture rejected;
- invalid reference/capture image rejected through Phase 5;
- invalid custom branding image rejected through Phase 5;
- custom branding without branding file rejected;
- built-in branding with branding file rejected;
- built-in branding without ID rejected;
- custom branding with built-in ID rejected;
- no branding type with branding file/ID rejected;
- invalid background rejected;
- invalid corner style rejected;
- non-boolean/missing `showDate` rejected;
- invalid/non-v4 `comparisonId` rejected.

For every failure that occurs before permanent storage:
- assert no DB row;
- assert no permanent asset write.

### DB uniqueness / concurrency

Use real MySQL:

- two concurrent Publish calls with the same `comparisonId`;
- assert exactly one row exists afterward;
- one call succeeds;
- losing call receives neutral conflict;
- conflict result contains no existing public ID or management state.

### Generated collision behavior

Prove:
- public-ID collision retries;
- token-hash collision retries;
- only the colliding identifier is regenerated;
- asset version is reused;
- assets are not reprocessed/rewritten per retry;
- retry exhaustion is deterministic after max 5 attempts;
- no row is created on exhaustion.

If deterministic collision testing requires injectable identifier functions or another small internal dependency seam, keep that seam inside `publish.ts` / its existing approved API design. Do not create another file.

---

## 15. Route tests

Keep route tests thin.

Cover:

- valid multipart request maps successful service result to `201`;
- body contains only expected success fields;
- malformed/missing `payload` → `400`;
- missing required multipart file → `400`;
- service conflict → `409` with neutral body;
- unexpected service failure → `500`;
- route does not expose existing publication identifiers on conflict.

Do not duplicate the full Publish integration matrix at route level.

If direct route testing exposes a framework-specific import/runtime problem that cannot be solved inside the approved route/test files, STOP rather than modifying Astro/config/package files.

---

## 16. Important implementation constraints

- One implementation only.
- Minimal targeted changes.
- No refactoring of Phase 3–5 code.
- No new dependency.
- No generic CRUD abstraction.
- No new repository-wide error framework.
- No transaction abstraction spanning filesystem + DB.
- No synchronous orphan cleanup.
- No TempStorage use.
- No raw upload persistence.
- No plaintext management token persistence.
- No URL construction in the Publish result.
- No management authority logic on Publish.
- No Update/Delete/Resolve behavior.

---

## 17. Verification sequence

Run only relevant checks.

At minimum:

```bash
pnpm --dir hosted test
pnpm --dir hosted typecheck
pnpm --dir hosted build
```

Because `publish.ts` uses the Hosted DB schema/client and Phase-6 tests include real DB atomicity behavior, verify against the local MySQL 8.0.46 `sameview_hosted` database.

Before DB integration tests:
- inspect current row count;
- do not delete unknown/pre-existing rows;
- use unique synthetic comparison IDs;
- clean up only rows created by the tests.

After DB tests:
- verify synthetic rows were removed;
- do not alter migration metadata.

Also run root:

```bash
pnpm typecheck
```

because the root tsconfig broadly scans `hosted/`.

Do not run unrelated WordPress/Joomla/Playwright/Android suites.

Finally verify scope:

```bash
git status --short
git diff --check
git diff --stat
```

and explicitly confirm no file outside the six approved files changed.

---

## 18. STOP conditions

STOP immediately and report instead of expanding scope if:

- another repository file must be modified;
- a dependency/config change is required;
- the actual DB/Drizzle error shape contradicts the verified `err.cause` contract;
- an approved Presentation state cannot be represented;
- the current Phase-4/5 APIs cannot support the approved orchestration without modification;
- Astro route testing requires framework/config changes;
- current docs materially contradict the approved Gate-2 contract;
- local DB state contains unknown data that would make destructive testing unsafe.

---

# Required Gate-3 report

Return:

# Phase 6 Gate 3 — Implementation Report

## 1. Pre-flight repository state
## 2. Changed files
### New
### Modified
## 3. Publish request validation implementation
## 4. Identifier/token implementation
## 5. Duplicate-key classification
## 6. Asset/image-processing orchestration
## 7. Database insertion and persistence mapping
## 8. Collision/retry implementation
## 9. Route implementation
## 10. Success/conflict/failure behavior
## 11. Test implementation
## 12. Hosted verification
## 13. Root interaction verification
## 14. Database cleanup verification
## 15. Protected-file / scope verification
## 16. Final repository state
## 17. Scope compliance
## 18. Remaining risks / manual follow-up
## 19. Phase status

State exact test counts/results.

Explicitly state:
- whether any synthetic DB rows remain;
- whether any runtime asset files remain;
- whether migration metadata changed;
- whether any plaintext management token was persisted;
- whether any file outside scope changed.

Do NOT mark Phase 6 `Completed`.
Do NOT update documentation.
Do NOT commit.
Do NOT push.
Do NOT deploy.

End with:

`STOP after Gate 3.`
