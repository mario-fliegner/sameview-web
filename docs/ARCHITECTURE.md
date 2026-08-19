# SameView Web – Architecture

## Technology

The Astro, React, TypeScript and Node.js application stack applies to Version 1. The MySQL and persistent local-filesystem capabilities are the prepared technical basis for Hosted Publication; Version 1 does not implement publication infrastructure.

- Astro
- React
- TypeScript
- Node.js (two independently deployable applications — see "Repository and Application Boundary" below)
- MySQL (Netcup)
- Local filesystem (Netcup)

## Repository and Application Boundary

The `sameview-web` GitHub repository contains two independently deployable Node.js/Astro applications:

- the existing root application, serving `https://web.sameview.app` — the SameView Web editor, importer and Version 1 output generation described elsewhere in this document;
- a future Hosted application, under a conceptual `hosted/` directory, serving `https://my.sameview.app` — the Hosted Publication backend and public viewer described in "Hosted Comparison Architecture" below.

The existing root Web application remains in place at the repository root. It is not moved into an `apps/web` structure, and no speculative monorepo/shared-package restructure (for example `apps/`, `packages/shared`) is introduced for Hosted Version 1.

`web.sameview.app` and `my.sameview.app` run as separate Node.js/Plesk application instances with independent runtime and deployment lifecycles — see "Hosting" below. Neither domain is implemented by routing both through one running application process based on the HTTP `Host` header.

Both applications live in one repository and may reuse existing code selectively — for example the framework-independent Presentation/runtime modules described in "Hosted Public Viewer Architecture" below — where an actual Hosted implementation need justifies it. A dedicated shared package is not created speculatively; it is only extracted once real reuse pressure across the two applications justifies it.

The exact internal directory/file layout of the future `hosted/` application is implementation work, not decided here.

## Hosting

Version 1 deploys the root Web application as one Node.js application. The database and persistent upload directory listed below remain the prepared hosting basis for Hosted Publication and are not used by the Version 1 root Web application's own standalone HTML/static microsite output.

Root Web application:
- Domain: https://web.sameview.app
- One Node.js application

Hosted application (see "Repository and Application Boundary" above):
- Domain: https://my.sameview.app
- A separate Node.js application instance in the same Netcup/Plesk environment, with its own application configuration, deploy target and restart lifecycle, independent of the root Web application
- Exact Plesk application/deploy configuration is deployment implementation work, not decided here

Shared infrastructure:
- One MySQL database, logically separated per application — see "MySQL Logical Separation" below
- One persistent upload/asset directory, owned by the Hosted application — see "Hosted Comparison Architecture" → "Asset Storage" below

## Responsibilities

Current Version 1 root Web application (browser):
- Import ZIP
- Read supported SameView session metadata according to [docs/IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md)
- Preserve immutable Source Data and unknown metadata fields locally
- Maintain the editable Current Working State locally
- Display slider
- Edit presentation data
- Derive slider-label snapshots when generating an outcome
- Generate the standalone HTML export (client-side, no upload required)

Hosted service (`my.sameview.app`), conceptually — see "Hosted Comparison Architecture" below for detail:
- Publish
- Update
- Delete
- Resolve/View for the public Hosted Viewer
- the browser management surface
- the report flow
- Hosted MySQL access
- Hosted Asset Storage access
- Hosted processing/cleanup

These Hosted responsibilities belong to the Hosted application, not to the root SameView Web editor. Hosted publication does not pass through, and is not implemented inside, the root Web editor's own code.

The first supported Hosted publishing client is SameView Android. A future SameView Web publishing client is expected to use the same Hosted service/API described below without requiring a different Hosted publication model — see "Client/API Boundary" below.

For Hosted Publication, the Hosted service always validates, decodes, strips metadata from and re-encodes submitted images itself. It never trusts client-side image processing, including any privacy preprocessing already performed by a publishing client (see "Hosted Comparison Architecture" → "Upload and Processing" below). The limits defined below apply to Hosted Publication; the Version 1 root Web application's client-side standalone HTML export has no server upload and should apply the same checks where practicable, but is not server-enforced.

## Client/API Boundary

The Hosted service exposes a client-neutral API boundary, not an Android-specific server design:

