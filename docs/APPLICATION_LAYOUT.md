# APPLICATION_LAYOUT

Version: 1.0 (Draft)

## Purpose

This document defines the global application layout and user interface structure of SameView Web Version 1.


Its purpose is **not** to define visual styling (colors, spacing, typography or CSS implementation). Those aspects belong to the Brand Guide and implementation.

Instead, this document defines:

- application information architecture
- screen composition
- layout regions
- responsive behavior
- interaction flow
- persistent UI elements
- application states

This document serves as the layout source of truth for future implementation iterations.

---

# Design Principles

The application should feel like a modern desktop application rather than a traditional website.

The interface should be:

- calm
- spacious
- focused
- minimal
- distraction-free

The comparison itself is always the primary focus.

The application must never feel overloaded.

Only controls relevant to the current task should be visible.

---

# Global Layout

The application consists of three major regions.

```
Header

↓

Main Workspace

↓

Footer
```

The Main Workspace permanently consists of two regions:

- Presentation Preview
- Context Inspector

The Presentation Preview always remains visible while working.

The Context Inspector changes depending on the current workflow step:

- Edit Inspector
- Output Inspector

No separate Output Section exists in Version 1.

---

# Header

The header is always visible.

Purpose:

- application identity
- primary workspace actions

Desktop:

```
+-------------------------------------------------------------+
| SameView Logo     SameView Web             Primary Actions   |
+-------------------------------------------------------------+
```

Mobile:

```
+-----------------------------------------+
| Logo    SameView Web      Actions        |
+-----------------------------------------+
```

The header should remain intentionally small.

It must not consume unnecessary vertical space.

---

## Header Actions

### No Workspace

No primary actions are displayed.

The language selector remains the header's sole right-aligned control (see Language Selector).

### Workspace Active

The header provides workspace-related actions.

Initially:

- Replace Export

`Replace Export` is right-aligned in the header.

The language selector is not shown in this header. It is available in the footer instead while a workspace is active (see Footer, Language Selector).

Additional actions may be added in future versions without changing the overall layout; any additional workspace action joins `Replace Export` on the right side of the header.

On mobile, this header remains a single row whenever reasonably possible. It must not wrap onto a second row solely to accommodate language selection — the language selector is no longer part of this header.

---

# Footer

The footer is always visible.

It provides navigation to legal information.

Initially:

- Privacy
- Terms
- Imprint

While a workspace is active, the footer also provides the language selector (see Language Selector). This is the only difference in footer content between `No Workspace` and `Workspace Active`; the legal navigation itself is unchanged.

The footer should visually resemble the footer used on the public SameView website to create a consistent product identity.

---

# Application States

Version 1 contains two primary application states.

## State A

No Workspace

## State B

Workspace Active

No intermediate layout variants are introduced.

Temporary states (loading, errors, dialogs) are displayed within these two primary layouts.

---

# State A — No Workspace

Purpose:

Import an existing SameView export.

The workspace occupies nearly the full available width.

Desktop:

```
Header

↓

Centered Import Section

↓

Footer
```

The import area becomes the visual focus.

The surrounding interface intentionally remains minimal.

---

# Import Section

The import section contains:

- title
- short explanation
- drag & drop area
- file selection button
- privacy notice
- supported format information

Example hierarchy:

```
Import Comparison

Continue working with an exported SameView comparison directly in your browser.

+--------------------------------------------------+
|                                                  |
|              Drag & Drop                         |
|                                                  |
|                     or                           |
|                                                  |
|      Select SameView Export (.zip)               |
|                                                  |
+--------------------------------------------------+

Processed locally in your browser.

Nothing is uploaded.

Supports SameView Export (.zip)
```

---

## Drag & Drop

The entire import area acts as both

- drag target
- clickable file selector

The native HTML file input is implementation detail only.

It should never be visually exposed.

---

## Import Button

The visible button opens the hidden native file picker.

The button should be the secondary interaction.

The primary interaction is the complete drop zone.

---

## Accessibility

The complete drop zone must support:

- keyboard focus
- Enter
- Space

Screen readers must receive equivalent information.

---

# Import States

The import area remains visible in all import-related states.

The layout itself never changes.

Only contextual information changes.

---

## Idle

Normal drop zone.

---

## Drag Active

Drop zone becomes visually highlighted.

---

## Importing

The drop zone remains visible but becomes temporarily disabled.

A loading indicator communicates ongoing processing.

---

## Import Succeeded

The import area briefly enters a visually green success state, confirming that the import completed successfully.

This is a transient confirmation. No additional user interaction is required to continue.

After the brief success confirmation, the application transitions directly from `No Workspace` into `Workspace Active`.

