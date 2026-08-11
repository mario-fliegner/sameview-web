# Embed in website --- Approved Product Decision Baseline

**Status:** Approved product decision baseline\
**Date:** 2026-08-11\
**Purpose:** Consolidated product decisions for the SameView Web
`Embed in website` output. This document is an input for repository
analysis, platform research, specification work, and later
implementation planning. It is **not yet the final implementation
specification**.

## 1. Product concept

`Embed in website` is a separate SameView output alongside
`Standalone HTML` and `Static Microsite`.

The product promise is:

> SameView generates the simplest appropriate integration for each
> supported target platform. All platform variants are based on the same
> SameView Comparison and reproduce the same Presentation and
> Interaction. The technical integration form may differ by platform.

`Embed in website` is specifically for placing a SameView Comparison
**inside an existing website or website system**. It is not another
standalone website output.

The initially intended target platforms are:

-   WordPress
-   Joomla
-   Webflow
-   Squarespace

There is no generic `Custom HTML` target in the current scope. A generic
target may be reconsidered later only if technical analysis demonstrates
a distinct customer benefit beyond the existing Standalone HTML and
Static Microsite outputs.

## 2. Output Inspector UX

The existing output choices become:

-   `Standalone HTML`
-   `Static Microsite`
-   `Embed in website`

When `Embed in website` is available, the supported target platforms are
shown directly in the Output Inspector rather than appearing only after
the output card is selected. This avoids layout movement and makes
supported integrations visible immediately.

The platform selector is conceptually:

**Platform:** WordPress · Joomla · Webflow · Squarespace

Platform controls may be disabled when `Embed in website` is not the
selected output, but they remain visible.

The existing output options remain applicable to `Embed in website`:

-   `Use current slider position`
-   `Remove embedded location data`

Changing the selected platform changes only the target/packaging of the
next generated outcome. It does not change the Current Working State,
Workspace Preview, current slider position, or the state of the shared
output options.

The primary action label changes appropriately for the selected
platform. Exact labels are to be finalized during specification/UI work.

After successful generation, SameView shows a short platform-specific
installation/integration guide directly in the Output Inspector. There
is no wizard, modal, or separate workflow page. The Workspace Preview
remains visible. The appropriate follow-up action, such as downloading
the generated result again, remains available.

## 3. Platform support model

SameView supports **specific target systems**, not an unverified generic
promise.

A platform is offered as supported only when the complete real customer
workflow has been verified against the real target system.

There are no reduced or degraded SameView variants for individual
platforms. A platform either supports the complete required SameView
experience reliably or it is not offered as a supported platform.

WordPress, Joomla, Webflow, and Squarespace are implemented, tested, and
released independently. One platform does not need to wait for
completion of the others.

Initial implementation/release order:

1.  WordPress
2.  Joomla
3.  Webflow
4.  Squarespace

For traditional CMS platforms such as WordPress and Joomla, SameView
defines a clear officially supported version range consisting of the
current version and a sensible backward-support range. Exact version
numbers are maintained based on the platform lifecycle rather than
permanently hard-coded into the feature specification.

Every officially supported CMS version must be covered by real
integration/compatibility verification.

Hosted SaaS platforms such as Webflow and Squarespace are verified
against their current production platform behavior.

## 4. Platform-specific integration model

The required customer result and quality requirements are common across
platforms, but installation, management, and update workflows may follow
the native model of each platform.

Technical uniformity is not a goal by itself. The goal is the simplest
sensible integration for the target platform.

For platforms where a persistent SameView integration is appropriate,
especially WordPress and Joomla, the target model is:

-   one persistent SameView integration per platform/site;
-   the integration can hold multiple SameView Comparisons;
-   the current Comparison is already available as part of the
    first-installation customer workflow;
-   further Comparisons can later be added to the existing SameView
    integration.

The user must not have to decide in SameView Web whether this is their
first or tenth SameView Comparison.

For first installation, the intended customer experience is:

> Install the SameView integration and have the currently generated
> Comparison immediately available without a separate second Comparison
> import.

For an already installed SameView integration, the newly generated
Comparison can be added or updated through the integration's normal
Comparison import path.

The exact package/bootstrap mechanism is intentionally open until
technical feasibility analysis.

