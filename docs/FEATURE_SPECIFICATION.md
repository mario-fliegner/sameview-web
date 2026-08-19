# SameView Web – Feature Specification

## Status

This document defines the normative functional behavior of SameView Web features and complements the existing specifications.

## Purpose

This document specifies every user-visible feature independently using a consistent structure.

It does not redefine:

- product scope
- user workflow
- architecture
- privacy requirements

## Feature Index

| ID | Feature | Scope |
|----|---------|-------|
| F-001 | Import Comparison | Current Version 1 |
| F-002 | View Comparison | Current Version 1 |
| F-003 | Edit Comparison | Current Version 1 |
| F-004 | Configure Comparison Branding | Current Version 1 |
| F-005 | Generate Comparison Output | Current Version 1 |
| F-006 | Publish Hosted Comparison (planned) | Planned Version 2 |
| F-007 | View Hosted Comparison (planned) | Planned Version 2 |

## Specification Principles

Every feature description shall:

- describe observable user-facing behavior
- define preconditions
- define functional behavior
- define expected results
- define rules and limitations
- avoid implementation details
- avoid UI layout decisions unless functionally relevant
- avoid duplicating requirements from other specifications
- remain consistent with approved specifications

## F-001 Import Comparison

### Purpose

Import Comparison allows the user to make an existing SameView comparison available in SameView Web as an editable workspace.

### Preconditions

- The user has a SameView export ZIP.
- If no workspace is active, the application is in the `No Workspace` state.
- If a workspace is already active, the user must explicitly decide whether to replace it before another comparison may be imported.

### Functional Behavior

1. The user selects a SameView export ZIP.
2. If a workspace is already active, the application obtains the user's explicit decision before replacing that workspace. Cancelling the replacement ends the import without changing the active workspace.
3. The application validates the archive according to the existing import, archive and file validation specifications.
4. The application locates and parses `metadata.json`.
5. The application validates that the metadata declares a supported version and satisfies the imported comparison contract.
6. The application reads current metadata fields first and applies documented legacy fallbacks only where the imported comparison specification defines them.
7. The application resolves the comparison files referenced by the metadata and validates all files required for a valid import.
8. After all validation succeeds, the application creates immutable Source Data containing the complete accepted Imported Comparison, including metadata, accepted comparison files and preserved unknown metadata.
9. The application initializes the Current Working State from Source Data as a lossless working representation of the imported comparison.
10. The application creates exactly one active workspace for the imported comparison. When importing from `No Workspace`, the application transitions to `Workspace Active`.

### Result

A successful import creates one active workspace representing the selected comparison. Its Source Data is immutable, and its Current Working State is ready for review, editing and the generation of future outcomes.

### Rules and Limitations

- Exactly one workspace may be active at a time.
- A workspace may be created only from a valid, supported SameView export.
- A SameView export ZIP containing more than one valid session directory is rejected as a distinct import failure; SameView Web V1 does not select, merge or otherwise automatically resolve multiple sessions in one archive.
- Source Data remains immutable after a successful import.
- Unknown metadata fields and unknown optional blocks are tolerated and preserved where required by the imported comparison specification.
- Current metadata fields take precedence over documented legacy fallbacks.
- Device-local URIs and MediaStore references are not used to resolve comparison files.
- Importing does not modify the selected ZIP or any content in the original export.
- Replacing an active workspace requires an explicit user decision.
- If replacement is cancelled or the new import fails, the existing workspace, its Current Working State and previously generated outcomes remain unchanged.
- Detailed metadata field definitions and compatibility rules remain defined by the imported comparison specification.
- Implementation details, user interface layout and storage technologies are outside the scope of this feature.

### Failure Conditions

An import fails when the selected archive is not a supported SameView export or does not satisfy the existing archive, metadata or referenced-file validation requirements. This includes an archive that cannot be accepted, a missing or unparseable `metadata.json`, an unsupported metadata version, missing or invalid required metadata, required referenced comparison files that cannot be resolved or validated, or an archive containing more than one valid session directory.

