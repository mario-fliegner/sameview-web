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

## Supported Metadata Versions

SameView Web Version 1 accepts valid SameView session metadata versions 2 through 6 inclusive.

Readers use the current field first and then the documented legacy fallback:

| Current field | Legacy fallback |
| --- | --- |
| `session.id` | `sessionId` |
| `capture.timestampMs` | `sessionTimestampMs` |
| `capture.mediaStoreUri` | `captureMediaStoreUri` |
| `reference.sourceUri` | `reference.sourceDisplayName`, then `referencePickerUri` |
| `content.title` | `title` |
| `files.reference` | `referenceFile` |
| `files.referenceOriginal` | `referenceOriginalFile` |
| `files.capture` | `captureFile` |

Newer optional blocks and fields may be absent in older versions. Their absence alone does not make an older comparison invalid.

## Import Validity

A valid import must:

- contain a parseable JSON object as `metadata.json`,
- declare a supported metadata version,
- provide a session identity through the current field or its fallback,
- provide a valid capture timestamp through the current field or its fallback,
- provide the required reference and capture file references through current fields or their fallbacks, and
- satisfy the file and archive validation rules in [ARCHITECTURE.md](ARCHITECTURE.md).

If a valid `capture.timestampMs` cannot be obtained after applying the fallback, the import is invalid. It must not be reconstructed from image EXIF.

Device-local URIs and MediaStore references are informational provenance. They are never used to resolve files in SameView Web and their absence does not invalidate an otherwise valid import.

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
- `branding.handleFile`, and
- an optional branding asset referenced by the branding configuration.

`branding.type` is `builtin` or `image`. `branding.builtinId` identifies a built-in symbol and is applicable only to built-in branding. `branding.handleFile` identifies the normalized handle asset when one is present.

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
- required comparison images, and
- required outcome configuration.

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
