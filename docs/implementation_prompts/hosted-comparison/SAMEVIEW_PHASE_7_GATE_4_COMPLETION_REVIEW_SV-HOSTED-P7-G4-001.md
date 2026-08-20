# SameView Hosted Comparison — Phase 7 Gate 4 — Completion Review
## Prompt ID: SV-HOSTED-P7-G4-001

Phase 7 Gate 3 implementation is complete and reported green.

Current reported Gate-3 evidence:

```text
isolated update test: 20/20 passed
isolated route test: 5/5 passed
full Hosted suite: 141/141 passed
Hosted typecheck: 0 errors
Hosted build: succeeded
root typecheck: 0 errors
comparisons rows after cleanup: 0
migration metadata: unchanged
hosted/data/: absent after cleanup
```

Phase 7 is still documented as `Planned`.

This prompt is for:

```text
Phase 7 – Hosted Update API
Gate 4 – Completion Review / Acceptance
```

Do not implement anything.

Do not modify files.

Do not update documentation yet.

Do not commit, push, or deploy.

---

# 1. Pre-flight repository state

Verify:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected baseline from Gate 3:

```text
branch: main
HEAD:   10d7dcbd017a2ccf76546a99188877ffdba4026e
```

Expected working-tree footprint:

```text
?? hosted/src/lib/update.ts
?? hosted/src/pages/api/comparisons/
?? hosted/test/comparisons-update-route.test.mjs
?? hosted/test/update.test.mjs
```

Resolve the exact file under:

```text
hosted/src/pages/api/comparisons/
```

Expected:

```text
hosted/src/pages/api/comparisons/[publicId].ts
```

If repository state materially differs from the accepted Gate-3 state, STOP and report.

Do not stash, reset, clean, stage, or alter anything.

---

# 2. Re-read the Phase-7 source of truth

Read the current Phase 7 section in:

```text
docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md
```

Also inspect only the directly relevant approved specifications needed to validate the implementation:

```text
docs/ARCHITECTURE.md
docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md
docs/FEATURE_SPECIFICATION.md
docs/USER_WORKFLOW.md
docs/DATA_AND_PRIVACY.md
```

Identify the exact current:

- objective;
- prerequisites;
- required Update behavior;
- authorization requirement;
- atomicity requirement;
- non-goals;
- Gate-4 verification criteria;
- completion criteria.

Use the current repository files, not prior summaries.

If implementation and approved specification conflict, report the conflict. Do not silently reconcile it.

---

# 3. Inspect the actual implementation

Read in full:

```text
hosted/src/lib/update.ts
hosted/src/pages/api/comparisons/[publicId].ts
hosted/test/update.test.mjs
hosted/test/comparisons-update-route.test.mjs
```

Inspect relevant pre-existing dependencies/contracts only where necessary:

```text
hosted/src/lib/publish.ts
hosted/src/lib/hosted-identifiers.ts
hosted/src/db/schema.ts
hosted/src/db/client.ts
hosted/src/lib/asset-storage.ts
hosted/src/lib/image-processing.ts
hosted/src/lib/branding-processing.ts
```

Do not modify any of them.

Review the implementation itself, not only the Gate-3 report.

---

# 4. Scope compliance review

Confirm Phase 7 changed/created only the four approved new files:

```text
hosted/src/lib/update.ts
hosted/src/pages/api/comparisons/[publicId].ts
hosted/test/update.test.mjs
hosted/test/comparisons-update-route.test.mjs
```

Confirm no existing Phase-6 file was modified.

Confirm no changes exist in:

```text
hosted/src/db/schema.ts
hosted/src/db/client.ts
hosted/drizzle/**
hosted/package.json
hosted/pnpm-lock.yaml
hosted/pnpm-workspace.yaml
hosted/astro.config.mjs
hosted/tsconfig.json
hosted/app.js
docs/**
.github/**
```

Also confirm no unrelated refactor, shared-validator extraction, schema change, migration, dependency addition, or config change was introduced.

---

# 5. Authorization review

Verify from code:

- route target is `publicId`;
- plaintext `managementToken` is supplied only in the request body/multipart data;
- token is hashed using the existing `hashManagementToken()` helper;
- plaintext token is never persisted;
- plaintext token is never returned;
- plaintext token is never logged;
- early authorization lookup uses both:
  - `public_id`
  - `management_token_hash`
- unauthorized/unknown target returns before image processing and permanent storage;
- final activation again uses both:
  - `public_id`
  - `management_token_hash`
- the final guarded UPDATE is authoritative;
- unknown public ID and wrong management token are externally neutral/indistinguishable.

Do not accept a design where the early SELECT alone grants authority.

---

# 6. Complete-state replacement review

Verify Update implements a complete Hosted snapshot replacement, not patch semantics.

Confirm the request contract includes the full approved Hosted Presentation state:

Required:

