# SameView WordPress Integration

This directory is the dedicated WordPress platform-integration area for
SameView Web's `Embed in website` output
([docs/EMBED_IN_WEBSITE.md](../../docs/EMBED_IN_WEBSITE.md),
[docs/WORDPRESS_INTEGRATION.md](../../docs/WORDPRESS_INTEGRATION.md)),
per the approved architecture recorded in
[CLAUDE.md](../../CLAUDE.md) "Hard Constraints" and
[docs/IMPLEMENTATION_PLAN_V1.md](../../docs/IMPLEMENTATION_PLAN_V1.md)
Phase 14.

It is **isolated from the rest of the repository**:

- its own `package.json`, `package-lock.json` and `node_modules`,
  installed independently of the repository root via plain `npm`, never
  `pnpm` — the root `pnpm-workspace.yaml` declares no `packages:` glob,
  but pnpm still treats any subdirectory beneath it as sharing the root
  lockfile for `pnpm install`/`pnpm add` purposes (confirmed empirically:
  an initial `pnpm add` from this directory wrote ~2,700 lines into the
  *root* `pnpm-lock.yaml` despite the missing `packages:` glob, and was
  reverted). Plain `npm` has no such parent-workspace lookup, so it is
  used here specifically to guarantee this directory's dependencies never
  touch the root install or lockfile;
- its own tooling (`@wordpress/env`, PHP) — never added to the root
  `package.json`;
- no imports in either direction between this directory and `src/`.

The actual WordPress plugin lives at
[`sameview-comparisons/`](sameview-comparisons/) — this exact directory
name is what WordPress mounts and activates as the plugin.

## Current scope (Phase 14)

Plugin lifecycle (activation/deactivation/uninstall) and storage
foundation only:

- Custom Post Type `sameview_comparison` + two Post Meta keys
  (`_sameview_session_id`, `_sameview_outcome_fingerprint`);
- a SameView-owned uploads subdirectory, never registered in the Media
  Library;
- one native WordPress capability (`manage_sameview_comparisons`),
  granted to `administrator`.

There is **no Comparison-facing behavior yet** — no import, no admin
library UI, no placement, no frontend rendering. See
`docs/IMPLEMENTATION_PLAN_V1.md` Phase 14 for the exact scope and its
"Not included" list.

## Local setup

Requires Docker Desktop running locally (used by `wp-env` to run a real,
disposable WordPress + MySQL instance — never a mock, per
`docs/AI_ENGINEERING_GUIDE.md` "Testing").

```sh
cd integrations/wordpress
npm install
npm start         # wp-env start — first run downloads WordPress/MySQL images
npm test          # runs tests/plugin-foundation.test.mjs against the real instance
```

Other useful commands (run from this directory):

- `npm stop` — stops the running instance without deleting its data.
- `npm run destroy` — deletes the wp-env instance entirely, for a clean slate.
- `npx wp-env run cli wp <command>` — run any WP-CLI command directly
  against the instance, e.g. `npx wp-env run cli wp plugin list`.
- The site is reachable at the URL `wp-env start` prints (typically
  `http://localhost:8888`, admin at `/wp-admin`, default credentials
  `admin` / `password` unless `wp-env` reports otherwise).

## Manual Sandbox (human testing)

A dedicated, disposable WordPress instance for manually testing the real
customer install workflow — not an automated test, and not used by any of
the `npm test`/`verify-*.mjs` tooling. It is fully isolated from the
default instance above (`:8888`) and from `tests/fresh-install/` (`:8890`):
`wp-env` derives each environment's Docker containers, volumes and network
from a hash of its own config file's absolute path, so a distinct config
file (`.wp-env.sandbox.json`) guarantees entirely separate Docker
resources, never shared or destroyed by another environment's commands.

Unlike every other config in this directory, it never bind-mounts or
pre-installs the `sameview-comparisons` plugin (`"plugins": []`) — it
boots as a plain, clean WordPress install, exactly like a real customer's
own site before they've ever heard of SameView. WordPress core is pinned
to the same version already established as current for this project
(`https://wordpress.org/wordpress-7.0.4.zip`), the same URL the
`current-major` configs above use.

```sh
cd integrations/wordpress
npm run sandbox:start     # first run pulls/builds Docker images; boots a clean WP 7.0.4 at :8891
npm run sandbox:stop      # stops containers; preserves the WordPress database/uploads for next start
npm run sandbox:destroy   # prompts for confirmation, then deletes containers/volumes/network — full reset
npm run sandbox:status    # prints the current URL, port and config in use
```

Manual test workflow:

1. `npm run sandbox:start`.
2. In the main repository, run the SameView Web app (`pnpm dev`), import a
   Comparison, choose the `Embed in website` → WordPress output and
   generate/download the real `sameview-comparisons-wordpress.zip`.
3. Open `http://localhost:8891/wp-admin` — login `admin` / `password`
   (wp-env's own standard local bootstrap credentials; not used or
   reachable outside your machine).
4. **Plugins → Add Plugin → Upload Plugin**, choose the downloaded ZIP,
   **Install Now**, then **Activate** — the exact flow a real customer
   follows, exercised here through the real wp-admin UI rather than
   WP-CLI.

`sandbox:stop` never deletes the database or uploaded plugin — a later
`sandbox:start` resumes exactly where you left off. Only `sandbox:destroy`
resets it to a genuinely clean install.

## Testing notes

`tests/plugin-foundation.test.mjs` verifies the full Phase 14 lifecycle
against the real instance via WP-CLI (`node --test`, the same runner used
throughout the rest of this repository, invoked only from this isolated
`pnpm test` — never the repository root's `pnpm test`). It deliberately
does not use `wp plugin uninstall`/`wp plugin delete`: `wp-env` bind-mounts
this plugin directory from the host repository, and WordPress's own
plugin-delete flow removes the plugin's files as part of uninstalling —
which would delete this repository's own source files. Uninstall behavior
is instead verified by directly executing `uninstall.php`'s real logic in
the real WordPress runtime (`wp eval`, defining `WP_UNINSTALL_PLUGIN`
first — the same condition WordPress core itself sets), which exercises
the same code without touching the plugin's files on disk.

After the test runs, the instance is left in a "logically uninstalled but
still activated" state (the plugin's own activation flag was never
cleared, only its data). Run `pnpm destroy` for a genuinely clean slate
before reusing the instance for anything else.
