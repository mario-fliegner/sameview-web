# SameView Web – Data and Privacy

## Privacy

SameView Web supports local comparison output in Version 1 and is planned to add optional Hosted Publication in Version 2.

The Android app continues to work completely offline for its core capture, comparison and editing functionality. Hosted Publication is the first Android capability that requires network connectivity, and publishing is always an explicit user action — see "Hosted Client-Side Privacy Preprocessing" below.

The Version 1 standalone HTML export is generated entirely in the browser and never uploaded to the server. Original ZIP files and complete metadata are not sent to the server for this output.

Imported Source Data and the Current Working State remain full-fidelity and local to the user's browser in Version 1.

For Hosted Publication, publishing sends only the explicit outcome allowlist described in "Stored Data" below; Source Data and the complete Current Working State are never uploaded.

## Embed in Website

Embed in website ([docs/EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md)) is an approved Version 1 output, not yet implemented. It is generated and downloaded from SameView Web like Standalone HTML and Static Microsite; Source Data and the complete Current Working State are never uploaded to the server for this output either.

Once installed on a target platform, an Embed integration is a third kind of data residency, distinct from the two already described above: not local to the user's browser, and not stored by SameView Web's own server. It is stored entirely by the target platform, under the control of whoever operates that platform, with no runtime dependency on SameView servers or SameView services. This is independent of, and does not change, Source Data's and the Current Working State's own local-to-the-browser handling in SameView Web itself.

Embed in website does not introduce telemetry, usage analytics, remote error reporting or similar reporting. Any future telemetry capability requires its own explicit product, privacy, consent and technical specification.

## Stored Data

Persistence for Hosted Publication is allowlist-based: only data required for public Hosted rendering, publication identity/lifecycle, management authorization or reporting (see "Report Data" below) is stored. Arbitrary unknown Android metadata is never persisted, and a Hosted Publication is never a copy of the entire Android session.

The following data may be stored for Hosted Publication:

- processed reference image
- processed capture image
- title
- description
- derived reference and capture label snapshots
- user-authored location fields when used by the published outcome
- branding configuration and branding asset when used by the published outcome
- the published Presentation configuration selected by the user (for example the chosen background and stage-corner style)
- the global Comparison identity used to enforce at most one active Hosted Publication per Comparison — not a secret, and never sufficient by itself to authorize management (see "Management Credential Privacy" below)
- public ID
- management token hash

See [docs/ARCHITECTURE.md](ARCHITECTURE.md) "Hosted Comparison Architecture" → "Data Model" for the complete technical field list; this document states only the privacy-relevant allowlist principle.

The plaintext management token is shown to the user only once, at creation, and is never stored or retrievable afterwards — see "Management Credential Privacy" below.

Original ZIP files are never stored. Original uploaded image inputs are never stored after processing — only the processed `reference.webp`/`capture.webp` (and, when used, a processed branding asset) are retained, and embedded EXIF/XMP/IPTC/GPS metadata is never present in these final assets. Built-in branding symbols remain semantic configuration rather than a duplicated binary file where possible.

Additional files from the export (e.g. original images and HEIC source files) are not stored permanently. A processed branding asset is stored only when required for the specific published outcome.

## Session Metadata and Image Metadata

Session metadata in `metadata.json` is distinct from metadata embedded in image files.

Source Data and the Current Working State preserve supported and unknown session metadata locally for compatibility. For Hosted Publication, image processing removes embedded EXIF, XMP, IPTC and GPS metadata from published images.

For Version 1, embedded location metadata (e.g. EXIF GPS, or location fields within XMP or IPTC) in the reference and capture images may optionally be removed before a comparison image is included in a generated Standalone HTML, Static Microsite or Embed in website output — see FEATURE_SPECIFICATION.md F-005 "Remove Embedded Location Data". Only embedded location information is removed; other embedded metadata is preserved. This is independent of, and never exposes, `captureLocation` or `referenceLocation`.

## Hosted Client-Side Privacy Preprocessing

For a Hosted Publish or Update, the Android publishing client does not upload the original local session image files directly.

- The original local session files (for example `capture.jpg`, `reference.jpg` and any other session file) remain completely unchanged on the device.
- Before a Hosted Publish or Update, the client creates temporary upload copies from only the required Comparison assets.
- Embedded metadata such as EXIF, GPS, XMP and IPTC is removed from those temporary copies before network transfer.
- Only the privacy-processed temporary copies are uploaded; the temporary copies themselves are deleted again after their upload lifecycle completes.

