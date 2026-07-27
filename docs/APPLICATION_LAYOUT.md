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

The application consists of five major regions.

```
Header

↓

Main Workspace

↓

Comparison Section

↓

Output Section

↓

Footer
```

These regions remain stable throughout Version 1.

Features are added inside these regions instead of changing the overall application structure.

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

### Workspace Active

The header provides workspace-related actions.

Initially:

- Replace Export

Additional actions may be added in future versions without changing the overall layout.

---

# Footer

The footer is always visible.

It provides navigation to legal information.

Initially:

- Privacy
- Terms
- Imprint

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

Desktop layout:

```
+-------------------------------------------------------------+
| Header                                                      |
+-------------------------------------------------------------+

+---------------------------+-------------------------------+
|                           |                               |
|                           |                               |
|                           |                               |
|                           |       Comparison              |
|         Viewer            |                               |
|                           |                               |
|                           |                               |
|                           |                               |
+---------------------------+-------------------------------+

↓

Output

↓

Footer
```

---

# Responsive Layout

Desktop:

Two-column layout.

Viewer receives the larger portion of available width.

Comparison occupies the secondary column.

Suggested proportion:

```
Viewer

≈ 65–70 %

Comparison

≈ 30–35 %
```

Mobile:

Single column.

```
Viewer

↓

Comparison

↓

Output
```

---

# Viewer

The viewer is the primary workspace.

It receives the largest available space.

Future iterations will introduce:

- comparison slider
- markers
- editing
- synchronization

The surrounding layout should not need to change.

---

# Viewer Toolbar

A small toolbar is displayed below the viewer.

Initially:

```
⛶ Fullscreen
```

Future viewer actions may be added without restructuring the page.

---

# Fullscreen Mode

Fullscreen displays only the viewer.

The following elements disappear:

- header
- comparison panel
- output section
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

# Comparison Section

The comparison section contains comparison-related information and editing controls.

Initially this includes imported comparison information.

Later iterations may introduce editing controls directly inside this region.

The layout should therefore remain expandable.

---

# Output Section

The output section is dedicated to creating the final result.

It is visually separated from the comparison workspace.

---

## Live Preview

The output section always contains a live preview.

The preview represents the final exported result using the current configuration.

Users should never need to generate an export just to see the expected appearance.

---

## Future Output Controls

Examples include:

- layout selection
- branding
- metadata visibility
- title placement
- description placement
- watermark options

These controls are intentionally outside the comparison workspace.

---

# Replace Export

When a workspace already exists, importing another export becomes a dedicated workspace action.

It is not presented as the original large landing-page import area.

Replacement is initiated from the header.

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

The selector is part of the global header.

Desktop example:

```
+--------------------------------------------------------------+
| Logo  SameView Web                DE | EN      Actions        |
+--------------------------------------------------------------+
```

Mobile example:

```
+-------------------------------------------+
| Logo   SameView Web    DE | EN            |
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