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
corresponds to the Presentation Preview described in APPLICATION_LAYOUT.md. Every generated output should reproduce the Workspace Preview as
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

## One Cohesive Card

The Comparison Stage and Comparison Information are perceived as a single,
unified Presentation Card — a high-quality photo card, not a comparison
image with a separate footer attached beneath it.

Comparison Information reads as a natural continuation of the Comparison
Stage immediately above it, not as an independent block. See Part 2
"Comparison Information Rendering" for the concrete spacing and
typographic rules this principle governs.

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



## Interaction Parity

Interaction is part of the presentation, not an addition layered on top of
it. Any interaction defined by the presentation model belongs to the
presentation itself, exactly as its visual appearance does.

WYSIWYG applies to presentation interaction the same way it applies to
presentation appearance: an interactive rendering of the presentation
reproduces the same presentation behavior, not only the same presentation
look.

Presentation interaction is defined once, by the presentation model. It is
never redefined separately by an individual output type, and it does not
vary between one interactive rendering of the presentation and another.



## Workspace Preview

The Workspace Preview is the authoritative live representation of the Current
Working State.

It always remains visible while editing the comparison and while configuring
outputs. Changing workflow context never replaces or hides the Workspace
Preview.

The preview immediately reflects every presentation change defined by this
specification. No manual refresh or regeneration step exists.

## Preview Consistency

Changing from the Edit Inspector to the Output Inspector does not alter the
presentation itself.

Only the surrounding application controls change. The rendered comparison
remains visually identical unless the user explicitly changes the Current
Working State.

## Preview Scaling

The entire Presentation Canvas remains visible across supported screen sizes.

The preview scales proportionally to the available space while preserving:

- aspect ratio,
- configured padding,
- configured frame,
- configured corner radius, and
- the relative positioning of all rendered presentation elements.

Scaling never crops or stretches the comparison.

## Generation

When an outcome is generated, the Workspace Preview remains the visual
reference throughout the generation process.

Temporary progress information belongs to the application interface rather
than to the Presentation Canvas itself.

Generation never replaces the Workspace Preview with a separate success,
loading or result presentation.

## Standalone HTML Fidelity

The Version 1 Standalone HTML output reproduces the Workspace Preview as
closely as technically possible.

The generated HTML contains the same visual presentation, including:

- comparison stage,
- comparison information,
- presentation configuration,
- branding,
- colors,
- frame,
- corner radius, and
- visibility configuration.

The output is intended to be WYSIWYG. Any unavoidable technical differences
between browser rendering environments should be minimized but do not alter
the presentation model defined by this specification.


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

    Description (optional)

    ↓

    Reference Date → Capture Date

    ↓

    Location

The Map Preview belongs visually to the Comparison Stage as an overlay on
the Presentation Canvas. It is **not** part of the Comparison Information
Rendering flow below.

## Comparison Stage

The Comparison Stage is the presentation element that renders the two
compared images and the divider/handle interaction inside the Presentation
Canvas.

It is distinct from APPLICATION_LAYOUT.md's "Context Inspector", which is
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

The Handle is 1.5 times its standard diameter when displaying a Built-in
Symbol or a Custom Image; ring and label geometry are otherwise unchanged.

A Custom Image or an imported branding image occupies 72% of the Handle's
diameter. A Built-in Symbol occupies 57.6% of the Handle's diameter. Both
proportions are centered exactly on the Handle's own center, horizontally
and vertically.

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
-   Comparison Information is visually cohesive with the Comparison Stage
    above it, not a separate footer: only a small padding separates the two,
    Comparison Information begins visually immediately below the Stage, and
    together they read as one Presentation Card. No large empty area is
    introduced between the Stage and Comparison Information, or within
    Comparison Information itself.

### Typographic Hierarchy

Title, Time and Location form a fixed three-level typographic hierarchy,
each level immediately below the previous with only a small, consistent
vertical gap — perceivable as one cohesive block rather than as
independent, loosely related lines:

1. **Title** — the most important item: the largest size and the
   strongest weight of the three.
2. **Time** — smaller than Title, and lower contrast than Title.
   Positioned directly below Title, or directly below Description when
   Description is shown (see below).
3. **Location** — the smallest size and the lowest contrast of the three.
   Positioned directly below Time.

Each level has exactly one standard size — arbitrary or one-off sizes are
not used. The hierarchy must be perceivable at a glance, without reading
the text.

Description belongs to Level 1 together with Title, rather than forming an
additional hierarchy level:

-   Description appears only when enabled; it reserves no space otherwise.
-   Description keeps its own, already-specified typography (see
    "### Description" below) — it does not take on Title's size or weight.
-   Description is positioned directly below Title, separated only by a
    small gap, and reads as visually belonging to Title, together forming
    one associated information block.
-   Description never introduces a fourth hierarchy level.

The full rendering order is therefore: Title → Description (when shown) →
Time → Location.

### Adaptive Sizing

Adaptive Sizing is evaluated independently per rendered item — Title,
Description, Time and Location are each assessed on their own, never as
one shared calculation for the whole block:

    Standard size
    ↓ (only if this item requires it)
    Defined smaller size
    ↓ (only if this item still requires it)
    Ellipsis

A longer Location never causes Title, Description or Time to render
smaller. A longer Title never changes the size of Description, Time or
Location — and correspondingly for every other item. There is no
synchronized or shared scaling of the Presentation Information block as a
whole.

No further automatic sizes exist beyond this one additional step per item
— no continuous scaling and no arbitrarily computed size. Ellipsis remains
the last resort for that item, used only once its own smaller defined size
still cannot fully display its content.

### Title

-   Maximum two lines
-   Ellipsis on overflow, after Adaptive Sizing's smaller defined size has
    already been attempted
-   No reserved space when hidden or unavailable

### Description

-   Maximum three lines
-   Ellipsis on overflow, after Adaptive Sizing's smaller defined size has
    already been attempted
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

