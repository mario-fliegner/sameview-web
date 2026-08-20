# SameView Hosted Comparison — Phase 6 Gate 3D — Retry Exhaustion Off-by-One Correction
## Prompt ID: SV-HOSTED-P6-G3D-001

Phase 6 Gate 3 remains open.

Gate 3C successfully resolved the DB-pool teardown problem:

- `comparisons-route.test.mjs` now exits normally;
- `publish.test.mjs` now exits normally;
- the full Hosted test suite now exits normally;
- no synthetic DB rows remain;
- no attributable runtime asset files remain;
- migration metadata is unchanged.

Exactly one Phase-6 failure remains:

```text
retry exhaustion after 5 attempts is deterministic and creates no row
expected generator calls: 5
actual generator calls:   6
```

Gate 3B/3C already identified the root cause in `hosted/src/lib/publish.ts`:

the retry loop regenerates the colliding identifier inside the `catch` block after every failed INSERT attempt, including after the fifth/final allowed attempt. That sixth generated value is never used because the loop exits immediately afterward.

This iteration addresses only that one defect.

Do not change any other behavior.

---

# Objective

Correct the generated-identifier retry loop so that:

- the maximum number of INSERT attempts remains exactly 5;
- the colliding identifier is regenerated only when another INSERT attempt will actually occur;
- no unused sixth identifier/token is generated after the final failed attempt;
- public-ID collisions still regenerate only `publicId`;
- management-token-hash collisions still regenerate only the management token/hash;
- already-written assets are reused across retries;
- `comparison_id` remains non-retryable;
- retry exhaustion still returns internal failure;
- no DB row is created on exhaustion;
- no synchronous orphan cleanup is introduced.

---

# Step 1 — Pre-flight

Verify:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected:

```text
branch: main
HEAD:   737c42f585d1202f6d2de5754acde16347709a73
```

Expected current working-tree footprint:

```text
 M hosted/src/db/client.ts
?? hosted/src/lib/hosted-identifiers.ts
?? hosted/src/lib/publish.ts
?? hosted/src/pages/api/comparisons.ts
?? hosted/test/comparisons-route.test.mjs
?? hosted/test/hosted-identifiers.test.mjs
?? hosted/test/publish.test.mjs
```

`hosted/src/db/client.ts` must already contain both accepted corrective changes:

1. `import * as schema from "./schema.ts";`
2. exported `closeDb()` used by the affected tests.

Do not alter those Gate-3A/3C changes in this iteration.

If baseline differs materially, STOP and report.

---

# Step 2 — Confirm the exact defect before editing

Read the retry loop in:

```text
hosted/src/lib/publish.ts
```

and the failing assertion in:

```text
hosted/test/publish.test.mjs
```

Confirm:

- the loop permits exactly 5 INSERT attempts;
- on the fifth failed generated-ID collision, the current code regenerates the colliding identifier/token once more;
- that newly-generated sixth value is never used in another INSERT;
- the current failing test correctly observes generator call count `6` instead of the approved `5`.

No implementation change until this is reconfirmed.

If the observed root cause differs, STOP and report.

---

# Approved file scope

Modify only:

```text
hosted/src/lib/publish.ts
```

Do not modify the test expectation merely to make the test pass.

Do not modify:

```text
hosted/test/publish.test.mjs
hosted/test/comparisons-route.test.mjs
hosted/test/hosted-identifiers.test.mjs
hosted/src/lib/hosted-identifiers.ts
hosted/src/pages/api/comparisons.ts
hosted/src/db/client.ts
hosted/src/db/schema.ts
hosted/package.json
hosted/pnpm-lock.yaml
hosted/tsconfig.json
hosted/drizzle/**
docs/**
.github/**
```

No new file.
No dependency/config/schema/documentation change.

If the correct fix requires touching another file, STOP and report.

---

# Implementation rule

Make the smallest change necessary to the retry loop.

The approved semantics are:

```text
MAX_GENERATED_ID_ATTEMPTS = 5
```

Interpretation:

```text
maximum total INSERT attempts = 5
```

For generated collisions:

### public_id collision

If the current attempt is NOT the final allowed attempt:

- generate a new `publicId`;
- retry INSERT.

If the current attempt IS the fifth/final allowed attempt:

- do NOT generate another `publicId`;
- exit with internal failure.