Webflow and Squarespace do not have to imitate the WordPress/Joomla
management architecture. Their integration workflow may differ if their
native platform model requires it, provided the common product and
quality contract remains fulfilled.

## 5. Editing boundary

SameView Web is the place where a Comparison is created and configured.

The target website system is **not another SameView editor**.

An imported/generated Comparison cannot be edited in WordPress, Joomla,
Webflow, Squarespace, or another target integration.

No target-system controls are provided for:

-   title editing;
-   description editing;
-   dates;
-   location;
-   Presentation visibility;
-   canvas/background;
-   frame;
-   corner radius;
-   slider labels;
-   branding;
-   fonts;
-   other SameView Presentation settings.

The target system only provides the minimum controls required to manage,
select, place, and display already generated Comparisons.

## 6. Comparison identity

The existing SameView `session.id` is the stable identity of a
Comparison.

No additional Embed-specific Comparison ID is introduced.

Changes to images, metadata, Presentation, branding, output options, or
other editable state do not change the Comparison identity as long as
the underlying `session.id` remains the same.

A different `session.id` represents a different Comparison.

The stable identity is used to distinguish between adding a new
Comparison and updating an existing one.

## 7. Comparison lifecycle

For persistent integrations, a central **Add comparison** workflow is
provided.

The user does not choose between separate `Import` and `Update` actions.

When a valid SameView Comparison artifact is supplied:

-   unknown `session.id` → add a new Comparison;
-   existing `session.id` with changed outcome → atomically update that
    Comparison;
-   existing `session.id` with exactly the same outcome → no-op.

For an exact duplicate outcome, no copy is created, assets are not
unnecessarily rewritten, and placements remain unchanged. The user
receives a neutral informational state such as
`Comparison already up to date.`

The technical mechanism used to identify an exact outcome version (for
example version metadata, fingerprint, or hash) is intentionally left
open for technical analysis.

### Atomic updates

An update must be atomic.

A new version is validated completely before replacing the existing
version. If validation/import fails, the existing working Comparison
remains untouched.

Successful updates preserve every existing placement of the Comparison.
All placements automatically reference the new successfully imported
version on subsequent page loads.

Other Comparisons are never affected by an update.

### Asset replacement

A successful update completely replaces the stored outcome data
belonging to that Comparison.

Old Comparison assets that are no longer required are removed rather
than accumulated indefinitely.

This includes old image variants that may still contain embedded
location metadata after a newer outcome was generated with
`Remove embedded location data` enabled.

Assets belonging to other Comparisons remain untouched.

### Already loaded pages

Comparison updates do not live-update pages already open in a visitor's
browser.

New page loads and reloads use the updated version. Already loaded
instances continue with the version they loaded.

No polling, WebSocket connection, forced reload, or other live-update
mechanism is introduced.

## 8. Persistent integration versioning

The SameView platform integration and the stored Comparisons are
separate concepts and are versioned independently.

Updating the SameView WordPress/Joomla integration does not alter
Comparison content.

Importing/updating a Comparison does not automatically replace or update
the integration software.

The distribution/update mechanism for the integration itself is a
technical question to be investigated later.

An integration update must preserve previously supported stored
Comparisons and continue rendering them correctly.

If SameView's internal Comparison data/package format evolves, a newer
integration must either continue reading previously supported formats or
safely migrate existing data.

Required migrations occur automatically and must be failure-safe. A
failed migration must not destroy the previously working state.

If a newer Comparison format is imported into an older integration that
cannot fully understand it, the import is rejected completely. The user
is told that the SameView integration must be updated first. The
integration is not automatically updated as part of the Comparison
import.

Existing Comparisons, assets, and placements remain unchanged after such
a rejected import.

## 9. Import validation

`Add comparison` accepts only fully validated SameView Comparison
artifacts that are compatible with the target platform and installed
integration.

Invalid, corrupted, manipulated, wrong-platform, or unsupported
artifacts are rejected before changing stored state.

A rejected import:

-   does not modify existing Comparisons;
-   does not modify placements;
-   does not replace assets;
-   does not leave partial imports;
-   does not leave orphaned files.

User-facing errors use understandable product language, for example an
invalid SameView Comparison file or a requirement to update the SameView
integration.