This is a privacy-by-design measure. It does not replace server-side processing — see "Image Processing (Hosted Publication)" below. Exact client implementation details are outside the scope of this document; they belong to Android architecture/implementation documentation.

## Image Processing (Hosted Publication)

Before permanent storage, the Hosted service always processes every submitted comparison image itself:

1. Decode
2. Remove EXIF/XMP/IPTC/GPS metadata
3. Resize for web
4. Encode as WebP

This processing is always performed by the server for every published comparison, independent of and without trusting any client-side processing already performed — including the client-side privacy preprocessing described above, and any processing already performed for the standalone HTML export. The server never trusts a client's claim that an image is already sanitized; it independently validates the actual image content, decodes it, enforces the size/dimension limits below, and freshly encodes the canonical Hosted output. The server remains the final trust boundary for privacy-sensitive image processing.

### Hosted Source Images

For Android Hosted Publication, the intended image sources are `capture.jpg` and `reference.jpg` — the same two files the normal interactive Comparison presents. `reference-original.jpg` (the full, pre-crop/pre-pan/pre-zoom reference photo) is not used as the normal Hosted publication source, so that the published result corresponds to the Comparison the user actually reviewed and previewed before publishing.

Android Hosted Publishing sends only the specific assets required for the publication — never the complete SameView session ZIP.

### Size and Processing Constraints

Core comparison image input guardrails:
- approximately 20 MB per uploaded comparison image;
- maximum 40 megapixels decoded;
- approximately 8000 px per individual dimension.

Generated Hosted comparison output:
- maximum 1920 px on the long edge, aspect ratio preserved, no upscaling;
- server-controlled lossy WebP;
- one WebP asset per Comparison side for Version 1.

Custom branding asset:
- approximately 10 MB input cap;
- maximum 24 megapixels decoded;
- generated around a maximum of 512×512;
- alpha preserved where required;
- lossless/near-lossless WebP where appropriate.

These are input-validation and output guardrails, not a user-facing quality option; there is no Hosted "Quality" setting.

## Temporary Processing Data

Original upload inputs to Hosted Publication — both the privacy-preprocessed copies sent by a publishing client and the server's own working files during processing — are transient processing data only:

- never public, and isolated from public asset routes;
- retained only for the duration of the processing lifecycle;
- deleted immediately/best-effort after successful processing;
- deleted best-effort after failed or aborted processing;
- stale temporary inputs not cleaned up immediately are removed automatically by periodic cleanup;
- where operationally practical, temporary processing storage is excluded from long-lived persistent backup sets.

The concrete folder structure and exact cleanup schedule are implementation/deployment detail, not decided here.

## Publication (Hosted)

Publishing is always an explicit user action.

A publication uses an explicit allowlist. It may contain only the title, description, derived labels, user-authored location fields, required branding data and asset, required comparison images, required outcome/Presentation configuration and publication identifiers.

A publication never contains:

- the complete `metadata.json`
- unknown metadata fields
- Android or other device-local URIs
- MediaStore references
- internal imported file paths
- `captureLocation` or `referenceLocation`
- unneeded original files
- `additional.source`
- other provenance data

Public URL:
https://my.sameview.app/<public_id>

Private management capability:
https://my.sameview.app/<public_id>/manage/<management_token>

### Public Hosted Semantics

A Hosted Publication is public to anyone who possesses its public link. It is not authenticated or private access control. A difficult-to-guess public ID reduces accidental discovery, but must not be described as privacy protection or as making a Publication private.

Hosted pages are intended to be unlisted/not intentionally indexed for search in Version 1 — see "Search and Discovery" below — but this reduces unintended discovery only; it is not access control either.

The public link exposes only the allowlisted Hosted Presentation described above. It never exposes the management credential, the management-token hash, private operational data, physical storage paths, or unnecessary internal identifiers.

## Accountless Management

Hosted Publication Version 1 does not require a SameView account, a login, or a required email address, and no server-side user profile is created solely for Hosted ownership.

The management capability (see "Management Credential Privacy" below) is the ownership/management authority for Hosted Publication in Version 1 — there is no separate account-based ownership concept to reconcile with it.

## Management Credential Privacy

- The management token is a secret; the public ID and the global Comparison identity are not secrets.
- Management authority is never derived from the public ID or the Comparison identity alone.
- The server stores only a secure hash of the management token; the plaintext token is shown to the authorized client only once, at creation, and is never stored or retrievable afterwards.
- The plaintext token must never be written to logs or analytics.
- A normal SameView export (session ZIP) never contains the Hosted management credential.
- If the local Hosted management state is lost (for example through app data loss), the server does not automatically mint a replacement management token; management authority is not recoverable except through the private management link.

