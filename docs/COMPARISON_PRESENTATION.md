# COMPARISON_PRESENTATION

## Status

This is a pure presentation specification. It defines how a SameView comparison
is visually rendered and which aspects of that rendering are
user-configurable.

It does not define:

- comparison information editing behavior — owned by
  [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-003 (Edit
  Comparison),
- branding selection behavior — owned by FEATURE_SPECIFICATION.md F-004
  (Configure Comparison Branding),
- the imported metadata contract, derived labels or Outcome Snapshot
  mechanics — owned by [IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md),
- the workspace, Current Working State or outcome model — owned by
  [USER_WORKFLOW.md](USER_WORKFLOW.md), or
- application layout regions — owned by
  [APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md).

Where this document depends on one of those specifications, it references it
rather than restating it.

## Purpose

The Comparison Presentation defines the visual appearance of a SameView
comparison independently of its output medium.

The same presentation model applies to every approved comparison output type
listed in [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md#outputs). PRODUCT_SCOPE.md
remains the sole authority on which output types are approved for a given
version; naming an output type in this document does not add it to the
approved scope. Beyond the Workspace Preview and the currently approved
Standalone HTML and (planned Version 2) Hosted Comparison outputs, this
document may refer to further output types, such as a Share Image or Share
Video, purely as illustrative examples of the kind of additional output type
this presentation model is designed to support if such a type is approved in
the future. Such examples are not themselves part of the approved Version 1
or Version 2 product scope.

The Workspace Preview is the visual reference for this presentation model. It
corresponds to the Live Preview described in APPLICATION_LAYOUT.md's Output
Section. Every generated output should reproduce the Workspace Preview as
closely as technically possible (WYSIWYG).

------------------------------------------------------------------------

# Part 1 — Presentation Principles

This part defines the overall philosophy that governs the presentation. It
does not define concrete rendered elements (see Part 2) or configurable
options (see Part 3).

## Comparison First

The comparison is always the primary element.

All presentation elements support the comparison and must never visually
dominate it.

## Complete Presentation

The entire Presentation Canvas must always remain visible.

The Presentation Canvas must never have its own scroll area.

The canvas automatically scales to fit the available viewport.

## Aspect Ratio

The comparison always preserves its original aspect ratio.

Images are never stretched or cropped.

## WYSIWYG

The Workspace Preview is the authoritative visual reference.

Every configuration change defined in Part 3 is reflected immediately in the
Workspace Preview.

Generated outputs reproduce the Workspace Preview as closely as technically
possible.

------------------------------------------------------------------------

# Part 2 — Presentation Model

This part defines what the presentation renders and from which data. It does
not define which of these values are user-editable, nor how they are edited
— see Part 3 and the referenced feature specifications.

## Presentation Canvas

The Presentation Canvas contains the complete rendered comparison.

    Presentation Canvas
    ├── Canvas Background
    ├── Canvas Padding
    ├── Optional Frame
    └── Presentation Content

Canvas Padding is always present.

The Frame is optional.

## Presentation Layout

Default layout:

    Comparison Stage

    ↓

    Title

    ↓

    Reference Date → Capture Date

    ↓

    Location

    ↓

    Description

The Map Preview belongs visually to the Comparison Stage as an overlay on
the Presentation Canvas. It is **not** part of the Comparison Information
Rendering flow below.

## Comparison Stage

The Comparison Stage is the presentation element that renders the two
compared images and the divider/handle interaction inside the Presentation
Canvas.

It is distinct from APPLICATION_LAYOUT.md's "Comparison Section", which is
an application layout region, not a presentation element.

The Comparison Stage always occupies the maximum possible space inside the
Presentation Canvas. It always remains fully visible.

### Divider

Uses the existing SameView reference specification.

No presentation-specific variants are defined.

### Handle

The Handle renders the divider handle control.

Its content is derived entirely from the Session Branding configured for
the workspace (FEATURE_SPECIFICATION.md F-004):

- When no branding is configured, the Handle displays the default SameView
  Arrows.
- When a Built-in Symbol or a Custom Image is configured as Session
  Branding, the Handle displays that configured branding.

Selecting, uploading or replacing branding is defined exclusively by F-004.
This document defines only how the currently configured branding is
rendered inside the Handle; it introduces no branding option of its own.

The Handle automatically increases in size when displaying a Built-in
Symbol or a Custom Image.

Base handle shape and geometry use the existing SameView reference
specification. No presentation-specific variants are defined.

### Slider Date Labels

Displays the Reference Label and Capture Label beside the slider handle,
derived using the same rules as the Derived Slider Labels defined in
IMPORTED_COMPARISON_V1.md. For the Workspace Preview these are computed
live from the Current Working State; for a generated output they are fixed
as part of that output's Outcome Snapshot, exactly as defined for Derived
Slider Labels in IMPORTED_COMPARISON_V1.md.

Independent from the Comparison Information Rendering time block below.

## Comparison Information Rendering

This section defines how the comparison information items owned by F-003
(Title, Description, Reference Date, Capture Date, Location) are visually
presented when their configured visibility is shown. Editing a value and
editing its visibility are defined exclusively by F-003. This section
defines rendering only.

### General Rules

-   Hidden or unavailable items reserve no space.
-   Remaining items automatically move upwards.
-   All items are left-aligned.
-   Rich text is not supported.
-   Emojis are not supported.

### Title

-   Maximum one line
-   Ellipsis on overflow
-   No reserved space when hidden or unavailable

### Time

Default:

    Reference → Capture

Reference and Capture values are the Reference Label and Capture Label
derived using the rules defined in IMPORTED_COMPARISON_V1.md (Derived
Slider Labels), displayed using the available date precision.

Optional:

    Reference → Capture · Duration

The Duration addition is presentation-only, disabled by default, and is not
part of the comparison information owned by F-003.

### Location

Displayed using the application format.

Example:

    Marienplatz · Munich, Germany

### Description

-   Maximum three lines
-   Ellipsis on overflow
-   No reserved space when hidden or unavailable

## Map Preview

Map Preview is an optional presentation element, displayed as a
Presentation Canvas overlay, that renders the comparison's location as a
map when present.

Its data source is the GPS location data (`captureLocation` /
`referenceLocation`) preserved in Source Data and the Current Working State,
as defined in IMPORTED_COMPARISON_V1.md. It is independent of the
user-authored Location text fields (`location.displayName`, `location.city`,
`location.country`) rendered in Comparison Information Rendering above:
Map Preview does not derive from, and does not affect, that text, and no
reverse geocoding is performed in either direction.

This document defines only how Map Preview is rendered when it is present.
It does not decide, for any specific output type, whether a Map Preview is
included. That inclusion decision belongs to the specification owning each
output type (e.g. Standalone HTML, Hosted Comparison) and remains
unspecified here until that specification defines it.

Any output type that includes a Map Preview remains fully subject to the
existing privacy rules in DATA_AND_PRIVACY.md and IMPORTED_COMPARISON_V1.md,
which govern whether and how `captureLocation` / `referenceLocation` may
reach that output. This document does not restate, narrow or loosen those
rules.

Properties:

-   Optional
-   Disabled by default
-   Fixed size
-   Displayed as a Presentation Canvas overlay
-   Does not increase presentation height
-   Selecting the preview opens the full map

------------------------------------------------------------------------

# Part 3 — Presentation Configuration

This part lists the presentation aspects a user may configure. It defines
rendering configuration only. It does not define comparison information
editing (owned by F-003) or branding selection (owned by F-004).

## Where Presentation Configuration Belongs

Presentation Configuration is part of the Current Working State, using the
same model as Session Branding (F-004: branding "is part of the Current
Working State"). It is edited during "Prepare the Comparison"
(USER_WORKFLOW.md) and reflected immediately in the Workspace Preview.

It is explicitly not an outcome-specific setting: it exists and is editable
before any outcome is selected, which USER_WORKFLOW.md's outcome-specific
settings model does not permit ("Outcome-specific settings do not exist in
the workflow before the outcome selection").

When an outcome is generated, the Presentation Configuration values that
apply at that moment are captured into that outcome's Outcome Snapshot,
using the same snapshot semantics defined for Derived Slider Labels in
IMPORTED_COMPARISON_V1.md: later changes to the Current Working State affect
only future outcomes, and existing outcomes remain unchanged.

Whether Map Preview participates in this Current Working State / Outcome
Snapshot model for a given generated output is determined by the
specification owning that output type (see Map Preview below), not by this
document.

## Canvas

### Background

-   Light
-   Dark
-   Custom Color
    -   Color Picker
    -   HEX Input

### Frame

-   None
-   White
-   Black
-   Custom Color
    -   Color Picker
    -   HEX Input

Configured Background and Frame colors are reproduced exactly as
configured. This presentation model performs no automatic contrast
adjustment or color correction on user-selected colors; WYSIWYG fidelity
takes precedence.

## Image

### Corner Radius

-   Square
-   Rounded

## Comparison Information

-   Show Title
-   Show Time
-   Show Time Difference
-   Show Location
-   Show Description

These control only the rendering visibility used by Comparison Information
Rendering (Part 2). They render the visibility state owned by F-003; they
do not define or alter how that visibility is edited.

## Comparison Stage

-   Show Slider Date Labels

Handle rendering configuration is owned entirely by F-004 (Session
Branding) and is not a separate presentation configuration item; see
Comparison Stage → Handle in Part 2.

## Map

-   Show Map Preview

Whether Map Preview is available for a given output type, and how it is
captured, if at all, into that output's Outcome Snapshot, is defined by the
specification owning that output type — see Map Preview above. This
document does not decide inclusion or exclusion for any specific output
type.
