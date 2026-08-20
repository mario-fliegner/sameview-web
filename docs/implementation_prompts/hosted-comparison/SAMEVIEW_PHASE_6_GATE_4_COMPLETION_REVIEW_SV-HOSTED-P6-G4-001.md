# SameView Hosted Comparison — Phase 6 Gate 4 — Completion Review
## Prompt ID: SV-HOSTED-P6-G4-001

Phase 6 Gate 3 implementation is now reported green after three narrowly-scoped corrections:

- Gate 3A: native Node import-resolution correction in `hosted/src/db/client.ts`
- Gate 3C: explicit DB-pool teardown for the affected test workers
- Gate 3D: generated-identifier retry-exhaustion off-by-one correction

Current reported verification baseline:

```text
publish.test.mjs:        30/30 passed
full Hosted test suite: 116/116 passed
Hosted typecheck:       0 errors
Hosted build:           succeeded
root typecheck:         0 errors
comparisons rows:       0 after cleanup
migration metadata:     unchanged
attributable test data: cleaned
```

Do not assume those claims blindly. Gate 4 is a read-only completion review: inspect the actual implementation, relevant specifications, repository state, and existing Gate-3 evidence, then determine whether Phase 6 genuinely satisfies its approved completion criteria.

Do not implement anything during this gate.

---

# Step 1 — Repository state

Verify:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected branch/HEAD:

```text
branch: main
HEAD:   737c42f585d1202f6d2de5754acde16347709a73
```

Expected Phase-6 working-tree footprint:

```text
 M hosted/src/db/client.ts
?? hosted/src/lib/hosted-identifiers.ts
?? hosted/src/lib/publish.ts
?? hosted/src/pages/api/
?? hosted/test/comparisons-route.test.mjs
?? hosted/test/hosted-identifiers.test.mjs
?? hosted/test/publish.test.mjs
```

Resolve the exact file under `hosted/src/pages/api/` rather than relying on the directory shorthand.

If repository state has materially drifted from Gate 3D, STOP and report before reviewing completion.

---

# Step 2 — Re-read the Phase 6 source of truth

Inspect the relevant Phase-6 section in:

```text
docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md
```

Also inspect only the directly relevant approved specifications needed to verify Phase-6 behavior, especially:

```text
docs/ARCHITECTURE.md
docs/DATA_AND_PRIVACY.md
docs/FEATURE_SPECIFICATION.md
docs/APPLICATION_LAYOUT.md
docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md
```

Use the actual current repository copies.

Do not reopen unrelated product decisions.

Identify the exact Phase-6:

- objective;
- non-goals;
- required Publish behavior;
- identifier/token requirements;
- persistence requirements;
- asset-storage requirements;
- conflict behavior;
- verification/completion criteria.

If documentation conflicts with implementation, report the conflict. Do not silently rationalize it.

---

# Step 3 — Review the actual Phase-6 implementation

Read in full:

```text
hosted/src/lib/hosted-identifiers.ts
hosted/src/lib/publish.ts
hosted/src/pages/api/comparisons.ts
hosted/src/db/client.ts
hosted/test/hosted-identifiers.test.mjs
hosted/test/publish.test.mjs
hosted/test/comparisons-route.test.mjs
```

Read relevant existing dependencies/contracts as necessary, without modifying them:

```text
hosted/src/db/schema.ts
hosted/src/lib/asset-storage.ts
hosted/src/lib/image-processing.ts
hosted/src/lib/branding-processing.ts
```

Review the final implementation as a whole, including the corrective changes from Gates 3A/3C/3D.

Specifically verify, from code rather than reports:

## Identifiers and secrets

- internal publication ID generation;
- public ID format/entropy/alphabet/length;
- management token generation;
- management token hash storage;
- plaintext management token is not persisted;
- plaintext token is returned only where approved;
- collision handling is bounded and deterministic.

## Publish input and validation

- accepted request shape;
- required comparison ID;
- Hosted Presentation payload handling;
- required core image assets;
- optional branding behavior;
- use of the Phase-5 processing pipeline;
- malformed/unsupported input behavior;
- no trust in client-side preprocessing beyond the approved contract.

## Persistence and atomic uniqueness

- assets are written under the correct internal publication ID/version structure;
- DB row points to the active asset version;
- `UNIQUE(comparison_id)` arbitrates concurrent duplicate Publish attempts;
- there is no check-then-insert race replacing DB enforcement;
- `comparison_id` conflict returns the approved neutral not-created/conflict behavior;
- generated `public_id` and management-token-hash collisions retry correctly;
- maximum INSERT attempts remain exactly 5;
- final failed attempt does not generate an unused sixth identifier/token;
- non-colliding generated identity remains stable across retries;
- already-written assets are reused across retries;
- unknown DB failures are not disguised as ordinary conflicts.

## Presentation persistence

Confirm all Phase-6-required Hosted Presentation state is represented correctly, including the already-corrected independent Date visibility persistence:

```text
show_date
```

Confirm `reference_label` and `capture_label` remain required persisted labels rather than being overloaded as visibility state.

## Scope boundaries

Confirm Phase 6 does NOT implement later-phase responsibilities such as:

- Update;
- Delete;
- Resolve;
- management-session behavior;
- public viewer;
- actual stale/orphan cleanup;
- reporting/rate limiting;
- production deployment/provisioning.