```text
referenceLabel
captureLabel
showDate
background
cornerStyle
```

Optional/nullable according to the approved model:

```text
title
description
locationDisplayName
locationCity
locationCountry
brandingType
brandingBuiltinId
```

Binary assets:

```text
reference  required
capture    required
branding   custom branding only
```

Confirm no `comparisonId` is accepted as Update authority/target input.

Confirm unknown structured payload fields are rejected consistently with Publish.

Confirm branding consistency rules match the approved Phase-6 behavior.

---

# 7. Prepare → validate → store → activate review

Verify the actual sequence in code:

1. validate request/presentation state;
2. hash management token;
3. early authorized target lookup;
4. process core images through Phase 5;
5. process custom branding through Phase 5 where required;
6. generate fresh asset version;
7. store all required assets under the existing internal publication ID;
8. perform one final guarded activation UPDATE;
9. classify result.

Verify no live DB state changes before activation.

Verify invalid/unauthorized requests cannot force permanent asset writes.

---

# 8. Atomic activation review

Verify the final activation is one guarded DB UPDATE.

Confirm exactly these mutable fields are replaced:

```text
title
description
reference_label
capture_label
show_date
location_display_name
location_city
location_country
branding_type
branding_builtin_id
background
corner_style
active_asset_version
```

Confirm these remain unchanged:

```text
id
comparison_id
public_id
management_token_hash
created_at
status
```

Confirm `updated_at` remains handled by the schema's existing on-update behavior.

Confirm no explicit staging state, no new transaction abstraction, and no multi-row/table transaction was introduced.

Determine whether the single guarded UPDATE genuinely satisfies the approved atomicity requirement.

---

# 9. Asset-version lifecycle review

Verify:

- every authorized Update prepares a fresh immutable `assetVersion`;
- existing internal publication ID is reused;
- new internal publication ID is never generated;
- public ID is never regenerated;
- management token is never regenerated;
- `reference.webp` and `capture.webp` are written to the fresh version;
- `branding.webp` only exists for custom branding in the new version;
- switching away from custom branding results in a new version without `branding.webp`;
- old active version remains physically untouched;
- old version is not deleted;
- partially written or never-activated new versions are not synchronously deleted;
- Phase 10 remains responsible for cleanup.

Confirm Phase 4 storage APIs were reused without modification.

---

# 10. Failure-invariant review

For each failure class, verify the old live Publication remains intact until activation succeeds:

- malformed payload;
- missing required binary;
- invalid core image;
- invalid branding image;
- unknown public ID;
- wrong management token;
- partial asset write failure;
- final guarded UPDATE affects zero rows;
- unexpected DB error.

Explicitly determine whether any failure path can partially mutate the live row.

If yes, Phase 7 fails completion.

---

# 11. Concurrent Update review

Inspect the implementation and tests for concurrent authorized Updates.

Verify the approved semantics:

```text
last successful atomic activation wins
```

Confirm:

- both concurrent Updates may succeed;
- each writes its own complete asset version;
- final row corresponds to one complete snapshot;
- final row cannot contain a mixture of fields from different Updates;
- no ETag/version-lock/schema mechanism was introduced;
- superseded version remains a cleanup candidate.

If the tests only inspect one field and do not actually prove a coherent final snapshot across multiple mutable fields, identify that evidence gap explicitly.

Do not assume the test is sufficient merely because it passed.

---

# 12. Route/API review

Verify:

```text
PUT /api/comparisons/{publicId}
```

maps exactly:

```text
updated           -> 200 {}
validation-failed -> 400 {"error":"validation_failed"}
not-found         -> 404 {"error":"not_found"}
internal-failure  -> 500 {"error":"internal_failure"}
```

Confirm wrong token and unknown public ID produce the same external status/body.

Confirm no management token or management state is echoed.

Confirm route remains an HTTP adapter only and contains no DB/storage/image-processing orchestration.

Remember this route remains provisional pending Phase 12; that is not a Phase-7 blocker.

---

# 13. Test-coverage review

Review the actual assertions in:

```text
hosted/test/update.test.mjs
hosted/test/comparisons-update-route.test.mjs
```

Do not rely only on test names.

Verify coverage for the Phase-7 completion-critical requirements:

### Authorized success

- public ID preserved;
- internal ID preserved;
- comparison ID preserved;
- management-token hash preserved;
- created timestamp preserved;
- no plaintext/replacement token;
- all mutable presentation/content state replaced;
- `showDate=true`;
- `showDate=false`;
- fresh active asset version;
- new core WebP assets exist under existing internal ID;
- old version remains;
- custom branding;
- transition away from custom branding.

### Failure safety

- invalid core image leaves old row/version active;
- invalid custom branding leaves old row/version active;
- partial storage failure leaves old row/version active;
- final zero-row activation leaves old row intact where applicable.

### Authorization

- wrong token modifies nothing;
- unknown public ID modifies nothing;
- external result is identical;
- early rejection causes no processing/storage.

