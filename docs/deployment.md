# Deployment

How `web.sameview.app` is deployed to Netcup Webhosting (Plesk Node.js). Complements
[docs/ARCHITECTURE.md](ARCHITECTURE.md) — read that first for the overall technology and hosting decisions.

## Netcup / Plesk configuration

- Application Root: `/web.sameview.app`
- Document Root: `/web.sameview.app/httpdocs`
- Application Mode: `production`
- Node.js version: `26.5.0`
- **Package Manager: `npm`** — Plesk's Node.js panel only offers `npm` or `yarn`; `pnpm` is not selectable there. This
  only affects how dependencies are installed *on the server* — development, CI install, lint, typecheck and build
  continue to use pnpm (see [Deployment artifact](#deployment-artifact) below).
- **Application Startup File: `app.js`** (relative to the Application Root)

Startup File history: it was originally set to `app.js`, which at the time didn't exist as a real entrypoint in this
project (Plesk suggests that filename by default). It was then pointed at `dist/server/entry.mjs` — Astro's own real
HTTP entry point in `@astrojs/node`'s `standalone` mode — which loaded successfully but reproducibly caused **502 Bad
Gateway** (see [Why `standalone` mode is not used](#why-standalone-mode-is-not-used)). It was then pointed at a
versioned `server.mjs`, which instead produced **"Web application could not be started"** with no logs and no
diagnostic output at all — see
[Confirmed root cause](#confirmed-root-cause-passenger-cannot-load-an-es-module-as-the-startup-file) below. `app.js`
is now a real, plain CommonJS entrypoint — no wrapper, no import chain — and is the Startup File going forward.

The deployment uploads `dist/`, `package.json`, `package-lock.json` and `app.js` directly into the Application Root
(see [Deployment artifact](#deployment-artifact) below) — no `releases/`/`shared/` structure is used (see
[Why direct deployment, not a releases/shared layout](#why-direct-deployment-not-a-releasesshared-layout)).

## Confirmed root cause: Passenger cannot load an ES module as the Startup File

"Web application could not be started" with `runtime-diagnostic.log` never created meant the process never reached a
single line of the app's own code — the failure happened while Passenger was still loading the Startup File itself.

Confirmed against
[Plesk's own knowledge base article on this exact error](https://support.plesk.com/hc/en-us/articles/12389037025431-A-Node-js-app-hosted-in-Plesk-is-not-working-require-of-ES-Module-is-not-supported)
and Node's own documented module behavior: **Phusion Passenger's Node loader always loads the configured Startup File
with CommonJS `require()`**, never with ESM `import()`. Node's `require()` can never load a native ES module — not a
`.mjs` file, not a `.js` file under a `"type": "module"` package.json — this is a hard rule in Node itself (it throws
`ERR_REQUIRE_ESM`), independent of Passenger or Plesk version. `server.mjs` — and the `passenger.cjs` / `app.js`
wrapper variants tried before this fix, which all still ultimately `require()`d or statically `import`ed that same ESM
file — could therefore never have worked as a Passenger Startup File, regardless of `astro.config.mjs`'s adapter mode,
`PORT`, or anything else in the request-handling code.

This was checked against every other Node.js app already running successfully on this Netcup account, not assumed in
the abstract:

| | [ffg_monitor](https://github.com/FFGruenwald/ffg_monitor) | [ffg_einsatzzusammenfassung_chart](https://github.com/FFGruenwald/ffg_einsatzzusammenfassung_chart) | kalendory | sameview-web (before this fix) | sameview-web (after this fix) |
|---|---|---|---|---|---|
| Hosting | Netcup Plesk (Passenger), FTP deploy | Netcup Plesk (Passenger), FTP deploy | VPS + PM2 (**not** Plesk/Passenger — see note below) | Netcup Plesk (Passenger) | Netcup Plesk (Passenger) |
| `package.json` `"type"` | not set (CommonJS default) | not set (CommonJS default) | `"module"` at root, but the built server ships its own `dist-cjs/package.json` with `"type": "commonjs"` | `"module"` | not set (CommonJS default) |
| Startup file | `app.js` | `server.js` (via `"main"`) | `app.cjs` (generated; `require()`s the compiled, CommonJS `dist-cjs/server/index.js`) | `server.mjs` | `app.js` |
| Startup file module format | CommonJS (`require`) | CommonJS (`require`) | CommonJS (`require`) | native ESM (`import`) | CommonJS (`require`) |
| Where `.listen()` is called | top level of the startup file, guarded by `NODE_ENV !== 'test'` (explicit comment: *"WICHTIG für Passenger: immer lauschen"*) | top level of the startup file, unconditional | top level, inside the compiled server, unconditional | top level of `server.mjs` | top level of `app.js`, guarded by `require.main === module` |

Note on kalendory: its actual production host is a VPS managed with PM2 over SSH, not Plesk/Passenger, even though its
tooling has "netcup" in some script names — this table entry does **not** independently confirm Passenger's
`require()`-only loading, since PM2 has no such restriction. What it does still confirm is the same simpler pattern
the other two projects show directly: the real startup file is a plain CommonJS entrypoint that calls `.listen()` at
its own top level, never an ESM file, and never a thin wrapper importing another file that does the real work.

Fix applied: `package.json` no longer sets `"type": "module"`, so plain `.js` files default to CommonJS again; `app.js`
is written as CommonJS and is the real entrypoint (not a wrapper). Astro's own build output (`dist/server/entry.mjs`)
is unavoidably a native ES module regardless of this project's `package.json` — Astro always emits it with a `.mjs`
extension — so `app.js` loads it with a dynamic `import()`, the standard, documented way for a CommonJS module to load
an ES module. Everything else `app.js` needs (`node:http`, `node:fs`, `node:path`) is loaded with plain `require()`.

## Second confirmed root cause: `require.main === module` never matches under Passenger

Fixing the ESM/CommonJS problem above still produced "Web application could not be started" in production. The
actual code was checked directly, not assumed: an intermediate version of `app.js` gated its entire startup path —
including the real `server.listen()` call — behind `if (require.main === module) { ... }`, a common Node.js idiom for
"only run this when the file is executed directly, not when something else imports it".

That idiom silently breaks under Passenger specifically: Passenger's Node loader does not run the configured Startup
File as `node app.js`. It loads it with `require("./app.js")` from *inside its own internal loader module*. That
loader module — not `app.js` — is the process's actual entry point, so `require.main` always refers to Passenger's
loader, never to `app.js` itself. `require.main === module` is therefore always `false` inside `app.js` under
Passenger, no matter what. The startup block was silently skipped, `.listen()` never ran, and Passenger — which does
run the file and waits for it to bind a port — eventually gave up and reported "Web application could not be
started" after its own timeout. This is exactly consistent with the long load time observed before the error, and
with `node app.js` working correctly in every local/manual test: run directly, `app.js` genuinely *is* `require.main`,
so the guard happened to pass there and only there.

Checked directly against the two real Plesk/Passenger reference projects: neither uses `require.main === module`.
`ffg_einsatzzusammenfassung_chart`'s `server.js` calls `app.listen(port, ...)` completely unconditionally at the top
level. `ffg_monitor`'s `app.js` also calls `.listen()` unconditionally, guarded only by
`if (process.env.NODE_ENV !== 'test')` — its own comment states plainly: *"WICHTIG für Passenger: immer lauschen"*
("IMPORTANT for Passenger: always listen").

Fix applied: the `require.main === module` guard is removed entirely. `app.js`'s startup path (see
[`app.js`](../app.js)) now runs unconditionally, gated only by `process.env.NODE_ENV !== "test"` — mirroring
`ffg_monitor`'s proven pattern exactly. Nothing about Passenger's own environment sets `NODE_ENV=test`, so this
guard is always true in production; it only turns false in this project's own test run (see
[Testing without starting a real server](#testing-without-starting-a-real-server) below).

## `app.js` rebuilt line-for-line after the reference apps

After both fixes above, `app.js` was rebuilt from scratch to follow `ffg_monitor/app.js`'s structure directly —
requires, "require the application", create the server object, read `PORT`, define helpers, wire request handling
onto the server, conditionally `.listen()`, `module.exports` — rather than continuing to patch the previous version.
Every remaining difference from the reference apps is listed here explicitly, with the reason it was kept:

| | Reference (`ffg_monitor`/`ffg_einsatzzusammenfassung_chart`) | `app.js` before this rebuild | `app.js` now | Why |
|---|---|---|---|---|
| `PORT` fallback | `process.env.PORT \|\| 3000` | threw if `PORT` unset | `process.env.PORT \|\| 3000` | No reason to differ — adopted exactly. |
| `module.exports` | `module.exports = app;` (the real, fully-wired instance), at the very end of the file | a grab-bag of pure helper functions, positioned *before* the startup block | `module.exports = { server, ...pure helpers }`, at the very end, after the startup block | The real `server` instance is exported exactly like `module.exports = app`. It's a superset, not a deviation: the pure helper functions are additionally exported because `test/app.test.mjs` exercises specific error/timeout edge cases against a *fake* `astroHandler` — something neither reference app needs, since they have no async SSR render step to fail or hang. |
| Env-file loading (`dotenv`) | Loaded at the top of the startup file | not present | still not present | SameView's env loading already happens where it's actually needed, inside the Astro SSR code (`src/db/client.ts`, via `process.loadEnvFile(".env")`) — `process.env` is shared process-wide, so loading it a second time here would be redundant, not incorrect. |
| Loading "the application" (routes / Astro) | Synchronous `require("./routes/...")` | dynamic `import()`, previously placed inside the `NODE_ENV` guard | dynamic `import()`, now unconditional, in the same position a route `require()` would sit | Astro always emits `dist/server/entry.mjs` as a native ES module regardless of this project's `package.json` — confirmed by inspecting the actual built output. Node's `require()` can never load an ES module (this file's first confirmed root cause). A dynamic `import()` is the standard, documented replacement; forced by Astro's output format, not a stylistic choice. |
| Async request-handling safety net (`handleWithAstro`'s try/catch, promise handling, 15s timeout) | Not present — synchronous Express apps have no async render step to fail or hang | present | present | Fixes a separate, already-diagnosed SameView-specific defect (the "/" request hanging indefinitely — see [Request handling safety](#request-handling-safety)), not the Passenger-startup problem. Neither reference app can have this specific bug, since neither has an async SSR render step at all. Covered by `test/app.test.mjs`. |
| `process.on("uncaughtException"/"unhandledRejection", ...)` | Not present | present | present | Same reasoning as the row above — defense-in-depth for the same separately-diagnosed defect. |
| `process.on("SIGTERM"/"SIGINT", ...)` graceful shutdown | Not present | present | **removed** | Not tied to any diagnosed bug and not present in either reference app; Node's own default disposition for both signals already terminates the process with no handler registered, so removing this doesn't change actual shutdown behavior under Passenger. Kept it would have been an unjustified deviation. |

Everything else — the overall shape of the file, where `PORT` is read relative to server creation, defining helpers
before their first use, wiring the request handler onto the server object after creating it (`server.on("request",
...)` mirrors `app.use(...)`/`app.get(...)` being mounted onto `app` after `const app = express()`, rather than
handing a single, fully-assembled listener straight to `createServer()`), and the conditional `.listen()` as the very
last executable step before `module.exports` — is adopted directly from `ffg_monitor/app.js`, unchanged.

## Why `standalone` mode is not used

Separately from the ESM/CommonJS problem above, `@astrojs/node`'s `standalone` mode was tried and reproducibly caused
**502 Bad Gateway**, for an independent reason confirmed by a real Plesk test: `standalone` mode's
`dist/server/entry.mjs` starts its **own** internal HTTP server as an *import side effect* — as soon as the module is
loaded, it calls its own internal `listen()` deep inside the adapter's bundled code, before any of this project's own
code runs. A minimal test file (`http.createServer(...).listen(process.env.PORT)`, created directly and synchronously
at the top of its own module) worked correctly as the Startup File under the same Plesk/Passenger setup, proving
Plesk/Passenger, Node 26, nginx/Apache/SSL, `process.env.PORT`, and `npm`/`node_modules` were never the problem. The
one structural difference: the working test calls `.listen()` directly, synchronously, at the top level of the
Startup File itself; `standalone` mode's actual TCP `.listen()` call happens indirectly, nested inside the adapter's
own internal module — which this Plesk/Passenger setup does not reliably detect as "the app is now listening".

`astro.config.mjs` therefore configures the Node adapter with **`mode: "middleware"`** instead. In this mode, building
produces a `handler` export (`dist/server/entry.mjs`) with no autostart side effect at all — verified by inspecting
the actual built output. [`app.js`](../app.js) creates and starts its own plain
`http.createServer(...).listen(process.env.PORT)` (no host argument) at its own top level — no other module, own or
third-party, calls `.listen()` anywhere — exactly mirroring the pattern proven to work under this Plesk/Passenger
setup, and matching every reference project above.

One consequence of `mode: "middleware"`: unlike `standalone` mode, the middleware handler only renders pages — it does
not also serve `dist/client`'s static assets (verified locally: without extra handling, `/favicon.ico` and the built
JS bundle both 404 even though `/` renders fine). `app.js` therefore also serves `dist/client` directly using only
`node:fs`/`node:path` — no Express, no extra dependency — falling back to Astro's handler for anything that isn't a
static file on disk.

## Request handling safety

`app.js` wraps every call into the Astro handler defensively (regression tests in
[`test/app.test.mjs`](../test/app.test.mjs)):

- A synchronous throw and a rejected handler promise are both caught and turned into a safe HTTP 500 instead of
  crashing the process or hanging the connection.
- A 15-second per-request timeout sends a safe HTTP 500 if the handler never finishes the response at all.
- `uncaughtException` and `unhandledRejection` are logged and then `process.exit(1)` — per Node's own guidance the
  process may be in an inconsistent state afterwards; Plesk/Passenger is responsible for restarting it. `app.js` does
  not loop or retry itself.

No file-based diagnostic logging is used any more — the root cause above was confirmed structurally (Passenger
requiring an ES module can never work, regardless of what the code does at runtime), so the temporary
`runtime-diagnostic.log` mechanism previously used to debug the earlier "`/` hangs" symptom has been removed entirely
along with `server.mjs`/`server-runtime.mjs`. Process-level errors are logged with `console.error`/`console.log`,
visible in Plesk's own Node.js log panel.

## Testing without starting a real server

`app.js`'s startup path (the real `.listen()`) now runs unconditionally unless `process.env.NODE_ENV === "test"` (see
[Second confirmed root cause](#second-confirmed-root-cause-requiremain--module-never-matches-under-passenger) above
for why it is not gated behind `require.main === module` instead). Two different test files rely on that guard in two
different, deliberate ways:

- [`test/app.test.mjs`](../test/app.test.mjs) sets `process.env.NODE_ENV = "test"` and only then loads `app.js`, via a
  **dynamic** `import()` — a static `import` at the top of the file would be hoisted and evaluated before that
  assignment ever runs, defeating the guard. This test only exercises the pure request-handling helper functions
  (`createRequestListener` and friends) with a fake `astroHandler`; no real port is ever opened.
- [`test/passenger-boot.test.mjs`](../test/passenger-boot.test.mjs) is the regression test for the
  `require.main === module` bug specifically. It does not import `app.js` in-process at all — it spawns a separate
  `node -e "require('./app.js')"` child process (deliberately not `node app.js`, and with `NODE_ENV` set to
  `"production"`, not `"test"`), which reproduces Passenger's actual loading model: `app.js` is `require()`d from
  inside another module (the `-e` script), so `require.main` is that other module, never `app.js` — the same relationship
  as Passenger's own loader. The test then confirms the port Passenger would have given it actually accepts
  connections. Confirmed to fail correctly: temporarily reintroducing `require.main === module` in `app.js` while
  running this test reproduces the exact symptom seen in production (nothing ever listens; the test fails via the
  connection-timeout, not a crash).

## GitHub Environment: `production`

Workflow: [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml).

**Secrets** (Environment → `production` → Secrets):

- `NETCUP_FTP_USERNAME`
- `NETCUP_FTP_PASSWORD`

**Variables** (Environment → `production` → Variables):

- `NETCUP_FTP_HOST`
- `NETCUP_FTP_PORT`
- `NETCUP_FTP_PROTOCOL` — value expected by [`SamKirkland/FTP-Deploy-Action`](https://github.com/SamKirkland/FTP-Deploy-Action): `ftps` (recommended), `ftp`, or `ftps-legacy`
- `NETCUP_DEPLOY_PATH` — must resolve to the Application Root as seen by the FTP account (this depends on how the FTP user's home/chroot was set up on Netcup — verify once with a manual FTP login; it may need to be `/web.sameview.app/` or just `/`, and must end with a trailing `/`)
- `PRODUCTION_URL` — `https://web.sameview.app`

No production database credentials exist as a GitHub secret. `DATABASE_URL` is never read by the workflow — the
build does not touch the database (verified: `astro build` completes with no `DATABASE_URL` set at all).

## Release flow

```sh
git tag v0.0.1
git push origin v0.0.1
```

This triggers the workflow:

1. `build` job (no environment, no secrets): checkout → Corepack → Node 26 → `pnpm install --frozen-lockfile` →
   `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` → assemble the deployment artifact → upload it as a
   GitHub Actions artifact.
2. `deploy` job (`environment: production`, needs the secrets/variables above): downloads the artifact, uploads it to
   Netcup via FTPS, then prints the manual next steps.

`workflow_dispatch` is also enabled for a manual run — e.g. to redeploy an older tag (see
[Rollback](#rollback)).

`pnpm test` runs Node's built-in test runner (`node --test`, no extra dependency) against
[`test/app.test.mjs`](../test/app.test.mjs) — regression tests for the request-handling logic described in
[Request handling safety](#request-handling-safety) — and
[`test/passenger-boot.test.mjs`](../test/passenger-boot.test.mjs) — the Passenger-loading regression test described in
[Testing without starting a real server](#testing-without-starting-a-real-server).

## Deployment artifact

Assembled fresh on every run, uploaded to Netcup, nothing else:

```text
release/
├── dist/                 (full Astro build output — client assets + server entry/handler)
├── package.json
├── package-lock.json     (generated in CI, npm-only, production dependencies only)
└── app.js                (versioned Plesk/Passenger-compatible Startup File)
```

Verified locally: the built entry module fails at startup with `Cannot find package 'react'` when `node_modules` is
not reachable — the build does **not** bundle all runtime dependencies (`react`, and later likely
`mysql2`/`drizzle-orm` once a page actually imports `src/db/client.ts`, plus `sharp` if image processing is added).
`node_modules` is therefore required on the server but is deliberately **not** uploaded via FTP: pnpm's `node_modules`
is largely symlinks into a local content-addressable store, which does not survive being copied by an FTP client, and
shipping it would also bake in whatever OS the GitHub runner happened to build on.

### Why `package-lock.json` instead of `pnpm-lock.yaml`

Netcup/Plesk's Node.js panel only offers **npm** or **yarn** as the package manager — pnpm is not selectable there
(confirmed against the actual panel). Since the runtime install therefore has to happen with npm, the server needs an
npm-compatible lockfile, not `pnpm-lock.yaml`.

`pnpm-lock.yaml` stays the single, authoritative lockfile for development, CI installs, linting, type-checking and
the build (`pnpm install --frozen-lockfile` in the `build` job) — it is never touched, never removed, and the project
does **not** switch to npm. A `package-lock.json` is instead generated fresh, only inside the disposable `release/`
copy, on every workflow run:

```sh
# inside release/, after dist/ and package.json have been copied there
npm install --package-lock-only --omit=dev --ignore-scripts
```

- `--package-lock-only` resolves the dependency tree and writes `package-lock.json` **without** installing
  `node_modules` in CI — nothing is installed twice, this step only takes a few seconds.
- `--omit=dev` marks devDependencies as `"dev": true` in the lockfile (they are still listed — that's normal,
  unmodified npm behavior — but a later `npm ci --omit=dev` on the server will skip installing them).
- `--ignore-scripts` is defensive: `--package-lock-only` doesn't run lifecycle scripts anyway since nothing is
  installed, but this keeps that guaranteed regardless of npm version.
- Verified: `npm install --package-lock-only` runs cleanly against the project's `package.json` including its
  `"packageManager": "pnpm@11.1.2"` field and the presence of `pnpm-workspace.yaml` in the repo — npm does not read or
  react to either (npm has no concept of `pnpm-workspace.yaml`, and plain `npm` is not intercepted by Corepack even
  after `corepack enable` runs earlier in the same job). No changes to `package.json` were necessary, in the original
  file or in the artifact's copy.
- Only one lockfile is committed to the repository (`pnpm-lock.yaml`). `package-lock.json` is generated on every run
  and only ever lives inside the CI artifact — it is not committed.

**Required manual step after every deploy that changes dependencies:** install runtime dependencies for the Node.js
application in the Plesk panel — see [Installing dependencies on the server](#installing-dependencies-on-the-server)
below for the exact command and its trade-offs.

## Installing dependencies on the server

Preferred, if the Plesk Node.js panel exposes a free-form "Run Node.js commands" / "Run script" field:

```sh
npm ci --omit=dev
```

This installs exactly what `package-lock.json` records (fails instead of silently re-resolving if `package.json` and
the lockfile ever disagree) and skips devDependencies.

If Plesk only offers a fixed, single "NPM install" button with no free-form command available:

- It almost certainly runs plain `npm install`, not `npm ci --omit=dev`. Modern npm (7 and later) no longer infers
  "production only" from a `NODE_ENV=production` environment variable — that auto-detection was removed years ago —
  so a plain `npm install` click installs devDependencies too unless Plesk is specifically configured otherwise.
- Consequences compared to `npm ci --omit=dev`:
  - `typescript`, `drizzle-kit`, `@biomejs/biome` and `@astrojs/check` (all devDependencies) get installed on the
    server as well — extra disk space and install time, and dev tooling present on a production system that never
    needs it. This is not a functional problem: the runtime dependencies the app actually needs are always a subset
    of what gets installed either way, so the app still works.
  - `npm install` can, in principle, adjust `package-lock.json` itself if it finds an inconsistency, rather than
    failing the way `npm ci` does. Since a matching `package-lock.json` is uploaded together with `package.json` on
    every deploy, this is unlikely to bite in practice, but it is a real difference in strictness.
- Verify once against the actual panel which of the two is available, and prefer `npm ci --omit=dev` whenever a
  free-form command can be entered.

## Why direct deployment, not a releases/shared layout

A `releases/<tag>/` + `shared/` structure (with a symlink pointing at the active release) was considered, but
requires creating/repointing a symlink on every deploy and pointing Plesk's Startup File at a stable symlink target.
Plain FTP/FTPS has no reliable, standard way to create or update a symlink, and no SSH access exists here to do it
another way. Plesk's Node.js Startup File is also a fixed path under the Application Root, not designed to be
repointed via a swapped symlink without direct server access. Building that structure without a way to reliably
operate the symlink would be an unsafe, half-working "atomic deploy" — so this deploys directly into the Application
Root instead, with the FTP action configured to never delete anything it did not itself upload (see below).

## Upload behavior and delete protection

`SamKirkland/FTP-Deploy-Action` tracks what it previously uploaded in a state file it keeps on the server. On each
run it only uploads changed files and only deletes files *it previously uploaded and that are no longer present*
locally (e.g. an old content-hashed chunk file from a prior build). It does not delete files it never uploaded in the
first place.

- `dangerous-clean-slate` is explicitly set to `false` — the target directory is never wiped.
- The local artifact never contains `.env*`, `node_modules`, `.git`, tests, docs, `.vscode`, or Docker files, so none
  of those can ever be part of the sync in the first place.
- `exclude` additionally lists `.env`, `.env.*`, `node_modules/**` and `.git*` as an explicit second layer of
  protection.
- There is currently no persistent uploads/data directory in the Application Root (V1 has no such feature yet). If
  one is added later, add its path to `exclude` as well, in addition to keeping it out of `release/`.

## `.env.production` handling

- `.env.production` is never read by this repository's tooling, never uploaded by the workflow, and not part of the
  deployment artifact. `.gitignore` already excludes it.
- **Important:** the application code (`src/db/client.ts`, `drizzle.config.ts`) only ever looks for a file literally
  named `.env` (`existsSync(".env")` / `process.loadEnvFile(".env")`) — it does not look for `.env.production`. When
  placing the production values on the server, the file must therefore be named `.env`, not `.env.production`.
- Place it at `/web.sameview.app/.env` on the server (the Application Root) — this is a one-time manual step (e.g.
  via an FTP client), independent of this workflow, and is never touched by any deploy.
- This assumes Plesk starts the Node process with its working directory set to the Application Root, since
  `process.loadEnvFile(".env")` resolves relative to `process.cwd()`. Verify this once after the first deploy; if the
  app cannot find `DATABASE_URL` once it actually needs it, this is the first thing to check.
- The homepage's smoke test (see [Smoke test](#smoke-test-homepage) below) does import `src/db/client.ts`, but only
  lazily and inside its own error handling — the app still starts and serves the homepage correctly with no
  `.env`/`DATABASE_URL` present at all, it just reports "DATABASE_URL configured: no" instead of attempting a
  connection (verified locally).

## Local vs. production database

- The local MySQL container and its Docker volume (`sameview-mysql-data`) are for development only. They are never
  copied, exported, or synced to Netcup in any form.
- The production database structure is created exclusively from the versioned Drizzle migrations in
  [`drizzle/`](../drizzle/) — never by copying the local volume.
- Local development/test data is **not** transferred to production automatically, ever. There is no script or
  workflow step that does this.
- For `v0.0.1`, an empty `comparisons` table in production is the expected, correct state — no seed data ships with
  this release. The smoke test on the homepage (see below) treats a row count of `0` as a successful result, not an
  error.
- If specific data is ever deliberately wanted in production later (not routine, not automatic), that would be a
  one-off, manual export/import of chosen rows (e.g. via phpMyAdmin's own "Export"/"Import" tabs, selecting specific
  rows or a `WHERE`-filtered result) — a completely separate action from schema migration, never bundled with it.

## Migrations

**What the existing migration does:** [`drizzle/0000_smart_zaran.sql`](../drizzle/0000_smart_zaran.sql) contains a
single statement: `CREATE TABLE comparisons (...)` with a primary key on `id` and unique constraints on `public_id`
and `management_token_hash`. Checked in detail:

- No foreign keys, no triggers, no generated columns, no MySQL-version-specific syntax — plain `CHAR`/`VARCHAR`/`TEXT`/
  `TIMESTAMP` columns, a primary key and two unique constraints. Confirmed to run cleanly on `mysql:8.0.46` (the same
  version used locally and on Netcup) — applied locally against that exact image while writing this.
- **It must only be run once.** The file is a plain `CREATE TABLE`, not `CREATE TABLE IF NOT EXISTS`. Verified locally:
  re-applying the raw SQL file a second time fails with `ERROR 1050 (42S01): Table 'comparisons' already exists`. This
  matters directly for Variant A below — the phpMyAdmin import must only be done once per database.
- Running `pnpm db:migrate` (Drizzle Kit) a second time, by contrast, is safe and a no-op: Drizzle Kit tracks applied
  migrations in its own `__drizzle_migrations` table and skips ones already recorded there — verified locally by
  running it twice in a row.

It has **not** been applied to the production database yet. It is not currently required for the app to start — no
route uses the database for anything beyond the read-only smoke check below, which handles a missing table itself.

Migrations are **not** run automatically from GitHub Actions, and `DATABASE_URL` for production is **not** added as a
GitHub secret, by design.

### Variant A — one-time manual import via Netcup's phpMyAdmin (recommended for the first setup)

1. Open phpMyAdmin for the production database on Netcup (provided by Netcup/Plesk for the database itself — separate
   from the local development phpMyAdmin described in [README.md](../README.md), which only ever talks to the local
   Docker MySQL container).
2. Select the production database.
3. Open the "Import" tab.
4. Choose the file [`drizzle/0000_smart_zaran.sql`](../drizzle/0000_smart_zaran.sql) from a local checkout.
5. Run the import.
6. Verify: the `comparisons` table now appears in the table list, with `0` rows.

Because the migration must only be run once (see above), do **not** repeat this step for the same database once it
has succeeded. Any future migration (after a future `pnpm db:generate`) would be imported the same way, once, as an
additional file.

### Variant B — later server-side migration (only if realistic)

This would only apply if Plesk's "Run Node.js commands" panel realistically allows running arbitrary project
commands (as used for dependency installation — see
[Installing dependencies on the server](#installing-dependencies-on-the-server)). If so, the equivalent command is:

```sh
npx drizzle-kit migrate
```

This is **not** wired into the GitHub Actions workflow — `DATABASE_URL` for production is deliberately never added as
a GitHub secret, and no automatic migration step exists or is planned there. Whether this variant is realistic on the
actual Netcup panel has not been verified; Variant A works regardless and does not depend on it.

### Manual migration from a local machine (alternative to both variants)

1. Temporarily set `DATABASE_URL` to the production connection string in a local, never-committed `.env` (e.g. a
   throwaway copy, not the tracked `.env.example`).
2. Run `pnpm db:migrate`.
3. Remove the temporary `.env` / production value again.

Repeat step 2 for any future migration after `pnpm db:generate` adds one — safe to run repeatedly, unlike the raw SQL
file used in Variant A.

## Smoke test (homepage)

The homepage (`src/pages/index.astro`, via `src/lib/db-health.ts`) runs a read-only check on every request, so that
after a deploy and restart it's immediately visible whether the whole chain — Astro/Node runtime → `DATABASE_URL` →
MySQL → `comparisons` table — actually works, without needing a separate tool:

1. Is `DATABASE_URL` configured at all.
2. If so: can a connection be opened and does `SELECT 1` succeed.
3. Does the `comparisons` table exist (checked via `information_schema.tables`, not by guessing from an error).
4. If it exists: `SELECT COUNT(*)` on it.

Guarantees, verified locally in all three states (DB working, DB unreachable, `DATABASE_URL` unset):

- Always renders the page with HTTP 200 — a failed or skipped check never turns into a 500. `checkDbHealth()` catches
  every error itself and returns a plain status value; it never throws.
- Never writes, deletes, or migrates anything — read-only queries only.
- A row count of `0` is displayed as a normal, successful result (expected for `v0.0.1`, see
  [Local vs. production database](#local-vs-production-database)), not hidden or treated as an error.
- No connection string, host, credentials, SQL text, or stack trace is ever sent to the browser. Errors are logged
  server-side only (`console.error`, visible in Plesk's own Node.js logs) for operators to diagnose — never in the
  HTML response.

**Expected output after a healthy deploy** (migration already applied, database reachable):

```text
Database check
DATABASE_URL configured: yes
Database connection: ok (SELECT 1 succeeded)
Table "comparisons" exists: yes
Row count in "comparisons": 0
```

A row count of `0` here is correct and expected for `v0.0.1` — it is not an error. Before the first migration has been
applied (see [Migrations](#migrations)), the third and fourth lines instead read `Table "comparisons" exists: no`,
with no row-count line — also not an error, just not yet migrated.

## Restart (manual)

The workflow never restarts the app itself. After every successful deploy:

1. Open the Netcup/Plesk dashboard.
2. If dependencies changed, install them first — see
   [Installing dependencies on the server](#installing-dependencies-on-the-server).
3. Confirm the Application Startup File is set to `app.js` (not `dist/server/entry.mjs` or the old `server.mjs` — see
   [Confirmed root cause](#confirmed-root-cause-passenger-cannot-load-an-es-module-as-the-startup-file) and
   [Why `standalone` mode is not used](#why-standalone-mode-is-not-used)).
4. Click "Restart App".
5. Manually check `https://web.sameview.app` against the
   [expected smoke test output](#smoke-test-homepage).

No automatic restart or automatic post-deploy healthcheck is implemented — the workflow cannot know the app is
actually serving again until the manual restart has happened, so making the upload job depend on a live healthcheck
would make it fail for the wrong reason every single time.

## Rollback

There is no instant/atomic rollback in this FTP-only setup (no symlink swap, no SSH). To roll back:

1. Go to the Actions run history and either:
   - re-run `workflow_dispatch` selecting the previous release tag as the ref, or
   - download that older tag's `production-release` artifact (kept for 14 days) and upload it manually via an FTP
     client.
2. Reinstall dependencies (see [Installing dependencies on the server](#installing-dependencies-on-the-server)) if the
   rolled-back version has different dependencies.
3. Click "Restart App".

This takes as long as a normal deploy — there is no faster path without SSH or a symlink-based release structure.