When an import fails, the application communicates that the comparison could not be imported. The failure does not create a workspace from the rejected comparison. Failed imports never create a partially initialized workspace and never modify an already active workspace, its Current Working State or its previously generated outcomes.

## F-002 View Comparison

### Purpose

View Comparison allows the user to inspect and interact with the comparison represented by the active workspace.

### Preconditions

- Exactly one workspace is active.
- The active workspace contains a valid Current Working State with both required comparison images.

### Functional Behavior

1. The application presents the active workspace to the user.
2. The application presents the comparison interactively so that both comparison images are available for inspection.
3. The presented comparison and its information are derived from the Current Working State.
4. Configured branding is presented where applicable.
5. All displayed comparison information automatically reflects changes made to the Current Working State by other features.
6. Viewing and interacting with the comparison performs no modification of comparison data.

### Result

After the comparison is viewed:

- the active workspace remains available,
- the Current Working State remains unchanged unless it is modified by another feature, and
- Source Data remains unchanged.

### Rules and Limitations

- Exactly one comparison may be viewed at a time.
- Presentation is always derived from the Current Working State.
- Source Data is never modified.
- User interaction within the viewer does not modify comparison data.
- Viewing the comparison is independent of standalone HTML generation.
- Viewing the comparison is independent of publication.
- Metadata editing is not part of this feature.
- Branding configuration is not part of this feature.
- Marker editing is not part of this feature.
- HTML generation is not part of this feature.
- Publication is not part of this feature.
- Implementation details and user interface layout are outside the scope of this feature.

## F-003 Edit Comparison

### Purpose

Edit Comparison allows the user to update the user-editable comparison information and presentation visibility of an imported comparison in the active workspace.

### Comparison Information

Comparison information consists of user-facing information associated with the imported comparison. For each information item, its value and its visibility in the comparison presentation are separate properties:

| Comparison information | Value | Visibility |
| --- | --- | --- |
| Comparison Title | Editable | Editable |
| Description | Editable | Editable |
| Reference Date | Editable | Editable |
| Capture Date | Read-only | Editable |
| Reference Location Display Name | Editable | Editable |
| Reference Location City | Editable | Editable |
| Reference Location Country | Editable | Editable |
| Session Branding | Editable through Feature F-004 | Follows the configured branding state |

An information value and its visibility are independent. A value may exist in the Current Working State while being hidden from the comparison presentation.

### Functional Behavior

1. The user may modify the value or visibility of comparison information only where that property is defined as editable.
2. All edits modify only the Current Working State.
3. Source Data remains unchanged.
4. The comparison viewer immediately reflects changes to the Current Working State.
5. A generated standalone HTML outcome or future publication uses the Current Working State that exists when that outcome is generated.
6. Editing never changes previously generated or previously published outcomes.
7. Alignment markers are not part of SameView Web and are outside the scope of this feature.

### Result

After editing:

- the active workspace remains available,
- the Current Working State contains the updated comparison information and presentation visibility, and
- Source Data remains unchanged.

### Rules and Limitations

- Only editable comparison information properties may be modified.
- Read-only information cannot be changed.
- Comparison information may be hidden without deleting its value.
- Removing a value is different from hiding the information.
- Presentation visibility defined by this feature is independent of the preserved imported `additional.visibility` metadata field.
- Session Branding is configured only through Feature F-004.
- A target platform for a generated Embed in website output is not an alternative editor for this feature's editable properties — see [docs/EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md) "Editing Boundary".
- Detailed value formats, validation, metadata semantics and outcome snapshot behavior remain defined by the existing specifications.
- Implementation details and user interface layout are outside the scope of this feature.
- No product behavior beyond the behavior defined by the approved specifications and this feature is introduced.

## F-004 Configure Comparison Branding

### Purpose

Configure Comparison Branding allows the user to select the branding used in the presentation and future outcomes of the comparison in the active workspace.

### Branding Options

The supported branding options are:

- No Branding
- Built-in Symbol
- Custom Image

Branding, including a custom branding image when selected or a Built-in Symbol's configured color, is part of the Current Working State.

Built-in Symbol additionally supports a configurable color: Dark (default), Brand or Custom. This color is part of Session Branding and applies exclusively to Built-in Symbol; it never applies to, and never modifies, Custom Image or any imported branding asset.