The transition is performed within the application layout. The document itself does not scroll. The workspace becomes the new visual focus automatically while preserving the user's orientation.

This transition applies only to the initial import. Replacing an already active workspace follows the separate rules defined under "Replace Export".

---

## Import Failed

The drop zone remains visible.

A localized accessible error message appears directly above the drop zone.

The error uses:

- semantic alert
- aria-live
- accessible colors
- application color system

The layout must not jump excessively.

---

# State B — Workspace Active

Once a comparison has been successfully imported, the application switches completely into workspace mode.

The large import area disappears.

The focus becomes working with the comparison.

The transition into the workspace preserves the user's orientation.

The workspace becomes the new visual focus automatically, without requiring further navigation.

The header narrows to brand identity and workspace actions only; the language selector moves to the footer while a workspace is active (see Header Actions, Footer, Language Selector).

Desktop layout:

```
+-------------------------------------------------------------+
| Header                                                      |
+-------------------------------------------------------------+

+---------------------------+-------------------------------+
|                           |                               |
|                           |                               |
|                           |                               |
|                           |    Context Inspector         |
|  Presentation Preview     |                               |
|                           |                               |
|                           |                               |
|                           |                               |
+---------------------------+-------------------------------+

↓

Footer
```

---

# Responsive Layout

Desktop:

Two-column layout.

Comparison occupies the secondary column.

Suggested proportion:

```
Viewer      50 %
Comparison  50 %
```

This split is fixed and independent of the comparison image orientation (portrait, landscape or square).

Orientation does not affect the column split. It affects only how the Presentation Canvas uses the space available to it within the Presentation Preview column (see docs/COMPARISON_PRESENTATION.md "Preview Scaling"):

- Portrait primarily uses the available height.
- Landscape primarily uses the available width.
- Square is fitted proportionally within that same 50 % Preview column.

The Presentation Preview column itself never changes width because of orientation.

Mobile:

Single column.

```
Presentation Preview

↓

Context Inspector
```

---

# Viewer

The viewer is the primary workspace.

It receives an equal share of the available width alongside the Context Inspector (see "Responsive Layout"). Within that space, the Presentation Canvas scales to use as much of it as the comparison's aspect ratio and orientation allow.

An interactive comparison slider is part of the current Viewer, revealing one image over the other.

Future iterations will introduce:

- markers
- editing
- synchronization

The surrounding layout should not need to change.

---

# Viewer Toolbar

Deferred to a later iteration.

A small toolbar is displayed below the viewer.

Initially:

```
⛶ Fullscreen
```

Future viewer actions may be added without restructuring the page.

---

# Fullscreen Mode

Deferred to a later iteration.

Fullscreen displays only the viewer.

The following elements disappear:

- header
- context inspector
- footer
- surrounding application UI

The viewer becomes the sole visible content.

---

## Fullscreen Toolbar

Fullscreen provides a lightweight overlay toolbar.

Initially:

```
Exit Fullscreen

View Mode

• Fit to Screen
• 100 %
```

---

## Fit to Screen

Default mode.

The comparison is displayed as large as possible while preserving aspect ratio.

The viewer never exceeds the original image resolution.

---

## 100 %

One image pixel equals one display pixel.

Images larger than the viewport remain at original resolution.

The user navigates through the image instead of scaling beyond native size.

No artificial upscaling is performed.

---

# Context Inspector

The Context Inspector is the secondary workspace region beside the Presentation Preview.

Depending on the current workflow step it displays either:

- Edit Inspector
- Output Inspector

The Presentation Preview always remains visible while only the inspector content changes.

---

# Output Inspector

The Output Inspector replaces the Edit Inspector after the user selects **Create Output**.

The Presentation Preview remains visible and unchanged.

A back action (`← Edit`) returns to the Edit Inspector without losing any workspace or output configuration.

## Output Cards

Version 1 provides three output cards:

- Standalone HTML (available)
- Static Microsite (Coming Soon)
- CMS Package (Coming Soon)

Hosted Comparison is not presented in Version 1.

Each card contains:

- output name
- short explanation
- optional status badge (Coming Soon)

Only Standalone HTML can be selected.

## Standalone HTML

Standalone HTML requires no additional output settings.

The generated file represents the current Presentation Preview exactly at the moment of download.

The export consists of:

- a single HTML file
- inline CSS
- inline JavaScript
- embedded Base64 images
- no external resources
- complete offline functionality

## Download Flow

The primary action is:

`Download HTML`

Internally the application generates the HTML document and immediately starts the browser download.

Generation and download are presented as one continuous user action.

## Progress

During generation the Output Inspector displays:

- progress indicator
- progress bar
- processing phase

Examples:

- Preparing comparison
- Processing images
- Building HTML
- Starting download

The Presentation Preview remains visible.

Workspace interactions are temporarily disabled until generation completes.

## Completion

After the browser download starts:

- the progress UI disappears
- Download HTML becomes available again
- the Output Inspector remains open
- the current workspace remains unchanged

No dedicated success screen is displayed.

# Replace Export

When a workspace already exists, importing another export becomes a dedicated workspace action.

It is not presented as the original large landing-page import area.

Replacement is initiated from the header.

Replace Export is intentionally a secondary workspace action.

It remains easily accessible, but never competes visually with the active workspace.

It is right-aligned in the `Workspace Active` header, as defined under Header Actions.

Once a workspace is active, the workspace itself — not the import action — remains the primary focus.

Future iterations define:

- confirmation flow
- cancellation
- atomic replacement

---

# Loading Philosophy

Loading should always preserve context.

Existing content should remain visible whenever possible.

Avoid replacing entire pages with loading screens.

---

# Error Philosophy

Errors should remain local to the action that failed.

Avoid modal dialogs unless the action itself requires confirmation.

Users should immediately understand:

- what failed
- where it failed
- what they can do next

---

# Responsive Philosophy

Responsive behavior should preserve the same information architecture.

Desktop and mobile should differ only in layout.

Features and capabilities remain equivalent.


---

# Internationalization

The complete application layout supports the existing project localization infrastructure.

All user-visible text must be localized.

This includes, but is not limited to:

- page title
- header
- footer
- import section
- buttons
- helper text
- loading messages
- error messages
- confirmation dialogs
- comparison labels
- output labels
- viewer controls
- fullscreen controls

The layout must not contain hard-coded user-facing strings.

The existing localization architecture shall be reused.

---

# Language Selector

The application provides the same language selector used by the public SameView website.

Language switching remains available in both `No Workspace` and `Workspace Active`. Only its location differs between the two states.

**No Workspace.** The selector is part of the global header. No workspace actions are displayed, so the language selector remains the header's rightmost control on its own.

Desktop header:

```
+--------------------------------------------------------------+
| Logo  SameView Web                                DE | EN     |
+--------------------------------------------------------------+
```

Mobile header:

```
+-------------------------------------------+
| Logo   SameView Web              DE | EN   |
+-------------------------------------------+
```

**Workspace Active.** The selector is not part of the header. The header shows only brand identity and `Replace Export`, right-aligned (see Header Actions).

The selector is part of the footer instead (see Footer).

Desktop header:

```
+--------------------------------------------------------------+
| Logo  SameView Web                            Replace Export |
+--------------------------------------------------------------+
```

Desktop footer:

```
+--------------------------------------------------------------+
| Privacy   Terms   Imprint                          DE | EN    |
+--------------------------------------------------------------+
```

Mobile header:

```
+-------------------------------------------+
| Logo   SameView Web        Replace Export |
+-------------------------------------------+
```

Mobile footer:

```
+-------------------------------------------+
| Privacy  Terms  Imprint                    |
|                 DE | EN                    |
+-------------------------------------------+
```

Changing the language updates the complete application UI.

Changing the language must **not**:

- reset the current workspace
- discard imported data
- interrupt an ongoing import
- clear the current application state

---

# Reference Implementation

To preserve a consistent user experience across the SameView ecosystem, existing UI building blocks should be reused or adapted where appropriate.

Reference project:

```
C:\data\work\privat\git-repos\sameview-website
```

Before implementing the following components, inspect the existing implementation in the reference project:

- language selector
- header
- footer
- legal navigation
- localization behaviour
- responsive navigation behaviour
- branding assets

Do not create alternative implementations unless technically required.

Reuse existing assets, styling concepts and interaction patterns wherever practical while keeping this application independent.


---

# Future Extensions

The layout intentionally reserves room for future additions without structural redesign.

Possible future extensions include:

- additional viewer tools
- comparison history
- multiple output templates
- publication workflow
- collaboration
- account-specific functionality

These additions should extend existing regions instead of introducing new primary layout levels.

---

# Edit Inspector

The Edit Inspector is the primary control panel of the active workspace.

Its purpose is to edit comparison information, presentation settings and branding before selecting an output.

All changes update the comparison preview immediately.

No Apply or Save action exists.

The inspector should fit into the supported desktop viewport without requiring vertical scrolling. If additional functionality is introduced in future versions, collapsible sections should be used before introducing an internally scrollable inspector.

## Structure

The inspector consists of three collapsible sections:

- Comparison information
- Presentation
- Branding

The Edit Inspector itself is only a vertical layout container for these sections. It does not present a single shared bordered panel around all of them.

