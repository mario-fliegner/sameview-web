# SameView Web – Data and Privacy

## Privacy

SameView Web is an optional publishing service.

The Android app continues to work completely offline.

The standalone HTML export is generated entirely in the browser and never uploaded to the server.

Imported Source Data and the Current Working State remain full-fidelity and local to the user's browser. Publishing sends only the explicit outcome allowlist; Source Data and the complete Current Working State are never uploaded.

## Stored Data

- processed reference image
- processed capture image
- title
- description
- derived reference and capture label snapshots
- user-authored location fields when used by the published outcome
- branding configuration and branding asset when used by the published outcome
- public ID
- management token hash

The plaintext management token is shown to the user only once, at creation, and is never stored or retrievable afterwards.

Original ZIP files are never stored.

Additional files from the export (e.g. original images and HEIC source files) are not stored permanently. A processed branding asset is stored only when required for the specific published outcome.

## Session Metadata and Image Metadata

Session metadata in `metadata.json` is distinct from metadata embedded in image files.

Source Data and the Current Working State preserve supported and unknown session metadata locally for compatibility. Image processing removes embedded EXIF, XMP, IPTC and GPS metadata from published images.

## Image Processing

Before storage:

1. Decode
2. Remove EXIF/XMP/IPTC/GPS metadata
3. Resize for web
4. Encode as WebP

This processing is always performed by the server for every published comparison, independent of and without trusting any client-side processing already performed for the standalone HTML export.

## Publication

Publishing is always an explicit user action.

A publication uses an explicit allowlist. It may contain only the title, description, derived labels, user-authored location fields, required branding data and asset, required comparison images, required outcome configuration and publication identifiers.

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
https://web.sameview.app/v/<public-id>

Private management URL:
https://web.sameview.app/manage/<management-token>

## Deletion

Deletion removes:
- publication
- processed images
- processed branding asset, when present
- related metadata

Temporary uploads must be deleted automatically after processing.

Temporary upload lifecycle:

- Uploads are used exclusively for processing, never for permanent storage.
- Successfully processed ZIP files are deleted immediately after processing completes.
- Successfully created temporary working files are deleted immediately as well.
- On errors or aborted operations, temporary files must not remain permanently.
- Temporary files not cleaned up immediately are removed by a periodic cleanup.
- Temporary files are never publicly reachable.

The concrete folder structure and cleanup/cron implementation are not yet defined.

Version 1 uses hard delete exclusively. Deleting a publication means:

- the publication becomes immediately unreachable
- the management link becomes immediately invalid
- `reference.webp` and `capture.webp` are physically deleted
- the processed branding asset is physically deleted when present
- the database record is fully deleted

There is no `deleted_at`, no soft delete, no history and no tombstone records. SameView Web is not designed to track deleted publications.
