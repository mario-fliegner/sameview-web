# SameView Web – Product Scope

## Purpose

SameView Web is the web application for importing, viewing, exporting and publishing interactive photo comparisons created with SameView.

The Android app remains the tool used to recreate and capture a photo.
SameView Web provides additional ways to present and share the finished comparison.

## Relationship to SameView Android

SameView Android is the primary application for creating and managing photo comparisons.
SameView Web is not an alternative for capturing or creating new photo comparisons. It extends comparisons created with SameView Android with browser-based viewing, metadata editing, export and publication functions.

## Entry Points

Users can reach SameView Web directly at `web.sameview.app`, through a prominent reference on `sameview.app`, or, in a future version, from SameView Android.

SameView Web must provide the product context needed by users who access it directly and may not already know the application. This includes its relationship to SameView Android, the availability of the Android app and the requirement in Version 1 to import an export from the Android app.

## Repository and Domain

Repository: sameview-web

Production domain: https://web.sameview.app

## Core Principle

The Android app creates the comparison.

SameView Web presents, exports and optionally publishes it.

## Version 1 Scope

1. Import a SameView export ZIP.
2. Display an interactive comparison slider.
3. Edit supported comparison metadata: title, description, reference date, user-authored location and session branding.
4. Derive slider labels from the reference date and immutable capture timestamp; slider labels are not independently editable.
5. Remove image metadata and optimize images.
6. Download as standalone HTML, generated entirely in the browser without uploading to the server.
7. Publish online.
8. Receive public URL, QR code and iframe embed code.
9. Manage or delete the publication through a private management link.

The import and metadata contract is defined in [docs/IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md).

## Outputs

- Standalone HTML
- Hosted comparison
- QR code
- iframe embed code

## Out of Scope (V1)

- User accounts
- Public galleries
- Comments
- Likes
- Social features
- Automatic Android-to-web transfer
- Video hosting
- ZIP backup storage

## Future Scope

- Open a selected comparison directly from SameView Android in SameView Web without requiring a manual ZIP import for that entry point.