## 10. CMS Comparison management

Where the target platform supports a persistent SameView integration,
its management UI is intentionally minimal and polished.

It is a library/management surface for completed Comparisons, not an
editor.

The management view should expose only information and actions needed to
identify and manage Comparisons, such as:

-   Preview/thumbnail
-   Comparison title
-   Reference-to-capture period
-   Usage count
-   Concrete usages/placements where reliably available
-   `Add comparison`
-   `Delete`

No rename, Presentation settings, metadata editing, branding controls,
or separate manual update workflow are provided.

Comparisons are sorted by **most recently added or updated first**.

V1 does not require search, filtering, or user-configurable sorting.

Where the platform can reliably identify placements, the management UI
should show not only the usage count but also the concrete
pages/posts/locations using the Comparison. These should link to the
relevant editing location where possible.

No unreliable whole-site scanner is introduced solely to approximate
usage.

## 11. Placement

When adding a SameView Comparison to a page, post, module position, or
equivalent target-system location, the user selects **only the desired
existing Comparison**.

There are no SameView Presentation controls at the placement level.

The same Comparison may be placed:

-   on multiple pages;
-   multiple times on the same page;
-   alongside different SameView Comparisons on the same page.

Each rendered placement is an independent interactive instance even when
multiple placements reference the same `session.id`.

Where technically reliable, the CMS/editor should show the actual
responsive SameView Comparison as the placement preview.

The editor preview may remain interactive, such as allowing slider
movement, but that interaction never changes stored Comparison state.

If a target platform cannot reliably show the real interactive
Comparison in its editor, it may show a high-quality static preview
instead. This does not change the requirement that the public output is
the complete interactive Comparison.

## 12. Placement behavior after deletion

A stored Comparison may be deleted even while it is still used.

If it has active placements, deletion requires a clear warning and
explicit confirmation. Where reliably available, the warning identifies
the affected placements.

Deleting a Comparison does **not** automatically remove or rewrite its
placements.

The placement retains the referenced `session.id`.

After deletion:

-   in the CMS/editor, the placement shows a defined missing-Comparison
    state and allows the user to select another available Comparison;
-   on the public website, the missing placement renders nothing and
    should consume no meaningful empty space.

If a Comparison with the same `session.id` is later imported again,
existing placements that still reference that ID automatically become
functional again.

If the user selects another Comparison for a missing placement, its
stored reference changes to the newly selected Comparison.

## 13. Deactivation and uninstall

For persistent CMS integrations:

**Deactivation** preserves all stored SameView Comparisons and placement
relationships. Reactivating the integration restores normal operation.

**Full uninstall/removal** deletes all data owned by the SameView
integration, including stored Comparisons, images, assets, and other
SameView-owned integration data.

SameView should not leave orphaned data after a deliberate full
uninstall.

Where the target platform allows it, the user should receive an
appropriate warning before permanent SameView data is removed.

## 14. Presentation and interaction parity

Every supported Embed platform must reproduce the complete required
SameView Presentation and Interaction.

There are no intentionally reduced platform variants.

The Embed output must preserve the output-relevant behavior already
defined for the SameView Presentation, including:

-   complete Presentation composition;
-   interactive before/after slider;
-   slider handle and divider behavior;
-   Presentation metadata;
-   branding;
-   fonts;
-   slider date labels when enabled;
-   overflow tooltips where applicable;
-   responsive behavior;
-   keyboard interaction;
-   accessibility behavior.

`Embed in website` does **not** include the SameView Web Workspace
Fullscreen action or a Fullscreen mode. The Comparison remains inside
the target-system container.

## 15. Responsive sizing

The target website controls where a SameView Comparison is placed and
how much width is available to it.

SameView controls the appearance **inside** that space.

The Comparison responsively uses the available width of its container
while preserving its complete SameView Presentation.

The host CMS/theme must not determine SameView typography, colors,
frame, corner radius, slider appearance, or other internal Presentation
styling.

SameView does not introduce separate CMS controls such as
`50% / 75% / 100% width`. Width and page layout are controlled with the
target platform's normal layout tools.

The Comparison does not use a fixed Embed height.

Its required height is derived from the available width and complete
Presentation.

