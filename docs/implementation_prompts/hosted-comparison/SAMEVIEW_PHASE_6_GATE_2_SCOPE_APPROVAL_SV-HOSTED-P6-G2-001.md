# SameView Hosted Comparison — Phase 6 Gate 2 — Scope Approval
## Prompt ID: SV-HOSTED-P6-G2-001

Proceed with:

# Phase 6 – Hosted Publish API
## Gate 2 – Scope Approval only

Gate 1 is complete and the persistence blocker for Hosted Date visibility has been resolved and committed.

Do NOT implement anything yet.

Use the current repository and the current Sources of Truth. Revalidate the Gate-1 conclusions against the actual committed state before approving the implementation scope.

If a real contradiction or unresolved product decision remains, STOP and report it instead of improvising.

---

## 1. Repository pre-check

Verify:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Working tree must be clean.

If not:
- do not stash
- do not reset
- do not modify anything
- STOP if the state affects reliable scope confirmation

Also confirm the committed Date-visibility correction is present:

```ts
showDate: boolean("show_date").notNull().default(true),
```

and migration:

```text
hosted/drizzle/0001_known_zombie.sql
```

Phase 3 must currently be documented as `Completed`.

---

## 2. Re-read the authoritative Phase-6 scope

Read the current Phase 6 section in:

```text
docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md
```

and the relevant current sections of:

```text
docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md
docs/ARCHITECTURE.md
docs/DATA_AND_PRIVACY.md
docs/FEATURE_SPECIFICATION.md
docs/APPLICATION_LAYOUT.md
docs/USER_WORKFLOW.md
```

Inspect the actual current implementation files needed to confirm the proposed Phase-6 design:

```text
hosted/src/db/schema.ts
hosted/src/db/client.ts
hosted/src/lib/asset-storage.ts
hosted/src/lib/temp-storage.ts
hosted/src/lib/image-processing.ts
hosted/src/lib/branding-processing.ts
hosted/astro.config.mjs
hosted/package.json
hosted/test/**
```

Do not repeat broad Gate-1 research.
Only revalidate what is needed for a precise Gate-2 scope.

---

## 3. Gate-1 conclusions to carry forward

Revalidate these conclusions, but do not reopen them without contradictory evidence:

### Persistence
- `comparison_id` is database-unique.
- `public_id` is database-unique.
- `management_token_hash` is database-unique.
- `show_date` now persists Date visibility independently.
- `reference_label` and `capture_label` remain required derived Outcome Snapshot strings.

### Image processing
- reference/capture publication inputs are JPEG.
- branding publication input is canonical PNG.
- Phase 5 owns validation, metadata stripping, resizing and WebP conversion.
- Phase 6 must reuse those processors and must not duplicate them.

### Asset storage
- Phase 4 owns versioned `AssetStorage`.
- permanent asset keys use internal publication ID + asset version + canonical filenames.
- failed/staged asset versions may remain unreferenced and are later cleanup candidates according to the approved cleanup model.
- Phase 6 does not implement Phase-10 cleanup scheduling.

### Management authority
- Publish input contains no management token.
- Publish therefore cannot prove authority over an already-existing Publication.
- Update/Delete authority belongs to later phases.

### Atomicity
- no check-then-insert race for `comparison_id`;
- one atomic INSERT lets the UNIQUE constraint arbitrate concurrent Publish attempts.

### Duplicate-key discrimination
The actual Drizzle insertion path wraps the mysql2 duplicate error in `err.cause`.

The implementation must account for the verified shape:

```text
err.cause.code === "ER_DUP_ENTRY"
err.cause.errno === 1062
err.cause.sqlState === "23000"
err.cause.sqlMessage contains the known constraint name
```

Known constraint names:

```text
comparisons_comparison_id_unique
comparisons_public_id_unique
comparisons_management_token_hash_unique
```

Do not implement classification against `err.code` directly if the actual Drizzle path does not expose it there.

---

## 4. Resolve the exact conceptual Publish request contract

