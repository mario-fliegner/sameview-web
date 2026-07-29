# COMPARISON_PRESENTATION

## Purpose

The Comparison Presentation defines the visual appearance of a SameView
comparison independently of its output medium.

The same presentation model is used by:

-   Workspace Preview
-   Standalone HTML
-   Hosted Comparison
-   Share Image
-   Share Video

The Workspace Preview is the visual reference. Published and exported
outputs should match it as closely as technically possible (WYSIWYG).

------------------------------------------------------------------------

# Design Principles

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

------------------------------------------------------------------------

# Presentation Canvas

The Presentation Canvas contains the complete rendered comparison.

    Presentation Canvas
    ├── Canvas Background
    ├── Canvas Padding
    ├── Optional Frame
    └── Presentation Content

Canvas Padding is always present.

The Frame is optional.

------------------------------------------------------------------------

# Presentation Layout

Default layout:

    Comparison

    ↓

    Title

    ↓

    Reference Date → Capture Date

    ↓

    Location

    ↓

    Description

The Map Preview belongs visually to the Comparison Area as an overlay on
the Presentation Canvas.

It is **not** part of the metadata flow.

------------------------------------------------------------------------

# Metadata

## General Rules

-   All metadata elements are optional.
-   Hidden or unavailable elements reserve no space.
-   Remaining elements automatically move upwards.
-   All metadata is left-aligned.
-   Rich text is not supported.
-   Emojis are not supported.

## Title

-   Optional
-   Visible by default if available
-   Can be shown or hidden independently
-   Maximum one line
-   Ellipsis on overflow
-   No reserved space when hidden or unavailable

## Time

Default:

    Reference → Capture

Displayed using the available date precision.

Optional:

    Reference → Capture · Duration

Time Difference is disabled by default.

## Location

Displayed using the application format.

Example:

    Marienplatz · Munich, Germany

## Description

-   Optional
-   Hidden by default
-   Maximum three lines
-   Ellipsis on overflow
-   No reserved space when hidden or unavailable

------------------------------------------------------------------------

# Comparison

The Comparison Area always occupies the maximum possible space inside
the Presentation Canvas.

It always remains fully visible.

## Divider

Uses the existing SameView reference specification.

No presentation-specific variants are defined.

## Handle

Uses the existing SameView reference specification.

Supported handle content:

-   SameView Arrows
-   Built-in Symbol
-   Custom Image

The handle automatically increases in size when displaying a Built-in
Symbol or Custom Image.

## Slider Date Labels

Optional.

Enabled by default.

Displays the reference and capture dates beside the slider handle.

Independent from the metadata time block.

------------------------------------------------------------------------

# Map Preview

-   Optional
-   Disabled by default
-   Fixed size
-   Displayed as a Presentation Canvas overlay
-   Does not increase presentation height
-   Selecting the preview opens the full map

------------------------------------------------------------------------

# Presentation Options

## Canvas

### Background

-   Light
-   Dark
-   Custom Color
    -   Color Picker
    -   HEX Input

## Frame

-   None
-   White
-   Black
-   Custom Color
    -   Color Picker
    -   HEX Input

## Image

### Corner Radius

-   Square
-   Rounded

## Metadata

-   Show Title
-   Show Time
-   Show Time Difference
-   Show Location
-   Show Description

## Comparison

-   Show Slider Date Labels
-   Handle Content

## Map

-   Show Map Preview

------------------------------------------------------------------------

# Design Philosophy

The Workspace Preview is the authoritative visual reference.

All presentation options are reflected immediately in the preview.

Published and exported outputs should reproduce the Workspace Preview as
closely as technically possible.
