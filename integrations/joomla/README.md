# SameView Joomla Integration

This directory is the dedicated Joomla platform-integration area for
SameView Web's `Embed in website` output
([docs/EMBED_IN_WEBSITE.md](../../docs/EMBED_IN_WEBSITE.md),
[docs/JOOMLA_INTEGRATION.md](../../docs/JOOMLA_INTEGRATION.md)), per the
approved architecture recorded in [CLAUDE.md](../../CLAUDE.md) "Hard
Constraints" and
[docs/IMPLEMENTATION_PLAN_V1.md](../../docs/IMPLEMENTATION_PLAN_V1.md)
Phase 19.

It is **isolated from the rest of the repository**: no dependencies of its
own (see "No new dependencies" below), no imports in either direction
between this directory and `src/` or `integrations/wordpress/`.

The actual Joomla extension source lives at
[`com_sameviewcomparisons/`](com_sameviewcomparisons/) — this exact
directory name matches the Joomla component element it installs as.

## Current scope (Phase 19)

Extension lifecycle (install/remove) and storage foundation only:

- a dedicated database table (`#__sameview_comparisons`) for Comparison
  metadata;
- a SameView-owned directory under Joomla's own `media/` folder
  (`media/com_sameviewcomparisons/`), never under `images/` (the Media
  Manager's default scanned root);
- one native Joomla ACL permission (`core.manage` on the
  `com_sameviewcomparisons` component asset), assignable through Joomla's
  own Permissions interface.

There is **no Comparison-facing behavior yet** — no seed import, no `Add
comparison` workflow, no placement, no frontend rendering. See
`docs/IMPLEMENTATION_PLAN_V1.md` Phase 19 for the exact scope and its "Not
included" list.

## No new dependencies

This directory adds no `package.json` and installs no npm packages.
Everything used to build and test the extension is either already a root
dependency of this repository (`@zip.js/zip.js` for packaging,
`@playwright/test` for browser automation — both resolved via Node's
parent-directory `node_modules` walk, the same mechanism
`integrations/wordpress` already relies on for Playwright) or a plain
`docker`/`docker compose` CLI invocation.

## Local setup

Requires Docker Desktop running locally — real, disposable Joomla + MySQL
instances, never a mock, per
[docs/AI_ENGINEERING_GUIDE.md](../../docs/AI_ENGINEERING_GUIDE.md)
"Testing" and
[docs/JOOMLA_INTEGRATION.md](../../docs/JOOMLA_INTEGRATION.md) "Testing".

```sh
cd integrations/joomla
node scripts/build-package.mjs                          # builds tests/artifact/sameview-comparisons-joomla.zip
docker compose -f docker-compose.current-major.yml up -d
docker compose -f docker-compose.previous-major.yml up -d
node --test tests/plugin-foundation.test.mjs
```

- `docker compose -f docker-compose.current-major.yml stop` — stops the
  instance without deleting its data.
- `docker compose -f docker-compose.current-major.yml down -v` — deletes
  the instance (containers, volumes, network) entirely, for a clean slate.
- Sites are reachable at `http://localhost:8892` (current major, Joomla 6)
  and `http://localhost:8893` (previous major, Joomla 5), admin at
  `/administrator`, credentials `admin` / `sameview-test-1234`.
- `docker compose -f docker-compose.current-major.yml exec joomla php
  cli/joomla.php <command>` — run any native Joomla console command
  directly against the instance, e.g. `extension:list`.

Both instances use the official `joomla` Docker image
(`docker-library/joomla`), which fully automates installation via
environment variables (`JOOMLA_DB_*`, `JOOMLA_SITE_NAME`,
`JOOMLA_ADMIN_*`) — no manual click-through of Joomla's own web installer
is needed to bring an instance up.

**Version matrix**: `docker-compose.current-major.yml` pins `joomla:6`
(currently 6.1.x), `docker-compose.previous-major.yml` pins `joomla:5`
(currently 5.4.x LTS) — the two versions
[docs/JOOMLA_INTEGRATION.md](../../docs/JOOMLA_INTEGRATION.md) "Supported
Joomla Versions" requires coverage for. Both are isolated from each other
via distinct Compose project names (the `name:` key in each compose file),
so their containers, volumes and networks never collide or interfere.

## Manual Sandbox (human testing)

A dedicated, disposable-but-persistent Joomla instance for manually
testing the real customer install workflow — not an automated test, and
not used by `plugin-foundation.test.mjs`. It is fully isolated from the
two version-matrix instances above and from the WordPress integration's
own `wp-env`-managed sandbox (`integrations/wordpress/.wp-env.sandbox.json`)
— a completely separate toolchain with its own Docker resources.

Unlike the version-matrix instances, it never has the extension
pre-installed — it boots as a plain, clean Joomla install, exactly like a
real customer's own site before they've ever heard of SameView. Pinned to
the current supported major version (Joomla 6).

```sh
cd integrations/joomla
docker compose -f docker-compose.sandbox.yml up -d       # start (first run pulls images; boots a clean Joomla 6 at :8894)
docker compose -f docker-compose.sandbox.yml stop        # stop; preserves the database/uploads for next start
docker compose -f docker-compose.sandbox.yml start       # resume — data from the previous session is still there
docker compose -f docker-compose.sandbox.yml down -v     # destroy — full reset (confirmed: removes containers, volumes and network)
docker compose -f docker-compose.sandbox.yml ps          # status — current containers/ports/state
```

Manual test workflow:

1. `docker compose -f docker-compose.sandbox.yml up -d` (or `start` if
   already created once).
2. In the main repository, once SameView Web can generate a Joomla
   package (Phase 21 onward), download the generated
   `sameview-comparisons-joomla.zip`. Until then, use
   `node scripts/build-package.mjs` here to build the same extension
   package this repository's own automated tests use.
3. Open `http://localhost:8894/administrator` — login `admin` /
   `sameview-sandbox-1234`.
4. **Extensions → Manage → Install → Upload Package File**, choose the
   ZIP, **Upload & Install** — the exact flow a real customer follows,
   exercised through the real Extensions Manager UI.

`stop` never deletes the database or installed extension — a later
`start` resumes exactly where you left off. Only `down -v` resets it to a
genuinely clean install.

## Testing notes

`tests/plugin-foundation.test.mjs` verifies the full Phase 19 lifecycle —
install, storage model, ACL registration, the admin list view rendering a
manually inserted row, and full removal with no orphaned data — against
both real instances via `node --test`, the same runner used throughout
the rest of this repository. It assumes both version-matrix instances are
already running and the package is already built; it does not manage the
Docker lifecycle itself.

Per [docs/JOOMLA_INTEGRATION.md](../../docs/JOOMLA_INTEGRATION.md)
"Testing", Docker + Playwright is the primary and default verification
mechanism; no dedicated PHP-level test harness was introduced for
Phase 19 — none proved necessary. Joomla's own native console
(`cli/joomla.php extension:install` / `extension:remove`) and admin UI
(driven by Playwright for the parts that only exist there, such as the
Permissions screen) were sufficient for everything Phase 19 needs to
verify.

A freshly booted Joomla core has `plg_system_guidedtours` enabled, which
redirects every admin view other than the dashboard back to the dashboard
until the onboarding tour is dismissed — confirmed against both real
instances. The test helpers disable this plugin as a test-harness
accommodation before driving any other admin view; it is never touched by
the shipped extension itself.

## Real findings from real-instance testing

Several assumptions that looked reasonable when written were contradicted
by real Joomla 6.1.2 / 5.4.7 behavior during Phase 19 verification and
were corrected (with the reasoning recorded as comments at the exact
point they matter, in `com_sameviewcomparisons/sameviewcomparisons.xml`,
`script.php` and `admin/services/provider.php`):

- The manifest filename must be exactly `sameviewcomparisons.xml` (the
  element with its `com_` prefix stripped) — Joomla's general installer
  accepts any `*.xml` with an `<extension>` root regardless of filename,
  but the core PSR-4 namespace-map generator
  (`libraries/namespacemap.php`) looks for this exact filename pattern
  only, silently leaving the namespace unregistered otherwise.
- `Joomla\CMS\Filesystem\Folder` no longer exists as a directly
  autoloadable class in Joomla 6 core (only via the optional `compat6`
  behaviour plugin); the correct current namespace is
  `Joomla\Filesystem\Folder`.
- `Installer::parseSQLFiles()` matches the manifest's `<file charset="…">`
  attribute literally against `"utf8"` — `"utf8mb4"` is silently skipped,
  with no error, even though the table's own `DEFAULT CHARSET=utf8mb4` is
  unaffected and still correct.
- A `method="upgrade"` manifest attribute makes
  `ComponentAdapter::checkExtensionInFilesystem()` force the "update"
  install route once the target directory exists on disk — with no check
  of whether a matching `#__extensions` row exists — which skips
  `<install><sql>` entirely. Not declaring it lets Joomla's default
  install/update detection apply instead.
- `MVCComponent` (via `MVCFactoryServiceTrait`) throws "MVC factory not
  set" unless `setMVCFactory()` is called explicitly in the component's
  own `services/provider.php` — registering the `MVCFactory` service
  provider on the container is not by itself enough.
- Joomla's native Permissions screen
  (`com_config&view=component&component=…`) requires a `config.xml` with
  a real `<field type="rules" component="…" section="component" />`
  inside a `permissions` fieldset — an empty fieldset loads without error
  but never renders the `access.xml` actions.
