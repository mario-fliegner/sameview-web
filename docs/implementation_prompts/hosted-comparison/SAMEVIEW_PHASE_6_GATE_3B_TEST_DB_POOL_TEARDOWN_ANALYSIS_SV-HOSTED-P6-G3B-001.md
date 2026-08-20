# SameView Hosted Comparison — Phase 6 Gate 3B — Test DB Pool Teardown Analysis
## Prompt ID: SV-HOSTED-P6-G3B-001

Phase 6 Gate 3 remains open.

Gate 3A proved that the one-line import correction in `hosted/src/db/client.ts` fixes the original native-Node module-resolution failure. `comparisons-route.test.mjs` loaded and passed 10/10 tests.

A new, separate problem was then observed: the complete `pnpm --dir hosted test` run did not terminate. The current working hypothesis is that the module-level MySQL pool created by `hosted/src/db/client.ts` remains open after DB-backed Phase-6 tests.

This iteration is **analysis and scope proposal only**. Do not implement a fix.

# Goal

Determine the proven root cause of the test-runner hang and identify the smallest, architecture-preserving correction.

Do not assume that exporting `closeDb()`, changing the tests to use injected DB instances, or any other proposed option is correct until the repository and runtime evidence proves it.

---

## Step 1 — Pre-flight

Verify:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected branch/HEAD:

```text
main
737c42f585d1202f6d2de5754acde16347709a73
```

Expected working tree includes:

```text
 M hosted/src/db/client.ts
?? hosted/src/lib/hosted-identifiers.ts
?? hosted/src/lib/publish.ts
?? hosted/src/pages/api/comparisons.ts
?? hosted/test/comparisons-route.test.mjs
?? hosted/test/hosted-identifiers.test.mjs
?? hosted/test/publish.test.mjs
```

The only modification from Gate 3A in an existing file should still be:

```diff
-import * as schema from "./schema";
+import * as schema from "./schema.ts";
```

If repository state differs materially, STOP and report.

---

## Step 2 — Inspect only relevant implementation

Read at minimum:

```text
hosted/src/db/client.ts
hosted/src/lib/publish.ts
hosted/src/pages/api/comparisons.ts
hosted/test/publish.test.mjs
hosted/test/comparisons-route.test.mjs
hosted/test/hosted-identifiers.test.mjs
hosted/package.json
hosted/tsconfig.json
```

Also inspect any directly relevant existing DB-client pattern in the root application if it helps determine whether SameView already has a proven lifecycle/teardown convention.

Do not inspect or redesign unrelated Hosted phases.

---

## Step 3 — Prove the hang source

Do not rely only on the previous "most likely cause" statement.

Use the smallest targeted experiments necessary to determine whether the open shared MySQL pool is actually what keeps the Node test worker/process alive.

Useful evidence may include:

- running only `comparisons-route.test.mjs`;
- running only `publish.test.mjs`;
- observing whether test assertions finish but the process stays alive;
- inspecting active Node handles/resources if practical without adding dependencies or modifying repository files;
- inspecting MySQL `PROCESSLIST` / `INNODB_TRX`;
- comparing with `hosted-identifiers.test.mjs`, which owns and closes its own pool;
- inspecting whether `publish()` already exposes dependency injection sufficient for tests to avoid the singleton DB client;
- determining whether merely importing `publish.ts` creates the singleton pool before injected dependencies can replace it.

Do not create a permanent repository change for diagnosis.

Temporary shell/runtime diagnostics are allowed if they leave no repository diff and no persistent DB/runtime-data residue.

If a targeted test hangs, terminate only the process(es) created by that diagnostic after collecting enough evidence.

Before and after DB-backed diagnostics:

- record `comparisons` row count;
- do not delete unknown/pre-existing rows;
- clean up only synthetic rows attributable to this diagnostic;
- verify migration metadata remains unchanged.

Before deleting any runtime assets, prove they were created by this diagnostic and are not pre-existing user/runtime data.

---

## Step 4 — Compare minimal correction options

Once the root cause is proven, evaluate the smallest realistic fixes against the existing architecture.

At minimum compare these possibilities if they are technically applicable:

### Option A — Explicit lifecycle function in `client.ts`

For example, expose a narrowly-scoped function that closes the existing module-level pool for tests/process teardown.

Determine:

- exact file(s) that would change;
- whether production/runtime behavior remains unchanged unless the function is explicitly called;
- whether both `publish.test.mjs` and `comparisons-route.test.mjs` can use it safely;
- whether closing the singleton in one Node test file can interfere with another test file/worker;
- whether Node's test-runner process isolation makes this safe.

### Option B — Test-owned DB dependency injection

Investigate whether `publish()`'s existing `deps.db` seam allows DB-backed tests to construct, own, and close their own pool without using the singleton.

Critically determine:

- whether importing `publish.ts` still imports `client.ts` eagerly and therefore creates the singleton pool anyway;
- whether this option actually eliminates the open handle or merely adds a second closeable pool;
- whether changing import structure/lazy defaults would be required;
- whether route tests can still exercise the real route without importing/creating the singleton.

### Option C — Any smaller proven existing pattern

If the repository already contains a better established lifecycle pattern, document it. Do not invent a broader abstraction merely because it is possible.

Choose the simplest option that:

- fixes the proven root cause;
- preserves production behavior;
- avoids dependency/config changes;
- avoids architecture redesign;
- permits the real Phase-6 tests to execute and terminate normally;
- does not weaken the real-DB coverage already requested.

---

## Step 5 — Scope proposal only

After analysis, propose the exact next implementation scope:

- files;
- exact changes;
- risks;
- exact tests.

Do **not** modify those files yet.

If the minimal fix requires changing `hosted/src/db/client.ts`, that is acceptable to propose; Gate 3A already established this file as the source of the shared DB lifecycle. But implementation still requires approval after this analysis.

Do not expand into Phase 6 product behavior fixes unless the diagnostics actually execute the tests and reveal a separate assertion failure. If that happens, report it separately and do not combine it with the pool-lifecycle fix.

---

# Required report

Return:

# Phase 6 Gate 3B — Test DB Pool Teardown Analysis

## 1. Repository state
## 2. Relevant code paths inspected
## 3. Reproduction of the hang
## 4. Proven root cause
## 5. Why Gate 3A's import correction remains valid
## 6. Option A assessment — explicit client teardown
## 7. Option B assessment — test-owned injected DB
## 8. Other viable option, if any
## 9. Recommended minimal correction
## 10. Exact proposed files
## 11. Exact proposed changes
## 12. Risks
## 13. Exact verification plan
## 14. DB/runtime cleanup state
## 15. Gate result

The report must clearly distinguish:

- observed fact;
- inference;
- proposed change.

State whether `publish.test.mjs` can be made to execute far enough during diagnostics to reveal any assertion failures. If it does reveal failures, list them but do not fix them.

No code changes.
No documentation changes.
No dependency changes.
No migration changes.
No commit.
No push.
No deploy.

End with:

`STOP after Gate 3B analysis.`