Produce the final Gate-2 request contract sufficiently precisely that Gate 3 can implement it without inventing product behavior.

At minimum resolve:

### Required structured fields
- `comparisonId`
- `referenceLabel`
- `captureLabel`
- `showDate`
- `background`
- `cornerStyle`

### Optional structured fields
- `title`
- `description`
- location fields
- branding fields where applicable

### Required binary fields
- reference image
- capture image

### Optional binary field
- branding image only for custom branding

Important correction:

**`showDate` is REQUIRED in the Publish request contract.**

Do not make it optional merely because the database column has a default.

Reason:
- it is an explicit Hosted Presentation setting;
- the client publishes a concrete Presentation snapshot;
- the DB default remains a defensive persistence default, not a substitute for an omitted client-side Presentation choice.

Therefore:
- Gate-3 request validation must require a boolean `showDate`;
- do not include a test that omission of `showDate` is accepted by the Publish API;
- the DB default remains untouched and may still protect direct DB inserts/migrations.

Determine exact allowed values for:
- `background`
- `cornerStyle`
- `brandingType`

from the current approved sources.

Determine the consistency rules between:
- `brandingType`
- `brandingBuiltinId`
- branding file presence

Do not invent additional payload metadata.

---

## 5. Labels

Confirm the already-resolved ownership:

- publishing client sends final `referenceLabel`
- publishing client sends final `captureLabel`
- Hosted does not derive raw dates into labels

Do not add raw date fields unless the approved sources explicitly require them.

---

## 6. Presentation persistence mapping

Map every request field to the current DB schema.

Explicitly show:

- Title hidden/visible semantics
- Description hidden/visible semantics
- Date via `show_date`
- Location via nullable location fields
- Branding semantics
- Background
- Corner style

If any approved presentation state is still not representable, STOP and report the mismatch.

Do not add another schema field in Phase 6.

---

## 7. Identifier generation

Confirm the exact implementation-level algorithms:

### Internal publication ID

Use an app-generated UUID compatible with:

```text
id char(36)
```

### Asset version

Use a fresh UUID compatible with:

```text
active_asset_version varchar(36)
```

### Public ID

Use Node crypto to produce:
- exactly 72 random bits
- Base64url without padding
- exactly 12 characters

Expected implementation pattern:

```ts
randomBytes(9).toString("base64url")
```

### Management token

Use:
- 256 random bits
- Base64url without padding
- approximately 43 characters

Expected pattern:

```ts
randomBytes(32).toString("base64url")
```

### Persisted management token verifier

Use SHA-256 hex:

```ts
createHash("sha256").update(token).digest("hex")
```

Expected:
- 64 lowercase hex characters
- plaintext management token never persisted

No new crypto dependency.

---

## 8. Collision/retry policy

Gate 2 must define the exact bounded retry behavior for generated identifier collisions.

Resolve:
- maximum retry attempts
- whether each retry regenerates both `public_id` and management token or only the colliding identifier
- whether the already-written asset version is reused across generated-ID retries
- final failure behavior after retry exhaustion

The implementation must remain simple.

Do not treat `comparison_id` conflict as retryable.

For `comparison_id` conflict:
- no second Publication is created;
- no existing `public_id` or management state is disclosed.

For `public_id` / `management_token_hash` generated collisions:
- bounded retry is allowed.

Choose a concrete bounded retry count as an implementation-level engineering decision if the approved specs intentionally leave the exact number open.

State the exact number in Gate 2.

---

## 9. TempStorage decision

Revalidate the final Gate-1 recommendation.

Determine whether Phase 6 should:

A. use direct in-memory multipart bytes → Phase-5 processor,

or

B. stage raw request bytes through Phase-4 TempStorage first.

Prefer the simplest implementation consistent with the normative privacy/storage requirements.

Do not use TempStorage merely because it exists.

If direct in-memory processing satisfies:
- non-public handling
- transient processing
- no persistent original upload
- no stale processing artifact

then document that clearly as the Phase-6 decision.

If the sources explicitly require filesystem staging, say so and include TempStorage in scope.