### Functional Behavior

The user may:

- disable branding by selecting No Branding,
- select a supported built-in branding symbol,
- upload a custom branding image,
- replace an existing custom branding image, and
- switch freely between all branding options.

Each branding change updates the Current Working State and is immediately reflected by the comparison viewer. Generated standalone HTML includes the branding selected in the Current Working State at generation time. A future publication includes the branding selected in the Current Working State at generation time.

Changing branding does not alter previously generated standalone HTML or previously published comparisons.

Opening the Built-in Symbol selection does not itself activate a symbol; a symbol becomes the active branding only once the user explicitly selects it, and the Built-in Symbol selection shows a symbol as selected only while that symbol is the currently active branding.

The configured color belongs to the Built-in Symbol branding as a whole, not to an individual symbol: switching between symbols (for example Heart, then Star, then Fire) keeps the currently configured color unchanged. Changing the configured color never regenerates or otherwise modifies any branding image.

Selecting No Branding deactivates the active branding immediately, without discarding the most recently selected built-in symbol or the most recently valid custom branding image. Selecting Custom Image reactivates the most recently valid custom branding image immediately, in both the comparison viewer and its own preview, whenever one exists from earlier in the active workspace; without an existing valid custom branding image, selecting Custom Image only presents the image selection and does not change the currently active branding. An invalid custom branding image upload changes neither the currently active branding nor the most recently valid custom branding image.

The most recently selected built-in symbol and the most recently valid custom branding image are each retained independently of which branding option is currently active, for the duration of the active workspace. Importing a comparison with built-in symbol branding initializes the most recently selected built-in symbol accordingly; importing a comparison with custom image branding initializes the most recently valid custom branding image accordingly. The branding present at import remains the active branding until the user takes an explicit branding action.

### Result

After configuring branding:

- the active workspace remains available,
- the Current Working State contains the selected branding, any custom branding image required by that selection, and, for Built-in Symbol, its configured color, and
- Source Data remains unchanged.

### Rules and Limitations

- Branding configuration is independent of Source Data and never modifies Source Data.
- A custom branding image is part of the Current Working State.
- The current branding is preserved when generating standalone HTML.
- The current branding is preserved when publishing.
- Changing branding never modifies previously generated or previously published outcomes.
- No branding options other than No Branding, Built-in Symbol and Custom Image are defined.
- A Built-in Symbol's configured color applies exclusively to Built-in Symbol; it never applies to, and never modifies, Custom Image, an imported branding asset or any other raster branding file.
- Implementation details, image processing and user interface layout are outside the scope of this feature.

## F-005 Generate Comparison Output

### Purpose

Generate Comparison Output allows the user to create a new comparison output artifact from the Current Working State of the active workspace.

### Preconditions

- An active workspace exists.
- The active workspace has a valid Current Working State.

### Supported Output Types

SameView Web supports multiple comparison output types generated from the same comparison.

The currently supported Version 1 output types are:

- Standalone HTML
- Static Microsite

Embed in website is an approved Version 1 output type, not yet implemented, specified in [docs/EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md); platform-specific technical contracts are specified separately, for example [docs/WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md).

Hosted Comparison is a related but separate Version 2 capability: publishing an interactive online Comparison rather than generating a downloadable output artifact. It is not a comparison output type of this feature and is specified separately by Feature F-006 and Feature F-007.

Additional comparison output types may be introduced in future versions.

### Functional Behavior

1. The user explicitly enters the output-selection context while remaining in the same active workspace.
2. The user selects one supported comparison output type.
3. The selected comparison output is generated exclusively from the Current Working State.
4. Every generated output represents the same comparison associated with the active workspace.
5. Each output type may define its own generation, processing and delivery behavior.
6. Successful generation creates a new comparison output artifact.
7. Returning to comparison editing never discards the Current Working State or previously generated outputs.



### Standalone HTML

For Version 1, Standalone HTML is generated and immediately handed to the browser as a download.

Use Current Slider Position and Remove Embedded Location Data (below) are the additional output-specific configuration this output type supports.

