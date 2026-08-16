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

## Current scope (Phase 19–24)

The full `Embed in website` Joomla integration, per
[docs/JOOMLA_INTEGRATION.md](../../docs/JOOMLA_INTEGRATION.md) and
[docs/IMPLEMENTATION_PLAN_V1.md](../../docs/IMPLEMENTATION_PLAN_V1.md)
Phases 19–24, implemented and real-instance-verified against Joomla 6.1.2
and Joomla 5.4.7:

- **One installable package** (`pkg_sameviewcomparisons`) bundling the
  `com_sameviewcomparisons` component, the `plg_content_sameview` and
  `plg_editors-xtd_sameview` companion plugins and the
  `mod_sameview_comparison` companion module as a single native Joomla
  extension install/uninstall unit.
- **Storage foundation**: a dedicated database table
  (`#__sameview_comparisons`) for Comparison metadata; a SameView-owned
  directory under Joomla's own `media/` folder
  (`media/com_sameviewcomparisons/`), never under `images/` (the Media
  Manager's default scanned root); one native Joomla ACL permission
  (`core.manage` on the `com_sameviewcomparisons` component asset),
  assignable through Joomla's own Permissions interface.
- **First installation**: installing the package makes its bundled seed
  Comparison immediately available, with no separate manual import step.
- **Comparison lifecycle**: Add/Update/no-op/Delete through the
  component's own `Add comparison` admin upload, using
  `session.id`/Outcome Fingerprint for Add-vs-Update-vs-no-op detection.
- **Placement**: content placement via a native editor button
  (`plg_editors-xtd_sameview`) inserting a `{sameview session="..."}`
  reference, resolved at render time by `plg_content_sameview`; module
  placement via `mod_sameview_comparison`'s own native picker field. Both
  pickers identify a Comparison by title and reference-to-capture period
  label, never a preview.
- **Plugin auto-enable**: a genuine first install enables both placement
  plugins automatically; a later update/reinstall never re-enables a
  plugin an operator has deliberately disabled.
- **Update/reinstall lifecycle**: re-uploading the same package through
  the native Extensions Manager (`Extensions → Manage → Install → Upload
  Package File`) updates the already-installed extension in place,
  preserving stored Comparisons and placements.
- **Frontend delivery**: assets load only on pages that actually contain a
  placement, via Joomla's native Web Asset system; each placement mounts
  into its own open Shadow Root (Shadow DOM), so multiple placements and
  multiple different Comparisons on one page stay fully isolated from
  each other and from the host template.
- **Comparison Library management**: the admin list view shows a
  thumbnail, the reference-to-capture period, a usage count and the
  concrete, linked placements (articles and modules) using each
  Comparison.
- **Editor-picker ACL**: the Editors-XTD picker (`layout=modal`) remains
  usable by any user who already holds ordinary content-editing rights,
  without requiring `core.manage` — only the Comparison Library itself and
  Add/Delete require that permission.
- **Module missing-Comparison state**: a module referencing a deleted
  Comparison shows a selectable "Missing Comparison (`session.id`)" state
  and can be re-saved independently (for example, changing only its
  title) without losing the stored reference; re-importing the same
  `session.id` restores the normal Comparison label automatically.

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
2. Get the real, unified Joomla package that a customer would install:
   either download it from SameView Web's own Output Inspector (`Embed in
   website` → Joomla → Generate), or run `node
   scripts/generate-joomla-artifact-for-verification.mjs <output-path>
   [fixture-name]` from the repository root, which drives the real
   running SameView Web application via Playwright and saves the same
   `sameview-comparisons-joomla.zip` a customer would download. This is
   distinct from this directory's own `scripts/build-package.mjs` above,
   which only zips the bare `com_sameviewcomparisons/` component source
   for `plugin-foundation.test.mjs`'s own narrower Phase 19 lifecycle
   checks — never a seed Comparison, never the companion module/plugins.
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

Five further test files cover Phases 20–24 against the same two real
instances, using the full `pkg_sameviewcomparisons` package (built via
`node scripts/generate-joomla-artifact-for-verification.mjs`, not the
narrower `build-package.mjs` above):

- `add-comparison-lifecycle.test.mjs` — first installation, Add/Update/
  no-op/Delete through the real `Add comparison` admin upload, rejected-
  import atomicity.
- `placement-lifecycle.test.mjs` — content placement via the editor
  button, module placement, missing-Comparison states (including the
  module's own independent-resave regression), re-import reactivation,
  deliberate reselection, and full uninstall.
- `frontend-delivery-lifecycle.test.mjs` — asset loading only where a
  placement exists, cache/versioning, and Shadow DOM host isolation in
  both directions against a deliberately hostile template.
- `package-update-lifecycle.test.mjs` — reinstalling an already-installed
  package through the native Extensions Manager as a genuine update,
  preserving stored Comparisons and placements.
- `comparison-library-management.test.mjs` — the admin list view's
  thumbnail, reference-to-capture period, usage count and linked
  placements.

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
by real Joomla 6.1.2 / 5.4.7 behavior during Phase 19–24 verification and
were corrected (with the reasoning recorded as comments at the exact
point they matter):

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
- `Joomla\CMS\Dispatcher\ComponentDispatcher::checkAccess()` enforces the
  component's ACL permission (`core.manage`) unconditionally for every
  backend request, before any controller — including this component's own
  — is ever reached. Exempting the Editors-XTD picker (`layout=modal`)
  from that requirement, per
  [docs/JOOMLA_INTEGRATION.md](../../docs/JOOMLA_INTEGRATION.md)
  "Permissions and Security", therefore needs its own dispatcher override
  (`admin/src/Dispatcher/Dispatcher.php`); the matching check already in
  `admin/src/Controller/DisplayController.php` is a second, independent
  gate a request must also pass once the dispatcher lets it through.
- `Joomla\CMS\MVC\Controller\FormController::save()` validates a module's
  saved parameters against a `Form` object deliberately bound to no data
  (`getForm($data, false)`), never the submitted or previously stored
  values. A custom field whose available options depend on the module's
  own current value — `mod_sameview_comparison/fields/sameviewcomparison.php`'s
  missing-Comparison handling — can therefore never rely on that value
  being populated during save; it must resolve the module's
  already-persisted parameter directly from `#__modules`, keyed by the
  module `id` Joomla still passes as a plain request parameter.
