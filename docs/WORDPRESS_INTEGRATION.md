# SameView Web – WordPress Integration

## Status

This is the normative WordPress-specific technical contract for the `Embed in website` output type. It satisfies, and does not restate, the shared contract defined in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md); every requirement in that document applies to WordPress unless this document states otherwise. WordPress is the first Embed platform in the approved release sequence ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Supported Platforms").

This document defines the WordPress-native contract a future implementation must satisfy. It does not define concrete code structure, class/module design, function or hook names, or build tooling — those remain implementation-time decisions made when the feature is actually built, consistent with [AI_ENGINEERING_GUIDE.md](AI_ENGINEERING_GUIDE.md) "Specification Discipline".

## Purpose

Defines, for WordPress specifically: the persistent integration model, the Comparison storage model, first installation, placement, frontend delivery, permissions/security, and the real-platform test environment — each satisfying the corresponding shared requirement in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md).

## Supported WordPress Versions

SameView officially supports the current WordPress major version and the immediately previous WordPress major version. This range is maintained operationally, based on WordPress's own release lifecycle, rather than hard-coded as specific version numbers in this document — consistent with [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Supported Platforms". Every officially supported version is covered by real integration/compatibility verification (see "Testing" below).

## Persistent Integration

WordPress uses the persistent integration model defined in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Persistent Integration Model": one SameView plugin per WordPress site, capable of holding multiple Comparisons.

Plugin activation, when there is no previously stored Comparison matching the currently bundled one, makes that Comparison available — see "First Installation" below. Deactivation preserves all stored Comparisons and placement relationships; reactivation restores normal operation. Full uninstall/removal deletes all SameView-owned data — stored Comparisons, images, assets and other integration data — leaving no orphaned data, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Deactivation and Uninstall".

Plugin code updates and Comparison data updates are versioned and delivered independently of one another, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Persistent Integration Versioning". The concrete update-distribution mechanism for the plugin software itself is an implementation-time decision.

## Storage Model

Comparison metadata is stored as a WordPress Custom Post Type, with per-Comparison values held as Post Meta. Comparison identity ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Comparison Identity") and Outcome Fingerprint ([IMPORTED_COMPARISON_V1.md](IMPORTED_COMPARISON_V1.md) "Outcome Fingerprint") are stored as Post Meta and used as the basis for Add/Update/no-op detection ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Comparison Lifecycle"). The Outcome Fingerprint is generated deterministically by SameView Web; WordPress only stores and compares it — WordPress never computes or independently interprets it.

Comparison assets (processed images and any branding asset) are stored in a SameView-owned directory under the WordPress uploads directory, not registered in or exposed through the WordPress Media Library. This keeps SameView-owned, non-reusable technical assets out of the site's general media library, consistent with the Editing Boundary in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) — these assets are not meant for reuse or repurposing outside the Comparison they belong to.

Full uninstall removes both the Custom Post Type data and the SameView-owned upload directory in full, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Deactivation and Uninstall".

## First Installation

SameView Web generates the same kind of downloadable package for WordPress regardless of whether the target site already has the SameView plugin installed, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Persistent Integration Model" and "First Installation" — SameView Web never asks or infers whether this is the first Comparison for a given site.

Installing that package through WordPress's native plugin installation flow, on a site with no SameView plugin yet, both installs the plugin and makes the currently generated Comparison immediately available, without a separate manual import step. This satisfies [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "First Installation" as one coherent action from the user's perspective.

Comparisons after the first are always added through the installed plugin's own `Add comparison` workflow ([EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Comparison Lifecycle") — never by reinstalling or replacing the plugin. The exact package format and the exact WordPress-native mechanism by which activation makes the bundled Comparison available are implementation-time decisions, made to satisfy the contract in this section; a real, disposable WordPress instance confirmed this contract is achievable using entirely native WordPress plugin-activation behavior, without any custom infrastructure or external service dependency.

## Placement

