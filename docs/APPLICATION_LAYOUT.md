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

The language selector remains the header's sole right-aligned control (see Language Selector).

### Workspace Active

The header provides workspace-related actions.

Initially:

- Replace Export

`Replace Export` is right-aligned in the header.

While the Import Stage is shown for a replacement (see "Replace Export"), the header uses the same state as `No Workspace` above: `Replace Export` is not shown, and the `No Workspace` header actions apply instead. There is no separate, third header state for this case.

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

While the Import Stage is shown for a replacement (see "Replace Export"), the footer uses the same state as `No Workspace` above: no language selector in the footer. This keeps the language selector's existing rule intact — it appears in exactly one of header or footer, never both at once (see Header Actions, Language Selector).

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

Import Stage

↓

Footer
```

The Import Stage becomes the visual focus.

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

The Import Stage briefly enters a clearly perceivable green success state, confirming that the import completed successfully. Icon, frame/glow and confirmation message change together into this success treatment.

This is a transient confirmation. No additional user interaction is required to continue.

The application then performs a stage transition (see "Stage Transition") from the Import Stage to `Workspace Active`. Once the transition completes, only `Workspace Active` is visible and interactive.

This transition applies to the initial import from `No Workspace` into `Workspace Active`. Replacing an already active workspace follows the separate rules defined under "Replace Export".

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

# Stage Transition

The Import Stage and `Workspace Active` are mutually exclusive. Exactly one of the two is visible and interactive at any time; the other is neither visible nor interactive.

Moving between them is a stage transition, not a page scroll. The stage leaving view moves out of the visible area; the stage entering view appears in its place, within the same main area.

The transition is brief, calm and purposeful — a confirmation of what just happened, not a decorative effect.

It never leaves the page taller than its content requires, never introduces a scrollbar that would not otherwise be needed, and never leaves an empty or invisible remainder of the stage that just left.

The transition does not depend on and does not cause a document scroll.

`prefers-reduced-motion` is respected: the transition still happens, but without pronounced movement.

Neither stage is interactive while the transition is in progress. Only once the transition has fully completed does the target stage become interactive; the stage that was left remains inactive.

Keyboard focus and keyboard navigation are handed over to the target stage only after the transition has fully completed. The stage that just left is removed from the tab order and from assistive technology exposure until it becomes active again.

This transition applies both when `Workspace Active` first appears (see "Import Succeeded") and when `Replace Export` returns the user to the Import Stage and back (see "Replace Export").

---

# State B — Workspace Active

Once a comparison has been successfully imported, the application switches completely into workspace mode via the stage transition described under "Import Succeeded" and "Stage Transition".

The Import Stage is no longer visible or interactive.

The focus becomes working with the comparison.

`Workspace Active` is the new visual focus, without requiring further navigation.

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

When a workspace already exists, importing another export is initiated as a dedicated workspace action, not as the original landing-page import.

`Replace Export` is right-aligned in the `Workspace Active` header, as defined under Header Actions.

Selecting `Replace Export` starts the reverse stage transition described under "Stage Transition": `Workspace Active` moves out of the visible area and the Import Stage appears in its place. No document scroll occurs. Once the transition completes, only the Import Stage is visible and interactive; `Workspace Active` remains fully intact internally, but is neither visible nor interactive.

While the Import Stage is shown for a replacement, `Replace Export` is not offered again in the header.

The Import Stage shows the replacement state already defined for Import Comparison (docs/FEATURE_SPECIFICATION.md F-001): the user selects a candidate export, and the application obtains the user's explicit decision before replacing the existing workspace.

## Cancelling

If the user cancels the replacement, the existing workspace remains completely unchanged. The application performs the same forward stage transition used after a successful import: the Import Stage moves out of the visible area, `Workspace Active` reappears, and `Replace Export` is offered again in the header.

## Invalid Replacement

If the selected replacement export is invalid, the Import Stage remains visible and shows the existing "Import Failed" state. The existing workspace remains completely unchanged and available. The user may choose a different file, or cancel the replacement as described above.

## Successful Replacement

Once the replacement export is fully validated and the user has confirmed the replacement, the Import Stage briefly shows the same green success state described under "Import Succeeded". Only then does the new workspace replace the previous one. The application then performs the same forward stage transition to `Workspace Active`, which now reflects the new comparison. `Replace Export` is offered again in the header.

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