The Embed must not be clipped because of a fixed integration height and
must not introduce an internal scrolling area.

When container width changes because of responsive layout, resizing, or
orientation change, required height updates correctly.

If a target platform requires an isolated container such as an iframe,
the integration must reliably synchronize its required height. A
platform that cannot reliably meet this requirement cannot be treated as
fully supported.

## 16. Host isolation

Isolation applies in both directions.

Host-site CSS or JavaScript must not unintentionally alter or break the
SameView Comparison.

SameView CSS, JavaScript, event handling, identifiers, or other behavior
must not leak into or alter the surrounding website.

This isolation must continue to hold when multiple SameView instances
exist on the same page.

The exact technical isolation mechanism is intentionally left to
architecture/platform analysis.

## 17. Independent instance state

Every rendered SameView placement has fully independent temporary
interaction state.

Each instance starts with the `initialSliderPosition` stored in the
generated outcome.

Moving one slider affects only that concrete instance.

Instances do not synchronize slider positions, tooltip state, focus, or
other temporary UI state, even when they reference the same Comparison.

Visitor interaction state is not persisted to cookies, Local Storage, or
the target CMS.

After a page reload, each instance starts again from its defined initial
state.

Multiple placements of the same Comparison may reference the same
locally stored immutable image/assets to avoid redundant transfers.
Sharing static resources must never imply sharing interactive state.

## 18. Output options

The existing `Use current slider position` behavior applies to Embed
outcomes.

The generated outcome stores the appropriate initial slider position,
and every rendered instance begins at that position.

The existing `Remove embedded location data` semantics also apply
unchanged.

When enabled, location metadata is removed from the generated image
assets **before** they are handed to a platform-specific
integration/adapter.

The target platform must never receive an additional unprocessed
original image variant from the Embed output path.

Platform adapters must reuse the common output/image-processing behavior
rather than implementing different privacy semantics.

## 19. Local/self-contained resources

After integration, the Comparison is served entirely by the target
website/platform.

At runtime it has no dependency on SameView servers or SameView
services.

All resources required for the Comparison are delivered with or stored
by the target integration, including as applicable:

-   images;
-   JavaScript;
-   CSS;
-   fonts;
-   branding assets;
-   other runtime assets.

The Embed implementation does not rely on external CDNs, Google Fonts,
third-party runtime libraries loaded from remote services, or other
externally hosted resources.

Nothing required for the current Embed Comparison is loaded from
external services.

This requirement concerns runtime/resource self-containment; it does not
mean the host website itself must work offline.

## 20. Telemetry scope

The product is **not permanently defined as telemetriefree for all
future versions**.

However, telemetry, usage analytics, remote error reporting, or similar
reporting is **not introduced as part of the current Embed feature**.

Any future telemetry capability requires its own explicit product,
privacy, consent, and technical specification.

It must not be silently introduced as part of this implementation.

## 21. Performance and resource loading

SameView resources are loaded in the public frontend only on pages that
actually contain at least one SameView Comparison.

Pages without a SameView placement do not load SameView runtime,
SameView CSS, SameView fonts, or Comparison assets.

Pages with SameView load only resources needed for Comparisons actually
used on that page. Comparisons stored elsewhere in the CMS are not
loaded.

Shared static resources such as runtime, CSS, and fonts should be loaded
only once per page where the platform reliably permits this.

Comparison-specific data and assets remain separated.

Multiple placements of the same Comparison may reuse the same local
immutable image/assets.

Shared code and resources never create shared interaction state.

Comparison images should be loaded on demand/lazily when they are not
immediately needed.

The correct layout area is reserved from the beginning so delayed image
loading does not cause disruptive layout shifts.

Visible or immediately needed Comparisons may load with appropriate
priority.

## 22. Caching and updates

Caching is allowed and should remain effective.

After a successful Comparison update, new page loads must reliably
receive the updated Comparison rather than remaining stuck on stale
cached assets.

SameView therefore needs reliable cache invalidation or asset versioning
for changed resources.

Unchanged resources may continue to benefit from caching.

Caching is not globally disabled as a workaround.

## 23. Loading and failure states

During normal image/resource loading, SameView should not expose a
half-rendered broken Comparison.

The required layout area remains stable while required assets load.