- Android communicates directly with `my.sameview.app` over HTTPS; it does not route Hosted operations through `web.sameview.app`.
- A future SameView Web publishing client communicates with the same Hosted service/API.
- Public viewing (Resolve/View) requires no management authority and no specific client.
- Publish/Update/Delete ownership semantics are governed by management capability (see "Hosted Comparison Architecture" → "Data Model" and "Identifiers" below), independent of which client performs them.

## Main Routes

Root Web application, current Version 1:

/

Hosted application (`my.sameview.app`), planned for Hosted Publication:

 /<public_id>
 /<public_id>/manage/<management_token>
 /<public_id>/manage
 /<public_id>/report

There is no `/v/` route prefix. `/<public_id>` is the canonical public Hosted Viewer route (see "Hosted Comparison Architecture" → "Hosted Public Viewer Architecture" below). `/<public_id>/manage/<management_token>` is the private management capability entry point; after successful capability verification, the browser management surface continues at the token-free `/<public_id>/manage` route, so the secret token does not need to remain in subsequent visible browser URLs. `/<public_id>/report` is the public reporting entry point (see "Hosted Comparison Architecture" → "Reporting Architecture" below).

No physical storage path or provider URL is ever exposed through these routes, and no management secret appears in a public (non-management) route.

## Identifiers

Comparison identity, used across SameView Web import, Embed and Hosted Publication:

- `session.id`: the existing Android/local session identity (the session's export-archive directory name — see [docs/IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md) "Session Identity"). It is not globally unique across independent devices and is not used as the Hosted Comparison identity.
- `session.comparisonId`: the global, product-level Comparison identity used for Hosted Publication. A UUID v4, generated offline by the publishing client (no external service, no device identifier, no timestamp-derived value). It is not secret. The exact Android metadata field/assignment mechanics belong to the Android session metadata specifications, not here.

The following identifiers are planned for Hosted Publication:

- `internal_id`: a UUID, used only internally for database rows and Asset Storage keys. Never exposed in a URL.
- `comparison_id`: the stored form of `session.comparisonId` on the Hosted Publication record, unique. Hosted publication uniqueness — at most one active Hosted Publication per Comparison — is enforced against this value. `comparison_id` alone never authorizes management.
- `public_id`: an independent, cryptographically random, URL-safe public identifier — 72 bits of randomness (9 random bytes, Base64url without padding, 12 characters), unique, used in the public route `/<public_id>`. Not a secret, but not practically enumerable.
- `management_token`: an independent, cryptographically random secret — 256 bits (32 random bytes, Base64url without padding, approximately 43 characters), used in the private route `/<public_id>/manage/<management_token>`. Generated server-side; the plaintext value is returned only once, to the authorized publishing client/capability holder, at creation. Only a secure hash of it is stored in the database. It is independent of `public_id`, `comparison_id`, device identity and time; management authority comes only from possessing this token, never from `public_id` or `comparison_id` alone.
- Sequential database IDs must never appear in public URLs or storage paths.

After successful verification of a management capability link, the browser may establish a protected management session so the secret token itself does not need to remain in subsequent visible browser URLs (see "Main Routes" above). Management tokens are never written to logs or analytics in plaintext.

## Upload Limits

For the current Version 1 browser import (SameView export ZIP):

- Maximum ZIP size: 25 MB
- Maximum number of contained files: 20
- Maximum uncompressed total size: 50 MB
- Nested archives are not allowed
- ZIP entries with absolute paths or path traversal segments (e.g. `../`) are rejected
- A ZIP archive containing more than one entry with the same relative path is rejected as invalid; this check does not depend on the specific ZIP parser used

Hosted Publication does not reuse this ZIP upload path. A publishing client sends structured publication data and only the specific image assets required for Hosted Publishing (see "Hosted Comparison Architecture" → "Upload and Processing" below), never a complete SameView backup/export ZIP. The corresponding per-image upload limits for Hosted Publication are defined in "Image Limits" below.

## Export Structure

- SameView Web Version 1 accepts valid session metadata versions 2 through 6 inclusive
- Current metadata fields are read before the documented legacy fallbacks in [docs/IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md)
- A valid import must contain a supported `metadata.json`
- A SameView export ZIP may contain more than one session directory (e.g. a multi-session backup); because Version 1 supports exactly one active workspace, an import ZIP containing more than one valid session directory is rejected as a distinct import failure and does not create or replace a workspace
- Relevant files are determined from the references in `metadata.json`
- Exactly one referenced `reference` file and exactly one referenced `capture` file are required
- Additional known SameView files may also be present (e.g. original images, HEIC source files, branding files)
- Files that are not referenced or not recognized are not processed automatically
- Unknown metadata fields are tolerated and preserved locally but are not published automatically
- Device-local URIs and MediaStore references are retained as provenance only and are never used for file resolution

## Image Limits

Current Version 1 client-side standalone HTML input:

- Maximum resolution per processed file: 40 megapixels
- Files must be decoded and validated based on their actual content; file extension and browser-supplied MIME type alone are not sufficient

Hosted Publication input, per required Comparison image (reference/capture):

- Maximum resolution per processed file: 40 megapixels
- Maximum upload size per image: approximately 20 MB
- Maximum per individual dimension: approximately 8000 px
- Files must be decoded and validated based on their actual content; file extension and browser-supplied MIME type alone are not sufficient
- Only the reference, capture and optional branding files actually needed for publication are processed
- Inputs exceeding these limits are rejected rather than processed with uncontrolled decode/resource usage

Custom branding asset input for Hosted Publication is smaller, since its output is always bounded to a small fixed size regardless of source size (see "Hosted Comparison Architecture" → "Upload and Processing" below):

- Maximum upload size: approximately 10 MB
- Maximum resolution: 24 megapixels
- Maximum per individual dimension: approximately 8000 px

Hosted output:

- Scaled to a maximum of 1920 px on the long edge, no upscaling, aspect ratio preserved
- One WebP asset per Comparison side for Version 1 (no responsive multi-size set)
- Target size: approximately 200 KB per image, without forcing this via visibly unusable compression
- Absolute limit: 350 KB per processed image; if exceeded despite valid processing, publication is rejected with a clear error message
- No user-facing Hosted quality control — the Hosted service determines output encoding

## Abuse Protection

The following requirements apply to anonymous Hosted Publication write operations (Publish, Update, Delete):

- Anonymous publishing must be protected against automated abuse.
- Simple server-side rate limiting is sufficient; failed attempts may count toward limits.
- No CAPTCHA, no third-party anti-abuse service, no device fingerprinting and no persistent user profiling are required.
- No account requirement is introduced solely for abuse protection.
- Responses must not reveal whether a Comparison/Public ID belongs to another requester.
- The concrete technical implementation (e.g. Redis, in-memory) is not yet defined, and should remain replaceable if multiple server instances later require shared rate-limit state.
- Normal public Hosted Viewer traffic (Resolve/View) is not subject to the same write-operation limits.
- Exact thresholds are operational configuration, not fixed architecture.

## Storage

In Version 1, Source Data and the Current Working State remain local to the browser. The concrete local persistence technology is not defined here. Standalone HTML is generated entirely in the browser and is not uploaded.

For Hosted Publication, publishing sends only the explicit outcome allowlist; Source Data and the complete Current Working State are never uploaded.

Hosted database storage (MySQL) — see "Hosted Comparison Architecture" → "Data Model" below for the full field list:
- internal publication identity and `comparison_id`
- `public_id` and `management_token_hash`
- allowlisted, published Presentation and user-visible metadata
- asset keys, including the active asset version
- created/updated timestamps and operational publication state where required

Hosted filesystem/Asset Storage — see "Hosted Comparison Architecture" → "Asset Storage" below for the full model:

comparisons/<internal-publication-id>/versions/<asset-version>/
- reference.webp
- capture.webp
- branding.webp (optional)

Original ZIP files are not stored. Original upload inputs to Hosted Publication are transient processing data only, never a permanent Hosted asset — see "Hosted Comparison Architecture" → "Upload and Processing" below.

### Embed Platform Storage

Embed in website ([docs/EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md)) is generated and downloaded from SameView Web exactly like Standalone HTML and Static Microsite. Once downloaded, its persistent storage exists entirely inside the target platform's own infrastructure (for example a customer's WordPress installation), never inside SameView Web's own database or filesystem. The hard constraints above — no S3 or other external object storage, one Netcup MySQL database, no persistent upload directory used by the browser-local V1 workflow — govern SameView Web's own infrastructure and do not apply to a target platform's storage, which is outside SameView Web's control. Platform-specific storage models are defined in the relevant platform integration document, for example [docs/WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md).

## Hosted Comparison Architecture

The following sections define the durable technical architecture of Hosted Publication: its data model, asset storage, update/cleanup model, delivery, public viewer, failure handling, reporting and deletion. They apply to the Hosted application (`my.sameview.app`) described in "Repository and Application Boundary" above.