Duration reads "Same year" only when zero complete years and zero complete
months separate the Reference Date from the Capture Date. Once at least one
complete month has elapsed, that month count is shown (for example "1
month" or "11 months"), even before a first complete year has elapsed.

### Location

Displayed using the application format.

Example:

    Marienplatz · Munich, Germany

### Overflow Tooltip

The Overflow Tooltip makes an item's complete original text accessible
when that item is visually truncated, without permanently occupying
additional space and without altering the Presentation Canvas geometry
defined elsewhere in this document.

The Overflow Tooltip is a Presentation Interaction (see "Interaction
Parity" in Part 1): it belongs to the presentation itself, not to the
Workspace specifically, and therefore behaves identically in every
interactive rendering of the same presentation. No output-type-specific
variant of it is defined.

The Overflow Tooltip applies to Title, Description and Location. It does
not apply to Time, the Time Difference addition, Slider Date Labels, the
Handle, the Edit Inspector, Branding, or Map Preview.

The Overflow Tooltip is available for an item only while that item's own
rendered content is actually being clipped by Adaptive Sizing's Clamp or
Ellipsis (see "Adaptive Sizing" above) — that is, only while the renderer
genuinely cannot display the item's complete text within its currently
rendered bounds. A given text length, a given number of lines, the Compact
size itself, or an assumption based on available width are not, on their
own, sufficient to make the Overflow Tooltip available; only the item's
own actual rendered truncation decides this, evaluated independently per
item, exactly as Adaptive Sizing itself already is. An item whose complete
text is currently displayed in full has no Overflow Tooltip.

The Overflow Tooltip displays the affected item's complete, original text:

-   No further clamping or ellipsis is applied inside the tooltip.
-   The text may wrap onto as many lines as it needs.
-   No markup, formatting, or Markdown is applied to the text.
-   Content is never shortened, summarized, or reworded.

Where a pointer is available, the Overflow Tooltip opens on hover and
closes once the pointer leaves the item. Independently, keyboard focus on
the item opens it, and the item losing focus closes it; Escape closes an
open tooltip without moving focus away from the item. Where only touch is
available, a single tap on the item opens it, a further tap on the same
item closes it, and a tap outside the item closes it — touch input never
simulates hover, and no sustained press is required to open it. The
Overflow Tooltip never interferes with scrolling the surrounding page or
with the Comparison Stage's own slider interaction.

The Overflow Tooltip is always positioned clearly relative to the item it
belongs to, above or below it depending on available space; when the
preferred position does not offer enough room, an alternative position
within the visible viewport is used instead. Regardless of position, the
Overflow Tooltip never extends beyond the left, right, top or bottom edge
of the visible viewport, never introduces a horizontal or vertical
scrollbar, never increases the document's width or height, never changes
the Presentation Canvas geometry, and never permanently displaces any
other presentation element.

The Overflow Tooltip has a bounded maximum width, within which its
complete text wraps onto as many lines as needed; no concrete size is
defined here — the rendered maximum width is a proportional rendering
decision, in the same sense as Part 4 "Semantic Presentation
Configuration". On a narrow viewport, the Overflow Tooltip still remains
within the available viewport width.

The Overflow Tooltip reads as calm, compact and unobtrusive — a small
detail belonging to the presentation, not a competing element within it: a
quiet, dark surface, a subtle border, a small corner radius, and compact,
easily readable typography. It uses no strong shadow and no prominent
animation, does not resemble a large card or dialog, and never visually
dominates the presentation.

Whether an item is truncated is re-evaluated whenever it could plausibly
change: on initial rendering, when the viewport is resized, when the
Presentation Canvas is resized, when the item's text changes, when the
item's visibility changes, when the item switches between its Standard and
Compact size, and when the same presentation is rendered again at a
different size or a different presentation is rendered. If a previously
truncated item becomes fully visible as a result, its Overflow Tooltip
closes and stops being available for that item. If a previously fully
visible item becomes truncated as a result, its Overflow Tooltip becomes
available.

The complete text of every Comparison Information item always remains
present wherever the presentation places accessible text — visual
truncation only ever affects what is rendered on screen, never the
accessible text content itself. The Overflow Tooltip never causes the same
text to be announced twice by assistive technology. A truncated item
remains reachable by keyboard for as long as its Overflow Tooltip is
available for it, and Escape closes the tooltip without moving focus away
from that item. The concrete technical association between an item and its
tooltip is an implementation decision, made so that it avoids duplicate
announcement.

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

-   Transparent
-   White
-   Black
-   Brand
-   Custom Color
    -   Color Picker
    -   HEX Input

Default: Brand.

### Frame

-   None
-   White
-   Black
-   Custom Color
    -   Color Picker
    -   HEX Input

Default: None.

Frame width is not a user setting. This specification defines only the
semantic color selection; concrete frame width is a rendering concern (see
"Part 4 — Semantic Presentation Configuration" below).

Configured Background and Frame colors are reproduced exactly as
configured. This presentation model performs no automatic contrast
adjustment or color correction on user-selected colors; WYSIWYG fidelity
takes precedence.

### Custom Color Editing

Background, Frame and Text use identical Custom Color editing behavior.

This specification describes user-facing behavior only. It does not
prescribe a browser API or a specific color picker implementation; an
implementation may use a native browser color input, a custom-built
picker, or any equivalent.

The HEX input accepts a value with or without a leading `#`. The value is
always stored internally normalized as `#RRGGBB` in uppercase.

While the user is typing, no aggressive validation and no automatic reset
of the field occurs.

Once the input holds a valid value, the Workspace Preview updates
immediately.

An invalid value never changes the preview: the previously valid color
remains in effect, and the field receives only a subtle error state — no
explanatory error text is shown.

Not specified for Version 1: an eyedropper/color-sampling tool, RGB/HSL/HSV
value entry, alpha/transparency, gradients or gradient backgrounds, color
history, recently used colors, color palettes, or any other
browser-specific picker detail.

### Corner Radius

-   Sharp
-   Rounded

Default: Rounded.

Corner Radius applies to the entire Presentation Canvas — Canvas
Background, the optional Frame and the Comparison Stage together — as one
continuous visual unit, not to the Comparison Stage alone.

## Text

-   Automatic
-   Light
-   Dark
-   Custom Color
    -   Color Picker
    -   HEX Input

Default: Automatic.

Text controls the color of the Comparison Information Rendering text
elements (Part 2): Title, Time (Reference Date, Capture Date and, when
enabled, the Duration/Time Difference addition), Location, and
Description.

Text does not affect: Slider Date Labels, the Handle, the compared images
of the Comparison Stage, the Edit Inspector UI, Branding, or Map Preview.

### Automatic

Automatic is the default.

The renderer determines a light or dark text tone from the Canvas
Background actually in effect at render time.

Automatic stores no concrete color. The derivation happens only at render
time.

This specification intentionally does not define a derivation algorithm, a
luminance threshold, or a WCAG contrast calculation. The concrete
derivation remains a renderer concern.

### Light

Light uses the project's existing light presentation text color:
BRAND_GUIDE.md's Text Colors → Primary (#FFFFFF). No new color value is
introduced.

### Dark

Dark uses BRAND_GUIDE.md's Brand Identity Color (#0D1424), not pure black
(#000000), producing a refined dark presentation tone consistent with the
rest of the brand.

### Custom

Selecting Custom opens the same Custom Color area as Background and Frame
— see "Custom Color Editing" above. Background, Frame and Text share one
identical Custom Color editing behavior.

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

Default: On.

Handle rendering configuration is owned entirely by F-004 (Session
Branding) and is not a separate presentation configuration item; see
Comparison Stage → Handle in Part 2.

## Map

-   Show Map Preview

Deferred to a later iteration. Show Map Preview remains part of this
specification, but is not part of the current Edit Inspector Presentation
section; its control is not yet displayed.

Whether Map Preview is available for a given output type, and how it is
captured, if at all, into that output's Outcome Snapshot, is defined by the
specification owning that output type — see Map Preview above. This
document does not decide inclusion or exclusion for any specific output
type.

------------------------------------------------------------------------

# Part 4 — Semantic Presentation Configuration

Presentation Configuration stores semantic design decisions, not absolute
pixel values.

No absolute pixel values become part of the Current Working State for any
Presentation Configuration property.

Renderers compute the concrete rendering values for a given output —
dimensions, offsets and any other rendered measurement — proportionally to
the actual size of the Presentation Canvas being rendered at that moment.

This principle applies to current Presentation Configuration properties
(Corner Radius, Frame) and equally to any future property this model may
gain (for example Spacing, Typography, Shadows).

A configured Custom Color's normalized `#RRGGBB` value (see "Custom Color
Editing" above) is itself such a semantic decision, not a pixel value —
only the concrete rendered fill or border a given output paints from it is
a rendering concern.

Text follows this same semantic-state architecture, as established for
Background and Frame. Automatic, Light and Dark are semantic states; none
of them stores a concrete color value. Only Custom stores a normalized
`#RRGGBB` value, exactly as Background's and Frame's Custom Color does.
Renderers derive the concrete rendered text color — including Automatic's
light/dark determination — from this semantic state at render time. No
pixel value and no renderer-specific state become part of the Current
Working State for Text.

Its goal is a consistent WYSIWYG presentation across the Workspace
Preview, Standalone HTML and any further approved output type —
illustratively including a possible future Image Export or Microsite
output, in the same illustrative sense as "Purpose" above — regardless of
that output's own concrete rendered size. Naming an output type here does
not add it to the approved product scope; PRODUCT_SCOPE.md remains the
sole authority on that.
