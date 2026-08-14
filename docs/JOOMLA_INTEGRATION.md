# SameView Web – Joomla Integration

## Status

This is the normative Joomla-specific technical contract for the `Embed in website` output type. It satisfies, and does not restate, the shared contract defined in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md); every requirement in that document applies to Joomla unless this document states otherwise. Joomla is the second Embed platform in the approved release sequence ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Supported Platforms"), following WordPress.

This document defines the Joomla-native contract a future implementation must satisfy. It does not define concrete code structure, class/namespace design, database column names, or build tooling — those remain implementation-time decisions made when the feature is actually built, consistent with [AI_ENGINEERING_GUIDE.md](AI_ENGINEERING_GUIDE.md) "Specification Discipline".

## Purpose

Defines, for Joomla specifically: the persistent integration model, the Comparison storage model, first installation, placement, frontend delivery, permissions/security, and the real-platform test environment — each satisfying the corresponding shared requirement in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md).

## Supported Joomla Versions

SameView officially supports the current Joomla major version and the immediately previous Joomla major version. This range is maintained operationally, based on Joomla's own release lifecycle, rather than hard-coded as specific version numbers in this document — consistent with [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Supported Platforms". Every officially supported version is covered by real integration/compatibility verification (see "Testing" below).

## Persistent Integration

Joomla uses the persistent integration model defined in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Persistent Integration Model": one SameView integration per Joomla site, capable of holding multiple Comparisons.

The integration is implemented as a Joomla component, `com_sameviewcomparisons`, which owns the Comparison library, the `Add comparison` workflow and all stored data. The component's placement mechanisms (see "Placement" below) are implemented as a companion module and companion content-rendering/editor-insertion plugins — distinct Joomla extension types from the component itself. All of these are packaged and installed together as a single Joomla extension package (a native Joomla mechanism for bundling several extensions into one install/uninstall unit), so a site operator only ever performs one native install action, never several separate extension installs.

Joomla has no single native action equivalent to WordPress's plugin deactivate/reactivate toggle for an entire extension; installation and full removal (`Extensions → Manage → Uninstall`) are the two native lifecycle actions Joomla applies to an installed package. The companion plugins each carry their own native enabled/disabled toggle, independent of one another and of the component; disabling one stops only that placement path from newly rendering, without discarding any stored Comparison, asset or placement reference. Short of full removal, no native Joomla action discards SameView-owned data — the practical guarantee [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Deactivation and Uninstall" requires (data preserved short of a deliberate full removal) holds under Joomla's own lifecycle model, even though the concrete triggering actions differ from WordPress's single deactivate/reactivate toggle.

Full uninstall/removal deletes all data owned by the integration — stored Comparisons, images, assets and other SameView-owned integration data — with no orphaned data left behind. Where Joomla's own removal flow allows it, the user receives an appropriate warning before permanent data removal.

Component code updates and Comparison data updates are versioned and delivered independently of one another, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Persistent Integration Versioning". The concrete update-distribution mechanism for the integration software itself is an implementation-time decision.

## Storage Model

Comparison metadata is stored in a dedicated database table owned by the `com_sameviewcomparisons` component, installed and, where a future format change requires it, migrated via Joomla's own native component-schema-versioning mechanism. Comparison identity ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Comparison Identity") and Outcome Fingerprint ([IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md) "Outcome Fingerprint") are stored as column values on this table and used as the basis for Add/Update/no-op detection ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Comparison Lifecycle"). The Outcome Fingerprint is generated deterministically by SameView Web; Joomla only stores and compares it — Joomla never computes or independently interprets it.

Comparison assets (processed images and any branding asset) are stored in a SameView-owned directory under Joomla's `media/` folder — the conventional Joomla location for extension-owned static/generated assets — and not under the `images/` folder Joomla's own Media Manager scans by default. This keeps SameView-owned, non-reusable technical assets out of the site's general media library, consistent with the Editing Boundary in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) — these assets are not meant for reuse or repurposing outside the Comparison they belong to.

Full uninstall removes both the component's database table(s) and the SameView-owned `media/` subdirectory in full, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Deactivation and Uninstall".

## First Installation

SameView Web generates the same kind of downloadable package for Joomla regardless of whether the target site already has the SameView integration installed, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Persistent Integration Model" and "First Installation" — SameView Web never asks or infers whether this is the first Comparison for a given site.