The native WordPress Block Editor block is the primary placement mechanism. A shortcode is an additional compatibility path, for contexts without Block Editor support (e.g. the Classic Editor, page builders, or non-block widget areas), rendered through the same underlying renderer as the block — never a second, independently maintained rendering implementation.

Both reuse the same shared Presentation and Interaction source defined in [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md); WordPress does not implement its own PHP reimplementation of Presentation rendering or interaction behavior. A real Block Editor proof of concept confirmed this is achievable: a real, disposable WordPress instance rendered a fully interactive Comparison inside the Block Editor, using the same Presentation markup and interaction source SameView Web already produces elsewhere, without a PHP rendering clone.

Placement selects only an existing Comparison, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Placement" — no SameView Presentation controls exist at the placement level. The block's editor preview reuses the same Presentation and Interaction source and may remain interactive, confirmed achievable by the same proof of concept; where this is not reliably achievable for a given rendering context, a high-quality static preview is used instead, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Placement". The WordPress Block Editor may render block content in an isolated context (for example an iframe); the block implementation accounts for this without changing the shared Presentation/Interaction source itself. The missing-Comparison editor state and public missing behavior follow [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Placement Behavior After Deletion".

## Frontend Delivery

SameView frontend assets (runtime script, CSS, fonts) are local, self-contained files served by the WordPress site itself, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Local/Self-Contained Resources" — no third-party CDN or externally hosted resource.

Assets are loaded only on pages that actually contain a SameView placement, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Performance and Resource Loading" — including placements outside ordinary singular post content (for example widget areas or block-theme template parts), not only the common case of a single post/page. Asset versioning ensures a Comparison update is reliably reflected on new page loads without requiring the site operator to manually clear caches, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Caching and Updates".

SameView does not integrate with third-party WordPress full-page-caching plugins' purge APIs in Version 1. Interaction between Comparison updates and a site's own full-page caching (where installed) is outside this document's contract; a site operator relying on full-page caching may need to purge it manually after a Comparison update for changes to appear immediately.

## Host Isolation

Bidirectional host isolation, per [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) "Multiple Instances and Host Isolation", is mandatory for WordPress. A Shadow DOM-based isolation boundary is the preferred technical candidate, based on completed technical research, but is not yet an approved technical decision. The concrete isolation mechanism remains an implementation-time decision, bound by the mandatory outcome already defined in [COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md).

## Permissions and Security

WordPress's native capability system gates the administrative Comparison-library actions (Add, Update through Add comparison, Delete) to appropriately privileged users; users with ordinary content-editing capabilities may select and place already available Comparisons without receiving Comparison-library management rights, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Permissions". No separate SameView user or role system is introduced.

The `Add comparison` upload path validates the supplied artifact completely before any stored state changes, per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Import Validation" — including safe handling of the uploaded file and protection against cross-site request forgery on the administrative action, following WordPress's own established security practices for administrative actions and file handling. This validation is independent of, and does not rely upon, WordPress's built-in Media Library upload validation, since this upload path is not a Media Library upload.

## Testing

WordPress Embed integration is verified against a real, disposable WordPress instance — not a mock or an approximated host page — per [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Real-Platform Verification and Release Criteria" and [AI_ENGINEERING_GUIDE.md](AI_ENGINEERING_GUIDE.md) "Testing". `wp-env`, the official WordPress local/test environment tooling, was confirmed during technical research and a completed proof of concept to be adequate for this purpose, including installing a real generated plugin package, activating it, placing a block in a real Block Editor instance, and verifying real frontend rendering with Playwright. Verification covers the currently supported WordPress major version and the immediately previous major version (see "Supported WordPress Versions" above). The exact test suite structure and CI wiring are implementation-time decisions.

## Non-Goals

This document does not define:

- concrete plugin file/folder structure, class/module design, or function and hook names;
- the exact Comparison package/artifact file format;
- the exact Block Editor build/bundling approach;
- Joomla, Webflow or Squarespace technical contracts, which are not yet specified;
- anything already defined generally in [EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md), which this document satisfies rather than restates.