---

# Step 4 — Review the tests

Determine whether the committed/untracked Phase-6 tests actually exercise the completion-critical behavior rather than merely existing.

At minimum verify coverage for:

- identifier format and generation;
- management token hashing;
- successful Publish;
- core image processing/storage;
- branding path if applicable;
- persisted metadata/presentation fields;
- `show_date`;
- duplicate `comparison_id`;
- generated public-ID collision retry;
- management-token-hash collision retry;
- retry exhaustion;
- exactly 5 generator/INSERT attempts where required;
- no unused sixth generated value;
- concurrent duplicate Publish behavior if required by the approved Phase-6 completion criteria;
- route-level success and error mapping;
- test DB cleanup;
- explicit DB-pool teardown.

Do not add tests during Gate 4.

If a completion-critical requirement is untested and the plan explicitly requires direct verification, identify it as a blocker rather than inventing evidence.

---

# Step 5 — Verification evidence

Use the existing Gate-3D green evidence if repository state and implementation are unchanged.

Do not rerun expensive checks merely for repetition.

However, perform targeted read-only/local checks where needed to validate current state or resolve uncertainty.

Gate 3D reported:

```text
node --test test/publish.test.mjs
→ 30/30 passed

pnpm --dir hosted test
→ 116/116 passed

pnpm --dir hosted typecheck
→ 0 errors, 0 warnings, 2 pre-existing hints

pnpm --dir hosted build
→ succeeded

pnpm typecheck
→ 0 errors, 0 warnings, 77 pre-existing hints
```

Confirm that nothing has changed since those runs that would invalidate them.

Also confirm current local DB state read-only:

- `comparisons` contains no synthetic test rows;
- migration metadata still contains the same migrations/hashes;
- no production DB is involved.

Inspect `hosted/data/` without deleting anything. Gate 3D reported it absent after cleanup.

If new/unknown runtime data exists, report it; do not delete it during Gate 4.

---

# Step 6 — Scope compliance

Confirm the final Phase-6 footprint contains no unauthorized change to:

```text
hosted/src/db/schema.ts
hosted/drizzle/**
hosted/package.json
hosted/pnpm-lock.yaml
hosted/tsconfig.json
docs/**
.github/**
root application implementation
```

Remember that `hosted/src/db/client.ts` is an approved Phase-6 corrective change and should contain only:

- the `.ts` import-resolution correction;
- the narrow exported `closeDb()` lifecycle function.

No unrelated refactoring should be present there.

---

# Step 7 — Documentation follow-up

Do NOT edit documentation during Gate 4.

If Phase 6 passes, identify the minimal follow-up required to synchronize:

```text
docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md
```

Expected follow-up should normally be only:

```text
Phase 6 – Hosted Publish API
Status: Planned → Completed
```

But verify the actual current status and wording first.

If implementation introduced a behavior that genuinely requires another approved source-of-truth document to be updated, identify it explicitly. Do not edit it now.

---

# Acceptance rule

Accept Phase 6 only if the actual code and evidence establish that its approved objective and completion criteria are met.

Do not accept merely because all tests are green.

If you find:

- a specification mismatch;
- missing required persistence;
- incorrect secret handling;
- incorrect collision/concurrency semantics;
- incorrect asset/version linkage;
- an unverified completion-critical requirement;
- scope creep;
- test evidence invalidated by current repository state;

then Phase 6 is NOT ready for completion. State the exact blocker and STOP. Do not fix it in Gate 4.

---

# Required report

Return:

# Phase 6 Gate 4 — Completion Review

## 1. Repository state
## 2. Phase-6 objective and completion criteria
## 3. Actual changed files
## 4. Scope compliance
## 5. Identifier and secret-handling review
## 6. Publish input/validation review
## 7. Asset processing/storage review
## 8. Persistence and atomic-uniqueness review
## 9. Retry/collision review
## 10. Presentation-persistence review
## 11. Route/API behavior review
## 12. Test-coverage review
## 13. Verification evidence assessment
## 14. Database/runtime cleanup state
## 15. Remaining risks
## 16. Documentation follow-up
## 17. Completion-criteria assessment
## 18. Gate result

For the completion-criteria assessment, use a concise table:

```text
Criterion | Result | Evidence
```

Explicitly answer:

- Is the Publish API implementation complete for Phase 6?
- Is concurrent duplicate Publish safely arbitrated by the database?
- Is plaintext management authority persisted anywhere?
- Are generated-ID retries bounded to exactly 5 INSERT attempts?
- Is the final-attempt unused-generation defect gone?
- Are already-written assets reused across retries?
- Is `show_date` correctly persisted?
- Are Phase-6 tests fully green?
- Does the full Hosted suite terminate normally?
- Are synthetic DB rows absent?
- Is migration metadata unchanged?
- Is `hosted/data/` clean/absent?
- Did Phase 6 introduce any later-phase behavior?
- Is any blocker left before marking Phase 6 Completed?

If all criteria pass, state exactly:

`Phase 6 is ready to be accepted as Completed.`

Do NOT mark it Completed yourself.
Do NOT edit documentation.
Do NOT commit.
Do NOT push.
Do NOT deploy.

End with:

`STOP after Gate 4.`