### Data Model

Hosted Publication uses MySQL for structured Hosted state, in a single table conceptually named `comparisons`, consisting of:

- `id` — internal UUID, primary key, generated by the application, never exposed publicly
- `comparison_id` — the stored `session.comparisonId` (see "Identifiers" above), unique; enforces at most one active Hosted Publication per Comparison
- `public_id` — cryptographically random, URL-safe public ID, unique
- `management_token_hash` — hash of the private management token, unique
- `title` (optional)
- `description` (optional)
- `reference_label` — derived Outcome Snapshot value
- `capture_label` — derived Outcome Snapshot value
- `location_display_name` (optional)
- `location_city` (optional)
- `location_country` (optional)
- `branding_type` (optional)
- `branding_builtin_id` (optional)
- `background` — Dark or Light
- `corner_style` — Rounded or Sharp
- `active_asset_version` — identifies the currently active, immutable versioned asset set (see "Asset Storage" below)
- operational publication state, where required for atomic activation (see "Publication Update Atomicity" below)
- `created_at` (UTC)
- `updated_at` (UTC)

Further decisions:

- Binary images are never stored in MySQL.
- Asset paths are not stored as literal columns; the active asset version, together with `id`, determines the Asset Storage key (see "Asset Storage" below) — file paths are never derived from user input.
- There is no files table, no token table, no user table, no account table and no consent table.
- Published rows contain only the explicit outcome allowlist; complete session metadata and unknown fields are never stored.
- A parallel `comparison.json` (or equivalent file-based record) is not introduced as a second source of truth for Hosted Publication state; MySQL remains authoritative.
- Reports are a separate data model from the Hosted Publication itself — see "Reporting Architecture" below.

### Asset Storage

Hosted binary assets use a separate, provider-neutral Asset Storage boundary, distinct from MySQL:

- Initial provider: Netcup persistent filesystem.
- The rest of the application depends only on neutral asset keys, never on absolute Netcup/Plesk filesystem paths, S3-specific concepts, or other storage-provider URLs.
- A later move to S3-compatible object storage must not require redesigning Hosted product/API semantics or changing existing public Hosted URLs.

Assets are immutable and versioned, not overwritten in place:

comparisons/<internal-publication-id>/versions/<asset-version>/
- reference.webp
- capture.webp
- branding.webp (optional)

Built-in SameView branding remains semantic Presentation configuration (`branding_type`, `branding_builtin_id`) rather than a duplicated image file per Comparison/version, where technically consistent with the Hosted Public Viewer.

### Publication Update Atomicity

Hosted updates use the versioned asset model above to remain atomic:

1. The complete new version is prepared separately from the currently active one.
2. It is validated, processed and stored under a new immutable asset version.
3. Once the complete new Hosted state is verified ready, the MySQL Publication state and `active_asset_version` are switched atomically.
4. Until that activation succeeds, the previously published version remains fully active and unaffected.
5. The public URL never changes across an update.
6. The Hosted Public Viewer observes either the complete previous active state or the complete new active state, never a mixture.
7. If preparation fails, the previous Publication remains unchanged. If activation fails, the previous Publication remains active and the newly prepared assets become cleanup candidates (see "Cleanup and Orphan Handling" below).
8. Obsolete assets from a previously active version are removed only after successful activation, as cleanup work; a cleanup failure after a successful update does not roll back that update.

Exact transaction/SQL implementation is implementation work, not decided here.

### Cleanup and Orphan Handling

- Active MySQL references (`active_asset_version` and the Publication row itself) are authoritative for what is live.
- Unreferenced staged, failed or obsolete asset versions may be removed only after they are old enough that an active processing operation cannot reasonably still depend on them (a safety age).
- Cleanup is idempotent and re-checks that an asset is not actively referenced before deleting it.
- No Redis, queue or dedicated worker service is required solely for Version 1 cleanup; an initial periodic, Netcup/Plesk-compatible cleanup job is sufficient.
- Temporary raw upload inputs (see "Upload and Processing" below) use a separate, shorter-lived cleanup lifecycle than obsolete versioned assets, since they are never a permanent Hosted asset in the first place.
- A cleanup failure to physically remove obsolete or deleted assets must never make previously deleted or superseded content public again.
- Exact cleanup intervals/scheduling are deployment configuration, not decided here.

### Upload and Processing