### management_token_hash collision

If the current attempt is NOT the final allowed attempt:

- generate a new management token;
- recompute its hash;
- retry INSERT.

If the current attempt IS the fifth/final allowed attempt:

- do NOT generate another token/hash;
- exit with internal failure.

### comparison_id collision

Unchanged:

- no retry;
- neutral conflict result immediately.

### unknown DB error

Unchanged:

- internal failure immediately.

Keep:
- same internal publication ID;
- same asset version;
- same already-written assets;
- same non-colliding generated identifier across retries.

Do not introduce a new helper/module unless absolutely necessary. Prefer a local conditional in the existing retry loop.

Do not restructure the whole Publish service.

---

# Verification

Run the most targeted test first:

```bash
node --test hosted/test/publish.test.mjs
```

or equivalent from the `hosted/` directory.

Required:

- process exits normally;
- all publish tests pass;
- retry-exhaustion test now observes exactly 5 generator calls;
- no other assertion changes/failures.

Then run:

```bash
pnpm --dir hosted test
pnpm --dir hosted typecheck
pnpm --dir hosted build
pnpm typecheck
```

Expected:
- full Hosted suite completes normally;
- full Hosted suite is green;
- no DB-pool hang returns;
- no type/build regression.

---

# Database and runtime cleanup verification

Before DB-backed tests:

- record current `comparisons` row count;
- record migration metadata state;
- inspect whether `hosted/data/` contains any pre-existing runtime assets.

Do not delete unknown/pre-existing data.

After testing:

- confirm all synthetic rows are removed;
- confirm migration metadata unchanged;
- inspect `hosted/data/`.

Conflict tests may create unreferenced asset versions by design because Phase 10 owns orphan cleanup.

If test-created assets remain:

1. prove they were created by this test execution;
2. prove no pre-existing/unknown data is mixed in;
3. only then remove those attributable test artifacts.

Do not delete unknown runtime data.

Confirm no Node process remains alive because of the DB pool.

---

# Scope verification

At the end run:

```bash
git status --short
git diff --check
git diff --stat
git diff -- hosted/src/lib/publish.ts
```

The only file modified during this iteration must be:

```text
hosted/src/lib/publish.ts
```

The pre-existing Phase-6/Gate-3A/Gate-3C working-tree changes must remain otherwise untouched.

Explicitly verify protected tracked files remain unchanged.

---

# STOP conditions

STOP and report instead of expanding scope if:

- the root cause differs from the proven final-attempt regeneration issue;
- fixing it requires changing a test;
- another file must change;
- the fix alters the 5-INSERT-attempt contract;
- the fix changes which identifier is regenerated;
- a new test failure appears after the off-by-one is fixed;
- the full Hosted suite hangs again;
- DB cleanup cannot be completed without touching unknown/pre-existing data;
- runtime asset cleanup cannot be safely attributed.

---

# Required report

Return:

# Phase 6 Gate 3D — Retry Exhaustion Off-by-One Correction Report

## 1. Pre-flight repository state
## 2. Root-cause reconfirmation
## 3. Changed file
## 4. Exact retry-loop correction
## 5. Retry semantics after correction
## 6. Isolated publish-test result
## 7. Full Hosted test-suite result
## 8. Hosted typecheck/build result
## 9. Root typecheck result
## 10. Database cleanup/state verification
## 11. Runtime asset cleanup/state verification
## 12. Scope verification
## 13. Remaining failures, if any
## 14. Gate result

Explicitly state:

- exact total/pass/fail count for `publish.test.mjs`;
- exact total/pass/fail count for the full Hosted suite;
- generator call count on retry exhaustion;
- total INSERT-attempt behavior remains exactly 5;
- whether any other assertion failed;
- whether any synthetic DB row remains;
- whether any attributable runtime test asset remains;
- whether migration metadata changed;
- whether the test suite exits normally;
- exact final `git status --short`;
- whether any file other than `hosted/src/lib/publish.ts` changed during this iteration.

Do NOT mark Phase 6 Completed.
Do NOT update documentation.
Do NOT commit.
Do NOT push.
Do NOT deploy.

If all tests pass after this correction, state that Phase 6 Gate 3 implementation is ready for Gate 4 completion review.

End with:

`STOP after Gate 3D.`