Do not leave this ambiguous in Gate 2.

---

## 10. Route and multipart contract

Phase 6 needs a real callable route, but Phase 12 later freezes the external cross-client contract.

Define the provisional Phase-6 route.

Gate 1 proposed:

```text
POST /api/comparisons
```

Revalidate whether this is the minimal appropriate Astro route.

If accepted, specify the exact file path:

```text
hosted/src/pages/api/comparisons.ts
```

Define the multipart structure.

Prefer:
- one structured JSON field
- binary fields for reference/capture/optional branding

Determine exact multipart field names.

Do not add a multipart dependency if `Request.formData()` is sufficient.

Clearly mark this route/body shape as provisional until Phase 12 freezes the external API contract.

---

## 11. Response contract

Keep Phase 6 minimal.

Success response must include only what the approved product behavior actually requires.

Important correction:

Do NOT automatically add convenience fields such as:

- `publicUrl`
- `managementUrl`

unless a current approved source explicitly requires them from the Publish response itself.

For Phase 6, prefer the smallest success response:

```text
publicId
managementToken
```

where:
- `managementToken` is returned only once;
- only its hash is persisted.

If the current approved source explicitly requires URLs in the Publish result, cite it and include them.
Otherwise keep them out and defer URL composition/final external response shape to Phase 12 / client presentation logic.

For existing-publication/no-authority behavior:
- no existing `publicId`
- no management state
- no ownership disclosure
- neutral result/error only

Do not freeze broad HTTP status-code conventions unless Phase 6 requires a concrete provisional code for route tests.

If a provisional status code is needed, clearly mark it provisional pending Phase 12.

---

## 12. Validation contract

Determine exact validation required before any permanent side effect.

At minimum:
- structured payload parses successfully
- required fields present
- `comparisonId` shape valid according to current approved identifier semantics
- enum-like Presentation fields valid
- branding configuration internally consistent
- reference/capture files present
- optional branding file present only when required/allowed
- image processors return success

Do not invent validation unrelated to Phase 6.

Determine whether unknown structured fields are rejected or ignored based on the approved allowlist requirement.

The baseline says arbitrary unknown request fields must not be persisted.
Gate 2 must state whether the Phase-6 request parser rejects unknown keys or simply ignores them.
Choose the safer/minimal behavior consistent with the approved source.

---

## 13. Publish orchestration

Define the exact implementation sequence.

At minimum resolve:

1. parse request
2. validate structured payload
3. obtain binary inputs
4. process core images / branding through Phase 5
5. generate internal publication ID
6. generate asset version
7. store processed assets through Phase 4
8. generate public ID + management token
9. hash token
10. INSERT complete row with `active_asset_version`
11. classify uniqueness result
12. retry generated identifier collision if appropriate
13. return success or neutral conflict/failure

No DB row may become active before the referenced asset version is fully stored.

Do not introduce a cross-filesystem/DB transaction abstraction that does not exist.

---

## 14. Failure behavior

Define exact Phase-6 behavior for:

- malformed structured payload
- missing required file
- Phase-5 processing rejection
- partial permanent asset write
- `comparison_id` uniqueness conflict
- `public_id` uniqueness collision
- `management_token_hash` uniqueness collision
- unexpected database error
- retry exhaustion

Clarify which cases create:
- no DB row
- unreferenced staged asset version
- neutral existing-publication response
- internal failure

Do not implement immediate orphan cleanup if the approved architecture delegates actual removal to Phase 10.

---

## 15. Exact implementation structure

Gate 1 proposed a minimal additive structure.

Revalidate the smallest file set.

Likely new files:

```text
hosted/src/pages/api/comparisons.ts
hosted/src/lib/hosted-identifiers.ts
hosted/src/lib/publish.ts
```

plus focused test file(s).

Do not create a separate module solely for trivial types unless it provides real reuse.

Determine whether:
- request parsing belongs in the route file;
- pure Publish orchestration belongs in `publish.ts`;
- identifier functions belong in one small reusable module because Update/Delete will need token hashing later.

If another existing file must be modified, identify it now.

