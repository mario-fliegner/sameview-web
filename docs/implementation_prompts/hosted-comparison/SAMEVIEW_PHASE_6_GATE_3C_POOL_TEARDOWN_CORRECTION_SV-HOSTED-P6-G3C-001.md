# SameView Hosted Comparison — Phase 6 Gate 3C — Pool Teardown Correction
## Prompt ID: SV-HOSTED-P6-G3C-001

Phase 6 Gate 3 remains open.

Gate 3B proved the test-runner hang is caused by the eagerly-created module-level MySQL pool in `hosted/src/db/client.ts`, which is never closed in the two Phase-6 test workers that transitively import it.

Gate 3B also discovered a separate retry-loop off-by-one defect in `publish.ts`. **Do not fix that defect in this iteration.** This prompt addresses one problem only: DB-pool teardown.

# Objective

Implement only the approved minimal pool-teardown correction:

- expose an explicit teardown function for the Hosted singleton DB pool;
- call it from the two affected Phase-6 test files;
- verify the isolated tests and complete Hosted test suite terminate normally.

Do not change Phase-6 product behavior.

---

## Step 1 — Pre-flight

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

Expected working-tree footprint:

```text
 M hosted/src/db/client.ts
?? hosted/src/lib/hosted-identifiers.ts
?? hosted/src/lib/publish.ts
?? hosted/src/pages/api/comparisons.ts
?? hosted/test/comparisons-route.test.mjs
?? hosted/test/hosted-identifiers.test.mjs
?? hosted/test/publish.test.mjs
```

`hosted/src/db/client.ts` must still differ from HEAD only by the Gate-3A import-resolution correction:

```diff
-import * as schema from "./schema";
+import * as schema from "./schema.ts";
```

If the baseline differs materially, STOP and report.

---

# Approved files

Modify only:

```text
hosted/src/db/client.ts
hosted/test/publish.test.mjs
hosted/test/comparisons-route.test.mjs
```

The six pre-existing Phase-6 files otherwise remain as they are.

Do not modify:

```text
hosted/src/lib/publish.ts
hosted/src/lib/hosted-identifiers.ts
hosted/src/pages/api/comparisons.ts
hosted/test/hosted-identifiers.test.mjs
hosted/package.json
hosted/pnpm-lock.yaml
hosted/tsconfig.json
hosted/src/db/schema.ts
hosted/drizzle/**
docs/**
root application files
```

No dependency/config/schema/migration/documentation change.

---

# Exact implementation

## 1. `hosted/src/db/client.ts`

Preserve the Gate-3A import correction:

```ts
import * as schema from "./schema.ts";
```

Add exactly one narrow exported lifecycle function using the existing module-level `pool`:

```ts
export async function closeDb(): Promise<void> {
	await pool.end();
}
```

Do not restructure pool creation.
Do not make it lazy.
Do not rename `db`.
Do not change connection configuration.
Do not change production call sites.

## 2. `hosted/test/publish.test.mjs`

Import `closeDb` from the existing Hosted DB client module.

In the file's existing top-level cleanup/`after()` lifecycle, call:

```js
await closeDb();
```

The close must occur after the test's existing DB/filesystem cleanup that still needs the shared pool.

Do not change assertions, retry expectations, fixtures, concurrency behavior, or product logic.

In particular, **do not change the currently failing retry-exhaustion assertion**:

```text
expected generator calls: 5
actual current implementation: 6
```

That is a separate defect for the next scoped iteration.

## 3. `hosted/test/comparisons-route.test.mjs`

Import `closeDb` from the existing Hosted DB client module.

In the existing top-level cleanup/`after()` lifecycle, call:

```js
await closeDb();
```

Again, close only after cleanup operations that require the pool.

Do not alter route assertions or cleanup semantics otherwise.

---

# Verification

Before running DB-backed tests, record:

- current `comparisons` row count;
- current `__drizzle_migrations` state;
- whether `hosted/data/` contains any pre-existing runtime assets.