Each section has its own panel surface: its own border, its own background, its own padding, its own heading and its own independent collapse control.

A clear visual gap separates each section from the next.

The Edit Inspector behaves as a focused accordion: at most one section may be open at a time. This applies to every section listed above, and to any further section the Edit Inspector may gain in the future.

Opening a closed section automatically closes whichever section was previously open, so only the newly opened section remains open.

The currently open section may be closed again by interacting with it the same way it was opened. Doing so leaves no section open — the accordion never forces exactly one section to stay open at all times, only ever at most one.

Initial expanded/collapsed state per section, subject to the accordion rule above:

- Comparison information: expanded by default
- Presentation: collapsed by default
- Branding: expanded by default, once this section exists

Because at most one section may be open at a time, these per-section defaults never apply simultaneously. For the sections currently implemented, only Comparison information starts open.

Users may collapse individual sections to reduce visual complexity.

The expanded/collapsed state should be preserved while the workspace remains open.

## Common Control Rules

### Input Fields

All text inputs use a modern outlined field design.

The field label is integrated into the outline instead of occupying a separate row.

Each field supports:

- default
- focus
- error
- disabled / read-only (where applicable)

Validation messages are displayed below the corresponding field.

### Visibility Switches

Visibility switches are aligned to the far right.

All switches share a common vertical alignment independent of label length.

Changes are reflected immediately in the viewer.

---

## Comparison information

### Title

Controls:

- Title input
- Show Title

The visibility switch is displayed in the same row as the field label.

### Description

Controls:

- Description input
- Show Description

Rules:

- approximately three visible text rows
- visibility default: OFF
- switch aligned to the top-right

### Photo dates

Controls:

- Show photo dates
- Show Time Difference

Rules:

- Show photo dates controls visibility of the complete rendered time block.
- Show Time Difference is only available when Show photo dates is enabled.
- When Show photo dates is disabled, Show Time Difference becomes disabled.

Below the switches the dates are displayed side by side.

Left:

- Reference photo date (currently editable)

Right:

- Capture photo date (currently read-only)

Both fields use identical widths.

### Place

Controls:

- Place name
- City
- Country
- Show place

Only one visibility switch exists.

The switch controls the complete rendered location.

Individual location components cannot be hidden separately.

---

## Presentation

The Presentation section contains three top-level control groups, in this fixed order:

1. Colors
2. Shape
3. Slider

Each top-level group has its own group heading. Within the Presentation section, all three top-level group headings share the same typography, weight, and hierarchy — none is visually subordinate to another.

A uniform vertical spacing separates the top-level groups — greater than the spacing used between the subgroups nested within a top-level group.

Groups do not have their own nested panel surfaces or additional borders; visual separation is achieved through headings and consistent spacing alone.

### Colors

Colors contains the color-related settings of the Presentation Canvas, as three subgroups, in this fixed order:

1. Background
2. Frame
3. Text

Background, Frame, and Text share the same subgroup heading — one hierarchy level below the top-level group headings, and equal in hierarchy to one another.

#### Background

Visual segmented option group with color chips.

Options:

- Transparent
- White
- Black
- Brand
- Custom

Default: Brand.

When Custom is selected, a small area expands directly below the option group, headed "Custom color". It contains a color field and a HEX input. Outside of Custom, this area is fully hidden.

#### Frame

Visual segmented option group with color chips, identical in presentation to Background.

Options:

- None
- White
- Black
- Custom

Default: None.

When Custom is selected, the same expandable "Custom color" area as Background appears — same structure, same operation.

#### Text

Visual segmented option group, identical in presentation to Background and Frame.

Options:

- Automatic
- Light
- Dark
- Custom

Default: Automatic.

When Custom is selected, the same expandable "Custom color" area as Background and Frame appears — same structure, same operation.

See docs/COMPARISON_PRESENTATION.md Part 3 "Text" for what each option controls.

### Shape

Shape contains a single subgroup:

#### Corners

Single-row option group.

Options:

- Sharp
- Rounded

Default: Rounded.

Corner Radius applies to the entire Presentation Canvas — background, optional Frame and Comparison Stage together — as one visual unit (see docs/COMPARISON_PRESENTATION.md Part 3).

### Slider

Control:

- Show date labels

Default: On.

The switch is right-aligned.

The comparison preview updates immediately.

The label reads "Show date labels" rather than "Show Slider Date Labels" — the group heading "Slider" already establishes the context. The underlying function is unchanged.

### Map Preview

Deferred to a later iteration. Show Map Preview is not part of the current Presentation section; its control is not yet displayed.

---

## Branding

Single-row option group.

Options:

- None
- SameView
- Custom

When Custom is selected, the image selector appears inline.

Changes update the preview immediately.