Do not modify Phase 3–5 implementations unless absolutely required.

---

## 16. Dependency/configuration impact

Confirm whether Phase 6 requires changes to:

```text
hosted/package.json
hosted/pnpm-lock.yaml
hosted/pnpm-workspace.yaml
hosted/astro.config.mjs
hosted/tsconfig.json
hosted/app.js
```

Expected result should be `None` unless evidence proves otherwise.

Use:
- Node crypto
- standard Request/FormData APIs
- existing Drizzle/MySQL
- existing Phase-4/5 modules

No dependency additions without evidence.

---

## 17. Test strategy

Define the exact Gate-3 verification matrix.

At minimum cover:

### Successful publish
- fresh comparison creates exactly one DB row
- `showDate=true` persisted
- `showDate=false` persisted
- title/description/location/branding mappings persisted correctly
- active asset version points to actual stored files
- reference.webp/capture.webp retrievable
- branding.webp present only for custom branding
- management plaintext returned once
- management plaintext absent from DB
- SHA-256(returned token) equals stored hash

### Validation
- malformed structured payload rejected
- missing reference rejected
- missing capture rejected
- invalid core image rejected through Phase 5
- invalid branding rejected through Phase 5
- invalid branding configuration rejected

### Concurrency / uniqueness
- concurrent Publish attempts with same comparisonId create only one row
- second/lost attempt receives neutral result
- no existing public ID disclosure
- publicId generated collision retries
- management-token-hash collision retries
- retry exhaustion handled deterministically

### Error-classification
- helper correctly classifies DrizzleQueryError through `err.cause`
- comparison/public/token constraints distinguished correctly

### Scope boundaries
- no Update/Delete behavior
- no Resolve/View behavior

Determine whether tests should:
- use real local MySQL integration for the atomic uniqueness cases;
- use disposable filesystem directories for AssetStorage;
- call the pure Publish service directly for most integration cases;
- test the Astro route separately for multipart parsing/response shape.

Prefer the minimum number of expensive integration tests necessary to prove atomicity.

---

## 18. Exact Gate-2 file scope

Output an exact file scope.

For each file state:
- New / Modified
- exact responsibility
- why it is required

Also state:
- no other file may be touched in Gate 3;
- if implementation requires another file, Gate 3 must STOP.

Include exact test files.

Do not leave vague placeholders like "corresponding tests."

---

## 19. Explicit exclusions

Confirm Phase 6 Gate 3 will NOT implement:

- Update API
- Delete API
- Resolve/View API
- browser management
- management session/cookie
- Public Viewer
- report flow
- rate limiting unless Phase 6 explicitly requires only a local primitive
- cleanup scheduler
- stale asset cleanup
- S3 backend
- Android networking
- Web publishing client
- QR
- production DB provisioning
- production migration
- deployment changes
- documentation status update
- Phase 7+

---

# Expected Gate-2 report

Return:

# Phase 6 Gate 2 — Scope Confirmation Report

## 1. Repository pre-check
## 2. Source-of-truth confirmation
## 3. Final request contract
## 4. Presentation persistence mapping
## 5. Identifier and token generation
## 6. Collision/retry policy
## 7. TempStorage decision
## 8. Route and multipart contract
## 9. Success/conflict response contract
## 10. Validation rules
## 11. Publish orchestration sequence
## 12. Failure/atomicity behavior
## 13. Exact approved files
### New
### Modified
## 14. Exact changes per file
## 15. Dependency/configuration impact
## 16. Exact test matrix
## 17. Explicit exclusions
## 18. Risks
## 19. Documentation impact
## 20. Gate result

At the end state exactly one:

`Phase 6 Gate 2 scope is ready for user approval.`

or:

`Phase 6 is blocked before Gate 3 implementation.`

If blocked, identify only the smallest unresolved product/architecture decision.

Do not implement anything.
Do not modify files.
Do not modify databases.
Do not write runtime asset data.
Do not update documentation.
Do not commit.
Do not push.
Do not deploy.

STOP after Gate 2.