The generated HTML reproduces the current Workspace Preview as closely as technically possible.

Generation and browser download form one continuous user action.

### Static Microsite

For Version 1, Static Microsite is generated and immediately handed to the browser as a ZIP download.

Use Current Slider Position and Remove Embedded Location Data (below) are the additional output-specific configuration this output type supports.

The generated microsite reproduces the current Workspace Preview as closely as technically possible, using the same presentation and interaction source as Standalone HTML. No independent presentation or interaction implementation is defined for this output type.

Generation and browser download form one continuous user action.

### Use Current Slider Position

Use Current Slider Position is a shared output-specific setting, available identically for Standalone HTML, Static Microsite and Embed in website once an output type has been selected. It is not part of the Current Working State and has no effect on the Workspace Preview.

Default: Off.

When Off, the generated output's Comparison Stage divider starts at the exact midpoint (50/50) — COMPARISON_PRESENTATION.md Part 2 "Initial Slider Position".

When On, the divider instead starts at the Workspace Preview's own current interactive slider position, read exactly once, at the moment generation is triggered, and carried into the Outcome Snapshot like every other captured value. The generated output is fully independent afterwards: its divider remains fully interactive, and later Workspace Preview slider movement never changes an already-generated output.

Standalone HTML, Static Microsite and Embed in website always use the same value for this setting, and the same resulting starting position, for a given outcome; no output-type-specific value exists.

### Remove Embedded Location Data

Remove Embedded Location Data is a shared output-specific setting, available identically for Standalone HTML, Static Microsite and Embed in website once an output type has been selected. It is not part of the Current Working State and has no effect on the Workspace Preview.

Default: On.

When On, the two comparison images have their embedded location information removed before being included in the generated output. Embedded metadata unrelated to location — in EXIF, XMP, IPTC or any other embedded metadata structure present in the image — remains unchanged. Removal never re-encodes the compressed image data, never changes pixel dimensions, never crops or stretches the image, and preserves the image's visual orientation, including its EXIF Orientation value. When Off, the two comparison images' embedded metadata is included in the generated output unchanged.

This setting affects only metadata embedded within the two comparison image files. It never exposes `captureLocation`, `referenceLocation`, or any other Source Data field beyond the existing outcome allowlist.

This setting is fully independent of the visible, user-editable Location value and its `Show Location` visibility (F-003; COMPARISON_PRESENTATION.md Part 3). Changing one never changes the other. When this setting is On and Show Location is also currently On, the Output Inspector displays a neutral informational hint that the visible location remains part of the comparison and that this setting removes only embedded image metadata. The hint never blocks generation and never changes either setting.

Standalone HTML, Static Microsite and Embed in website always use the same value for this setting for a given outcome; no output-type-specific value exists.

### Result

After successful generation:

- a comparison output artifact exists,
- the active workspace remains available,
- the Current Working State remains unchanged, and
- Source Data remains unchanged.

### Rules and Limitations

- Output generation never modifies Source Data.
- Output generation never modifies the Current Working State.
- Every generated output represents the Current Working State at the time of generation.
- Previously generated outputs remain unchanged.
- A previously generated output may be downloaded again only while the selected output type and output-specific settings still match those it was generated with; a change to either requires generating the newly selected configuration again before it can be downloaded.
- Output-type-specific behavior may be defined by dedicated specifications.
- This feature does not describe publishing an output — see Feature F-006.
- This feature does not describe hosted comparison management — see Feature F-006.
- This feature does not describe public URLs or QR codes for a Hosted Comparison — see Feature F-007. Iframe embed codes remain future scope.
- Implementation details are outside the scope of this feature.

## F-006 Publish Hosted Comparison

### Purpose

Publish Hosted Comparison allows the user to create and maintain one online Hosted Publication for a SameView Comparison, and to manage that Publication from the client that published it.

The first supported publishing client is SameView Android. SameView Web publishing is planned for a later phase and is not part of the initial, Android-first implementation of this feature. The Hosted Publication model remains suitable for another SameView client to publish through later, without redefining this feature's behavior.

### Preconditions