- A Hosted publishing client sends structured publication data plus only the specific assets required for Hosted Publishing — never a complete SameView backup/export ZIP (see "Upload Limits" above).
- The Hosted service treats every client as untrusted: it validates actual image content (not merely extension/MIME claims), enforces the byte/pixel/dimension limits in "Image Limits" above, and requires the two core Comparison images to successfully decode before activation.
- The Hosted service always freshly decodes, processes and encodes the canonical Hosted WebP output itself, per "Image Limits" above and [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) — it never trusts client-side processing, including any privacy preprocessing already performed by the publishing client (see below).
- A publishing client may prepare privacy-safe temporary upload copies before network transfer (for example, removing embedded location/EXIF metadata locally before sending), but this is a defense-in-depth measure only. The Hosted service's own processing remains the final trust boundary and independently enforces the same privacy guarantees regardless of what a client already did. Detailed client- and server-side privacy processing semantics are defined in [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md), not here.
- Original upload inputs are transient processing data only, held in a non-public, non-publicly-routable temporary area and never treated as a permanent Hosted asset; see "Cleanup and Orphan Handling" above for their lifecycle.

### Asset Delivery and Caching

- Versioned Hosted assets (see "Asset Storage" above) are immutable once active; a given asset version's public identity never changes underneath it.
- They may be served efficiently as static, SameView-controlled resources rather than forcing every image byte through the application server on each view.
- Long-lived, immutable public HTTP caching is appropriate for versioned assets, since a new Publication version naturally uses a new asset version rather than requiring cache invalidation of the old one.
- The stable Publication page itself (`/<public_id>`) remains revalidatable/short-lived enough that a successful Update becomes visible to viewers promptly.
- No physical storage-provider path is ever exposed through a public asset URL.
- Exact cache durations are operational configuration, not decided here.

### Hosted Public Viewer Architecture

The Hosted Public Viewer is shared application/runtime logic that resolves the current Publication state and renders it — not one generated, complete HTML file persisted separately per Publication. Improving or fixing the common viewer must not require regenerating or rewriting every stored Publication's content.

Where practical, the Hosted Public Viewer reuses SameView's existing framework-independent Presentation/runtime modules rather than a parallel slider implementation: the current comparison markup and document-scaffold builders are pure string builders with no browser or React dependency, and the current interactive slider/overflow-tooltip runtime already ships as a dependency-free script consumed by non-hydrated documents (Standalone HTML, Static Microsite). This makes them a plausible technical foundation for server-rendering the Hosted Viewer from stored Publication data; the exact reuse implementation is a technical-design decision for the Hosted application, not fixed here.

#### Search and Indexing

Hosted Publication pages are link-accessible to anyone with the public link, but are not intentionally designed for search-engine indexing in Version 1. `noindex` behavior is implemented at the Hosted Public Viewer layer. This reduces unintended discovery; it is not an access-control mechanism — see "Public Viewer Failure States" below and [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) for the corresponding privacy framing.

### Public Viewer Failure States

The Hosted Public Viewer distinguishes:

- a nonexistent, deleted or otherwise publicly unavailable Publication → a neutral not-available result, without disclosing whether the Publication previously existed or why it is unavailable;
- an infrastructure/database/storage failure → a distinct temporary/technical-failure result, which must never be presented the same way as a genuinely unavailable Publication;
- a missing or corrupt required core asset (reference or capture) → the viewer does not render a half-working Comparison; this is treated as a temporary/technical failure;
- a missing or broken optional asset (for example custom branding) → graceful degradation where the core Comparison itself otherwise remains valid.