Exact Android-side encryption/storage implementation is defined in Android architecture/implementation documentation, not here.

## Local Android Hosted Registry

The Android app's local Hosted management registry (listing the Publications this installation can manage) is app-private local state:

- it is separate from exportable session data, and is not part of normal SameView backup ZIPs;
- it is not intended to be transferred through Android Auto Backup or device transfer;
- it may outlive the local Comparison, if the user chooses to keep the Hosted Publication after deleting the local Comparison — see "Local Deletion versus Hosted Deletion" below;
- it is not a cloud account or a server-side ownership list — see "Accountless Management" above.

Implementation details of this registry are outside the scope of this document.

## Publication Lifetime and Deletion

Hosted Publications do not expire automatically by default; there is no default 30-day or similar lifetime. A Publication is retained while the user intends it to remain online, and is removed when explicitly deleted — subject only to the defined infrastructure backup retention described in "Backups" below, and to operator/legal review handling where applicable (see "Operator and Legal Takedown" below).

`Delete online` is a hard, live-system deletion. After a successful deletion:

- public access ends;
- the live publication database state is removed;
- live Hosted assets are removed;
- the local Hosted management relationship for that Publication is removed;
- there is no user-visible Trash, no normal Undo, no Hosted version history, and no permanent tombstone kept solely to remember that the Publication once existed.

Physical asset cleanup may complete asynchronously/best-effort after logical deletion, but a cleanup failure must never make a deleted Publication publicly accessible again.

### Local Deletion versus Hosted Deletion

Deleting the local Android Comparison does not, by itself, delete its Hosted Publication.

- If the user chooses to keep the Hosted Publication, it remains online, and the local Hosted management capability remains available through the app's local registry (see "Local Android Hosted Registry" above).
- If the user also requests Hosted deletion, the deletion lifecycle described above applies.

Local storage deletion and Hosted retention are never conflated with each other.

## Backups

Live-system deletion (above) is distinct from infrastructure backup retention.

- The MySQL database and the persistent Asset Storage used by Hosted Publication are covered by regular Netcup backups (see [docs/ARCHITECTURE.md](ARCHITECTURE.md) "Backup").
- Deleted content may remain temporarily in infrastructure backups only, for the operational backup-retention period actually configured for the hosting environment — this period must be documented and verified against the deployment before production release; it is not invented in this document.
- Backups must never become a hidden user archive.
- Disaster-recovery restore procedures must account for the possibility that restoring an older backup could reintroduce a Publication deleted after that backup was taken; restoring a backup must not silently make previously deleted public content live again indefinitely.

## Report Data

`Report this content` uses a separate data model from the Hosted Publication itself.

- Only the information required to review and respond to a report is collected.
- No SameView account is required to submit a report.
- No file attachments are accepted in Version 1.
- Reporter contact information is never exposed to the Publication's publisher.
- Submitting a report does not automatically remove or suspend the Publication.

Exact legally required report fields, categories and retention periods remain subject to legal review before production release and are not invented in this document.

## Operator and Legal Takedown

Operator/legal/abuse handling is distinct from a user's own `Delete online`:

- a user's `Delete online` always follows the hard-deletion lifecycle described in "Publication Lifetime and Deletion" above;
- operator/legal/abuse handling may additionally require temporary blocking, suspension or review before a final deletion decision;
- operator takedown authority is never derived from, and never depends on, a user's management token — the two remain architecturally separate;
- any content retained specifically for a legal/abuse review is purpose-limited to that review, and separately governed from ordinary Hosted retention.

Exact legal retention rules for such review remain external legal-review work, not decided in this document.

## Logs

Privacy-sensitive Hosted inputs are not logged unnecessarily. The following are never logged:

- the plaintext management token;
- the complete management capability URL;
- raw uploaded image content;
- embedded EXIF/GPS metadata read from an upload.

Operational logs use only the minimum identifiers/data necessary for troubleshooting, and must not create long-lived logs that could be used to reconstruct deleted user content.

## Search and Discovery

`noindex`/unlisted behavior at the Hosted Public Viewer reduces unintended discovery of a Publication, but it is not privacy or access control, and a public Hosted link must never be described as secret or private — see "Public Hosted Semantics" above.

## Hosted Is Not Cloud Backup

Hosted Comparison is publication, not backup or synchronization. The Hosted system is not required to preserve enough source data to reconstruct the original Android Comparison/session. Regaining management access through the private management link restores management authority only; it never restores the original local Android session data.