- A valid SameView Comparison is available to the publishing client, in a state suitable for Hosted publication — for example, an Android Comparison's current state, or, once supported, a SameView Web workspace's Current Working State.
- The user has explicitly chosen to publish; publishing is never triggered automatically.
- A Comparison that already has an active Hosted Publication may be published again to update that Publication (see "Update online" below) rather than to create a new one.

A Comparison that does not yet have the internal identity required for Hosted publication receives it automatically as part of publishing. This is not a user-visible step, does not depend on when or how the Comparison was originally created, and does not affect Comparisons that already have it. The underlying identity mechanics are defined in the imported/session metadata specifications, not here.

### Configurable Hosted Presentation

Before publishing, the user is shown a Hosted preview reflecting exactly what will be published. The Hosted Presentation available for Version 1 is:

| Hosted Presentation item | Configurable |
| --- | --- |
| Presentation style | Interactive Split/Slider only — no Side-by-Side Hosted variant |
| Title | Shown or hidden according to the user's selection |
| Description | Shown or hidden according to the user's selection |
| Date | Shown or hidden according to the user's selection |
| Location | Shown or hidden according to the user's selection |
| Slider branding | According to the user's selection (Feature F-004) |
| Background | Dark or Light |
| Stage corners | Rounded or Sharp |
| Quality | Not user-configurable — the Hosted service produces the delivered image |

The user's preview/configuration at the time of publishing defines what is published.

Hosted Android intentionally exposes a smaller Presentation surface than the SameView Web Presentation editor ([docs/COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md)). Web-only Presentation controls — including custom canvas colors, frame, custom presentation fonts and arbitrary text colors — are not part of Hosted Version 1. Rounded/Sharp stage corners reuse the terminology and default already defined in [docs/COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) "Canvas" → "Corner Radius"; they are not a separate concept.

### Initial slider position

The default initial position of the published interactive slider is the exact midpoint (50/50), consistent with [docs/COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) "Initial Slider Position". Version 1 does not expose an option to publish the current preview slider position instead; the feature model does not preclude adding such an option later.

### Publish behavior

1. The user reviews the Hosted preview described above and explicitly initiates publishing.
2. On success, exactly one active Hosted Publication is created for the Comparison, reachable through one stable public link (Feature F-007).
3. A Comparison may have at most one active Hosted Publication at a time. Publishing an already-published Comparison updates that Publication (see "Update online" below) instead of creating another one.
4. If a Publish attempt targets a Comparison that already has an active Hosted Publication managed by a different installation/capability, no second Publication is created, the existing Publication is not modified, and no ownership or management information about it is disclosed to the requester.
5. On success, the publishing installation receives the local management capability for the new Publication (see "Accountless management" below) together with the public sharing result described in Feature F-007.

### Update online

- A user with valid management capability for an existing Hosted Publication may update it with the currently configured Hosted Presentation and content.
- An update publishes the complete new Hosted state; it does not create another public link. The Publication's public link remains unchanged.
- If an update cannot be completed successfully, the previously published, working Publication remains available; a failed update never leaves the public Publication in a partial or broken state.
- Update requires valid management capability (see "Accountless management" below).

### Delete online

`Delete online`:

- is available from the local Comparison's own action context while that Comparison still exists;
- is also available from `Online comparisons` (below), including after the local Comparison no longer exists;
- requires explicit confirmation;
- deletes only the Hosted Publication;
- never deletes the local Comparison;
- on success, removes the local Hosted management relationship for that Publication, after which the Publication is no longer publicly available.

### Local Comparison deletion

Deleting a local Comparison and deleting its Hosted Publication remain distinct user decisions:

1. The existing local Comparison deletion confirmation remains unchanged.
2. If the Comparison has a locally managed Hosted Publication, the user is separately asked whether the online Publication should also be deleted.
3. The default answer is No / keep online.
4. Local deletion proceeds independently of Hosted/network availability and is never blocked by it.
5. If the user chose to also delete the Publication: success removes the Hosted Publication and the local Hosted management relationship; failure leaves the Hosted Publication and the local management relationship intact, and the user is told that only the local Comparison was deleted.
6. Deleting the Publication afterward remains possible through `Online comparisons`.

