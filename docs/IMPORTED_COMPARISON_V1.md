# SameView Web – Imported Comparison V1

## Status

This specification is the authoritative SameView Web contract for importing and working with SameView comparisons in Version 1.

Its metadata semantics originate from the SameView Android session metadata specifications, but this document is self-contained. SameView Web implementations do not depend on Android UI, navigation, storage or application architecture.

## Purpose

This document defines:

- which SameView session metadata versions can be imported,
- how current and legacy metadata fields are read,
- how Source Data and the Current Working State differ,
- which metadata may be edited in SameView Web,
- which metadata remains immutable or is only preserved,
- how slider labels are derived,
- how session branding is represented, and
- which data may be included in generated and published outcomes.

It does not define the import UI, editor UI, local persistence technology or outcome-generation implementation.

## Terminology

### Imported Comparison

An Imported Comparison is a valid SameView comparison made available to SameView Web. It contains session metadata and all files accepted as part of that comparison, including the files required to represent the reference and capture images.

### Source Data

Source Data is the complete Imported Comparison as accepted by SameView Web. It includes the imported metadata, all accepted comparison files and unknown metadata fields.

Source Data is immutable after a successful import. It is retained locally as the basis for reset, compatibility and non-destructive editing.

### Current Working State

The Current Working State is initialized from Source Data as a lossless working representation of its metadata and files. It contains everything required for editing and future outcomes.

Only fields defined as mutable by this specification may differ from Source Data. Changes never overwrite Source Data. The Current Working State is the sole source for newly generated outcomes.

### Outcome Snapshot

An Outcome Snapshot contains the values derived or selected when an outcome is generated. Later changes to the Current Working State do not modify an existing Outcome Snapshot.

### Comparison Identity (`session.id`)

For a generated outcome, `session.id` is the authoritative stable identity of the underlying Comparison. It is derived from the authoritative session identity already established during import (see "Session Identity" below) and is carried unchanged into the Outcome Snapshot.

This outcome-level `session.id` is distinct from the similarly named field that may be present in imported session metadata. That imported metadata field remains non-authoritative and is never used to resolve identity, at import or at outcome generation — see "Session Identity" below. Only the identity SameView Web itself establishes during import is ever carried into an outcome as `session.id`.

Changes to metadata, images, Presentation, branding, output options or other editable state never change a Comparison's `session.id`, as long as its underlying imported session identity remains the same. A different underlying session identity represents a different Comparison.

### Outcome Fingerprint

An Outcome Fingerprint is a value included in the Outcome Snapshot that changes if and only if the outcome's own allowlisted content changes. It is generated deterministically by SameView Web at outcome-generation time.

A persistent target integration that stores generated outcomes (see [docs/EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md)) may compare a newly received outcome's fingerprint against a previously stored one for the same `session.id` to determine whether the outcome is new, changed or identical, without independently recomputing or interpreting its meaning. The concrete fingerprint mechanism is an implementation detail, not defined by this specification.

## Supported Metadata Versions

SameView Web Version 1 accepts valid SameView session metadata versions 2 through 6 inclusive, declared in the top-level `version` field (JSON integer; matches `SessionStorage.METADATA_VERSION` and `SessionScanner.SUPPORTED_VERSIONS` in the SameView Android source). `metadata.json` is UTF-8 encoded, without a byte-order mark.

Readers use the current field first and then the documented legacy fallback:

| Current field | Legacy fallback | Verification |
| --- | --- | --- |
| `capture.timestampMs` | `session.createdAtMs` | Confirmed directly against the Android reader (`SessionScanner.kt`) and its instrumented test suite (`SessionScannerTest.kt`), which exercises this fallback for versions 2–4. |
| `capture.mediaStoreUri` | `captureMediaStoreUri` | Informational provenance only; absence never invalidates an import. |
| `reference.sourceUri` | `reference.sourceDisplayName` (schema version 4), then `referencePickerUri` (versions 2–3) | Informational provenance only; absence never invalidates an import. Confirmed against `SESSION_METADATA_V1.md` §4 in the Android repository. |
| `content.title` | `title` | Optional field. The current Android reader (`SessionScanner.kt`) only reads `content.title` and does not implement this fallback; it is tolerated here defensively but is unconfirmed against any real or currently-producible export. |
| `files.reference` | `referenceFile` | Required field for a valid import. The current Android reader only reads the nested `files.reference` form for every supported version (2–6, confirmed by `SessionScannerTest.kt`). The flat fallback is tolerated here defensively but is unconfirmed against any real or currently-producible export. |
| `files.referenceOriginal` | `referenceOriginalFile` | Optional field (not required for a valid import); same fallback caveat as `files.reference`. |
| `files.capture` | `captureFile` | Required field for a valid import; same fallback caveat as `files.reference`. |

`session.id` (nested, present from schema version 5 onward) and the legacy flat `sessionId` are informational only and are not used to resolve session identity. See "Session Identity" below.

Newer optional blocks and fields may be absent in older versions. Their absence alone does not make an older comparison invalid.

## Import Validity

A valid import must:

- resolve to exactly one session directory within the archive (see "Session Identity" below),
- contain a parseable JSON object as `metadata.json`,
- declare a supported metadata version in the top-level `version` field,
- provide a valid capture timestamp through `capture.timestampMs` or its documented fallback,
- contain a `files` object block,
- provide the required reference and capture file references through `files.reference` and `files.capture` (or their documented, unconfirmed legacy fallbacks — see above), and
- satisfy the file and archive validation rules in [ARCHITECTURE.md](ARCHITECTURE.md).

A resolvable session identity value is not required at the metadata-parsing level. See "Session Identity" below.

If a valid capture timestamp cannot be obtained after applying the fallback, the import is invalid. It must not be reconstructed from image EXIF.

Device-local URIs and MediaStore references are informational provenance. They are never used to resolve files in SameView Web and their absence does not invalidate an otherwise valid import.

## Session Identity

Session identity is authoritatively the session's directory name inside the SameView export archive — matching the Android app's own contract, where the ZIP subdirectory name is the stable session identity (`SESSION_BACKUP_EXPORT_V1.md` §4.2, §11.1 in the Android repository) and, from schema version 5 onward, `metadata.json`'s `session.id` field is written identically to it.

The Android reader (`SessionScanner.kt`) itself never validates a `session.id` or `sessionId` field for identity; it uses the containing directory name exclusively, and resolves `capture.timestampMs`'s fallback from the nested `session.createdAtMs` field without requiring an identity field to be present.

Metadata-level parsing therefore does not require or validate a session identity value. Resolving the archive directory name — and, when `session.id` is present, confirming it matches — is a ZIP/archive-resolution-level concern, defined together with the file and archive validation rules in [ARCHITECTURE.md](ARCHITECTURE.md), not a metadata-parsing-level concern.

