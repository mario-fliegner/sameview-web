# SameView Web – Embed in Website

## Status

This is the normative Version 1 specification for the `Embed in website` comparison output, referenced from [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) and [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-005. It supersedes the dated product-decision baseline that preceded it as the ongoing source of truth for this feature; that baseline remains available as historical input, not as a second normative document.

This document defines the shared, platform-independent contract every supported target platform must satisfy. It does not define any single platform's own technical implementation — platform-specific technical contracts are defined in their own documents, for example [WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md) and [JOOMLA_INTEGRATION.md](JOOMLA_INTEGRATION.md).

## Purpose

`Embed in website` is a comparison output type, alongside Standalone HTML and Static Microsite (F-005), for placing a SameView Comparison inside an existing website or website system rather than producing another standalone website output.

The product promise: SameView generates the simplest appropriate integration for each supported target platform. Every platform variant is based on the same Comparison and reproduces the same Presentation and Interaction (see [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md)). The technical integration form may differ by platform.

## Supported Platforms

The initially targeted platforms are WordPress, Joomla, Webflow and Squarespace. There is no generic "Custom HTML" target in the current scope.

A platform is offered as supported only when its complete real customer workflow has been verified against the real target system — see [AI_ENGINEERING_GUIDE.md](AI_ENGINEERING_GUIDE.md) "Testing". There are no reduced or degraded variants of this feature for an individual platform: a platform either supports the complete required SameView experience reliably, or it is not offered as a supported platform.

WordPress, Joomla, Webflow and Squarespace are implemented, tested and released independently of one another. One platform does not need to wait for completion of the others. Initial sequence: WordPress, then Joomla, then Webflow, then Squarespace.

For platforms with a persistent SameView integration (see "Persistent Integration Model" below), SameView defines an officially supported version range consisting of the current version and a sensible backward-support range, maintained operationally based on the platform's own release lifecycle rather than hard-coded here. Every officially supported version is covered by real integration/compatibility verification. Hosted SaaS platforms (Webflow, Squarespace) are verified against their current production platform behavior.

## Output Inspector Behavior

Once `Embed in website` is available, its supported target platforms are shown directly on its Output Inspector card rather than only after the card is selected, so they remain visible without an extra step. Platform controls may be disabled when `Embed in website` is not the selected output, but they remain visible (see [APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md) "Output Cards").

The existing shared output-specific settings — Use Current Slider Position and Remove Embedded Location Data (F-005) — apply unchanged.

Changing the selected platform changes only the target/packaging of the next generated outcome. It does not change the Current Working State, the Workspace Preview, the current slider position, or the state of the shared output settings.

After successful generation, SameView Web shows a short platform-specific installation/integration guide directly in the Output Inspector. There is no wizard, modal or separate workflow page. The Presentation Preview remains visible throughout, per [USER_WORKFLOW.md](USER_WORKFLOW.md) "Inspector Transition". The appropriate follow-up action, such as downloading the generated result again, remains available.

Directly below that installation/integration guide, SameView provides a platform-specific installation-guide link to the corresponding SameView website documentation. The guide destination follows the current SameView Web UI locale. The guide opens in a new browser tab, leaving the active SameView Web workspace and Output Inspector state untouched in the original tab. Only the currently selected platform's guide link is shown; the two platforms' links are never shown at the same time. The current supported mappings are WordPress and Joomla.

## Editing Boundary

SameView Web is the place where a Comparison is created and configured. A target platform is not another SameView editor (see [FEATURE_SPECIFICATION.md](FEATURE_SPECIFICATION.md) F-003 "Rules and Limitations"). No target-platform controls are provided for title, description, dates, location, Presentation visibility, canvas/background, frame, corner radius, slider labels, branding, fonts, or any other SameView Presentation setting (F-003, F-004, [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md)). A target platform provides only the minimum controls required to manage, select, place and display already generated Comparisons.

## Comparison Identity

`session.id`, as defined in [IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md) "Comparison Identity (`session.id`)", is the stable identity of a Comparison for every supported target platform. No additional Embed-specific Comparison identifier is introduced. Changes to images, metadata, Presentation, branding, output options or other editable state do not change a Comparison's identity as long as its underlying `session.id` remains the same. A different `session.id` represents a different Comparison.

## Persistent Integration Model

For platforms where a persistent SameView integration is appropriate — including, but not limited to, WordPress and Joomla:

- one persistent SameView integration exists per platform/site;
- the integration can hold multiple Comparisons;
- the Comparison generated as part of first installation is already available as part of that installation workflow, without a separate manual import for that entry — see "First Installation" below;
- further Comparisons are added to an already-installed integration exclusively through the integration's own `Add comparison` workflow (see "Comparison Lifecycle" below) — never by replacing or reinstalling the integration itself.

The user is never required to decide, in SameView Web, whether a given generation is their first or a later Comparison for a given site. SameView Web generates the same kind of output for a platform's persistent-integration case regardless of that state; which native action the user performs with it (install vs. add) depends on the state of their own site, not on a choice made in SameView Web.

Webflow and Squarespace are not required to follow this persistent-integration model; their integration workflow may differ where their native platform model requires it, provided the common contract in this document remains fulfilled.

## First Installation

Installing the SameView integration and having the currently generated Comparison immediately available is one coherent action from the user's perspective, without a separate second Comparison import. The exact platform-native mechanism that achieves this is defined per platform — see, for example, [WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md) "First Installation".

## Comparison Lifecycle

A central `Add comparison` workflow is provided for persistent integrations. The user does not choose between separate "Import" and "Update" actions.

When a valid SameView Comparison artifact is supplied:

- an unknown `session.id` adds a new Comparison;
- an existing `session.id` with a changed Outcome Fingerprint ([IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md) "Outcome Fingerprint") atomically updates that Comparison;
- an existing `session.id` with an unchanged Outcome Fingerprint is a no-op.

For an exact duplicate, no copy is created, assets are not unnecessarily rewritten, and placements remain unchanged. The user receives a neutral informational state, for example "Comparison already up to date."

### Atomic Updates

An update is atomic: a new version is validated completely before replacing the existing version. If validation or import fails, the existing working Comparison remains untouched. Successful updates preserve every existing placement of the Comparison; all placements automatically reference the new version on subsequent page loads (see "Placement" below). Other Comparisons are never affected by an update.

### Asset Replacement

A successful update completely replaces the stored outcome data belonging to that Comparison. Assets no longer required — including old image variants that may still carry embedded location metadata after a newer outcome was generated with Remove Embedded Location Data enabled — are removed rather than accumulated indefinitely. Assets belonging to other Comparisons remain untouched.

### Already-Loaded Pages

Comparison updates do not live-update pages already open in a visitor's browser. New page loads and reloads use the updated version. No polling, WebSocket connection, forced reload or other live-update mechanism is introduced.

## Persistent Integration Versioning

The SameView platform integration and the stored Comparisons it holds are separate concepts, versioned independently. Updating the integration software does not alter Comparison content; importing or updating a Comparison does not automatically replace or update the integration software.

An integration update preserves previously supported stored Comparisons and continues rendering them correctly. If SameView's internal Comparison data/package format evolves, a newer integration either continues reading previously supported formats or safely migrates existing data. Required migrations occur automatically and are failure-safe; a failed migration does not destroy the previously working state.

If a newer Comparison format is imported into an older integration that cannot fully understand it, the import is rejected completely, with the user told that the integration must be updated first. The integration is not automatically updated as part of a Comparison import. Existing Comparisons, assets and placements remain unchanged after such a rejected import.

## Import Validation

`Add comparison` accepts only fully validated SameView Comparison artifacts compatible with the target platform and the installed integration. Invalid, corrupted, manipulated, wrong-platform or unsupported artifacts are rejected before any stored state changes.

A rejected import does not modify existing Comparisons, does not modify placements, does not replace assets, does not leave partial imports, and does not leave orphaned files. User-facing errors use understandable product language (per [USER_WORKFLOW.md](USER_WORKFLOW.md) "Error Handling" → "Understandable Errors"), for example an invalid SameView Comparison file or a requirement to update the integration first.

## Comparison Management

Where a target platform supports a persistent integration, its management surface is intentionally minimal — a library for completed Comparisons, not an editor (see "Editing Boundary" above). It exposes only what is needed to identify and manage Comparisons: preview/thumbnail, Comparison title, reference-to-capture period, usage count, concrete usages/placements where reliably available, `Add comparison` and `Delete`. No rename, Presentation settings, metadata editing, branding controls or separate manual update workflow are provided.

Comparisons are sorted by most recently added or updated first. Version 1 does not require search, filtering or user-configurable sorting.

Where the platform can reliably identify placements, the management surface shows the concrete pages/locations using a Comparison, linking to the relevant editing location where possible. No unreliable whole-site scanner is introduced solely to approximate usage.

## Placement

When adding a Comparison to a page, post, module position or equivalent target-system location, the user selects only the desired existing Comparison. There are no SameView Presentation controls at the placement level (see "Editing Boundary" above).

The same Comparison may be placed on multiple pages, multiple times on the same page, and alongside different Comparisons on the same page. Each rendered placement is an independent interactive instance, per [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) "Multiple Instances and Host Isolation" — even when multiple placements reference the same `session.id`.

Where technically reliable, the editor shows the actual responsive Comparison as the placement preview, and that preview may remain interactive; interacting with it never changes stored Comparison state. If a target platform cannot reliably show the real interactive Comparison in its editor, it may show a high-quality static preview instead — this does not change the requirement that the public output is the complete interactive Comparison.

## Placement Behavior After Deletion

A stored Comparison may be deleted while it is still used. If it has active placements, deletion requires a clear warning and explicit confirmation; where reliably available, the warning identifies the affected placements. Deleting a Comparison does not automatically remove or rewrite its placements — a placement retains its referenced `session.id`.

After deletion: in the editor, the placement shows a defined missing-Comparison state and allows selecting another available Comparison; on the public website, the missing placement renders nothing and consumes no meaningful empty space. If a Comparison with the same `session.id` is later imported again, existing placements referencing it automatically become functional again. If the user selects another Comparison for a missing placement, its stored reference changes to the newly selected Comparison.

## Deactivation and Uninstall

For persistent integrations: deactivation preserves all stored Comparisons and placement relationships, and reactivating restores normal operation. Full uninstall/removal deletes all data owned by the integration, including stored Comparisons, images, assets and other SameView-owned integration data, with no orphaned data left behind. Where the target platform allows it, the user receives an appropriate warning before permanent data removal.

## Presentation and Interaction Parity

Every supported platform reproduces the complete required SameView Presentation and Interaction, per [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) — complete Presentation composition, the interactive before/after slider, slider handle and divider behavior, Presentation metadata, branding, fonts, slider date labels when enabled, overflow tooltips where applicable, responsive behavior, keyboard interaction and accessibility behavior. There are no intentionally reduced platform variants.

`Embed in website` does not include the SameView Web Workspace Fullscreen action or a Fullscreen mode of its own (see [APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md) "Fullscreen Mode"). The Comparison remains inside the target-system container.

## Responsive Sizing

The target website controls where a Comparison is placed and how much width is available to it; SameView controls the appearance inside that space. The Comparison responsively uses its container's available width while preserving its complete Presentation. The host platform/theme must not determine SameView typography, colors, frame, corner radius, slider appearance or other internal Presentation styling. SameView does not introduce separate width controls (e.g. "50% / 75% / 100%"); width and page layout are controlled with the target platform's own normal layout tools.

The Comparison does not use a fixed height; its required height is derived from the available width and the complete Presentation. It must not be clipped because of a fixed integration height and must not introduce an internal scrolling area. When container width changes because of responsive layout, resizing or orientation change, required height updates correctly. If a target platform requires an isolated container (for example an iframe) for host isolation, the integration reliably synchronizes its required height; a platform that cannot reliably meet this requirement cannot be treated as fully supported.

## Host Isolation

See [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) "Multiple Instances and Host Isolation" for the shared requirement. The exact technical isolation mechanism is a platform-specific technical decision — see the relevant platform integration document.

## Independent Instance State

See [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) "Multiple Instances and Host Isolation". In addition: every rendered placement starts from the `initialSliderPosition` stored in its generated outcome. Visitor interaction state is not persisted to cookies, local storage or the target platform; after a page reload, each instance starts again from its defined initial state. Multiple placements of the same Comparison may reference the same locally stored immutable image/assets to avoid redundant transfers — sharing static resources never implies sharing interactive state.

## Output Options Reuse

The existing Use Current Slider Position and Remove Embedded Location Data settings (F-005) apply unchanged to `Embed in website` outcomes; see F-005 for their behavior. When Remove Embedded Location Data is enabled, location metadata is removed from the generated image assets before they are handed to a platform-specific integration — the target platform never receives an additional unprocessed original image variant from this output path. Platform integrations reuse this common output/image-processing behavior rather than implementing their own privacy semantics.

## Local/Self-Contained Resources

After integration, a Comparison is served entirely by the target website/platform. At runtime it has no dependency on SameView servers or SameView services. All resources required for the Comparison — images, JavaScript, CSS, fonts, branding assets and other runtime assets, as applicable — are delivered with or stored by the target integration. No external CDN, Google Fonts, third-party runtime library loaded from a remote service, or other externally hosted resource is used for the current Embed Comparison. This concerns runtime/resource self-containment; it does not mean the host website itself must work offline. See [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Embed in Website".

## Telemetry Scope

No telemetry, usage analytics, remote error reporting or similar reporting is introduced as part of this feature. Any future telemetry capability requires its own explicit product, privacy, consent and technical specification, and must not be silently introduced as part of an Embed implementation. See [DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md) "Embed in Website".

## Performance and Resource Loading

SameView resources are loaded in the public frontend only on pages that actually contain at least one SameView placement. Pages without a placement do not load SameView runtime, CSS, fonts or Comparison assets. Pages with a placement load only resources needed for Comparisons actually used on that page; Comparisons stored elsewhere are not loaded. Shared static resources (runtime, CSS, fonts) are loaded only once per page where the platform reliably permits this; Comparison-specific data and assets remain separated, and multiple placements of the same Comparison may reuse the same local immutable assets. Shared code and resources never create shared interaction state (see "Independent Instance State" above).

Comparison images are loaded on demand/lazily when not immediately needed; the correct layout area is reserved from the beginning so delayed image loading does not cause disruptive layout shifts. Visible or immediately needed Comparisons may load with appropriate priority.

## Caching and Updates

Caching is allowed and remains effective; it is not globally disabled as a workaround. After a successful Comparison update, new page loads reliably receive the updated Comparison rather than remaining stuck on stale cached assets — this requires reliable cache invalidation or asset versioning for changed resources. Unchanged resources may continue to benefit from caching.

## Loading and Failure States

During normal loading, SameView does not expose a half-rendered broken Comparison; the required layout area remains stable while required assets load. No unnecessary public "Loading…" message or spinner is required. If JavaScript is unavailable, the output displays a calm localized fallback indicating that JavaScript is required to view the interactive Comparison — there is no static replacement Comparison and no reduced non-interactive mode.

If a required runtime asset is genuinely unavailable or unusable, the public output does not show broken-image icons or a partially functioning Comparison; it shows a neutral localized fallback (for example "Comparison unavailable"). The editor/management surface may show a more actionable diagnostic message for the site operator. This runtime/asset-failure state is distinct from a deliberately deleted Comparison: runtime/asset failure shows the neutral fallback, while a deliberately deleted/missing Comparison renders nothing, per "Placement Behavior After Deletion" above.

## Localization

The language of SameView-owned frontend/system text is determined at runtime from the current frontend page language — it is not frozen to the SameView Web UI language used at generation time. On multilingual websites, the same Comparison may show SameView-owned system text in different languages depending on the current page language. User-authored Comparison content (title, description, location, other user-entered content) is never automatically translated.

The management interface follows the backend/user language of the current platform user. Frontend and backend/management language selection are therefore intentionally separate.

Initial supported integration languages are English and German; English is the fallback when the current language is unsupported or cannot be reliably determined. This covers the management interface, public SameView system text, fallback/error states, import messages, accessibility text and platform-specific installation instructions shown by SameView Web. Where possible, platform-native internationalization mechanisms are used; the exact implementation is a platform-specific technical decision.

## Permissions

SameView uses the native permission/role model of each target platform; no separate SameView user or role system is introduced. Administrative Comparison-library actions (Add, Update through Add comparison, Delete) are available only to appropriately privileged platform users. Users with ordinary content/editor permissions may select and place already available Comparisons without automatically receiving management rights over the Comparison library. Exact platform capability/permission mappings are platform-specific technical decisions — see the relevant platform integration document.

## Management Interface Branding

A target platform's management interface may be discreetly branded as SameView (icon, name, a restrained link to the SameView website for product information/help where appropriate); it must not become advertising-heavy or introduce intrusive calls to action. The public website receives no additional plugin/integration branding — only branding already configured as part of the generated Comparison Presentation may appear publicly.

## Package and Upload Limits

SameView does not silently reduce image quality or resolution merely to fit a target platform's package/upload limits. Where a relevant platform limit can be determined before or during generation, SameView provides a clear user-facing warning/error. Hosting-specific limits SameView Web cannot know in advance are handled clearly by the target integration during installation/import. There is no hidden quality reduction; a future explicit image/output optimization option would be a separate feature.

## Accessibility

Accessibility is part of the hard platform-support contract. Every supported platform preserves the accessibility behavior already required by the Presentation, including a keyboard-operable slider, correct and visible focus behavior, accessible text, keyboard-accessible tooltip behavior, valid ARIA relationships and no unnecessary additional tab stops. Multiple instances on the same page do not create colliding DOM IDs, ARIA relationships or focus state (see [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) "Multiple Instances and Host Isolation"). A platform that materially breaks the required accessibility behavior cannot be considered fully supported.

## Real-Platform Verification and Release Criteria

A platform is not released as a normal supported option merely because its package structure looks valid, unit tests pass, artifact tests pass, a mock environment works, or a locally approximated host page works (see [AI_ENGINEERING_GUIDE.md](AI_ENGINEERING_GUIDE.md) "Testing"). The complete real customer workflow must be verified on the actual target platform, covering the platform-appropriate equivalents of: generating the artifact; installing the real generated integration/result; activating/configuring it; verifying the current Comparison is available on the first-install flow; adding another Comparison; detecting Add vs. Update via stable identity; detecting an exact duplicate as no-op; placing a Comparison; rendering the public page; updating a placed Comparison while preserving placements; rejecting invalid/incompatible imports atomically; deleting a used Comparison; the editor missing state; the public missing behavior; re-importing the same `session.id` to restore existing placements; rendering multiple different Comparisons on one page; rendering multiple instances of the same Comparison on one page; independent interaction state; responsive sizing and height; slider interaction; keyboard/accessibility behavior; overflow tooltips and other required Presentation interaction; English and German behavior plus English fallback; local/self-contained assets; resource loading only where required; cache/update behavior; deactivation persistence; full uninstall cleanup where applicable; and supported platform versions.

Webflow and Squarespace use the same quality bar but follow the customer workflow appropriate to those platforms. Real-platform integration tests complement, rather than replace, focused unit, artifact and browser tests.

## Non-Goals

This document does not define:

- any platform's own technical architecture, storage layout, code structure, plugin/extension/module packaging, or build tooling — see the relevant platform integration document;
- Webflow or Squarespace technical contracts, which are not yet specified;
- the Version 2 Hosted Comparison model, its public URLs, QR codes or iframe embed codes (F-005; [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md));
- SameView Web's own UI layout beyond what [APPLICATION_LAYOUT.md](APPLICATION_LAYOUT.md) already defines;
- implementation details of any kind.