### `Online comparisons`

`Online comparisons` is a secondary local management surface listing the Hosted Publications for which the current app installation retains management capability. It is not a cloud account, a synchronized library, or a server-side list of everything belonging to a user; no server-side account synchronization is implied.

For each listed Publication, the user has access to:

- View online;
- Copy public link;
- Share;
- QR code;
- Private management link;
- Delete online.

If the corresponding local Comparison still exists, `Open comparison` and `Update online` are also available. If the local Comparison has been deleted, those two are not offered, while public sharing and Hosted management remain available.

### Accountless management

- Publishing, updating and deleting a Hosted Publication never requires a SameView account, a login, or an email address.
- The Publication's public link never itself grants management authority.
- Management authority is separate from, and more restricted than, public access; only the holder of the management capability may update or delete a Publication.
- A normal SameView export of the local Comparison does not itself grant Hosted management authority over any Publication.

### Recovery

- The private management link is the intended Version 1 way to regain management access to a Hosted Publication, including from a different browser or device.
- Management access to a Publication may outlive the local Comparison that produced it.
- Deleting or losing the local Comparison does not delete its Hosted Publication.
- Losing the local Hosted management relationship (for example through app data loss) does not grant anyone replacement management authority merely by holding the Comparison or its public link.
- Regaining management access through the private management link restores management authority only; it does not restore the original local Android Comparison.
- Hosted Sharing is not a cloud backup or restore mechanism for local Comparisons.

### Publication lifetime

A Hosted Publication has no default expiration and is not subject to an automatic lifetime such as 30 days. It remains available until it is explicitly deleted, or becomes unavailable for an operator/legal reason described outside this feature (see Feature F-007 "Report this content").

### Privacy-facing Hosted behavior

Images used for Hosted Publishing are processed so that embedded identifying and location metadata is not published as part of the Hosted image assets. The detailed processing pipeline is defined in [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md), not here.

### Network behavior

Publish, Update and Delete online require network connectivity. Ordinary SameView capture, editing and other local use remain fully usable without network connectivity; Hosted Sharing does not redefine SameView as an online-first product.

### Result

After a successful Publish:

- exactly one active Hosted Publication exists for the Comparison, reachable through one stable public link (Feature F-007);
- the publishing installation holds the local Hosted management relationship for that Publication;
- the local Comparison itself is unchanged.

After a successful Update, the Publication's content reflects the newly published Hosted Presentation while its public link remains unchanged.

After a successful Delete online, the Hosted Publication is no longer available and the corresponding local Hosted management relationship is removed.

### Rules and Limitations

- A Comparison may have at most one active Hosted Publication.
- Publishing an already-published Comparison updates the existing Publication; it never creates a second public link for the same Comparison.
- Management authority, not possession of the public link, governs who may update or delete a Publication.
- This feature does not require a SameView account.
- This feature does not provide cloud backup or restore of local Comparisons.
- This feature does not describe the public Hosted Viewer, public sharing or reporting — see Feature F-007.
- This feature does not describe the identifier, storage or security implementation used to realize these guarantees — see [docs/ARCHITECTURE.md](ARCHITECTURE.md) and [docs/DATA_AND_PRIVACY.md](DATA_AND_PRIVACY.md).
- Implementation details, exact UI layout and exact wording are outside the scope of this feature.

### Failure Conditions

Publishing, updating or deleting a Hosted Publication fails when the Hosted service or network connectivity is unavailable, when the submitted Hosted content is invalid or unsupported, when a Publish attempt would otherwise create a second active Publication for an already-published Comparison without valid management authority, or when an Update or Delete is attempted without valid management authority for the targeted Publication.

A failed Publish does not create a Publication. A failed Update never replaces a working Publication with a partial or broken one. A failed Delete leaves the existing Publication and local management relationship unchanged. Failure messaging remains neutral and does not disclose ownership or management details about a Publication the requester does not control.

## F-007 View Hosted Comparison

### Purpose

View Hosted Comparison allows anyone who has a Hosted Publication's public link to view the published SameView Comparison, and to access the sharing and reporting behavior associated with it.

### Preconditions

