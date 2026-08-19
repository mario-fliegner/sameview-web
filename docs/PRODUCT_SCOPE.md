# SameView Web – Product Scope

## Purpose

SameView Web is the web application for importing, viewing and exporting interactive photo comparisons created with SameView.

The Android app remains the tool used to recreate and capture a photo.
SameView Web provides additional ways to present and share the finished comparison.

## Relationship to SameView Android

SameView Android is the primary application for creating and managing photo comparisons, and is the first intended client for publishing a comparison online as a Hosted Comparison — see "Hosted Comparison" below.

SameView Web is not an alternative for capturing or creating new photo comparisons. It extends comparisons created with SameView Android with browser-based viewing, metadata editing and downloadable export functions. SameView Web may become another Hosted Comparison publishing client later, using the same separate SameView Hosted service; publishing a Hosted Comparison does not require routing through SameView Web.

## Entry Points

Users can reach SameView Web directly at `web.sameview.app`, through a prominent reference on `sameview.app`, or, in a future version, from SameView Android.

SameView Web must provide the product context needed by users who access it directly and may not already know the application. This includes its relationship to SameView Android, the availability of the Android app and the requirement in Version 1 to import an export from the Android app.

## Repository and Domain

Repository: sameview-web

Production domain: https://web.sameview.app

## Core Principle

The Android app creates the comparison, and can publish it online as a Hosted Comparison.

SameView Web presents and exports it, and may also publish it online later through the same Hosted service.

## Version 1 Scope

1. Import a SameView export ZIP.
2. Display an interactive comparison slider.
3. Edit supported comparison metadata: title, description, reference date, user-authored location and session branding.
4. Derive slider labels from the reference date and immutable capture timestamp; slider labels are not independently editable.
5. Optionally remove embedded location metadata from the two comparison images for the client-side standalone HTML and static microsite outputs, without otherwise re-encoding, resizing or reducing their quality.
6. Download as standalone HTML or as a static microsite ZIP, both generated entirely in the browser from the same shared presentation and interaction source, without uploading to the server.

The import and metadata contract is defined in [docs/IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md).

## Outputs

Currently supported in Version 1 (downloadable):

- Standalone HTML
- Static Microsite

Approved for Version 1, not yet implemented (downloadable):

- Embed in website — placing a Comparison inside an existing website/CMS through a persistent, platform-native integration. Specified in [docs/EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md); platform-specific technical contracts (e.g. WordPress) are specified separately, for example [docs/WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md). Supported target platforms are implemented, tested and released independently of one another.

Planned for Version 2 (downloadable):

- iframe embed code

SameView Web is designed to support multiple comparison output types generated from the same comparison. Version 1 supports Standalone HTML and Static Microsite, both produced from the same shared presentation and interaction source and differing only in packaging. Embed in website is an approved third Version 1 output type, produced from the same shared presentation and interaction source, not yet implemented. Further downloadable comparison output types may be added in the future.

Hosted Comparison is a separate, online publication capability rather than a downloadable output artifact — see "Hosted Comparison" below.

## Hosted Comparison

Hosted Comparison is an online publication of a SameView Comparison — not a downloadable artifact in the same category as Standalone HTML or Static Microsite.

A Hosted Comparison is:

- interactive, in the same way as SameView's other interactive comparison presentations;
- accessible through one stable public link;
- intended for sharing with people who do not need to install SameView to view it;
- persistent until the user explicitly deletes it, rather than a short-lived transfer link;
- managed accountlessly in Version 1 — see "Accountless management" below.

### First publishing client

SameView Android is the first intended client for publishing a Hosted Comparison. SameView Web publishing a Hosted Comparison is planned for a later phase and is not part of the initial Hosted delivery.

### Accountless management

Publishing, updating and deleting a Hosted Comparison does not require a SameView account, a login, or a required email address. Management relies on a private management capability held by the publisher rather than an account.

### Publication lifecycle

A Comparison may have at most one active Hosted Publication at a time. An authorized update to an existing Hosted Publication keeps the same public link. A Hosted Publication remains available until it is explicitly deleted. Deleting the local Comparison on the device and deleting its Hosted Publication are separate decisions — deleting one does not automatically delete the other. Hosted Comparison is publication, not cloud backup or synchronization of local Comparisons.

### Public sharing

Once published, a Hosted Comparison can be shared through its public link, a QR code, and ordinary platform sharing, so the recipient can view and interact with the Comparison in a browser without installing SameView.

### Privacy boundary

Publishing a Hosted Comparison sends and persists only the data required for the public outcome. Privacy-sensitive metadata embedded in the underlying images is removed from the published Hosted images. A Hosted Comparison's public link means the Comparison is accessible to anyone who has that link; Version 1 does not offer a searchable public gallery of Hosted Comparisons.

Detailed data handling is defined in [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md); the exact feature behavior is defined in [docs/FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-006 and F-007.

## Out of Scope (V1)

- User accounts
- Public galleries
- Comments
- Likes
- Social features
- Automatic Android-to-web transfer
- Video hosting
- ZIP backup storage
- Cloud backup/restore of local Comparisons through Hosted Comparison
- A SameView Web Hosted-publishing workflow as part of the initial Hosted delivery
- A Hosted-operated email-delivery service for sharing links
- More than one active Hosted Publication per Comparison

## Future Scope

- Version 2: SameView Android publishes a Comparison online as a Hosted Comparison — see "Hosted Comparison" above.
- SameView Web becoming another Hosted Comparison publishing client, once the Android-first Hosted delivery is complete.
- Opening a selected comparison directly from SameView Android in SameView Web without requiring a manual ZIP import for that entry point.
- iframe embed code as an additional downloadable output type — see "Outputs" above.
