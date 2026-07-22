# SameView Web – Data and Privacy

## Privacy

SameView Web is an optional publishing service.

The Android app continues to work completely offline.

The standalone HTML export is generated entirely in the browser and never uploaded to the server.

## Stored Data

- processed reference image
- processed capture image
- title
- description
- labels
- public ID
- management token hash

The plaintext management token is shown to the user only once, at creation, and is never stored or retrievable afterwards.

Original ZIP files are never stored.

Additional files from the export (e.g. original images, HEIC source files, branding files) are not stored permanently unless required for the specific published output.

## Image Processing

Before storage:

1. Decode
2. Remove EXIF/XMP/IPTC/GPS metadata
3. Resize for web
4. Encode as WebP

This processing is always performed by the server for every published comparison, independent of and without trusting any client-side processing already performed for the standalone HTML export.

## Publication

Publishing is always an explicit user action.

Public URL:
https://web.sameview.app/v/<public-id>

Private management URL:
https://web.sameview.app/manage/<management-token>

## Deletion

Deletion removes:
- publication
- processed images
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
- the database record is fully deleted

There is no `deleted_at`, no soft delete, no history and no tombstone records. SameView Web is not designed to track deleted publications.
