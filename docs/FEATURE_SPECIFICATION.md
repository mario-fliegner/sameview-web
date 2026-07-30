# SameView Web – Feature Specification

## Status

This document defines the normative functional behavior of SameView Web features and complements the existing specifications.

## Purpose

This document specifies every user-visible feature independently using a consistent structure.

It does not redefine:

- product scope
- user workflow
- architecture
- privacy requirements

## Feature Index

| ID | Feature | Scope |
|----|---------|-------|
| F-001 | Import Comparison | Current Version 1 |
| F-002 | View Comparison | Current Version 1 |
| F-003 | Edit Comparison | Current Version 1 |
| F-004 | Configure Comparison Branding | Current Version 1 |
| F-005 | Generate Comparison Output | Current Version 1 |
| F-006 | Publish Hosted Comparison (planned) | Planned Version 2 |
| F-007 | Manage Hosted Comparisons (planned) | Planned Version 2 |

## Specification Principles

Every feature description shall:

- describe observable user-facing behavior
- define preconditions
- define functional behavior
- define expected results
- define rules and limitations
- avoid implementation details
- avoid UI layout decisions unless functionally relevant
- avoid duplicating requirements from other specifications
- remain consistent with approved specifications

## F-001 Import Comparison

### Purpose

Import Comparison allows the user to make an existing SameView comparison available in SameView Web as an editable workspace.

### Preconditions

- The user has a SameView export ZIP.
- If no workspace is active, the application is in the `No Workspace` state.
- If a workspace is already active, the user must explicitly decide whether to replace it before another comparison may be imported.

### Functional Behavior

1. The user selects a SameView export ZIP.
2. If a workspace is already active, the application obtains the user's explicit decision before replacing that workspace. Cancelling the replacement ends the import without changing the active workspace.
3. The application validates the archive according to the existing import, archive and file validation specifications.
4. The application locates and parses `metadata.json`.
5. The application validates that the metadata declares a supported version and satisfies the imported comparison contract.
6. The application reads current metadata fields first and applies documented legacy fallbacks only where the imported comparison specification defines them.
7. The application resolves the comparison files referenced by the metadata and validates all files required for a valid import.
8. After all validation succeeds, the application creates immutable Source Data containing the complete accepted Imported Comparison, including metadata, accepted comparison files and preserved unknown metadata.
9. The application initializes the Current Working State from Source Data as a lossless working representation of the imported comparison.
10. The application creates exactly one active workspace for the imported comparison. When importing from `No Workspace`, the application transitions to `Workspace Active`.

### Result

A successful import creates one active workspace representing the selected comparison. Its Source Data is immutable, and its Current Working State is ready for review, editing and the generation of future outcomes.

### Rules and Limitations

- Exactly one workspace may be active at a time.
- A workspace may be created only from a valid, supported SameView export.
- A SameView export ZIP containing more than one valid session directory is rejected as a distinct import failure; SameView Web V1 does not select, merge or otherwise automatically resolve multiple sessions in one archive.
- Source Data remains immutable after a successful import.
- Unknown metadata fields and unknown optional blocks are tolerated and preserved where required by the imported comparison specification.
- Current metadata fields take precedence over documented legacy fallbacks.
- Device-local URIs and MediaStore references are not used to resolve comparison files.
- Importing does not modify the selected ZIP or any content in the original export.
- Replacing an active workspace requires an explicit user decision.
- If replacement is cancelled or the new import fails, the existing workspace, its Current Working State and previously generated outcomes remain unchanged.
- Detailed metadata field definitions and compatibility rules remain defined by the imported comparison specification.
- Implementation details, user interface layout and storage technologies are outside the scope of this feature.

### Failure Conditions

An import fails when the selected archive is not a supported SameView export or does not satisfy the existing archive, metadata or referenced-file validation requirements. This includes an archive that cannot be accepted, a missing or unparseable `metadata.json`, an unsupported metadata version, missing or invalid required metadata, required referenced comparison files that cannot be resolved or validated, or an archive containing more than one valid session directory.

When an import fails, the application communicates that the comparison could not be imported. The failure does not create a workspace from the rejected comparison. Failed imports never create a partially initialized workspace and never modify an already active workspace, its Current Working State or its previously generated outcomes.

## F-002 View Comparison

### Purpose

View Comparison allows the user to inspect and interact with the comparison represented by the active workspace.

### Preconditions

- Exactly one workspace is active.
- The active workspace contains a valid Current Working State with both required comparison images.

### Functional Behavior

1. The application presents the active workspace to the user.
2. The application presents the comparison interactively so that both comparison images are available for inspection.
3. The presented comparison and its information are derived from the Current Working State.
4. Configured branding is presented where applicable.
5. All displayed comparison information automatically reflects changes made to the Current Working State by other features.
6. Viewing and interacting with the comparison performs no modification of comparison data.

### Result

After the comparison is viewed:

- the active workspace remains available,
- the Current Working State remains unchanged unless it is modified by another feature, and
- Source Data remains unchanged.

### Rules and Limitations

- Exactly one comparison may be viewed at a time.
- Presentation is always derived from the Current Working State.
- Source Data is never modified.
- User interaction within the viewer does not modify comparison data.
- Viewing the comparison is independent of standalone HTML generation.
- Viewing the comparison is independent of publication.
- Metadata editing is not part of this feature.
- Branding configuration is not part of this feature.
- Marker editing is not part of this feature.
- HTML generation is not part of this feature.
- Publication is not part of this feature.
- Implementation details and user interface layout are outside the scope of this feature.