A SameView export archive may legitimately contain more than one session directory (Android's own multi-session backup export produces exactly this structure). Because Version 1 supports exactly one active workspace, SameView Web does not select, merge or otherwise automatically resolve multiple session directories in a single import archive. An archive containing more than one valid session directory is rejected as a distinct import failure, as defined in [ARCHITECTURE.md](ARCHITECTURE.md) and [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-001.

This archive-directory-name identity, once resolved at import, is the sole basis for the outcome-level Comparison Identity carried into a generated outcome — see "Comparison Identity (`session.id`)" below. That outcome-level identity is a distinct concept from the imported metadata field discussed above: the metadata field remains informational only and is never itself the basis for identity resolution, at import or at outcome generation.

## Metadata Preservation

Unknown fields at every nesting level must be tolerated and retained in Source Data and the Current Working State.

Editing a known field must preserve:

- all other known fields,
- unknown fields,
- optional blocks not involved in the edit, and
- immutable metadata.

Unknown fields are not automatically included in outcomes or publications.

## Metadata Ownership

### Web-Editable Fields

SameView Web Version 1 may edit:

| Field | Type | Optional |
| --- | --- | --- |
| `content.title` | string | yes |
| `content.description` | string | yes |
| `reference.date` | string | yes |
| `location.displayName` | string | yes |
| `location.city` | string | yes |
| `location.country` | string | yes |
| session branding | branding configuration and optional asset | yes |

All text fields are plain text. Blank normalized values are treated as absent.

Text normalization:

- trims leading and trailing whitespace,
- removes zero-width and bidirectional override characters,
- replaces tabs with spaces,
- replaces line breaks with spaces in title and location fields,
- preserves line breaks in description, and
- preserves international characters, emoji and normal punctuation.

SameView Web Version 1 does not define additional schema-level length limits for these fields.

### Preserved but Not Editable in Web V1

The following fields are retained without operative effect in SameView Web Version 1:

- `content.tags`
- `additional.isFavorite`
- `additional.visibility`
- `additional.source`

Their absence is valid. SameView Web must not replace, normalize or remove them merely because it does not use them.

### Immutable Fields

SameView Web must not edit:

- session identity,
- `capture.timestampMs`,
- comparison image and original-file references,
- source URIs and MediaStore references,
- original files,
- viewport data,
- overlay geometry,
- rendering configuration,
- `captureLocation`,
- `referenceLocation`,
- `additional.source`, or
- other system identity, rendering or provenance fields.

The branding handle reference and optional branding asset are the only file-related values that may change as part of a Web V1 branding edit.

Imported images and original files are not editable comparison metadata. Metadata editing must not replace, crop, realign or otherwise alter them.

## Content Metadata

`content.title` and `content.description` are optional user-authored plain text.

Title is single-line content. Description may contain line breaks. Neither field supports HTML or Markdown execution.

Editing these fields changes only the Current Working State.

## Reference Date

`reference.date` represents the user's knowledge of when the reference photo was taken. It is independent of the capture timestamp and GPS data.

Supported values are:

- `YYYY`
- `YYYY-MM`
- `YYYY-MM-DD`

Validation rules:

- the year must be between 1826 and the browser's current year,
- the month must be between `01` and `12`,
- a day must be valid for its year and month,
- month and day must be zero-padded, and
- an empty normalized value means that the field is absent.

A manual change:

- updates or removes `reference.date`,
- sets `reference.dateSource` to `manual` when a value is present,
- removes `reference.dateSource` when the date is removed, and
- sets `reference.userEdited` to `true`.

A manually established date must never be replaced by a later EXIF read.

## Capture Timestamp

`capture.timestampMs` is the canonical capture time in milliseconds since the Unix epoch.

It is immutable and independent of image EXIF. For legacy sessions, `sessionTimestampMs` is used only when `capture.timestampMs` is absent.

The capture timestamp is never reconstructed from an image, changed by metadata editing or replaced by another date.

## Location Metadata

The following optional fields are independent user-authored plain text:

- `location.displayName`
- `location.city`
- `location.country`

Each field may be present or absent independently. Location text is not derived from GPS, and no reverse geocoding is performed.

Editing location text must not modify `captureLocation` or `referenceLocation`. GPS blocks remain unchanged in Source Data and the Current Working State.

## Session Branding

The Current Working State supports:

- no branding,
- a built-in symbol, or
- an image logo.

Branding uses:

- `branding.type`,
- `branding.builtinId`,
- `branding.symbolColor`,
- `branding.symbolColorHex`,
- `branding.handleFile`,
- `branding.updatedAtMs`,
- `files.brandingHandle` (the same filename as `branding.handleFile`, referenced from the `files` block), and
- an optional branding asset referenced by the branding configuration.

`branding.type` is `builtin` or `image`. `branding.builtinId` identifies a built-in symbol and is applicable only to built-in branding. `branding.handleFile` identifies the normalized handle asset when one is present. `branding.updatedAtMs` and `files.brandingHandle` are preserved but have no operative effect on Web V1 branding behavior; an inconsistency between `files.brandingHandle` and the `branding` block is tolerated and treated as no branding, matching the Android reader's own tolerance (`SessionScanner.kt`).

`branding.symbolColor` is `dark`, `brand` or `custom`, and configures the rendered color of a Built-in Symbol (`APPLICATION_LAYOUT.md` "Branding" → "Color"). It is applicable only to `builtin` branding and has no meaning for `image` branding. `branding.symbolColorHex` holds the configured custom color as a normalized `#RRGGBB` value and is present only when `branding.symbolColor` is `custom`. When `branding.symbolColor` is absent — including every existing Android export, which does not write this field — the effective color is `dark`. The configured color belongs to the built-in branding as a whole, not to an individual symbol: selecting a different built-in symbol (for example Heart, then Star, then Fire) preserves the currently configured `branding.symbolColor`/`branding.symbolColorHex` unchanged. Configuring or changing `branding.symbolColor`/`branding.symbolColorHex` never regenerates, replaces or otherwise modifies `files.brandingHandle` or any other raster branding asset.

The supported V1 `branding.builtinId` values, adopted unchanged from the Android built-in symbol catalog, are:

| `builtinId` | Symbol |
| --- | --- |
| `heart` | Heart |
| `star` | Star |
| `camera` | Camera |
| `home` | Home |
| `pin` | Pin |
| `fire` | Fire |

No other `branding.builtinId` values are defined for V1.

When Source Data includes built-in branding, the imported `branding-handle.png` (referenced by `files.brandingHandle`/`branding.handleFile`) remains the asset used for display; `branding.builtinId` is preserved alongside it but is not used to regenerate or replace that asset. A built-in symbol newly selected in SameView Web stores the corresponding `branding.builtinId` from the table above in the Current Working State.

Branding imported from Source Data is optional. Older comparisons without branding remain valid. Changes made in SameView Web affect only the Current Working State.

Branding is included only in outcomes that use it.

## Derived Slider Labels

Slider labels are derived outcome data. They are not editable comparison metadata and are not written back to the Current Working State as free-form values.

### Reference Label

The Reference Label is derived from `reference.date` at outcome generation:

| Stored precision | Derived label |
| --- | --- |
| `YYYY` | the stored year |
| `YYYY-MM` | localized month and year |
| `YYYY-MM-DD` | localized date |
| absent | localized fallback meaning “Then” |

### Capture Label

The Capture Label is derived from `capture.timestampMs` at outcome generation. It is formatted using the browser's locale and local time zone.

### Snapshot Semantics

`referenceLabel` and `captureLabel` are fixed in the Outcome Snapshot when an outcome is generated.

- Existing outcomes remain unchanged.
- Current Working State changes affect only future outcomes.
- Publication uses the labels stored in the generated Outcome Snapshot.
- Persisted label columns contain outcome data, not editable comparison metadata.

## Outcome and Publication Data

Local Source Data and the Current Working State remain full-fidelity.

A published outcome uses an explicit allowlist. It may include, when required by that outcome:

- title,
- description,
- derived label snapshots,
- user-authored location fields,
- branding configuration,
- the branding asset,
- required comparison images,
- required outcome configuration,
- the Comparison Identity (`session.id`), when the outcome type requires a stable identity, and
- the Outcome Fingerprint, when the outcome type requires exact-duplicate detection.

A publication must not include:

- the complete `metadata.json`,
- unknown metadata fields,
- Android or other device-local URIs,
- MediaStore references,
- internal file paths,
- `captureLocation` or `referenceLocation`,
- unneeded original files,
- `additional.source`, or
- other provenance data.

Session metadata in `metadata.json` is distinct from metadata embedded in image files. Published images are processed according to [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md), including removal of EXIF, XMP, IPTC and GPS image metadata.

## Forward Compatibility

Readers must tolerate unknown fields at every nesting level. Unknown optional fields and unknown optional blocks must not make a supported comparison invalid.

Unknown values are preserved locally but have no operative effect unless a later specification defines one. They are not published by default.

Adding a required field, removing a field or changing field meaning requires an explicit compatibility decision.

## Non-Goals

This specification does not define:

- Android UI or navigation,
- Compose, ViewModel or scanner behavior,
- Android storage functions or device paths,
- Web editor layout or controls,
- local browser persistence technology,
- import progress or error presentation,
- outcome-generation implementation, or
- publication API design.