Exact user-facing copy and additional client-side states (for example JavaScript-disabled or network-loading failures) belong to the feature/UI specification (see [docs/FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-007), not to this document.

### Reporting Architecture

Hosted Publication provides a separate report data model and a dedicated report entry point (`/<public_id>/report` — see "Main Routes" above), distinct from the Publication record itself:

- a report associates with exactly one public Publication;
- submitting a report never automatically deletes or suspends the associated Publication;
- reviewing a report and disabling/removing a Publication where required uses a secure, non-public operator process; a full moderation dashboard is not required for Version 1;
- operator/legal takedown capability remains architecturally separate from user management-token ownership — an operator action is never a substitute for, and never discloses, management authority.

Exact legal report fields, categories and retention are external legal-review work, not architecture, and are not decided here.

### Publication Deletion

Hosted Publication deletion is a hard delete:

- public accessibility ends immediately and logically first;
- the live database record and its active/referenced assets are removed;
- there is no user-facing Trash, Undo period, version history or tombstone record for a deleted Publication;
- a failure to physically remove assets after logical deletion must never make the Publication publicly accessible again (see "Cleanup and Orphan Handling" above).

Backup retention and disaster-recovery interaction with this deletion model are documented in [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) and [docs/deployment.md](deployment.md), not here.

## Backup

The following backup requirements apply to the database and persistent Asset Storage used by Hosted Publication:

- The MySQL database and the persistent Asset Storage are covered by the regular Netcup backups.
- A detailed backup and restore strategy, including the interaction between infrastructure backup retention and Publication deletion, is documented in [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) and [docs/deployment.md](deployment.md), not decided in full here.
- SameView Web is not a backup system for complete SameView exports.

## Local Development

The publication-related MySQL setup described in this section is a prepared technical foundation for Hosted Publication. It does not add publication infrastructure to the current Version 1 implementation scope.

- The Astro/Node application runs locally directly on the host via pnpm; it does not run in a Docker container locally.
- MySQL runs locally as a single container via Docker Desktop.
- The compose file is named `compose.yaml`; the deprecated filename `docker-compose.yml` is not used.
- MySQL remains the only infrastructure service required to run the application locally.
- `phpMyAdmin` is an explicitly permitted, optional local development container — used solely for manual, ad-hoc access to the local development database.
- `phpMyAdmin` is not a production component: it is never deployed, never part of the Netcup/Plesk hosting setup, and not covered by any of the production architecture decisions elsewhere in this document.
- `phpMyAdmin` is not a dependency of the application itself — the app never talks to it, imports it, or requires it to run.
- `phpMyAdmin` does not change the runtime architecture or the deployment process described in [docs/deployment.md](deployment.md) in any way.
- No other additional containers (e.g. Redis, Adminer, backend containers) are introduced.
- Production uses the existing Netcup MySQL database; local and production use the same versioned database schema.
- Credentials are provided exclusively via environment variables.
- A `.env.example` will be committed later; the real `.env` and other local secrets are never committed.

## MySQL Configuration

Production already uses MySQL Community Server 8.0.46; the local Docker version must use the same version, not `mysql:latest`.

Binding for SameView Web:

- Character set: utf8mb4
- Collation: utf8mb4_unicode_ci
- Timestamps: UTC

These settings apply regardless of any older databases still using utf8mb3.

## Local Docker Compose

The `compose.yaml` must satisfy at least these binding requirements:

- one MySQL service
- one persistent named volume
- a healthcheck
- configuration via environment variables
- MySQL pinned to version 8.0.46

Additional technical settings are explicitly permitted as long as they exclusively serve these requirements — for example MySQL server parameters for `utf8mb4` and `utf8mb4_unicode_ci`, UTC configuration, a restart policy, port mapping, or the concrete healthcheck implementation. No unrelated services or features are added.

The application connects exclusively via `DATABASE_URL`.

Intended local flow:

1. `docker compose up -d`
2. `pnpm db:migrate`
3. `pnpm dev`

A full local reset will later be possible by removing the Docker volume and re-running the migrations.

## Database Schema and Migrations

These database requirements apply to the prepared Hosted Publication foundation.

- The database schema is fully versioned.
- Schema and SQL migrations are stored in the repository.
- Tables are never created automatically via `CREATE TABLE IF NOT EXISTS` on application startup.
- Changes happen exclusively through versioned migrations.
- Migrations do not run automatically on normal web application startup; they are a deliberate development/deployment step.
- The schema and migrations are managed with Drizzle ORM and Drizzle Kit; migrations are generated into `drizzle/`.

## MySQL Logical Separation

The Hosted application owns its own database access layer. It may initially use the same physical MySQL server/instance already available in the hosting environment as the root Web application, but Hosted state remains logically isolated from unrelated application state — for example in a dedicated database/schema, or in clearly namespaced tables within an existing database. The exact choice is finalized during technical/deployment implementation, based on the current deployment environment, and is not decided here.

## Planned Repository Structure

```text
sameview-web/
├── docs/
├── drizzle/
├── hosted/                 (future Hosted application — my.sameview.app)
├── src/
│   ├── db/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── pages/
│   └── server/
├── compose.yaml
├── .env.example
└── package.json
```