Do not delete unknown/pre-existing rows or runtime files.

Then run the following in this order.

## A. Control

```bash
node --test hosted/test/hosted-identifiers.test.mjs
```

(or the equivalent command from the `hosted/` working directory).

Expected: exits normally and remains green.

## B. Route test in isolation

Run only:

```text
comparisons-route.test.mjs
```

Required result:

- all assertions execute;
- final Node test summary prints;
- process exits normally without timeout/manual termination;
- no idle MySQL connection from that worker remains afterward.

## C. Publish test in isolation

Run only:

```text
publish.test.mjs
```

Required pool-teardown result:

- all test bodies execute;
- final Node test summary prints;
- process exits normally without timeout/manual termination.

**Important:** Gate 3B already proved one assertion currently fails because `publish.ts` regenerates an identifier after the fifth/final failed INSERT attempt. That failure is expected to remain in this iteration.

Do not fix it here.

Report its exact pass/fail counts and confirm that the process nevertheless exits cleanly.

## D. Full Hosted suite

Run:

```bash
pnpm --dir hosted test
```

Required pool-teardown result:

- the suite completes without hanging;
- aggregate summary prints;
- process exits on its own.

The known retry-loop assertion may make the suite non-green. That is acceptable for this iteration provided it is the only Phase-6 assertion failure and the test process terminates normally.

## E. Static/build checks

Run:

```bash
pnpm --dir hosted typecheck
pnpm --dir hosted build
pnpm typecheck
```

Do not run unrelated root build/lint/test suites.

---

# Cleanup verification

After testing:

- confirm synthetic `comparisons` rows are cleaned up;
- confirm migration metadata is unchanged;
- inspect `hosted/data/`.

The 409/conflict route test may legitimately leave an unreferenced asset version because Phase 6 writes assets before the DB uniqueness conflict and Phase 10 owns actual stale/orphan cleanup. If such assets appear:

1. prove they were created by this test execution;
2. confirm no pre-existing/unknown runtime data is mixed in;
3. only then remove the attributable test artifacts.

Do not delete unknown runtime data.

Also confirm no diagnostic/test Node process remains running because of the DB pool.

---

# Scope discipline

Do not fix the retry-loop defect.

Do not change `MAX_GENERATED_ID_ATTEMPTS`.

Do not change identifier generation.

Do not change Publish validation, persistence, HTTP mapping, storage semantics, or concurrency behavior.

Do not add automatic/global process hooks such as `process.on(...)`.

Do not introduce a generic DB abstraction.

Do not refactor unrelated code.

If the pool-teardown change exposes another new problem, STOP and report it rather than expanding scope.

---

# Required report

Return:

# Phase 6 Gate 3C — Pool Teardown Correction Report

## 1. Pre-flight repository state
## 2. Changed files
## 3. Exact `client.ts` change
## 4. Exact test teardown changes
## 5. Isolated control result
## 6. Isolated route-test result
## 7. Isolated publish-test result
## 8. Full Hosted test-suite result
## 9. Hosted typecheck/build result
## 10. Root typecheck result
## 11. DB cleanup/state verification
## 12. Runtime asset cleanup/state verification
## 13. Scope verification
## 14. Remaining failure(s)
## 15. Gate result

Explicitly answer:

- Does `comparisons-route.test.mjs` now exit normally?
- Does `publish.test.mjs` now exit normally?
- Does the full Hosted suite now exit normally?
- Is the retry-exhaustion call-count failure still present and unchanged?
- Did any other assertion fail?
- Are any synthetic DB rows left?
- Are any attributable test runtime assets left?
- Is migration metadata unchanged?
- What is final `git status --short`?

Do NOT mark Phase 6 Completed.
Do NOT update documentation.
Do NOT commit.
Do NOT push.
Do NOT deploy.

End with:

`STOP after Gate 3C.`