Installing that package through Joomla's native Extensions Manager (`Extensions → Manage → Install → Upload Package File`), on a site with no SameView integration yet, both installs the component and its companion extensions and makes the currently generated Comparison immediately available, without a separate manual import step, using Joomla's own native post-installation script mechanism. This satisfies [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "First Installation" as one coherent action from the user's perspective.

Comparisons after the first are always added through the installed component's own `Add comparison` workflow ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Comparison Lifecycle") — never by reinstalling or replacing the integration through the Extensions Manager. The exact package format and the exact mechanism by which the post-installation step makes the bundled Comparison available are implementation-time decisions, made to satisfy the contract in this section.

## Placement

The reference form `{sameview session="SESSION_ID"}` (`SESSION_ID` being the Comparison's `session.id`, see [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Comparison Identity") is the syntax inserted into freeform content by the content placement path described below. The module placement path stores the same `session.id` value directly as a module parameter, without this bracket-tag syntax, since a module's own configuration is a structured form rather than freeform text.

Two placement paths are provided, both resolving the referenced Comparison through the same underlying renderer, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Placement" and reusing the shared Presentation and Interaction source defined in [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) — Joomla does not implement its own PHP reimplementation of Presentation rendering or interaction behavior:

- **Content placement**: a native editor button inserts the reference into the currently edited content (for example, article text); a native content-rendering extension resolves that reference into the rendered Comparison wherever the content is displayed. This is the primary placement mechanism for content such as articles.
- **Module placement**: a native module type renders one referenced Comparison in any module position the active template defines (for example, a sidebar or footer position), for placement contexts outside ordinary content — the compatibility path for template/module-position placement.

No SameView Presentation controls exist at either placement level, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Editing Boundary" — both paths select only an existing Comparison.

### No Editor Preview

Neither placement path renders a static or interactive preview of the Comparison anywhere in Joomla's editing surfaces — not in the content editor, not in the reference-selection interface, and not in the module's own configuration screen. Selecting a Comparison for placement is by identifying information only (Comparison title and reference-to-capture period label), never by rendering its content. [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Placement" permits, but does not require, an editor preview ("may show a high-quality static preview instead" of a live one); Joomla's own content editor has no mechanism comparable to a live block-rendering canvas, and no reliable mechanism to render arbitrary third-party markup inline during editing either, so this document deliberately settles on no preview in either form, for both placement paths uniformly, rather than a partial or inconsistent approximation. This is a Joomla-native placement decision, not a reduction of the required public output, which remains the complete interactive Comparison in both cases (see "Presentation and Interaction Parity" in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md)).

This is distinct from the Comparison Library's own preview/thumbnail requirement ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Comparison Management"), which applies to the library/management view, not to placement, and remains required.

The missing-Comparison editor state and public missing behavior follow [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Placement Behavior After Deletion" — an unresolved reference is identified by title only where the reference is still known (for example, still present in a module's own configuration), consistent with there being no rendered preview to fall back to.

## Frontend Delivery

SameView frontend assets (runtime script, CSS, fonts) are local, self-contained files served by the Joomla site itself, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Local/Self-Contained Resources" — no third-party CDN or externally hosted resource. Assets are registered and loaded through Joomla's own native web-asset system, which provides both the conditional per-page loading and the asset versioning this requires natively.

Assets are loaded only on pages that actually contain a SameView placement, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Performance and Resource Loading". Asset versioning ensures a Comparison update is reliably reflected on new page loads without requiring the site operator to manually clear caches, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Caching and Updates".

SameView does not integrate with third-party Joomla full-page-caching or system-cache plugins' own purge mechanisms in Version 1. Interaction between Comparison updates and a site's own caching (where installed) is outside this document's contract; a site operator relying on such caching may need to purge it manually after a Comparison update for changes to appear immediately.

## Host Isolation

Bidirectional host isolation, per [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) "Multiple Instances and Host Isolation", is mandatory for Joomla, using the same Shadow DOM-based isolation boundary already established for the shared Embed runtime — Joomla renders the same placement container markup and loads the same runtime script; no Joomla-specific isolation behavior is introduced or required.

## Permissions and Security

A single native Joomla access-control permission gates every administrative Comparison-library action uniformly — access to the Comparison library, `Add comparison`, update through `Add comparison`, and `Delete` — per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Permissions". This mirrors the shared contract's requirement of one coherent administrative capability without introducing a separate SameView role/permission model; Joomla's own User Group and Access Level system determines which groups hold it, assignable through Joomla's native permissions interface. Users without this permission who otherwise hold ordinary content- or module-editing permissions may still place already available Comparisons (via the mechanisms in "Placement" above) without receiving Comparison-library management rights, since placement uses Joomla's own existing content/module permissions, not a SameView-specific one.

The `Add comparison` upload path validates the supplied artifact completely before any stored state changes, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Import Validation" — including safe handling of the uploaded file and protection against cross-site request forgery on the administrative action, following Joomla's own established security practices for administrative actions and file handling. This validation is independent of, and does not rely upon, Joomla's Extensions Manager installation flow, since this upload path is not an extension (re)installation.

## Testing

Joomla Embed integration is verified against a real, disposable Joomla instance — not a mock or an approximated host page — per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Real-Platform Verification and Release Criteria" and [AI_ENGINEERING_GUIDE.md](AI_ENGINEERING_GUIDE.md) "Testing". The primary and default verification mechanism is a Docker-based real Joomla instance combined with Playwright browser automation, driving the same real administrative and public workflows a customer would use — installing the real generated extension package, adding a Comparison, placing it, and verifying real frontend rendering. A dedicated PHP-level test harness inside the Joomla integration is introduced only where a concrete, demonstrated verification need cannot be reasonably met through the Docker/Playwright path; it is not introduced speculatively or as a default convenience. Verification covers the currently supported Joomla major version and the immediately previous major version (see "Supported Joomla Versions" above). The exact test suite structure, Docker composition and CI wiring are implementation-time decisions.

## Non-Goals

This document does not define:

- concrete component/module/plugin file/folder structure, class/namespace design, or database column names;
- the exact Comparison package/artifact file format;
- the exact administrative UI layout of the Comparison library or `Add comparison` screens;
- WordPress, Webflow or Squarespace technical contracts — WordPress's is defined in [WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md); Webflow and Squarespace remain unspecified;
- anything already defined generally in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md), which this document satisfies rather than restates.