No unnecessary public `Loading...` message or spinner is required as
part of the current product decision.

If JavaScript is unavailable, the Embed displays a calm localized
fallback indicating that JavaScript is required to view the interactive
Comparison.

There is no static replacement Comparison and no reduced non-interactive
SameView mode.

If a required runtime asset is genuinely unavailable or unusable, the
public output does not show broken-image icons or a partially
functioning Comparison. Instead it shows a neutral localized fallback
such as:

`Comparison unavailable`

The CMS/editor may show a more actionable diagnostic message for the
site operator.

This runtime/asset-failure state is distinct from a deliberately deleted
Comparison:

-   runtime/asset failure → neutral public unavailable fallback;
-   deliberately deleted/missing Comparison → public output renders
    nothing.

## 24. Localization

The language of SameView-owned frontend/system text is determined at
runtime from the **current frontend page language**.

It is not permanently frozen to the SameView Web UI language used during
generation.

On multilingual websites, the same Comparison may therefore show
SameView-owned system text in different languages depending on the
current page language.

User-authored Comparison content is never automatically translated,
including:

-   title;
-   description;
-   location;
-   other user-entered content.

The SameView CMS management interface follows the **backend/user
language of the current CMS user**.

Backend and frontend language selection are therefore intentionally
separate:

-   frontend SameView system text → current frontend page language;
-   backend SameView management text → current CMS user's backend
    language.

Initial supported integration languages:

-   English
-   German

English is always the fallback when the current language is unsupported
or cannot be reliably determined.

This localization requirement covers, as applicable:

-   CMS management UI;
-   public SameView system text;
-   fallback/error states;
-   import messages;
-   accessibility text;
-   platform-specific integration instructions shown by SameView Web.

Where possible, platform-native internationalization mechanisms should
be used. Exact implementation is a technical decision.

## 25. Permissions

SameView uses the native permission/role model of each target platform.

No separate SameView user or role system is introduced.

Administrative Comparison-library actions such as:

-   Add
-   Update through Add comparison
-   Delete

are available only to appropriately privileged CMS users.

Users with appropriate normal content/editor permissions may select and
place already available Comparisons without automatically receiving
management rights over the Comparison library.

Exact WordPress capabilities, Joomla permissions, and equivalents are
platform-specific technical decisions.

## 26. CMS management branding

The target-system management interface may be discreetly branded as
SameView.

This may include:

-   SameView icon;
-   SameView name;
-   a restrained link to the SameView website for product
    information/help where appropriate.

The administration UI must not become advertising-heavy or introduce
intrusive calls to action.

The public website receives **no additional plugin/integration
branding**.

Only branding already configured as part of the generated SameView
Comparison Presentation may appear publicly.

## 27. Package and upload limits

SameView does not silently reduce image quality or resolution merely to
fit a target platform's package/upload limits.

Where a relevant platform limit can be determined before or during
generation, SameView should provide a clear user-facing warning/error.

Hosting-specific limits that SameView Web cannot know in advance are
handled clearly by the target integration during installation/import.

There is no hidden quality reduction.

A future explicit image/output optimization option would be a separate
feature.

## 28. Accessibility

Accessibility is part of the hard platform-support contract.

The Embed must preserve the accessibility behavior already required by
the SameView Presentation, including as applicable:

-   keyboard-operable slider;
-   correct focus behavior;
-   visible/usable focus;
-   accessible text;
-   keyboard-accessible tooltip behavior;
-   valid ARIA relationships;
-   no unnecessary additional tab stops.

Multiple SameView instances on the same page must not create colliding
DOM IDs, ARIA relationships, or focus state.

A platform that materially breaks the required SameView accessibility
behavior cannot be considered fully supported.

## 29. Real-platform verification and release criteria

A platform is not released as a normal supported option merely because:

-   its ZIP structure looks valid;
-   unit tests pass;
-   artifact tests pass;
-   a mock environment works;
-   a locally approximated host page works.

The complete real customer workflow must be verified on the actual
target platform.

For a persistent CMS integration such as WordPress, verification must
cover the platform-appropriate equivalents of:

-   Generate the actual SameView artifact;
-   install the real generated integration/result;
-   activate/configure it as required;
-   verify the current Comparison is available on first-install flow;
-   add another Comparison;
-   detect Add versus Update through stable identity;
-   detect exact duplicate as no-op;
-   place a Comparison;
-   render the public page;
-   update a placed Comparison while preserving placements;
-   reject invalid/incompatible imports atomically;
-   delete a used Comparison;
-   verify editor missing state;
-   verify public missing behavior;
-   re-import the same `session.id` and restore existing placements;
-   render multiple different Comparisons on one page;
-   render multiple instances of the same Comparison on one page;
-   verify independent interaction state;
-   verify responsive sizing and height;
-   verify slider interaction;
-   verify keyboard/accessibility behavior;
-   verify overflow tooltips and other required Presentation
    interaction;
-   verify English and German behavior plus English fallback;
-   verify local/self-contained assets;
-   verify resource loading only where required;
-   verify cache/update behavior;
-   verify deactivation persistence;
-   verify full uninstall cleanup where applicable;
-   verify supported CMS versions.

Webflow and Squarespace use the same quality bar but follow the actual
customer workflow appropriate to those platforms.

Real-platform integration tests complement, rather than replace, focused
unit, artifact, and browser tests.

## 30. Implementation sequencing

Platforms are developed and released independently.

Initial sequence:

1.  WordPress
2.  Joomla
3.  Webflow
4.  Squarespace

The technical architecture should favor a shared SameView
Embed/Presentation foundation with thin platform-specific integration
layers **where this matches the existing repository architecture and
platform requirements**.

This document does not approve a specific folder structure, class/module
design, package format, framework abstraction, Docker topology, or
adapter architecture.

Those decisions require repository analysis and platform feasibility
research first.

## 31. Explicitly open technical questions

The following are intentionally **not yet decided** and must not be
guessed during implementation:

-   exact repository/file/folder structure for Embed;
-   whether a new shared Embed runtime is necessary or existing
    Standalone/Microsite runtime can be reused directly;
-   exact WordPress integration architecture;
-   exact WordPress block/shortcode/plugin responsibilities;
-   exact Joomla extension/module architecture;
-   exact Webflow integration mechanism;
-   exact Squarespace integration mechanism;
-   exact first-install bootstrap/package mechanism that both installs
    the integration and makes the current Comparison immediately
    available;
-   exact subsequent Comparison artifact/package format;
-   exact outcome fingerprint/version mechanism for no-op detection;
-   exact persistent storage layout in each target platform;
-   exact host-CSS/JS isolation mechanism;
-   exact responsive-height mechanism where an isolated frame/container
    is required;
-   exact shared-resource deduplication strategy;
-   exact lazy-loading implementation;
-   exact cache-busting/versioning mechanism;
-   exact CMS permission mappings;
-   exact supported WordPress/Joomla version numbers;
-   exact integration update-distribution mechanism;
-   exact migration implementation for future integration/data versions;
-   exact UI labels for platform-specific Generate actions;
-   exact platform-specific installation instructions;
-   exact handling of platform-specific package/upload limits;
-   exact real-platform test environment/tooling, including whether
    Docker, `wp-env`, or another supported approach is best.

These questions must be resolved using the existing SameView repository,
current project specifications, and current official target-platform
documentation.

## 32. Next-step contract

This baseline is the approved product input for the next phase.

The next phase is **analysis only**, not implementation.

Repository analysis must:

1.  inspect the current Standalone HTML and Static Microsite generation
    path;
2.  identify existing shared Presentation, Interaction, asset, font,
    snapshot, privacy, and image-processing logic;
3.  identify the smallest reusable foundation for `Embed in website`;
4.  inspect the existing Output Inspector implementation;
5.  inspect existing unit/E2E/artifact test structure;
6.  identify conflicts between current code/specs and this approved
    decision baseline;
7.  identify technical questions requiring external platform research;
8.  avoid introducing a new architecture where existing proven
    structures can be reused;
9.  make no code or documentation changes during analysis.

After repository analysis and platform feasibility research, the
approved product decisions are to be incorporated into the appropriate
SameView source-of-truth specifications.

Only after those specifications are approved should
`IMPLEMENTATION_PLAN_V1.md` be updated with implementation phases.

Implementation begins only after the relevant scope has been explicitly
approved.
