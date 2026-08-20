# SameView Hosted Comparison — Phase 6 Gate 3A — Node Test Import Resolution Correction
## Prompt ID: SV-HOSTED-P6-G3A-001

The Phase 6 Gate 3 implementation hit a verified STOP condition.

This is a narrow corrective iteration only. Do not continue Phase 6 Gate 3 beyond the correction and verification explicitly authorized below.

# Goal

Unblock Node's native `node --test` loading of the existing Hosted DB client by correcting the pre-existing extensionless TypeScript import in:

```text
hosted/src/db/client.ts
```

Verified failure from Phase 6 Gate 3:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../hosted/src/db/schema'
imported from '.../hosted/src/db/client.ts'
```

Current line:

```ts
import * as schema from "./schema";
```

Proposed correction:

```ts
import * as schema from "./schema.ts";
```

The Phase 6 implementation itself already exists in the working tree as six untracked approved files. Preserve those files exactly unless the verification after this correction exposes a separate defect inside those already-approved Phase-6 files. Do not proactively change them in this corrective step.

---

## Step 1 — Analysis / pre-flight

Before changing anything, verify:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected baseline:

```text
branch: main
HEAD: 737c42f585d1202f6d2de5754acde16347709a73
```

Expected working-tree footprint from the stopped Gate 3:

```text
?? hosted/src/lib/hosted-identifiers.ts
?? hosted/src/lib/publish.ts
?? hosted/src/pages/api/comparisons.ts
?? hosted/test/comparisons-route.test.mjs
?? hosted/test/hosted-identifiers.test.mjs
?? hosted/test/publish.test.mjs
```

Read:

```text
hosted/src/db/client.ts
hosted/src/db/schema.ts
hosted/package.json
hosted/tsconfig.json
```

Confirm the root cause directly:

1. `client.ts` imports `./schema` without an extension.
2. `node --test` is executing the TypeScript modules directly using Node's native module resolution.
3. Astro/Vite build resolves the existing extensionless import, but native Node ESM does not.
4. No package/config/dependency change is necessary if the `.ts` extension resolves the problem.

Do not make any change until these points are confirmed.

If the observed repository state or root cause differs materially, STOP and report.

---

## Step 2 — Scope

Approved file for modification:

```text
hosted/src/db/client.ts
```

Approved change:

```diff
-import * as schema from "./schema";
+import * as schema from "./schema.ts";
```

No other change is approved initially.

Do NOT modify:

```text
hosted/src/db/schema.ts
hosted/package.json
hosted/pnpm-lock.yaml
hosted/pnpm-workspace.yaml
hosted/astro.config.mjs
hosted/tsconfig.json
hosted/app.js
docs/**
.github/**
```

Do not add dependencies.
Do not alter test scripts.
Do not add a loader.
Do not duplicate the DB client.
Do not refactor imports generally.
Do not clean up unrelated extensionless imports.

The six existing Phase-6 Gate-3 files are not part of this corrective edit. Preserve them initially.

---

## Step 3 — Implementation

After confirming the analysis, make exactly this one-line change in:

```text
hosted/src/db/client.ts
```

from:

```ts
import * as schema from "./schema";
```

to:

```ts
import * as schema from "./schema.ts";
```

No other line in `client.ts` may change.

---

## Step 4 — Verification of the correction

First verify the exact diff:

```bash
git diff -- hosted/src/db/client.ts
git diff --check
```

The `client.ts` diff must contain exactly one changed import line.

Then rerun the checks that were blocked by this issue:

```bash
pnpm --dir hosted test
pnpm --dir hosted typecheck
pnpm --dir hosted build
pnpm typecheck
```

The purpose is to determine whether the one-line import correction fully unblocks the already-created Phase-6 tests.

Also verify:

```bash
git status --short
git diff --stat
```

For DB-backed tests:

- use only the local `sameview_hosted` database;
- inspect row count before testing;
- do not delete unknown/pre-existing rows;
- clean up only synthetic rows created by tests;
- inspect row count afterward;
- confirm migration metadata was not changed.

For filesystem-backed Publish tests:

- confirm disposable test asset directories are cleaned up;
- confirm no real runtime assets remain under the project runtime storage path unless they pre-existed;
- do not delete unknown/pre-existing runtime data.

---

# Conditional handling if tests now execute but reveal Phase-6 implementation defects

The purpose of this iteration is primarily to correct the protected-file import blocker.

If the one-line correction makes `publish.test.mjs` and `comparisons-route.test.mjs` execute and they then reveal assertion failures:

1. Do NOT immediately fix them.
2. Analyze each failure.
3. Distinguish:
   - test defect;
   - Phase-6 implementation defect inside one of the six already-approved Gate-3 files;
   - new issue requiring scope outside those files.
4. Report the exact root cause and proposed minimal file scope.
5. STOP for approval before making any further Phase-6 change.

Exception: no exception. This corrective iteration authorizes only the one-line `client.ts` change.

This keeps the workflow one problem / one implementation per iteration.

---

# STOP conditions

STOP and report without expanding scope if:

- changing `./schema` to `./schema.ts` does not resolve the module-load failure;
- TypeScript rejects `.ts` import extensions under the current config;
- Astro/Vite build regresses;
- another config/package/dependency change appears necessary;
- a different extensionless import becomes the next native-Node blocker;
- executed Phase-6 tests reveal implementation/test failures after module loading succeeds;
- DB tests encounter unknown/pre-existing data that would require destructive cleanup;
- any file outside `hosted/src/db/client.ts` appears to require modification.

---

# Required report

Return:

# Phase 6 Gate 3A — Node Test Import Resolution Correction Report

## 1. Pre-flight repository state
## 2. Root-cause confirmation
## 3. Changed file
## 4. Exact change
## 5. Node test resolution result
## 6. Hosted test result
## 7. Hosted typecheck result
## 8. Hosted build result
## 9. Root typecheck result
## 10. Database cleanup/state verification
## 11. Runtime asset cleanup/state verification
## 12. Scope verification
## 13. Remaining failures, if any
## 14. Gate result

Explicitly state:

- whether `publish.test.mjs` now loads;
- whether `comparisons-route.test.mjs` now loads;
- exact total/pass/fail test counts;
- whether any Phase-6 test assertions fail after module loading;
- whether any synthetic DB rows remain;
- whether any runtime asset files remain;
- whether migration metadata changed;
- exact final `git status --short`;
- whether any file other than `hosted/src/db/client.ts` was modified during this corrective iteration.

Do NOT mark Phase 6 Completed.
Do NOT update documentation.
Do NOT commit.
Do NOT push.
Do NOT deploy.

If the correction succeeds but Phase-6 tests reveal separate failures, state that Gate 3 remains open and STOP for a new scoped iteration.

If all Phase-6 tests now pass, state that the import-resolution correction is accepted and Phase 6 Gate 3 is ready for completion review, but still do not mark Phase 6 Completed.

End with:

`STOP after Gate 3A.`