### Concurrency

- concurrent authorized Updates produce a coherent final state;
- no partial/mixed snapshot.

### Route

- success;
- validation failure;
- unauthorized;
- unknown target;
- internal failure if implemented/testable without production-code distortion;
- no secret leakage.

If a completion-critical requirement is untested or only superficially asserted, state whether it is a blocker under the actual Phase-7 plan.

---

# 14. Verification evidence assessment

Gate 3 reported:

```text
node --test test/update.test.mjs
→ 20/20 passed

node --test test/comparisons-update-route.test.mjs
→ 5/5 passed

pnpm --dir hosted test
→ 141/141 passed, 37 suites

pnpm --dir hosted typecheck
→ 0 errors, 0 warnings, 2 pre-existing hints

pnpm --dir hosted build
→ succeeded

pnpm typecheck
→ 0 errors, 0 warnings, 77 pre-existing hints
```

If repository state and the four Phase-7 files are unchanged since those runs, accept this evidence without rerunning expensive checks.

Perform only narrow read-only checks where useful to confirm:

- local `comparisons` row count;
- migration metadata unchanged;
- `hosted/data/` absent/clean.

Do not delete anything during Gate 4.

If unknown runtime data exists, report it; do not clean it.

---

# 15. Production/runtime scope review

Confirm Phase 7 did not:

- touch production DB;
- run production migration;
- change deployment;
- change Passenger/runtime config;
- add new environment variables;
- alter production storage configuration.

Production verification is not part of Phase 7 unless the implementation plan explicitly says otherwise.

---

# 16. Documentation follow-up

Do not modify docs during Gate 4.

If Phase 7 passes, determine the minimal follow-up.

Expected:

```text
docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md

Phase 7 – Hosted Update API
Status: Planned → Completed
```

Verify the actual current status first.

If another approved source-of-truth document genuinely needs updating because implementation differs from the already-approved behavior, identify it. Do not edit it now.

---

# Acceptance rule

Accept Phase 7 only if the actual code and evidence prove the approved objective and completion criteria.

Do not accept merely because 141 tests are green.

A blocker includes, for example:

- unauthorized content can reach processing/storage before authority is checked;
- final activation is not guarded by token authority;
- live row can be partially mutated before full readiness;
- public identity or management authority changes;
- failed processing/storage can replace the active row/version;
- concurrency can create mixed state;
- a completion-critical requirement lacks evidence;
- scope expanded beyond Gate 2.

If a blocker is found:

- do not fix it;
- state the exact blocker;
- STOP.

---

# Required Gate-4 report

Return:

# Phase 7 Gate 4 — Completion Review

## 1. Repository state
## 2. Phase-7 objective and completion criteria
## 3. Actual changed files
## 4. Scope compliance
## 5. Authorization review
## 6. Complete-state replacement review
## 7. Prepare → validate → store → activate review
## 8. Atomic activation review
## 9. Asset-version lifecycle review
## 10. Failure-invariant review
## 11. Concurrent Update review
## 12. Route/API review
## 13. Test-coverage review
## 14. Verification evidence assessment
## 15. Database/runtime cleanup state
## 16. Remaining risks
## 17. Documentation follow-up
## 18. Completion-criteria assessment
## 19. Gate result

For §18, use a concise table:

```text
Criterion | Result | Evidence
```

Explicitly answer:

- Is the authorized Update operation complete for Phase 7?
- Does the public link remain unchanged?
- Are internal ID, comparison ID, management-token hash, and created timestamp preserved?
- Is plaintext management authority persisted, returned, or logged anywhere?
- Are unauthorized and unknown targets externally neutral?
- Can unauthorized callers trigger image processing/permanent storage?
- Does the final activation re-check management authority?
- Is activation atomic across all mutable presentation fields + `active_asset_version`?
- Does failed processing leave the previous Publication fully intact?
- Does partial asset write failure leave the previous Publication fully intact?
- Does a zero-row final activation leave the previous Publication intact?
- Do concurrent valid Updates produce a coherent complete final snapshot?
- Does the old asset version remain present?
- Is cleanup execution still deferred to Phase 10?
- Are Phase-7 tests fully green?
- Is the full Hosted suite green?
- Are synthetic DB rows absent?
- Is migration metadata unchanged?
- Is `hosted/data/` absent/clean?
- Did Phase 7 introduce any later-phase behavior?
- Is any blocker left before marking Phase 7 Completed?

If all completion criteria pass, state exactly:

```text
Phase 7 is ready to be accepted as Completed.
```

Otherwise state:

```text
Phase 7 is not ready to be accepted as Completed.
```

and identify the exact blocker.

Do NOT mark Phase 7 Completed yourself.

Do NOT edit documentation.

Do NOT commit.

Do NOT push.

Do NOT deploy.

Do NOT begin Phase 8.

STOP after Gate 4.