## F-003 Edit Comparison

### Purpose

Edit Comparison allows the user to update the user-editable comparison information and presentation visibility of an imported comparison in the active workspace.

### Comparison Information

Comparison information consists of user-facing information associated with the imported comparison. For each information item, its value and its visibility in the comparison presentation are separate properties:

| Comparison information | Value | Visibility |
| --- | --- | --- |
| Comparison Title | Editable | Editable |
| Description | Editable | Editable |
| Reference Date | Editable | Editable |
| Capture Date | Read-only | Editable |
| Reference Location Display Name | Editable | Editable |
| Reference Location City | Editable | Editable |
| Reference Location Country | Editable | Editable |
| Session Branding | Editable through Feature F-004 | Follows the configured branding state |

An information value and its visibility are independent. A value may exist in the Current Working State while being hidden from the comparison presentation.

### Functional Behavior

1. The user may modify the value or visibility of comparison information only where that property is defined as editable.
2. All edits modify only the Current Working State.
3. Source Data remains unchanged.
4. The comparison viewer immediately reflects changes to the Current Working State.
5. A generated standalone HTML outcome or future publication uses the Current Working State that exists when that outcome is generated.
6. Editing never changes previously generated or previously published outcomes.
7. Alignment markers are not part of SameView Web and are outside the scope of this feature.

### Result

After editing:

- the active workspace remains available,
- the Current Working State contains the updated comparison information and presentation visibility, and
- Source Data remains unchanged.

### Rules and Limitations

- Only editable comparison information properties may be modified.
- Read-only information cannot be changed.
- Comparison information may be hidden without deleting its value.
- Removing a value is different from hiding the information.
- Presentation visibility defined by this feature is independent of the preserved imported `additional.visibility` metadata field.
- Session Branding is configured only through Feature F-004.
- Detailed value formats, validation, metadata semantics and outcome snapshot behavior remain defined by the existing specifications.
- Implementation details and user interface layout are outside the scope of this feature.
- No product behavior beyond the behavior defined by the approved specifications and this feature is introduced.

## F-004 Configure Comparison Branding

### Purpose

Configure Comparison Branding allows the user to select the branding used in the presentation and future outcomes of the comparison in the active workspace.

### Branding Options

The supported branding options are:

- No Branding
- Built-in Symbol
- Custom Image

Branding, including a custom branding image when selected, is part of the Current Working State.

### Functional Behavior

The user may:

- disable branding by selecting No Branding,
- select a supported built-in branding symbol,
- upload a custom branding image,
- replace an existing custom branding image, and
- switch freely between all branding options.

Each branding change updates the Current Working State and is immediately reflected by the comparison viewer. Generated standalone HTML includes the branding selected in the Current Working State at generation time. A future publication includes the branding selected in the Current Working State at generation time.

Changing branding does not alter previously generated standalone HTML or previously published comparisons.

### Result

After configuring branding:

- the active workspace remains available,
- the Current Working State contains the selected branding and any custom branding image required by that selection, and
- Source Data remains unchanged.

### Rules and Limitations

- Branding configuration is independent of Source Data and never modifies Source Data.
- A custom branding image is part of the Current Working State.
- The current branding is preserved when generating standalone HTML.
- The current branding is preserved when publishing.
- Changing branding never modifies previously generated or previously published outcomes.
- No branding options other than No Branding, Built-in Symbol and Custom Image are defined.
- Implementation details, image processing and user interface layout are outside the scope of this feature.

## F-005 Generate Comparison Output

### Purpose

Generate Comparison Output allows the user to create a new comparison output artifact from the Current Working State of the active workspace.

### Preconditions

- An active workspace exists.
- The active workspace has a valid Current Working State.

### Supported Output Types

SameView Web supports multiple comparison output types generated from the same comparison.

The currently supported Version 1 output type is:

- Standalone HTML

The output type planned for Version 2 is:

- Hosted Comparison

Later possible output types include:

- Static Microsite
- CMS Package

Additional comparison output types may be introduced in future versions.

### Functional Behavior

1. The user explicitly enters the output-selection context while remaining in the same active workspace.
2. The user selects one supported comparison output type.
3. The selected comparison output is generated exclusively from the Current Working State.
4. Every generated output represents the same comparison associated with the active workspace.
5. Each output type may define its own generation, processing and delivery behavior.
6. Successful generation creates a new comparison output artifact.
7. Returning to comparison editing never discards the Current Working State or previously generated outputs.



### Standalone HTML

For Version 1, Standalone HTML is generated and immediately handed to the browser as a download.

No additional output-specific configuration is required beyond the Current Working State.

The generated HTML reproduces the current Workspace Preview as closely as technically possible.

Generation and browser download form one continuous user action.


### Result

After successful generation:

- a comparison output artifact exists,
- the active workspace remains available,
- the Current Working State remains unchanged, and
- Source Data remains unchanged.

### Rules and Limitations

- Output generation never modifies Source Data.
- Output generation never modifies the Current Working State.
- Every generated output represents the Current Working State at the time of generation.
- Previously generated outputs remain unchanged.
- Output-type-specific behavior may be defined by dedicated specifications.
- This feature does not describe publishing an output.
- This feature does not describe hosted comparison management.
- This feature does not describe public URLs, QR codes or embed codes.
- Implementation details are outside the scope of this feature.
