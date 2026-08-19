# Hosted Comparison / Online Sharing --- Approved Product Decision Baseline

**Status:** Approved product decision baseline (Revision 4)\
**Date:** 2026-08-19\
**Purpose:** Consolidated product decisions for the planned SameView
Hosted Comparison / Online Sharing feature (`sameview-web` backend and
public viewer, SameView Android as the intended first publishing
client). This document is an input for repository analysis, technical
design, specification work, and later implementation planning. It is
**not yet the final Hosted implementation specification**, and it does
not yet update [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md)
F-006/F-007.

Its role for Hosted Comparison is the same role
[EMBED_IN_WEBSITE_APPROVED_PRODUCT_DECISIONS_2026-08-11.md](EMBED_IN_WEBSITE_APPROVED_PRODUCT_DECISIONS_2026-08-11.md)
played for `Embed in website`: it freezes product decisions already
made so that the remaining open technical and product questions can be
worked through against a stable baseline, without re-litigating what is
already decided.

**Revision 4 note:** This revision resolves the Hosted application and
deployment boundary: the repository stays a single `sameview-web`
repository with the existing root application untouched for
`web.sameview.app`; Hosted Comparison is built later as a second,
independently deployable Node/Astro application under a dedicated
`hosted/` directory in the same repository, deployed as its own
Netcup/Plesk Node.js application/subdomain for `my.sameview.app` with
its own Application Root, deployment target and runtime lifecycle ---
explicitly not via Host-header multiplexing of one application. This
resolves the previously open question of whether Netcup/Plesk can host
`my.sameview.app` at all: it can, as its own subdomain with its own
Node.js application instance. See "Application and deployment boundary"
under "Canonical Hosted domain and URLs" below for the full decision,
including the API-ownership relationship between Android, a future
SameView Web publishing client and `my.sameview.app`, the shared-code
policy between the two applications, and the MySQL/Asset Storage
boundary. Revision 1 through Revision 3 decisions are preserved below
except where a specific paragraph is marked **superseded** or has been
rewritten by this revision.

**Status reconciliation note (post-Revision 4):** The "Known Conflicts
and Gaps" and "Next-step contract" sections below have since been
annotated to record that `PRODUCT_SCOPE.md`, `ARCHITECTURE.md` and
`IMPORTED_COMPARISON_V1.md` (and, on the Android side,
`CLAUDE_PROJECT_INSTRUCTION.md`) have already been brought into
alignment with this baseline through subsequent documentation-
implementation iterations. This is a status update, not a new
product/architecture decision --- no approved Revision 4 decision is
changed, and this document remains Revision 4.

**Revision 3 note:** This revision resolves the Android Hosted
credential/registry questions Revision 2 left open under "Android
management persistence" and "Local Android `Online comparisons`":
the registry storage technology (a dedicated third
`DataStore<Preferences>`), its physical location
(`context.noBackupFilesDir`, superseding any earlier suggestion of the
normal DataStore directory plus backup-XML exclusions), its
conceptual JSON representation and minimal field set, the decision to
match registry entries against local sessions via
`session.comparisonId` rather than a cached `session.id`, the secret
protection approach (Android Keystore, AES-256-GCM, no new
dependency, no biometric/StrongBox requirement), key-lifecycle and
credential/key-loss handling, registry corruption handling, Android
logging rules for the management secret, the exact local/online
deletion ordering and failure handling, `Delete online`'s placement in
`CompareScreen` and in `Online comparisons`, `Online comparisons`'s
navigation placement and local/remote model, and the introduction of
Android's first network capability for Hosted publishing. Revision 1
and Revision 2 decisions are preserved below except where a specific
paragraph is marked **superseded** or has been rewritten by this
revision. Nothing in Revision 3 resolves the publishing-client
conflict or the other items already recorded under "Known Conflicts
and Gaps" and "Explicitly Open Decisions" unless explicitly stated.

**Revision 2 note:** This revision adds a second round of decisions
covering identifiers, the canonical Hosted domain, update/versioning
atomicity, cleanup, rate limiting, publication lifetime and deletion,
public-viewer failure states, asset delivery/caching, the Hosted API
surface, client/API security boundaries, upload validation, client-side
privacy preprocessing, the exact Hosted source images and output/input
image limits, custom branding limits, SameView service branding in the
viewer, content reporting, search-engine discoverability, QR/sharing,
the local Android `Online comparisons` surface, recovery, and long-text
viewport behavior. Revision 1 decisions are preserved below except where
a specific paragraph is marked **superseded**. Nothing in Revision 2
resolves the publishing-client conflict or the other items already
recorded under "Known Conflicts and Gaps" and "Explicitly Open
Decisions" unless explicitly stated.

## Relationship to existing documents

This baseline does not duplicate or replace any existing specification.
It records decisions that are new, and it explicitly cross-references
existing supporting architecture where a decision already has a basis
in current specifications or code. The most relevant existing documents
are:

- [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) --- places Hosted Comparison in
  "Future Scope: Version 2"; defines the current Android/Web
  relationship this baseline partially revises (see "Known Conflicts
  and Gaps" below).
- [ARCHITECTURE.md](ARCHITECTURE.md) --- defines the planned
  `internal_id` / `public_id` / `management_token` identifier model,
  routes, upload/image limits, and the prepared (unmigrated)
  `comparisons` MySQL table. Revision 2 makes the identifier formats,
  routes/domain, and image limits concrete (see "Identifier formats",
  "Canonical Hosted domain and URLs", "Hosted image output" and
  "Hosted image input security limits" below); several of these are now
  more specific than, or differ in shape from, ARCHITECTURE.md's
  current text --- see "Known Conflicts and Gaps".
- [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) --- defines the planned
  Version 2 image-processing pipeline, publication allowlist, and hard
  deletion semantics.
- [IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md) --- defines
  `session.id` as the current authoritative Comparison identity for
  SameView Web import and Embed matching; this baseline introduces a
  distinct, additional identity for Hosted (see "Global Comparison
  Identity" below).
- [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) --- defines
  the existing shared Presentation model (Comparison Stage, Comparison
  Information Rendering, Canvas Background, Corner Radius, Initial
  Slider Position, and the Overflow Tooltip interaction) that several
  Hosted decisions below deliberately build on, including the new "Long
  text and viewport behavior" section.
- [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) --- the closest existing
  precedent for a persistently stored, server-rendered SameView output
  reused across placements; referenced for architectural precedent, not
  duplicated.
- Android repository (`C:\data\work\privat\git-repos\sameview`),
  read-only: `docs/COMPARE_FLOW_V1.md`, `docs/COMPARE_SESSION_RENDERING_V1.md`,
  `docs/SESSION_METADATA_V1.md`, `docs/SESSION_BACKUP_EXPORT_V1.md`,
  `docs/SHARE_COMPARISON_IMAGE_V1.md`, `docs/VIDEO_EXPORT_V1.md`, and
  `app/src/main/java/com/isardomains/sameview/ui/camera/SessionStorage.kt`,
  `.../ui/camera/CameraScreen.kt`, `.../ui/camera/ReferenceRenderer.kt`,
  `.../ui/camera/MetadataTextSanitizer.kt`, `.../ui/camera/SessionDeleter.kt`.
  Revision 2 additionally confirms, by direct source inspection, that no
  character-length limits exist on `content.title`, `content.description`
  or `location.*` anywhere in the Android app (only trimming and
  zero-width/Bidi-character sanitization) --- see "Long text and viewport
  behavior".

No file in the Android repository is modified by this baseline; Android
specifications are consulted read-only.

---

## 1. Product concept

- Hosted Comparison is an online-sharing outcome for an existing
  SameView Comparison, alongside the existing Standalone HTML, Static
  Microsite and approved Embed in website outputs.
- Publishing produces a stable public URL.
- The public result is an interactive SameView Comparison, not a
  downloadable artifact.
- The Hosted backend and public viewer live in the `sameview-web`
  repository, as a separate deployable application from the existing
  root Web application (see "Application and deployment boundary" under
  "Canonical Hosted domain and URLs" below), using the identifier
  model, upload limits and image-processing principles already planned
  in [ARCHITECTURE.md](ARCHITECTURE.md) and
  [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) for Version 2 Hosted
  Publication.
- The intended first end-user publishing client is SameView Android.
- SameView Web will later become another publishing client of the same
  Hosted backend.
- Backend and public-viewer design must not be unnecessarily coupled to
  the SameView Web editor.

This introduces a sequencing change relative to the current product
scope, which currently frames publication as a SameView Web action. See
"Known Conflicts and Gaps" below --- this conflict is recorded, not
resolved, by this baseline.

## 2. One active publication per Comparison

- A SameView Comparison may have at most one active Hosted Publication.
- Publishing an already managed Comparison must update that existing
  publication rather than create an additional public URL.
- The public URL remains stable across successful updates.
- After a Hosted Publication has been fully deleted, the same
  Comparison may later be published again and may receive a new public
  URL.
- No permanent tombstone is required merely to remember that a deleted
  Comparison was previously published, consistent with the hard-delete,
  no-tombstone model already approved in
  [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Deletion (Version 2
  Hosted Publication)".

Enforcing "at most one active publication per Comparison" requires a
Comparison-level key on the publication record. The currently
documented `comparisons` table (ARCHITECTURE.md "Initial Data Model")
has no such key --- see "Known Conflicts and Gaps". How an `Update`
under this invariant is made atomic against the versioned asset model
is now specified in "Hosted update atomicity" below; how a conflicting
`Publish` attempt is handled is specified in "Hosted API product
operations" below.

## 3. Global Comparison identity

The existing Android `session.id` (the session's export-archive
directory name, see
[IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md) "Session
Identity", generated as `yyyy-MM-dd_HH-mm-ss[_n]` from local device
time --- Android `SessionStorage.kt`, function that builds
`baseName`/`sessionDir`) is not globally unique across independent
devices and must not be used as the global Hosted Comparison identity.

Introduce:

`session.comparisonId`

Rules:

- UUID v4.
- Canonical lowercase hyphenated textual representation.
- Generated locally/offline with the platform's standard secure random
  UUID facility, e.g. Android `UUID.randomUUID()`.
- No external service.
- No SameView server call.
- No device identifier.
- No timestamp-derived global identity.
- Not secret.
- Immutable after assignment.
- Represents the stable product-level identity of that Comparison.

Keep the concepts distinct:

- `session.id` = existing Android-local/session-directory identity,
  authoritative for SameView Web import and Embed matching as defined
  today in IMPORTED_COMPARISON_V1.md and
  [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Comparison Identity".
- `session.comparisonId` = globally unique Comparison identity, used
  for Hosted Comparison.
- Hosted `public_id` = public Hosted Publication URL identity (exact
  format: see "Identifier formats" below).
- Hosted `management_token` = secret management authority (exact
  format: see "Identifier formats" below).

`session.comparisonId` alone never authorizes update or deletion.

This is a newly introduced identity concept; it does not change or
supersede `session.id`'s existing role. See "Known Conflicts and Gaps"
for how this relates to IMPORTED_COMPARISON_V1.md's and
EMBED_IN_WEBSITE.md's current identity language.

## 4. Metadata compatibility

- Keep the current Android metadata version at version 6 for this
  addition (current Android `SessionStorage.METADATA_VERSION` /
  `SessionScanner.SUPPORTED_VERSIONS = {2,3,4,5,6}`, matching
  IMPORTED_COMPARISON_V1.md "Supported Metadata Versions").
- Do not introduce metadata version 7 solely for `session.comparisonId`.
- `session.comparisonId` is an optional additive field in the existing
  metadata structure.
- Existing v2--v6 Comparisons legitimately may not contain it.
- New Comparisons created by the future Android version receive it
  when the Comparison is created.
- Existing Comparisons receive it lazily only when an operation
  genuinely requires a global Comparison identity; the initial intended
  trigger is `Host online`.
- Do not assign it merely during scan, open, ordinary edit or ordinary
  export.
- Lazy assignment must preserve the existing metadata document and
  unknown/legacy fields through the existing targeted read/patch/write
  pattern (the same pattern Android's `SessionStorage.kt` already uses
  for `updateContent`/`updateReferenceDate`/`updateLocation`/etc.).
- Once assigned, all subsequent normal exports include it automatically
  as part of `metadata.json`.
- It is safe for normal exports because it is not a secret.
- A future management credential must never be written into ordinary
  export metadata (see "Android management persistence" below).

This approach is consistent with IMPORTED_COMPARISON_V1.md's "Forward
Compatibility" principle (unknown/new optional fields must not
invalidate a comparison; adding a required field or changing meaning
would need an explicit compatibility decision, which this is not, since
the field is optional and additive) and with SameView Web's own
tolerance for unknown/optional fields at every metadata nesting level.

## 5. Accountless management

Hosted Comparison V1 is intentionally accountless:

- no SameView account;
- no login;
- no required email address;
- no server-side user profile solely for Hosted Sharing.

A separate high-entropy management credential authorizes update/delete
operations.

Server storage:

- only a secure hash of the management token is persisted;
- plaintext management authority is never recoverable from the
  database.

This matches [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) "Out of Scope (V1)"
("User accounts") and the `management_token`/`management_token_hash`
model already planned in ARCHITECTURE.md "Identifiers" and "Initial
Data Model", and DATA_AND_PRIVACY.md "Stored Data" ("The plaintext
management token is shown to the user only once, at creation, and is
never stored or retrievable afterwards."). The exact `public_id` and
`management_token` formats, and the exact hash used for the latter, are
now decided --- see "Identifier formats" immediately below.

## 6. Identifier formats

Concrete formats for the two identifiers introduced in "Accountless
management" and used throughout this baseline.

### Public ID

- 72 bits cryptographically random;
- 9 random bytes;
- Base64url without padding;
- 12 characters;
- case-sensitive;
- generated server-side;
- protected by a database uniqueness constraint;
- regenerate on the extremely unlikely event of collision.

Example form: `k7Pq2_Zx4AbN`.

The public ID is not a secret, but it should not be practically
enumerable.

### Management token

- 256 bits cryptographically random;
- 32 random bytes;
- Base64url without padding;
- approximately 43 characters;
- generated server-side;
- plaintext returned only to the authorized publishing client/capability
  holder, at creation, exactly once (per "Accountless management"
  above);
- server persists only a secure hash --- a high-entropy random
  management token may be verified through a cryptographic hash such as
  SHA-256 rather than treating it as a human password (no password-style
  slow-hash/KDF is required for this purpose);
- never derive it from `public_id`, `comparisonId`, device identity or
  time.

## 7. Canonical Hosted domain and URLs

The canonical Hosted Comparison domain is:

`https://my.sameview.app`

It is intentionally separate from:

- `sameview.app` --- product/website;
- `web.sameview.app` --- SameView Web editor/application.

The canonical public Hosted URL is:

`https://my.sameview.app/<public_id>`

There is no `/v/` prefix. This is a deliberate departure from the
`/v/<public-id>` route currently documented in ARCHITECTURE.md "Main
Routes" --- see "Known Conflicts and Gaps".

This public URL must remain stable across successful updates and
independent of:

- Netcup;
- Plesk;
- physical filesystem paths;
- future S3/object storage;
- internal deployment architecture.

QR codes and normal public sharing always use this canonical public URL
(see "QR code and public sharing" below).

### Management URL

The private management capability URL is:

`https://my.sameview.app/<public_id>/manage/<management_token>`

The `public_id` identifies the Publication but is not an authorization
factor. The `management_token` is the secret management capability.
Both must resolve to the same Publication.

After successful browser verification of the capability URL:

- establish an appropriately protected management browser session;
- redirect to a token-free management URL such as:
  `https://my.sameview.app/<public_id>/manage`;
- do not keep exposing the secret token unnecessarily in subsequent
  browser URLs.

The management surface must not load unnecessary third-party resources
that could leak capability information (e.g. no third-party analytics,
font or asset host that would receive the management URL as a
`Referer`).

Management tokens must not be written to normal application/access
analytics or logs in plaintext.

### Application and deployment boundary

The repository remains a single GitHub repository, `sameview-web`. The
existing SameView Web application remains in the repository root and is
not moved or reorganized merely to introduce Hosted Comparison. A
speculative monorepo restructure such as `apps/web`, `apps/hosted`,
`packages/shared` is not performed for Hosted V1.

`web.sameview.app` continues to use the existing root application and
its existing, already-proven Netcup/Plesk/Passenger deployment
architecture (see [deployment.md](deployment.md)). Its current
repository/application structure remains intact unless a later
implementation phase explicitly approves a targeted change.

Hosted Comparison is built later as a second, independently deployable
Node/Astro application inside the same repository, under a dedicated
directory conceptually named `hosted/`. The exact files inside
`hosted/` are implementation work, not decided here.

`hosted/` / `my.sameview.app` owns:

- the Hosted public viewer;
- the Hosted Publish API;
- the Hosted Update API;
- the Hosted Delete API;
- Hosted Resolve/View behavior;
- the Hosted report endpoint/workflow;
- Hosted MySQL access;
- Hosted Asset Storage access;
- Hosted processing/cleanup logic;
- the Hosted management browser surface.

`my.sameview.app` runs as a separate Node.js application/subdomain in
Netcup/Plesk with its own Node.js application configuration,
Application Root, deployment target/path, runtime environment
variables, and restart/deployment lifecycle --- independent of
`web.sameview.app`'s.

**Superseded:** the previously open question of whether Netcup/Plesk
can host `my.sameview.app` at all is resolved --- Netcup/Plesk can host
`my.sameview.app` as its own subdomain with its own Node.js application
instance. This is no longer an unresolved architecture blocker.
Concrete Plesk setup steps (Application Root, deploy path, environment
variables) belong to implementation/deployment work, not this baseline.

No Host-header multiplexing of `web.sameview.app` and `my.sameview.app`
through one application is the approved Hosted V1 architecture. This
avoids coupling the two applications' request-handling, deployment and
restart lifecycles to each other.

#### Repository/deployment relationship

Although both applications live in the same GitHub repository, they are
independently deployable. Conceptually:

- root application -> `web.sameview.app`;
- `hosted/` application -> `my.sameview.app`.

The deployment system may later use separate jobs in one GitHub Actions
workflow, or separate workflows, provided deployment targets and
runtimes remain independent. The exact workflow structure is
engineering work for the later deployment implementation; concrete
secret names or deploy paths are not decided here.

#### API ownership

Android Hosted Publishing communicates directly with `my.sameview.app`
and does not need to route Hosted operations through `web.sameview.app`.
A future SameView Web publishing client also communicates with the same
Hosted backend/API at `my.sameview.app`. Hosted publication/storage
semantics therefore remain client-neutral, matching "Client/API
security boundaries" above.

```text
Android ───────┐
               ▼
        my.sameview.app
        Hosted Service
               ▲
               │
web.sameview.app
        later
```

#### Shared code

Living in one repository does not mean the two applications should
duplicate common comparison/runtime logic unnecessarily. However:

- a shared-package architecture is not created speculatively;
- existing root Web code is not moved merely to make the repository
  appear monorepo-like;
- modules are shared/reused only where technically practical and where
  an actual Hosted implementation needs them (see "Stable public URL /
  viewer" below for reuse candidates already identified, e.g.
  `comparison-artifact-markup.ts`/`comparison-artifact-scaffold.ts`);
- a dedicated shared package is extracted only if real reuse pressure
  later justifies it.

The initial goal is minimal, targeted reuse without destabilizing the
existing root application.

#### MySQL boundary

The Hosted application owns the Hosted database access layer. It may
use the same physical MySQL server/instance already available in the
hosting environment, but Hosted state remains logically separated from
unrelated Web application state. The exact choice between a dedicated
Hosted database/schema and clearly isolated Hosted tables in an
existing database is finalized during technical specification/
implementation, based on the current deployment environment --- not
decided here. Binary Hosted image assets are not put in MySQL,
consistent with "Persistence architecture" below.

#### Asset Storage boundary

The Hosted application's Storage abstraction remains exactly as already
approved in "Asset storage" below: Netcup persistent filesystem
initially, provider-neutral asset keys, later replaceable by
S3-compatible/object storage, no physical storage-provider URL leaking
into public Hosted URLs or core product state.

#### Why this architecture is approved

- preserves the existing proven SameView Web deployment architecture;
- keeps Hosted backend/public-viewer concerns isolated;
- allows independent deploy/restart/runtime configuration;
- keeps Android independent from the SameView Web editor;
- allows future SameView Web publishing through the same client-neutral
  Hosted API;
- avoids unnecessary Host-header routing complexity;
- avoids a disruptive repository-wide monorepo reorganization;
- still permits focused code reuse inside the same repository.

## 8. Android management persistence

The Android app must store Hosted management state separately from the
exportable session files.

Conceptual association:

`comparisonId -> Hosted publication information + management credential`

The following requirements are approved, including the storage
technology, physical location and encryption approach that Revision 2
of this baseline left open:

- the management credential is app-private;
- it is not stored inside `metadata.json`;
- it is not stored in a normal SameView export;
- it is not derived from `session.comparisonId`;
- Hosted management state is logically independent from the local
  session-file lifecycle.

If the local Comparison is deleted while the Hosted Publication is
deliberately kept online, the app must retain the local Hosted
management capability.

There is no existing Android concept of a stored secret/management
credential to reconcile with --- the current Android session model
(`metadata.json`, `SessionStorage.kt`, `SessionBackupExporter.kt`) has
no token/secret/credential field of any kind, so this is new territory,
not a change to existing behavior.

### Storage technology

The Hosted management registry uses a dedicated third
`DataStore<Preferences>`, intentionally reusing the persistence pattern
SameView Android already establishes for Settings and Guide state (two
existing Hilt-provided, qualified `DataStore<Preferences>` singletons).
Room, SQLite, `SharedPreferences`, a new persistence dependency, or a
separate database solely for Hosted management are not introduced. The
registry is expected to remain small and requires only simple
list/lookup/update/delete behavior --- a database is not justified
merely because the server uses MySQL. Exact class names, DataStore
qualifier names and internal repository structure are implementation
details, not decided here.

### Physical location

The Hosted registry is stored under Android `context.noBackupFilesDir`,
rather than the normal `filesDir/datastore` location used by the
existing Settings/Guide DataStores. This supersedes any earlier reading
of this baseline as suggesting the Hosted registry should live in the
normal DataStore directory and be protected only through matching
exclusion rules added to `backup_rules.xml`/`data_extraction_rules.xml`.
The reason: the Hosted management registry contains a bearer management
credential and is intentionally local installation state; the approved
recovery model is the private management capability link, not Android
Auto Backup or Device Transfer (see "Recovery and device changes"
below). Using `noBackupFilesDir` makes backup exclusion structural
rather than dependent on maintaining matching exclusion rules in two
separate XML files that an unrelated future change could silently
break.

As a direct consequence, the Hosted registry:

- is not included in Android Auto Backup;
- is not included in cloud backup;
- is not included in device-transfer backup;
- is not included in a normal SameView session ZIP export;
- does not survive app uninstall;
- does not survive Clear Storage;
- is not automatically restored on another device.

No additional Hosted-specific backup-XML exclusions are required when
`noBackupFilesDir` is used correctly. Existing backup behavior for
unrelated Settings/Guide state is outside this decision.

### Registry representation

The registry is one versioned document stored through DataStore,
conceptually:

```json
{
  "version": 1,
  "publications": [
    {
      "comparisonId": "...",
      "publicId": "...",
      "encryptedManagementToken": "...",
      "displayTitleSnapshot": "...",
      "publishedAtMs": 0,
      "updatedAtMs": 0
    }
  ]
}
```

This is a conceptual structure, not a final serialization/API contract;
exact JSON key names and the encrypted-token encoding are
implementation details. A single registry-level `version` marker is
used rather than an independent schema version on every entry, unless
later implementation evidence shows a concrete need for finer-grained
versioning. Future registry evolution remains additive/migratable.

### Minimal registry fields

Each locally managed Hosted Publication stores only the local
information required for management and useful offline identification:

- `comparisonId`;
- `publicId`;
- encrypted `managementToken`;
- nullable/local `displayTitleSnapshot`;
- `publishedAtMs`;
- `updatedAtMs`.

The registry does not persist, merely for convenience:

- the full canonical public URL --- derived at use time from
  `https://my.sameview.app/<publicId>` (see "Canonical Hosted domain
  and URLs" above);
- the full private management URL --- constructed only when the user
  deliberately requests it, never persisted;
- local filesystem paths;
- the Android `session.id` as a lookup cache (see "No `session.id`
  lookup cache" immediately below);
- Hosted Presentation configuration;
- Hosted image assets or thumbnails;
- duplicate copies of server-side publication state.

### No `session.id` lookup cache

The registry does not store Android `session.id` merely to avoid
scanning local sessions. The authoritative cross-feature identity
remains `session.comparisonId` (see "Global Comparison Identity"
above). When `Online comparisons` needs to know whether a registry
entry's corresponding local Comparison still exists, it uses the
existing local session scanning model, reads `session.comparisonId`
where present, and matches it against the Hosted registry's
`comparisonId` --- see "Local Android `Online comparisons`" below. No
dedicated session index or cache is introduced solely for Hosted V1;
the expected scale does not justify the added complexity. A future
performance optimization may introduce an index only if actual measured
need justifies it.

### Secret protection

Only the secret management credential requires encryption at rest;
`comparisonId`, `publicId`, the display title snapshot and timestamps
are not encrypted. Protection uses:

- Android Keystore;
- one app-owned, non-exportable symmetric AES key;
- AES-256-GCM authenticated encryption;
- a fresh IV/nonce per encryption operation, as GCM requires.

The key is created lazily, the first time Hosted credential encryption
is actually required. The same Keystore key protects every Hosted
registry token in the installation; a key per Publication is not
created without a concrete reason to do so.

### No new dependency

Encryption uses Android/platform cryptographic APIs
(`android.security.keystore`, `javax.crypto`) directly. Jetpack
Security (`androidx.security:security-crypto`) is not added solely for
this feature unless later implementation analysis proves the
platform-only approach inadequate --- its primary abstractions do not
match the app's existing DataStore-based persistence pattern, and the
amount of hand-written Keystore code needed for one encrypted field
does not justify a new dependency. Room or another storage/security
framework is likewise not added for Hosted V1 (see "Storage technology"
above).

### No biometric or StrongBox requirement

Hosted credential access does not require biometric authentication,
lock-screen reauthentication, or StrongBox-backed key storage.
User-authentication-required key behavior is not set merely because the
token is secret --- the product does not currently require a
password-manager-style unlock flow. (Avoiding this also avoids key
invalidation when the device's lock-screen configuration changes, which
`setUserAuthenticationRequired` would otherwise trigger.) StrongBox may
be considered later as optional hardening if a concrete need is
demonstrated, but it is not a V1 product requirement.

### Key lifecycle

The Hosted registry encryption key is created lazily, remains
non-exportable in Android Keystore, and survives normal app updates. It
does not need to survive uninstall/Clear Storage, is not part of a
SameView export, and is not part of Android backup recovery ---
consistent with "Physical location" above. If the Keystore key becomes
unavailable or is lost, SameView must never fabricate new management
authority for existing registry entries; the private management
capability link remains the intended recovery mechanism (see "Recovery
and device changes" below).

### Credential/key loss behavior

If a Hosted registry entry still contains valid non-secret metadata but
its management token cannot be decrypted, the Publication may remain
visible in `Online comparisons`. Public-only actions that require only
`publicId` remain possible --- View online, Copy public link, Share
public link, QR code. Management-authority actions are
disabled/unavailable --- Update online, Delete online, exposing or
reconstructing the private management link. The UI may explain that
management access is unavailable and that the private management link
is required for recovery. SameView never generates a new management
token locally, and never treats `comparisonId` or `publicId` as
replacement authority.

### Registry corruption behavior

The existing SameView resilience principle applies: a corrupt entire
registry must not crash the app; a malformed individual entry must not
invalidate unrelated valid entries; missing credentials are never
fabricated; management authority fails closed. This mirrors the
existing Android session scanner's tolerance for individual malformed
sessions without invalidating an entire scan, and the corruption-handler
pattern already used by the existing Guide/Settings DataStores. The
exact corruption-handler/migration implementation remains a technical
detail.

### Logging and privacy

Hosted management secrets require stricter logging discipline than
ordinary identifiers. The plaintext `managementToken`, the complete
management capability URL, and the encrypted management-token/ciphertext
blob must never be logged --- including in debug builds.
`BuildConfig.DEBUG` gating alone is not relied on as protection for
management secrets. `comparisonId` and `publicId` are not secrets, but
logging involving them still remains minimal and operationally
justified. If a crash-reporting/analytics system is introduced in the
future, Hosted management-token and capability-URL scrubbing must be
explicitly verified before such an integration receives data from
Hosted code paths.

### Security limitations

Android Keystore protects normal app-private credential storage and
makes key extraction materially harder; it does not guarantee
protection against a fully rooted/compromised device, a compromised
OS/TEE, or an attacker controlling the running SameView process on an
unlocked, compromised device. These are accepted platform limitations,
not implementation defects, and no Hosted architecture claims
otherwise.

The concrete local surface exposing this state to the user is specified
in "Local Android `Online comparisons`" below. What happens when the
credential itself is lost, or the app is reinstalled, is covered by
"Recovery and device changes" below.

## 9. Recovery and device changes

The private management capability link (see "Canonical Hosted domain
and URLs" above) is the V1 recovery mechanism.

No account/password/email recovery system is required.

A valid management link may be used from another browser/device to
regain management access to the Hosted Publication.

Browser management recovery does not restore the original Android
Comparison files. It restores management authority only.

Do not turn Hosted Sharing into cloud backup/restore.

If both the local credential and the private management link are lost,
there is no ordinary self-service recovery in the accountless model.
The server cannot reconstruct the original management token from its
stored hash.

Operator abuse/legal removal capability (see "Report this content"
below) must not be confused with transferring ownership or recovering
a user's lost management token.

A future `Add to SameView`/App Link flow may allow a valid capability
holder to import management authority into another SameView
installation, but this is not required for initial Hosted V1. The
architecture must not unnecessarily prevent it.

Loss of app data, the app installation, the Hosted registry, or the
Keystore key does not transfer or weaken ownership of a Hosted
Publication --- the server's management-token hash remains the sole
source of management authority. The Hosted registry is convenience/
local management state, not authoritative ownership storage. Android
backup or automatic device migration must not become an implicit
ownership-transfer or recovery mechanism; see "Physical location" under
"Android management persistence" above for why the registry is
deliberately excluded from both.

## 10. Local deletion behavior

The existing local Comparison deletion confirmation remains, and the
local Comparison lifecycle remains independent from network
availability.

Deletion flow:

1. The user invokes the existing local Comparison delete action.
2. The existing local-delete confirmation remains unchanged.
3. If the Comparison has a locally managed Hosted Publication (a
   matching registry entry, see "No `session.id` lookup cache" above),
   SameView shows a second, explicit question: "Also delete the online
   version?"
4. Default selection is **No / keep online**.
5. Local deletion proceeds independently of the answer to step 3 --- it
   is never blocked merely because the device is offline, the Hosted
   backend is unavailable, or a later Hosted deletion attempt might
   fail.
6. If the user chose to also delete online, SameView attempts Hosted
   deletion after the local deletion has completed.
7. If Hosted deletion succeeds: the Hosted Publication is removed, and
   the local Hosted registry entry is removed.
8. If Hosted deletion fails: local deletion remains complete; the
   Hosted Publication, the Hosted registry entry and its management
   credential all remain untouched; SameView clearly tells the user
   that local deletion succeeded but online deletion did not; the user
   may retry later from `Online comparisons`.

The Hosted credential is never silently removed after a failed Hosted
deletion attempt --- only a server-confirmed successful deletion removes
the registry entry, consistent with the fail-closed principle in
"Registry corruption behavior" and "Credential/key loss behavior"
above.

Deleting locally must never silently delete the Hosted Publication;
deleting the Hosted Publication must never silently delete the local
Comparison; if the user keeps the Hosted Publication, its locally
stored management capability remains available in the app; this is not
an account, cloud library or synchronized gallery.

While the local Comparison still exists, `Delete online` belongs in the
existing session/action context of `CompareScreen`, using its existing
secondary-action/overflow pattern rather than introducing a new
destructive-action surface in `EditSessionScreen`, which remains
primarily the metadata-editing surface for V1. `Delete online` must
also be available from `Online comparisons`, since that is the only
management surface once the local Comparison has been deleted (see
"Local Android `Online comparisons`" below).

`Delete online` requires confirmation, deletes only the Hosted
Publication (exact deletion semantics: see "Publication lifetime,
deletion and backups" below), removes the local Hosted registry entry
only on successful server deletion, and never deletes the local
Comparison.

This extends, and does not conflict with, the existing local deletion
flow (Android `SessionDeleter.kt`, recursive directory delete with
path-traversal validation) --- it adds a second, independent step after
local deletion, not a change to how local deletion itself works.

The minimal local management surface referenced above is specified in
full immediately below.

## 11. Local Android `Online comparisons`

Android requires a minimal local Hosted-management surface called
conceptually:

`Online comparisons`

It is not:

- a cloud account;
- a synchronized Hosted gallery;
- a second main Comparison gallery;
- a server-side list of everything belonging to a user.

### Navigation placement

`Online comparisons` is placed in the existing Camera/Home screen
overflow/menu, alongside the app's existing secondary destinations such
as Settings, Guide and About, rather than as a primary navigation tab.
It does not introduce a bottom navigation tab, a new main app section, a
cloud-dashboard paradigm, or a separate primary navigation architecture;
it reuses the app's current Compose navigation model. Exact row/card
layout is Android UX implementation work, not decided here.

### Local/remote model

The `Online comparisons` screen is generated from the local Hosted
registry, not a server-side account lookup --- no such account exists,
so the app never requests "show me all Publications owned by this user"
from the server. The screen remains useful without network connectivity
for displaying locally known Publication entries; server contact
happens only when an action needs it (View, Update, Delete, management
validation), never as background polling solely to keep the registry
synchronized. If a server operation later authoritatively reports that
a Publication no longer exists, the stale local registry entry is
removed and the user is informed appropriately.

### Matching against local sessions

The list is generated from the app's local Hosted management registry
(see "Android management persistence" above). It contains Publications
for which this app installation retains management authority. To
determine whether a registry entry's corresponding local Comparison
still exists, SameView uses the existing local session scanning model
and matches on `session.comparisonId` --- not a cached `session.id` or
filesystem path (see "No `session.id` lookup cache" above).

### Per-Publication actions

Per Publication, provide appropriate actions such as:

- View online;
- Copy link;
- Share;
- QR code;
- Private management link;
- Delete online.

If the corresponding local Comparison still exists, additionally allow:

- Open comparison;
- Update online.

If the local Comparison has been deleted:

- no Open comparison;
- no Update online;
- public sharing, QR, private management access and Delete online
  remain available.

If the management token cannot be decrypted, only the public-only
actions remain available, regardless of whether the local Comparison
still exists --- see "Credential/key loss behavior" above.

### Display fallback

The registry retains a small local display snapshot
(`displayTitleSnapshot`) so a Publication remains recognizable after the
local Comparison has been deleted; where a display title is unavailable,
publication timestamps serve as useful secondary identification. Exact
fallback wording (for example an "Untitled comparison" label) and date
formatting are UI copy, finalized during Android UX implementation, not
decided here. Rendering the basic `Online comparisons` list never
requires fetching remote Hosted content --- the list remains
fundamentally local.

### After deletion

After successful `Delete online`:

- remove the Hosted Publication;
- remove its local Hosted credential/registry entry;
- do not delete the local Comparison if it still exists.

If a local Comparison is deleted while its Hosted Publication is
deliberately kept:

- retain the Hosted registry/management state;
- inform the user that the online version remains;
- tell the user it can later be managed under `Online comparisons`.

No server-side account synchronization is implied by this feature.

## 12. Android `Host online` UX

The publishing experience should build on existing SameView sharing UX
rather than create an unrelated technical/cloud workflow.

The user sees a Hosted preview before publishing.

Approved Hosted V1 presentation choices:

- interactive Split/Slider only;
- no Side-by-Side Hosted variant;
- Title according to the user's selection;
- Description according to the user's selection;
- Date according to the user's selection;
- Location according to the user's selection;
- Branding according to the user's selection;
- page background: Dark or Light;
- comparison image/stage corners: Rounded or Sharp;
- no user-facing quality setting.

The server is responsible for producing suitable web-delivery image
assets (exact source files, output size and encoding: see "Hosted
source images", "Hosted image output" and "Custom branding image"
below).

The UI must be designed from the user's task and expectations first.
Technical concepts such as storage providers, DB rows, IDs and
management tokens must not dictate the visible workflow or terminology.

The design should remain extensible for future Hosted presentation
options, but V1 must not expose speculative controls merely because the
underlying model could support them.

The visibility-toggle-per-field pattern (Title/Description/Date/
Location "according to the user's selection") mirrors the existing
Comparison Information visibility model already owned by F-003/F-004
in [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) and rendered
per [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md)
"Comparison Information Rendering" for SameView Web's own outputs ---
this is a deliberate reuse of an established pattern, not a new one.
The Rounded/Sharp corner choice directly mirrors
COMPARISON_PRESENTATION.md "Canvas" -> "Corner Radius" (`Sharp` /
`Rounded`, default `Rounded`), which already exists as a SameView Web
Presentation Configuration option. The Dark/Light page background is a
deliberately reduced, Hosted/Android-specific option and is distinct
from SameView Web's own richer Canvas Background control (Transparent /
White / Black / Brand / Custom Color) --- see "Known Conflicts and
Gaps" for why this is a reduction, not a reuse, of that control.
Neither a Dark/Light background toggle nor a Rounded/Sharp corner
toggle currently exists anywhere in the Android app's live comparison
view or its Share Image/Video Export renderers; both are new Android UI
surface for this feature, not a reuse of an existing Android control.

### Network capability

Hosted Comparison introduces the first intentional network capability
in SameView Android. The current app has no `INTERNET` permission and
no general-purpose network API layer. The Android Hosted implementation
must therefore explicitly introduce and document the Android `INTERNET`
permission, HTTPS-only communication with the SameView Hosted backend,
and only the network behavior required by Hosted publication/
management. Adding Hosted Sharing must not silently redefine the rest
of SameView Android as an online-first application --- core capture,
comparison, editing and ordinary local/export behavior remain
offline-first. Hosted Sharing must not introduce unrelated remote
dependencies or telemetry as a side effect. See "Known Conflicts and
Gaps" for how this relates to Android's currently documented,
fully-offline posture.

## 13. Metadata placement in the viewer

Hosted V1 uses the Share Image-style composition:

- interactive Comparison Stage first;
- selected Comparison information below the image/stage;
- information is not permanently overlaid on top of the image.

The complete Hosted Presentation consists of the Comparison Stage plus
the selected information beneath it.

This decision has two independent, mutually reinforcing bases:

1. On the Android side, this matches Share Image's proven layout model
   (`image/ShareRenderConfig.kt`, `image/CaptionRenderer.kt`): a
   metadata region below the comparison, sized dynamically per active
   line count, with no documented legibility failure --- unlike Video
   Export's animated, transient, in-image overlay
   (`video/TitleDateOverlayRenderer.kt`), which the Android source
   documents as having an accepted, unresolved legibility defect in
   aspect-ratio-mismatch/letterboxed scenarios (`docs/VIDEO_EXPORT_V1.md`
   §31.8/§32.8).
2. On the SameView Web side, this matches the existing, already-shipped
   Presentation model exactly: COMPARISON_PRESENTATION.md's "Comparison
   Stage" followed immediately by "Comparison Information Rendering"
   ("Comparison Information is visually cohesive with the Comparison
   Stage above it, not a separate footer") is the same composition
   principle already used by Standalone HTML, Static Microsite and
   Embed in website. Hosted V1 is not adopting an Android-only pattern;
   it is adopting the pattern SameView Web's own shared Presentation
   model already uses.

## 14. Full-viewport viewer principle

The public Hosted Viewer uses the available browser viewport as its
presentation area.

Requirements:

- the complete Hosted Presentation is kept visible;
- it is made as large as possible within the available viewport;
- aspect ratio is preserved;
- no cropping;
- no stretching;
- no internal scrolling area;
- responsive to viewport/orientation changes;
- portrait, landscape and square Comparisons follow the same product
  principle.

The exact viewport/fitting algorithm remains an implementation/
specification detail still to be finalized (see "Explicitly Open
Decisions"). How long user-authored text is handled within this
constraint is now decided --- see "Long text and viewport behavior"
immediately below. How the discreet SameView service footer coexists
with this principle is decided in "SameView service branding in Public
Viewer" further below.

No current SameView Web specification defines a full-viewport
presentation mode; COMPARISON_PRESENTATION.md's existing sizing rules
("Preview Scaling", "Responsive Handle Size on a Small Presentation
Stage") are written for a bounded container (Workspace Preview,
Standalone HTML, Embed placement), not an unbounded browser viewport.
This is new specification territory, not a conflict with existing
sizing rules.

## 15. Long text and viewport behavior

Retain the "Full-viewport viewer principle" above without qualification:
the Comparison Stage remains the visual priority, and selected metadata
below it must not cause the Stage to become unusably small.

Do not create internal scrolling regions inside the Hosted Presentation
merely to display arbitrary amounts of text.

Do not continuously shrink text to fit unlimited content.

Initial intended visible constraints:

- Title: up to approximately 2 visible lines;
- Description: up to approximately 3 visible lines;
- Date: one line;
- Location: approximately 1--2 visible lines.

Overflow may use ellipsis.

Full truncated content should remain accessible through an appropriate
interaction consistent with SameView's existing overflow-tooltip
behavior (COMPARISON_PRESENTATION.md "Overflow Tooltip"):

- hover/focus where applicable;
- an appropriate touch interaction on mobile.

Do not invent a completely separate Hosted text-overflow system if the
existing Presentation behavior can be reused --- these line-count
maximums and the ellipsis-then-tooltip pattern are a direct reuse of
COMPARISON_PRESENTATION.md's own "Title" (max two lines), "Description"
(max three lines) and "Overflow Tooltip" rules, not a new invention for
Hosted.

Existing Android/user-input field limits were inspected before setting
these constraints: direct reading of `MetadataTextSanitizer.kt` and
`docs/SESSION_METADATA_V1.md` §9.5/§11.2 confirms Android enforces **no
character-length limit** on `content.title`, `content.description` or
`location.*` --- only trimming and zero-width/Bidi-character
sanitization on save. There is therefore no existing Android character
cap to reuse; the line-count/ellipsis/tooltip model above is the
correct existing behavior to reuse instead, and is sufficient on its
own regardless of how long the underlying stored text is.

The exact touch interaction for revealing truncated text on the Hosted
viewer remains open --- see "Explicitly Open Decisions".

## 16. Initial slider position

Default Hosted initial slider position:

50/50.

The design and data model must not prevent a later or explicit option
to publish the current preview slider position.

Do not expose such an option in V1 unless a later decision explicitly
approves it.

This directly parallels the existing `initialSliderPosition` concept
already defined in COMPARISON_PRESENTATION.md "Initial Slider Position"
(default exact midpoint 50/50; an explicit "Use current slider
position" output option changes this for existing outputs) and its
Outcome Snapshot semantics ("Where Presentation Configuration
Belongs"): the value in effect at generation/publication time is
captured once and does not change with later Current Working State
edits. Hosted V1's default-50/50-only behavior is a deliberate
narrowing of the already-existing "Use current slider position" pattern
used by Standalone HTML/Static Microsite/Embed, not a new concept.

## 17. Hosted API product operations

Keep the Hosted API conceptually small and aligned with product
operations rather than exposing generic CRUD unnecessarily.

Required conceptual operations:

### Publish

Input:

- `comparisonId`;
- complete Hosted Presentation payload;
- required assets.

If no active Publication exists for the Comparison:

- create it;
- return the public identity and initial management capability.

If an active Publication already exists for the same `comparisonId` and
the requester does not possess valid management authority (this
supersedes and replaces the previous standalone "Existing publication
without management authority" section --- the rule itself is
unchanged):

- do not create a second Publication;
- do not modify the existing Publication;
- no management credential or ownership information is disclosed;
- the response/UI must remain neutral and security-conscious.

Exact wording and HTTP/API behavior remain open (see "Explicitly Open
Decisions").

### Update

Requires valid management authority.

The publishing client sends the complete desired Hosted snapshot rather
than a collection of independent field patches.

A successful update:

- atomically activates the complete new state (see "Hosted update
  atomicity" below);
- preserves the public URL.

### Delete

Requires valid management authority.

Deletes only the Hosted Publication. It does not delete the
Android/local Comparison (exact deletion semantics: see "Publication
lifetime, deletion and backups" below).

### Resolve/View

Requires only `public_id`.

It exposes only the public allowlisted Presentation state needed by the
viewer.

Never expose through the public viewer payload:

- management token/hash;
- internal storage paths;
- unnecessary internal IDs;
- private operational state.

## 18. Client/API security boundaries

Android is a native client and communicates with the Hosted API
directly over HTTPS.

Do not rely on CORS as Android security.

Do not embed a supposed secret global API key in the Android
application as proof that requests originate from a genuine SameView
installation.

Future SameView Web publishing from `web.sameview.app` may use the same
Hosted backend.

Browser CORS for write endpoints must be explicitly restricted to
approved SameView origins rather than permissive wildcard
management/publishing access.

The browser management surface under `my.sameview.app` should use
same-origin requests and an appropriately secured management session
after capability verification (see "Canonical Hosted domain and URLs"
above).

Browser management write operations require normal CSRF protection
appropriate to the chosen session design.

Management credentials must never appear in:

- query parameters;
- analytics;
- public viewer payloads;
- external resource requests;
- normal logs;
- user-visible technical error details.

Use HTTPS only.

## 19. Rate limiting / abuse protection

Anonymous Hosted write operations require simple server-side rate
limiting.

Apply it to operations such as:

- Publish;
- Update;
- Delete.

Use appropriate combinations such as source IP and Comparison identity
where useful.

Requirements:

- ordinary legitimate usage should not normally encounter the limits;
- exact thresholds are operational configuration, not fixed product
  behavior;
- failed attempts may count toward limits;
- responses must not reveal whether a Comparison/Public ID belongs to
  another user;
- no CAPTCHA in V1;
- no third-party anti-abuse service required;
- no device fingerprinting;
- no persistent user profiling;
- no account requirement;
- no Redis requirement solely for rate limiting.

The implementation should remain replaceable if multiple server
instances later require shared rate-limit state.

Normal Public Viewer traffic is not subject to the same Hosted
write-operation limit.

This narrows, but does not resolve, the previously open "rate-limit
thresholds and implementation" item --- the requirements above are
decided; the exact thresholds and storage mechanism remain open (see
"Explicitly Open Decisions").

## 20. Upload model and validation

Android Hosted Publishing sends a strict structured Hosted payload and
only the required assets.

Do not upload the complete SameView backup/export ZIP merely to publish
Hosted content.

Do not create a generic archive-upload API for Android Hosted V1.

The server treats every client as untrusted.

Validate:

- actual image content, not merely extension/MIME claims;
- supported image formats;
- upload byte size;
- decoded pixel count;
- relevant dimensions;
- required asset presence;
- allowlisted structured fields;
- text lengths.

Reference and Capture must both successfully decode before activation.

Do not persist arbitrary unknown request fields.

The exact byte-size, pixel-count and dimension thresholds for the two
core Comparison images are decided in "Hosted image input security
limits" below; the corresponding thresholds for the branding asset are
decided in "Custom branding image" below.

## 21. Client-side privacy preprocessing

Android should avoid sending metadata-bearing original session images
when publishing Hosted content.

The original local session files remain unchanged.

For Hosted Publishing, Android creates temporary local upload copies
derived from the required Comparison assets (see "Hosted source images"
below for which files those are).

Before upload, those temporary copies must remove embedded metadata
such as:

- EXIF;
- GPS;
- XMP;
- IPTC;

through an appropriate decode/re-encode/privacy-processing path.

Only the privacy-processed temporary upload copies should leave the
device.

Delete those local temporary copies after the upload attempt according
to safe lifecycle handling.

This is a privacy-by-design measure.

It does **not** replace server-side validation/privacy processing.

The server must still independently:

- validate;
- decode;
- enforce security limits;
- resize;
- freshly encode the canonical Hosted WebP output.

The server is the final trust boundary.

Do not move canonical Hosted output-generation policy into Android
merely because Android performs privacy preprocessing.

## 22. Hosted source images

For Android Hosted Comparison, use:

- `capture.jpg`;
- `reference.jpg`.

Do not use `reference-original.jpg` as the normal Hosted Reference
source.

Reason: the standard Android interactive Comparison (`CompareScreen`)
renders exclusively `capture.jpg` + `reference.jpg`
(`docs/COMPARE_SESSION_RENDERING_V1.md` "Deterministic Compare Rule":
*"The compare screen must ONLY render: capture.jpg, reference.jpg"*).
`reference-original.jpg` is the full, pre-crop/pre-pan/pre-zoom
reference photo; it belongs to the separate, opt-in "peek original"
viewing gesture in `CompareScreen.kt` and does not represent the normal
interactive Comparison framing --- it can have a materially different
aspect ratio and framing than what the user aligned and reviewed.
Hosted output must correspond to the Comparison the user previewed
before publishing, not to a higher-resolution but differently-framed
source.

`capture.jpg` and `reference.jpg` are the only two image files
guaranteed present for every Android metadata schema version this
project already supports (v2--v6); `capture-original.jpg` and
`reference-source-original.<ext>` exist only from schema v5 onward and
are not used for Hosted, consistent with not using
`reference-original.jpg`.

## 23. Hosted image output

Generate one bounded WebP per Comparison side in V1.

No responsive multi-size image set is required for V1.

Comparison image output:

- maximum 1920 px on the long edge;
- preserve aspect ratio;
- no upscaling;
- lossy WebP;
- server-controlled quality;
- no alpha requirement for normal reference/capture images (Android's
  `ReferenceRenderer` output is always fully opaque per
  `docs/COMPARE_SESSION_RENDERING_V1.md`, and `capture.jpg` is a camera
  photo --- neither needs an alpha channel);
- no user-facing Hosted quality control.

The exact encoder quality constant may remain an implementation
parameter unless existing evidence requires it to be product-specified;
it remains open (see "Explicitly Open Decisions").

This is consistent with, and makes concrete, ARCHITECTURE.md's planned
Version 2 hosted output limits (max 1920px long edge, WebP, ~200KB
target / 350KB absolute limit) and DATA_AND_PRIVACY.md's Decode ->
Remove EXIF/XMP/IPTC/GPS -> Resize for web -> Encode as WebP pipeline.
**Supersedes** the previous "Image processing" section's statement that
"No new decision is introduced here beyond what is already planned" ---
this section, "Hosted source images" and "Hosted image input security
limits" are genuinely new decisions (which specific source files to
use, and the input validation limits), building on but going beyond the
output-size figures ARCHITECTURE.md already planned.

## 24. Hosted image input security limits

Initial approved guardrails for each core Comparison image
(`capture.jpg`-equivalent and `reference.jpg`-equivalent upload):

- approximately 20 MB maximum upload size per image;
- maximum 40 megapixels decoded;
- approximately 8000 px maximum per individual dimension.

These are input/security limits, not output dimensions. The server
still produces the bounded 1920px Hosted result described in "Hosted
image output" above regardless of how large the validated input was.

Reject inputs exceeding the accepted security limits rather than
attempting uncontrolled decode/processing.

This is a distinct, image-specific limit from ARCHITECTURE.md's
existing 25 MB ZIP-level upload cap ("Upload Limits") --- that limit
governs the full-session-ZIP import flow, a different, heavier upload
shape than Hosted Publishing's per-image upload (see "Upload model and
validation" above: Hosted Publishing explicitly does not upload the
complete SameView ZIP). The 40-megapixel figure matches
ARCHITECTURE.md's existing "Image Limits" figure for Version 2
publication input exactly; the per-image byte cap and the per-dimension
cap are new, more specific decisions that extend it.

## 25. Custom branding image

Custom branding is optional.

Use the existing SameView concept of a bounded branding asset.

Initial Hosted target:

- maximum generated branding dimensions around 512x512;
- preserve alpha where required;
- use lossless or near-lossless WebP where appropriate.

This reuses Android's own existing branding normalization target
exactly: `BrandingNormalizer` already normalizes any input (a user's
own image or a built-in symbol) to a 512x512 RGBA PNG before it is
used anywhere in the app, including at the Handle's maximum on-screen
size --- there is no evidence anywhere in the existing product that a
larger branding asset is ever needed.

Initial input guardrails:

- approximately 10 MB upload size;
- maximum 24 megapixels decoded.

These are smaller than the core Comparison image limits in "Hosted
image input security limits" above because the eventual output is only
512x512 regardless of source size, so there is no legitimate case for
needing main-image-class input headroom here. The same approximately
8000 px per-dimension guard from "Hosted image input security limits"
applies for the same reason (defense-in-depth against a pathological
single-dimension input passing a naive megapixel check).

Built-in SameView branding symbols should normally remain semantic
Presentation configuration rather than generating duplicate branding
files for every Publication.

## 26. Image processing

Hosted output processing is server-side.

The existing planned privacy principles remain applicable:

- validate actual input;
- process only assets required by the Hosted outcome;
- remove embedded EXIF/XMP/IPTC/GPS metadata from hosted comparison
  image assets;
- resize appropriately for web delivery;
- encode web-appropriate image assets such as WebP;
- do not require a Hosted `Quality` control from the user.

This matches DATA_AND_PRIVACY.md "Image Processing (Version 2 Hosted
Publication)" (Decode -> Remove EXIF/XMP/IPTC/GPS -> Resize for web ->
Encode as WebP, "always performed by the server ... independent of and
without trusting any client-side processing").

The concrete decisions this pipeline now implements --- which source
files feed it, the exact output bound, and the exact input validation
limits --- are specified in "Hosted source images", "Hosted image
output", "Hosted image input security limits" and "Custom branding
image" above; this section states only the pipeline order and its
governing principles, and should be read together with those four
sections rather than restated by them.

## 27. Temporary server processing data

Original upload inputs are transient processing data only.

They are not permanent Hosted assets.

Use an internal, non-public temporary processing area associated with a
random processing identifier.

Requirements:

- never publicly routable;
- do not trust user-provided filenames as storage paths;
- delete inputs immediately/best-effort after successful processing;
- delete them best-effort after failed processing;
- stale temporary processing data must be removed automatically;
- temporary upload cleanup may use a shorter safety age than immutable
  orphan-asset cleanup (see "Cleanup and orphan handling" below);
- where operationally practical, exclude temporary processing storage
  from persistent Hosted backup sets.

Do not introduce a separate upload service, S3 pre-signed upload
system, queue or processing cluster for V1.

## 28. Persistence architecture

MySQL is approved for structured Hosted Publication data.

MySQL should contain, as applicable:

- internal publication identity;
- `comparison_id`;
- public ID;
- management-token hash;
- Presentation/viewer configuration;
- user-authored allowlisted metadata needed by the Hosted outcome;
- asset keys, including a reference to the currently **active asset
  version** (see "Asset storage" and "Hosted update atomicity" below);
- created/updated timestamps.

`comparison_id` must support enforcing at most one active Hosted
Publication per Comparison.

Binary comparison images must not be stored as MySQL BLOBs, consistent
with ARCHITECTURE.md "Initial Data Model" ("Binary images are never
stored in MySQL.").

Do not introduce a parallel `comparison.json` as a second source of
truth for Hosted Publication state.

This decision is broader than, and requires reconciling with, the
currently documented `comparisons` table --- see "Known Conflicts and
Gaps".

## 29. Asset storage

Hosted binary assets use a separate Asset Storage boundary.

Initial provider:

Netcup persistent filesystem.

The storage implementation must be cleanly encapsulated behind a small
storage contract so that a later move to S3-compatible object storage
does not require redesigning Hosted Sharing.

The rest of the application must not depend on:

- absolute Netcup/Plesk filesystem paths;
- S3-specific concepts;
- storage-provider URLs.

Persist neutral asset keys rather than physical storage URLs.

**Superseded:** assets are not stored as a single flat set per
Publication. Hosted updates use immutable/versioned asset sets (see
"Hosted update atomicity" below) --- the conceptual layout is:

```
comparisons/<internal-publication-id>/versions/<asset-version>/
    reference.webp
    capture.webp
    branding.webp   (optional)
```

rather than a single flat `comparisons/<internal-id>/reference.webp,
capture.webp, branding.webp` per Publication. Built-in branding should
normally remain semantic configuration rather than duplicate an image
file per Comparison/version, where technically consistent with the
final renderer.

This still matches the "No S3 or other external object storage in V1"
hard constraint (CLAUDE.md) and the storage-provider-agnostic boundary
already required here --- no S3 is introduced now. It does **not**
match ARCHITECTURE.md's currently documented flat, non-versioned
filesystem layout or its flat `reference_path`/`capture_path` DB
columns --- see "Known Conflicts and Gaps".

## 30. Hosted update atomicity

Hosted updates use immutable/versioned asset sets.

Do not overwrite the currently active `reference.webp`, `capture.webp`
or branding asset in place.

Conceptual structure:

`comparisons/<internal-publication-id>/versions/<asset-version>/...`

Update sequence:

1. validate the complete request;
2. process the new input;
3. generate all required Hosted assets;
4. store them under a new immutable/versioned asset set;
5. verify that the complete new Hosted state is ready;
6. atomically switch the MySQL Publication state and active asset
   references/version in a database transaction;
7. commit;
8. only then remove obsolete assets (see "Cleanup and orphan handling"
   below).

Until activation succeeds, the previous Publication remains fully
functional.

The public URL does not change.

The viewer must observe either the complete old active state or the
complete new active state, never a mixture.

If preparation fails, the old Publication remains unchanged.

If DB activation fails, the old Publication remains active and the
newly prepared assets become cleanup candidates.

If cleanup of the previous version fails after successful activation,
the update remains successful from the user's perspective.

Use the same conceptual `prepare -> validate -> store -> activate`
model for initial publish where applicable.

This internal versioning is not a user-visible version-history feature.

## 31. Cleanup and orphan handling

MySQL active asset references are authoritative.

Cleanup is:

- reference-based;
- delayed by a safety age;
- idempotent;
- not part of the user's successful update result.

Unreferenced staged, failed or obsolete asset versions may be removed
only after they are old enough that an active processing operation
cannot reasonably still depend on them.

Do not introduce Redis, a queue or a dedicated worker service solely
for V1 cleanup.

A periodic Netcup/Plesk-compatible cleanup job is sufficient initially.

Cleanup must re-check that assets are not actively referenced before
deleting them.

After successful update:

- new version active;
- old version cleanup candidate.

After failed pre-activation update:

- old version remains active;
- incomplete/new version cleanup candidate.

After Hosted deletion:

- Publication becomes publicly unavailable first;
- its asset tree becomes cleanup/deletion work.

Failure to physically remove obsolete assets must not make a deleted
Publication public again.

Cleanup logging should contain only operational information required
for diagnosis and must not create an unnecessary long-lived history of
deleted user content.

## 32. Stable public URL / viewer

The public Hosted URL belongs to SameView and must remain independent
from the physical storage provider. The exact domain and route shape
are decided in "Canonical Hosted domain and URLs" above
(`https://my.sameview.app/<public_id>`, no `/v/` prefix).

The public viewer is shared application/runtime logic that renders the
stored Hosted Publication.

Do not generate and persist a separate complete `index.html` viewer for
every Hosted Comparison as the primary architecture.

Improving/fixing the common Hosted Viewer later should be possible
without rewriting every Hosted Publication's stored content.

This is consistent with SameView Web's existing shared-pipeline
precedent: the same underlying markup/scaffold building blocks already
used for Standalone HTML, Static Microsite and Embed
(`src/lib/comparison-artifact-markup.ts`,
`src/lib/comparison-artifact-scaffold.ts`) are pure, framework-agnostic
string builders with no browser dependency, already built with a
collision-free multi-instance mode for embedding. They are a plausible
technical foundation for server-rendering the Hosted Viewer from stored
data rather than from a per-publication generated file, though no
specific reuse decision is made by this product baseline --- that is a
technical-design question for the next phase.

How the underlying image assets referenced by this viewer are delivered
and cached is decided in "Asset delivery and HTTP caching" below; how
the viewer behaves when a Publication or an asset is unavailable is
decided in "Public Viewer failure states" below.

## 33. Asset delivery and HTTP caching

Hosted Publication assets are immutable and version-addressed (see
"Hosted update atomicity" above).

Do not overwrite an asset while retaining the same immutable public
asset identity.

For Netcup V1, binary Hosted assets may be served efficiently as static
resources by the web server rather than forcing all image bytes through
Astro/Node on every view.

Public asset URLs must:

- remain SameView-controlled;
- not expose physical Netcup/Plesk filesystem paths;
- not expose management secrets;
- not depend on storage-provider-specific URLs in the core Publication
  model.

Immutable versioned assets may use long-lived public HTTP caching
including `immutable` semantics.

The stable Publication URL
(`https://my.sameview.app/<public_id>`) must remain
revalidatable/appropriately short-lived so successful `Update online`
operations become visible promptly.

Versioned asset URLs naturally change when a new Publication asset
version becomes active, avoiding complex cache invalidation.

Do not require signed/expiring asset URLs for publicly visible
comparison images in V1.

## 34. Publication lifetime, deletion and backups

Hosted Comparisons do not expire automatically by default.

Approved product principle:

**Published until explicitly deleted.**

Do not impose a default 30-day or similar expiration.

A future optional expiration feature is outside V1.

### User deletion

`Delete online` means:

- immediately make the Publication publicly unavailable;
- remove the live Publication state;
- delete live Hosted assets;
- no user-visible Trash;
- no Undo period;
- no Hosted version history;
- no permanent tombstone solely to remember that the Publication once
  existed.

Physical asset cleanup failure does not restore public accessibility.

### Backups

Backup retention is an operational concern separate from live Hosted
retention.

Deleted content may remain temporarily in infrastructure backups only
according to a defined, documented maximum backup-retention policy.

Do not attempt per-object mutation of historical backup sets merely to
implement normal user deletion if the backup system does not support
that safely.

Backups must not become a hidden user archive.

The exact Netcup/Plesk/MySQL backup retention period must be verified
against the actual deployment configuration before release rather than
invented in this specification.

Disaster-recovery procedures must account for the possibility that
restoring an older backup could otherwise reintroduce Publications
deleted after that backup was taken.

## 35. Public Viewer failure states

Publicly distinguish only meaningful user-facing states.

### Not available

A never-existing Public ID and a deleted/blocked Publication should not
disclose different ownership/history information to ordinary visitors.

Show a neutral SameView state such as:

`Comparison not available`

Use appropriate HTTP 404 semantics for nonexistent/deleted public
content.

Do not disclose whether the URL previously existed.

### Temporarily unavailable

Infrastructure/database/storage failures must not masquerade as
deletion/nonexistence.

Show a neutral temporary-error state such as:

`Comparison temporarily unavailable`

with appropriate 5xx semantics.

### Missing core asset

If either core comparison image is unavailable/corrupt, do not render a
half-working Comparison.

Treat it as a temporary/unavailable technical failure and log the
operational error server-side.

### Missing optional asset

Optional presentation assets such as custom branding should degrade
gracefully where possible.

If the core Comparison remains valid, failure of optional branding must
not necessarily prevent viewing.

### JavaScript disabled

No complex static Comparison fallback is required.

Provide a concise `<noscript>` message explaining that JavaScript is
required for the interactive Comparison.

### Client/network load failure

Do not leave an indefinite spinner.

Provide a clean failure/retry state where appropriate.

## 36. SameView service branding in Public Viewer

The Public Hosted Viewer must be recognizably but discreetly hosted by
SameView.

Do not place large SameView branding over the user's Comparison.

The user's own selected Comparison/slider branding (per "Android `Host
online` UX" above) remains part of the Presentation and is conceptually
separate from SameView service branding.

Provide a restrained service footer outside the Comparison Presentation,
conceptually such as:

`Hosted with SameView · Report this content`

The footer may link to SameView and required legal/service information,
including the "Report this content" flow defined below.

The footer must:

- not cover the Comparison;
- not compete visually with user-selected branding;
- be accounted for in available viewport layout (see "Full-viewport
  viewer principle" above);
- remain visually secondary.

## 37. Report this content

Every public Hosted Comparison provides an integrated:

`Report this content`

flow.

Do not use a simple `mailto:` link as the primary reporting experience.

Use a SameView-hosted report form associated automatically with the
Publication, conceptually:

`https://my.sameview.app/<public_id>/report`

Requirements:

- no SameView account required;
- Publication automatically identified;
- collect only information needed to review/respond;
- no file attachments in V1;
- server-side validation;
- strict text limits;
- rate limiting;
- no automatic Publication deletion or suspension merely because a
  report was submitted;
- reporter contact information is not exposed to the publisher.

The exact legal categories, mandatory fields, notices and
processing/retention requirements must be legally reviewed before
release rather than invented as technical product behavior.

Reports should use a separate data model from the Hosted Publication
itself.

An operator must have a secure non-public process for reviewing a
report and disabling/removing a Publication where required.

Do not require a full moderation dashboard for V1 if a secure minimal
operator process is sufficient.

## 38. Search-engine discoverability

Hosted Comparisons are public to anyone who possesses the link.

Do not describe them as private merely because the Public ID is
difficult to guess.

For V1 they should not intentionally be indexed as public searchable
content.

Use appropriate `noindex` behavior for Hosted Publication pages.

This reduces unintended discovery but is not an access-control
mechanism.

## 39. QR code and public sharing

After successful Hosted Publish, immediately provide the useful public
outcome rather than exposing technical publication concepts.

Provide:

- View online;
- Copy public link;
- Android system Share;
- QR code.

Normal sharing always shares the public URL
(`https://my.sameview.app/<public_id>`), never the private management
URL.

Do not build service-specific WhatsApp/Gmail/etc. integrations. Use the
Android system share sheet.

QR-code access is considered part of the intended Hosted user value. It
represents the public Hosted URL and does not create a second
publication identity or separate hosted object.

QR content is exactly the canonical public URL:

`https://my.sameview.app/<public_id>`

Generate the QR locally from the URL.

Do not require a third-party QR service. Do not create a second
server-side QR identity.

The QR view must support:

- viewing the QR;
- sharing the QR as an actual image/file;
- saving the QR as a file;
- copying the underlying public link.

A sufficiently high-resolution PNG is acceptable for V1. SVG is
desirable for print scalability if it can be supported cleanly, but V1
must not become unnecessarily complex solely for SVG.

This matches PRODUCT_SCOPE.md "Future Scope" ("Version 2: receive a
public URL, QR code and iframe embed code.") and "Outputs" ("Planned
for Version 2: Hosted Comparison, QR code, iframe embed code."), which
already lists QR code alongside Hosted Comparison, and **supersedes**
the previous "QR code" section's "Exact UI/export details remain to be
specified" --- the QR content, generation location, and required
view/share/save/copy affordances are now decided; only the exact PNG
resolution and whether SVG ships in V1 remain open (see "Explicitly
Open Decisions").

## 40. No Hosted email-delivery service in V1

Do not implement `Email me this link` as a SameView server feature in
V1.

The Android system share sheet already permits the user to send the
public link through their installed email client.

Avoid introducing unnecessary:

- email-address collection;
- outbound-mail infrastructure;
- deliverability handling;
- additional privacy processing;
- mail abuse/spam surface.

This does not prevent a future explicit email feature if actual user
need justifies it.

---

## Known Conflicts and Gaps

This section records tensions between the decisions above and current
specifications. None of these are resolved by this baseline; the
referenced existing documents are unmodified.

### Conflict: publishing client responsibility

[PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) "Core Principle" currently states:

> The Android app creates the comparison.
> SameView Web presents, exports and optionally publishes it.

and "Relationship to SameView Android":

> It extends comparisons created with SameView Android with
> browser-based viewing, metadata editing, export and publication
> functions.

[ARCHITECTURE.md](ARCHITECTURE.md) "Responsibilities" assigns
"Trigger publication" to "Planned Version 2 browser" (i.e. SameView
Web), with no mention of Android as a publishing client anywhere in
current `sameview-web` specifications.
[USER_WORKFLOW.md](USER_WORKFLOW.md) "Workspace Model" similarly frames
publication as an action taken on a SameView Web workspace ("Making
workspace data available for publication requires an explicit user
action").

This directly conflicts with this baseline's Product Concept decision
that "the intended first end-user publishing client is SameView
Android" and that "SameView Web will later become another publishing
client." Reconciling PRODUCT_SCOPE.md's Core Principle (and the related
passages in ARCHITECTURE.md and USER_WORKFLOW.md) with Android-first
publishing is required before F-006/F-007 are written, and is
explicitly not done by this baseline. **Not addressed by Revision 2.**

**Resolved:** PRODUCT_SCOPE.md's "Core Principle" and "Relationship to
SameView Android" have since been updated to state that the Android app
both creates the comparison and can publish it online as a Hosted
Comparison, that SameView Web may also publish it later through the
same Hosted service, and that publishing does not require routing
through SameView Web. ARCHITECTURE.md's "Responsibilities" has likewise
been updated to assign Hosted responsibilities to the separate Hosted
service rather than to a "Planned Version 2 browser." The quoted
passages above no longer appear in either document; this conflict no
longer exists in their current text.

### Gap: `comparisonId` has no place in the current identity model

IMPORTED_COMPARISON_V1.md "Comparison Identity (`session.id`)" and
"Session Identity" currently treat the Web-import-time, archive-
directory-derived `session.id` as *the* authoritative stable Comparison
identity, without qualification about cross-device global uniqueness.
EMBED_IN_WEBSITE.md "Comparison Identity" reinforces this: "No
additional Embed-specific Comparison identifier is introduced." Neither
document anticipates a second, coexisting global identity.

This baseline's introduction of `session.comparisonId` is a newly
recorded limitation, not previously stated in any specification:
`session.id`, as currently generated (a local-time-derived Android
directory name), is not collision-resistant across independent devices
and cannot alone serve as a global Hosted identity once Android
publishes directly, without SameView Web's import step as an
intermediary. This does not change `session.id`'s existing, narrower
role for Web import and Embed matching. Updating
IMPORTED_COMPARISON_V1.md and EMBED_IN_WEBSITE.md to acknowledge
`session.comparisonId` as a coexisting concept is deferred to a later
specification pass.

**Resolved for IMPORTED_COMPARISON_V1.md:** that document's "Global
Comparison Identity" section now defines `session.comparisonId` as a
coexisting, additive identity alongside `session.id`, and its
"Comparison Identity (`session.id`)" entry now explicitly notes that a
separate global identity may exist without changing `session.id`'s own
role. EMBED_IN_WEBSITE.md has not been updated and still states only
that "No additional Embed-specific Comparison identifier is
introduced." On inspection this remains accurate and non-conflicting:
it describes only that Embed itself introduces no identifier of its
own, not that no other product-level identity exists elsewhere. No
update to EMBED_IN_WEBSITE.md is required by this baseline.

### Gap: `comparisons` table has no Comparison-level key or asset-version column

ARCHITECTURE.md "Initial Data Model" documents a single `comparisons`
table keyed by `id` (internal UUID) with a unique `public_id` and
`management_token_hash`, but no column tying a publication row back to
a Comparison (there is no `comparison_id` / `session_comparisonId`
column) and no column for an active asset version. Without a
`comparison_id` column, "at most one active Hosted Publication per
Comparison" (see "One active publication per Comparison" above) cannot
be enforced at the schema level. Without an active-asset-version
column, "Hosted update atomicity"'s versioned-activation model (see
above) cannot be implemented either. This baseline's "Persistence
Architecture" section now requires both; the currently documented
schema has neither. Updating ARCHITECTURE.md's "Initial Data Model"
(and the corresponding `src/db/schema.ts` /
`drizzle/0000_smart_zaran.sql`, neither of which is touched by this
documentation-only baseline) is deferred.

**Resolved for ARCHITECTURE.md's documentation:** its "Data Model"
(under "Hosted Comparison Architecture") now includes both a
`comparison_id` column and an `active_asset_version` column, matching
this baseline's requirements. The actual `src/db/schema.ts` and
`drizzle/0000_smart_zaran.sql` still do not include them; that remains
open implementation work --- see "Explicitly Open Decisions" ("exact DB
schema/migrations").

### Gap: storage-portability requirement goes beyond current architecture documentation

ARCHITECTURE.md "Storage" documents the planned Version 2 filesystem
layout purely in terms of physical relative file paths stored directly
as DB columns (`branding_path`, `reference_path`, `capture_path`), with
a flat, non-versioned `comparisons/<internal-id>/reference.webp,
capture.webp, branding.webp` layout; it does not mention a
storage-provider abstraction, an active-version concept, or a
requirement that a later move to S3-compatible storage must not require
redesign. This baseline's "Asset Storage" and "Hosted update atomicity"
sections introduce the storage-provider-agnostic boundary and the
versioned `.../versions/<asset-version>/...` layout as new decisions.
Neither contradicts any existing constraint (S3 itself remains
introduced only later, matching CLAUDE.md's "No S3 ... in V1" and
"prepared technical foundation for planned Version 2 Hosted
Publication" wording), but both are additive to, and in the versioned
layout's case a structural departure from, ARCHITECTURE.md's current
"Storage" section and its flat `*_path` columns.

**Resolved:** ARCHITECTURE.md's "Asset Storage" (under "Hosted
Comparison Architecture") now documents the provider-neutral boundary
and the versioned `.../versions/<asset-version>/...` layout, replacing
the previously documented flat, non-versioned layout. ARCHITECTURE.md's
"Data Model" section now stores an `active_asset_version` reference
instead of literal `reference_path`/`capture_path`/`branding_path`
columns.

### Gap: canonical Hosted domain and routes not yet reflected in ARCHITECTURE.md

**New in Revision 2.** ARCHITECTURE.md "Main Routes" currently documents
`/v/<public-id>` and `/manage/<management-token>` with no explicit
domain (implicitly on the same Version-1 application domain). This
baseline's "Canonical Hosted domain and URLs" section instead specifies
a dedicated `my.sameview.app` domain, a public route with no `/v/`
prefix (`https://my.sameview.app/<public_id>`), and a two-stage
management route (`.../manage/<management_token>` before verification,
`.../manage` after). ARCHITECTURE.md's "Hosting" section ("One Node.js
application", domain `https://web.sameview.app`) also does not yet
account for a separate `my.sameview.app` domain/deployment target.
**Amended in Revision 4:** the deployment/application-boundary decision
itself is now approved (a second, independently deployable Node/Astro
application under `hosted/`, its own Netcup/Plesk Node.js
application/subdomain for `my.sameview.app`, no Host-header
multiplexing --- see "Application and deployment boundary" under
"Canonical Hosted domain and URLs" above); what ARCHITECTURE.md's
"Hosting" section specifically needs to reflect is therefore now known
precisely: two independently deployed Node.js applications rather than
one. Updating ARCHITECTURE.md's "Main Routes" and "Hosting" sections
themselves is still deferred to a later specification pass, consistent
with this document's documentation-only, non-code-changing scope.

**Resolved:** ARCHITECTURE.md's "Main Routes" and "Hosting" sections
have since been updated directly. "Main Routes" now documents
`/<public_id>`, the two-stage `/<public_id>/manage/...` route and
`/<public_id>/report`, all under the `my.sameview.app` domain, with no
`/v/` prefix. "Hosting" now describes two independently deployed
Node.js applications --- the root application for `web.sameview.app`
and a separate Hosted application for `my.sameview.app` --- consistent
with "Application and deployment boundary" above. This gap no longer
exists in the current text of ARCHITECTURE.md.

### Clarification (not a conflict): Hosted page background vs. Web Canvas Background

COMPARISON_PRESENTATION.md "Canvas" -> "Background" already defines a
richer Presentation Configuration option (Transparent / White / Black /
Brand / Custom Color, default Brand) for SameView Web's own outputs.
This baseline's Hosted-specific "page background: Dark or Light" is a
deliberately reduced, Android-appropriate option, not an exposure or
reuse of that existing control, and not currently backed by any
equivalent toggle in the Android app (confirmed absent from the live
Compare screen, Share Image and Video Export renderers). This is
recorded as a clarification, since the two concepts could otherwise be
mistaken for the same control.

### Gap: Android network capability not yet reflected in Android specifications

**New in Revision 3.** The current Android app has no `INTERNET`
permission and no general network layer anywhere in its manifest or
source. Existing Android documentation and behavior around GPS handling
and release hardening describe and rely on the app's fully offline
posture. No current Android specification anticipates or forbids adding
a network capability. "Android management persistence" -> "Network
capability" above records this as a new, first-of-its-kind capability
introduced by Hosted Sharing. Updating the relevant Android-side
specifications to reflect this is deferred to Android-side
specification work, outside this repository and outside this
baseline's documentation-only scope.

**Resolved:** `CLAUDE_PROJECT_INSTRUCTION.md` has since received an
"Addendum (2026-08-19 --- Hosted Comparison Network Capability)" that
explicitly approves this capability, with matching exception clauses
added throughout its "Remains Explicitly Out of Scope" list --- each
relevant bullet, including the `INTERNET` permission bullet, now
carries an explicit Hosted Comparison exception. This gap no longer
exists in that document. A related, narrower issue was separately
identified in `GPS_RECREATION_SYSTEM_V1.md` (its unconditional
location-data-upload prohibition has not received the same exception
treatment); that document is outside the scope of this baseline and is
not addressed here.

---

## Explicitly Open Decisions

The following are intentionally **not yet decided** by this baseline
and must not be guessed during specification or implementation work:

- exact DB schema/migrations (including the `comparison_id` key and
  active-asset-version column identified above);
- exact MySQL database/schema name and whether Hosted uses a dedicated
  database or isolated tables in an existing one;
- exact migration commands and deployment order;
- exact `hosted/` directory structure, Astro config and `package.json`
  contents;
- exact shared-module import strategy between the root Web application
  and `hosted/`;
- exact GitHub Actions job/workflow structure for deploying `hosted/`
  independently;
- exact environment variable/secret names and exact Plesk Application
  Root for `my.sameview.app`;
- exact rollback mechanics for the `hosted/` application;
- exact Storage contract/API;
- exact asset public-route implementation;
- exact HTTP cache durations;
- exact encoder quality (WebP quality constant/target algorithm);
- exact API route names and HTTP request/response contracts;
- exact rate-limit values/state implementation;
- exact Android Hosted registry implementation details (DataStore key
  names, Hilt qualifier/class names, JSON serialization key names, AES
  helper class names, Keystore alias string, exact GCM ciphertext/IV
  encoding, exact registry migration functions, exact coroutine/
  repository interfaces, exact network library);
- exact Android `Online comparisons` UI layout (row/card design, list
  ordering, exact copy/error wording);
- exact management browser-session implementation;
- exact CSRF implementation;
- exact cleanup safety ages/scheduling;
- exact Netcup/Plesk backup retention;
- disaster-recovery deletion reconciliation;
- exact report-form legal fields/categories/retention;
- operator moderation/takedown mechanics;
- exact QR file formats/resolution (PNG resolution; whether SVG ships
  in V1);
- exact long-text touch interaction;
- exact full-viewport sizing algorithm;
- SameView Web Hosted-publishing UX;
- future `comparisonId` duplicate/copy/restore semantics;
- future Android management-capability import/App Link flow.

These questions must be resolved using the existing SameView
repositories, current project specifications, and further product
decisions --- not invented during implementation.

---

## Next-step contract

This baseline is the approved product input for the next phase.

The next phase is analysis/specification work, not implementation.

Before F-006/F-007 are written, the following must at minimum be
resolved:

1. the publishing-client conflict recorded above (PRODUCT_SCOPE.md
   "Core Principle" vs. Android-first publishing) --- **resolved**, see
   "Known Conflicts and Gaps" above;
2. how `session.comparisonId` is reflected in
   IMPORTED_COMPARISON_V1.md and EMBED_IN_WEBSITE.md without disturbing
   `session.id`'s existing role --- **resolved for
   IMPORTED_COMPARISON_V1.md; EMBED_IN_WEBSITE.md confirmed
   non-conflicting as-is**, see "Known Conflicts and Gaps" above;
3. the exact `comparisons` table shape (including a `comparison_id`
   key and an active-asset-version column) reconciling this baseline's
   "Persistence Architecture" and "Hosted update atomicity" with
   ARCHITECTURE.md's "Initial Data Model" --- **ARCHITECTURE.md's
   documented target shape resolved**; the actual schema/migration
   implementation remains open, see "Explicitly Open Decisions";
4. the Asset Storage contract shape and the versioned
   `.../versions/<asset-version>/...` layout referenced in "Asset
   Storage" and "Hosted update atomicity" above --- **the versioned
   layout and provider-neutral boundary are now documented in
   ARCHITECTURE.md**; the exact contract/API implementation remains
   open, see "Explicitly Open Decisions";
5. reflecting the `my.sameview.app` canonical domain, route shape and
   two-application deployment boundary (see "Canonical Hosted domain
   and URLs" and "Application and deployment boundary") in
   ARCHITECTURE.md's "Main Routes" and "Hosting" sections --- "Hosting"
   in particular needs to describe two independently deployed Node.js
   applications, not one --- **resolved**, see "Known Conflicts and
   Gaps" above.

Item 5 is new in Revision 2 and was made more concrete in Revision 4;
items 1--4 are carried forward from Revision 1 (item 4 is now more
concretely specified by "Asset storage" and "Hosted update atomicity"
above, but the exact contract/API shape remains open per "Explicitly
Open Decisions"). All five items above have since been addressed in
ARCHITECTURE.md, DATA_AND_PRIVACY.md, PRODUCT_SCOPE.md and
IMPORTED_COMPARISON_V1.md through subsequent documentation-
implementation iterations; only the implementation-level details
listed in "Explicitly Open Decisions" remain outstanding.

Only after the relevant specifications
(PRODUCT_SCOPE.md, ARCHITECTURE.md, DATA_AND_PRIVACY.md,
IMPORTED_COMPARISON_V1.md, FEATURE_SPECIFICATION.md F-006/F-007) are
updated and approved should
[IMPLEMENTATION_PLAN_V1.md](IMPLEMENTATION_PLAN_V1.md) be updated with
implementation phases for Hosted Comparison. Implementation begins only
after the relevant scope has been explicitly approved.

**Status:** all five specifications listed above have since been
updated to reflect this baseline; F-006 and F-007 now have complete
normative text. The precondition for beginning implementation-phase
planning has therefore been met. Whether Hosted Comparison
implementation phases are documented as an extension of
IMPLEMENTATION_PLAN_V1.md or as a separate planning document is an
implementation-planning decision, not decided by this baseline.

This document makes no code change, no database migration, and no
change to any existing specification.