- A Hosted Publication exists and is currently available at its public link.

### Presentation

1. Visiting a Hosted Publication's public link presents the published Comparison as an interactive SameView Comparison. No editor is shown; the published Hosted snapshot is presented as-is.
2. The complete Hosted Presentation consists of the Comparison Stage together with the selected information beneath it, per Feature F-006 "Configurable Hosted Presentation". Selected information remains below the Stage rather than permanently overlaid on the image.
3. The complete Presentation uses the available viewport as fully as practical while remaining entirely visible: no cropping, no stretching, and no internal scrolling area for the Presentation itself. It responds correctly to viewport size and orientation changes. The Comparison Stage remains the visual priority.
4. Rounded/Sharp stage corners and the overall Dark/Light background follow the published configuration (Feature F-006). Corner terminology and default reuse [docs/COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md) "Canvas" → "Corner Radius"; the richer Web canvas/background system is not part of this feature.

### Long text

Long selected metadata may be visually truncated to preserve the Presentation's composition. Full truncated content remains accessible through an appropriate pointer/focus/touch interaction, consistent with [docs/COMPARISON_PRESENTATION.md](COMPARISON_PRESENTATION.md)'s existing overflow behavior. No internal scrolling metadata panel is introduced, and text is not continuously shrunk merely to fit arbitrary content.

### SameView service branding

A restrained SameView service presence is shown outside the Comparison Presentation itself. It does not cover the Comparison, does not compete visually with the user's own selected slider branding, and remains visually secondary. It provides access to `Report this content` and to appropriate SameView/service information.

### Report this content

`Report this content` is available from every public Hosted Viewer. Reporting uses a SameView-hosted flow associated with the current Publication, requires no SameView account, and accepts no file attachments in Version 1. Submitting a report does not by itself remove or suspend the Publication. The exact legal form fields, categories and retention are defined outside this feature specification.

### Public sharing

The publishing client can offer View online, Copy public link, ordinary platform/system Share, and a QR code for the Publication (Feature F-006). The QR code represents only the Publication's canonical public link, never creates another Publication or identity, can be displayed, shared as an image/file, and saved, and its underlying link can be copied. Version 1 does not require an SVG form of the QR code.

Hosted Sharing does not provide a SameView-operated `Email me this link` delivery service in Version 1; users may share the public link through their platform's own sharing/mail capabilities.

### Result

Viewing a Hosted Publication never modifies it. Sharing, viewing the QR code, and submitting a report do not require and never grant management authority over the Publication (Feature F-006).

### Rules and Limitations

- A Hosted Publication is accessible to anyone who possesses its public link. A difficult-to-guess public identifier is not an access-control mechanism, and this feature must not be described as private.
- Version 1 does not intentionally expose Hosted Publications as searchable/indexed public content; the exact technical mechanism belongs to [docs/ARCHITECTURE.md](ARCHITECTURE.md).
- Public access to a Publication never grants management authority over it — see Feature F-006.
- This feature does not describe how a Publication is created, updated, deleted or locally managed — see Feature F-006.
- This feature does not describe the exact legal report-form fields, categories or retention.
- Implementation details, exact UI layout and exact wording are outside the scope of this feature.

### Failure Conditions

If the public link no longer resolves to an available Publication — because it never existed, was deleted, or is otherwise unavailable for an operator/legal reason — the Viewer shows a neutral not-available state without disclosing whether it previously existed or why it is unavailable.

If the Hosted service, storage or network experiences a temporary technical failure, the Viewer shows a distinct temporary/technical-error state; a temporary failure must never make a live Publication appear permanently deleted or nonexistent.

If either of the two required Comparison images is unavailable, the Viewer does not render a half-working Comparison; this is treated as a temporary/technical failure.

If an optional asset such as custom branding is unavailable, the Viewer degrades gracefully and remains usable where the core Comparison itself is otherwise valid.

If JavaScript is unavailable, a concise message states that JavaScript is required for the interactive Comparison; Version 1 does not otherwise provide a static fallback.

If loading otherwise fails on the client, the Viewer avoids an indefinite loading state and provides a useful retry/error state where appropriate.
