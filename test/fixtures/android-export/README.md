# Real Android export fixtures

Two real, single-session SameView exports produced by the actual SameView
Android app (schema version 6), provided as the canonical real-export
compatibility fixtures for the import pipeline. Both are deliberately staged,
non-sensitive test captures, taken with Recreation Guidance off (no GPS
blocks in either `metadata.json`).

## `sample-v6-session_minimal.zip`

The canonical **minimal** valid v6 export: a fresh capture with no
user-entered content, no location, and no branding configured. `files.*`
declares five files (`capture`, `captureOriginal`, `reference`,
`referenceOriginal`, `referenceSourceOriginal`) — no `brandingHandle`.
`reference.dateSource` is `"exif"` (auto-populated, not manually set).

Use this fixture to verify the baseline shape: the pipeline must not require
any optional metadata block to be present.

## `sample-v6-session_full.zip`

The canonical **fuller** valid v6 export: a capture with `content.title`,
`content.description`, `location.*` and built-in branding (`branding.type:
"builtin"`, `branding.builtinId: "star"`) all set. `files.*` additionally
declares `brandingHandle`. `reference.dateSource` is `"manual"`
(user-edited).

Use this fixture to verify optional-block handling: unknown-field
preservation and the branding file resolution path in particular.

## Handling rules

- Both files must be treated as **read-only** by every test that uses them —
  opened with `readFile`/`readFileSync` only, never written to or deleted.
- Do not regenerate, re-compress, or otherwise modify either archive. If a
  different or additional real export is ever needed, add it as a new file
  rather than replacing one of these, so existing tests referencing these
  exact fixtures keep working.

## Used by

- `test/integration/android-export-fixture.test.mjs` — both fixtures:
  structural archive validation, single-session resolution, required and
  optional file resolution (including the branding-handle difference between
  the two).
- `test/e2e/import-pipeline.spec.ts` — `sample-v6-session_full.zip` only, for
  the one complete browser-only import flow (decode validation is identical
  code for both fixtures, so only one is used there — see the comment on
  that test).
