# SameView Web – User Workflow

## Status

This specification is developed iteratively. Only sections marked `Status: Complete` are normative. Sections marked `Status: TBD` are placeholders that identify topics for later specification and do not define requirements.

## Purpose

**Status: Complete**

This specification defines how users experience the SameView Web workflow and the principles that govern the workflow across its stages. It complements the product capabilities and boundaries defined in [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) without redefining them.

The specification provides an implementation-independent basis for later UI, UX, testing, analytics and technical decisions. It does not define screens, components, layouts, routes, APIs or data models.

## Design Goals

**Status: Complete**

- **Guided, not overwhelming:** Help users understand the current task and available choices without presenting unnecessary complexity.
- **One primary task at a time:** Keep the main objective of each workflow stage clear.
- **Progressive disclosure:** Introduce choices and information when they become relevant.
- **Preserve user progress:** Avoid unnecessary loss of completed work and support continuity when the workflow is interrupted.
- **Consistent across entry points:** Maintain a coherent workflow regardless of how the user reaches SameView Web.
- **Local-first whenever possible:** Prefer completing work locally when the product capability does not require server-side processing or publication.
- **Clear primary actions:** Make the action that advances the workflow distinguishable from secondary or optional actions.
- **Minimize unnecessary navigation:** Allow users to complete their objective without avoidable transitions or detours.

## User Journey

**Status: Complete**

The typical user opens SameView Web with a photo comparison that already exists in SameView Android. Most users arrive with prior knowledge of SameView, while some may first discover the web application through the broader SameView product context.

The user is not seeking to create a new comparison. Their motivation is to use browser-based capabilities that complement SameView Android and to prepare the existing comparison so that others can experience it interactively or so that it can be provided in the desired form.

The journey begins when the user opens SameView Web. It ends when the user has successfully obtained the intended result, regardless of the specific form that result takes.

The journey consists of five high-level phases:

1. **Access the Comparison:** Bring the existing comparison into the SameView Web experience.
2. **Review the Comparison:** Understand the comparison and assess how it is currently presented.
3. **Prepare the Comparison:** Make any refinements needed to support the intended result.
4. **Choose an Outcome:** Decide how the comparison should be made available for its intended use.
5. **Achieve the Intended Outcome:** Successfully obtain the chosen result and conclude the immediate objective.

## Entry Points

**Status: Complete**

SameView Web always works with a comparison that already exists; it does not create the comparison. An entry point determines whether an existing comparison becomes available in an editable workspace, a published outcome is opened for viewing, or an existing publication is accessed for management. It does not define how the comparison was originally created.

### Continue an Existing Comparison

The primary product entry is the continuation of work on an existing SameView comparison in SameView Web. In Version 1, this comparison originates in SameView Android and is made available through a manual handoff. Future versions may make the same comparison available in other ways without changing the product model or the resulting workspace.

### Direct Web Access

Users may open SameView Web directly. Direct access does not create a workspace by itself; an editable workspace exists only after an existing comparison has been made available.

### Product Discovery

Users may discover SameView Web through `sameview.app`. The main website provides product context and access to SameView Web, but does not make a comparison available or create a workspace.

### Public Viewing

Users may directly access a published outcome for viewing. This entry is limited to experiencing the published comparison and does not provide an editable workspace.

### Publication Management

Owners may access the management context for an existing publication. Publication management is separate from workspace editing and does not create a workspace.

### Entry Independence

An entry point determines only how an existing comparison becomes available or whether a published outcome is opened for viewing or management. It does not determine the workspace type, the subsequent workflow or the content of the workspace. Every entry that makes a comparison available for editing leads to the same workspace model.

## Workspace Model

**Status: Complete**

A workspace represents exactly one existing SameView comparison. The comparison is created outside SameView Web and provides the basis for the workspace. The workspace contains immutable Source Data and the complete current body of work for that comparison, including effective metadata, additions, modifications, intentionally removed information, presentation settings and settings for intended outcomes.

### Source Data and Current Working State

Source Data is the complete imported comparison and remains unchanged after a successful import. The Current Working State is initialized from Source Data as a lossless working representation. It is the complete set of information, files and settings that currently applies to the workspace, determines how the comparison is represented and forms the sole basis for subsequent outcomes.

Unknown metadata fields are retained in both Source Data and the Current Working State. Only fields defined as mutable by the imported comparison contract may differ in the Current Working State.

Derived Variants of existing content may be part of the Current Working State. Their creation, timing, formats and storage are outside the scope of this model.

### Workspace Independence and Version 1

Each workspace is an independent unit associated with one comparison, and the model allows multiple workspaces to exist. Version 1 supports exactly one active workspace at a time. All user actions apply exclusively to that active workspace, and Version 1 does not specify the management or selection of multiple workspaces.

### Changes

All changes update the Current Working State of the same workspace without modifying Source Data. They do not create a new comparison, a new workspace, an automatic version or a copy. Internal processing and Derived Variants do not change this identity model.

### Local Retention and Outcomes

Unpublished workspace data remains local to the user's browser until explicitly replaced or removed. Making workspace data available for publication requires an explicit user action.

Exported or published outcomes are results of the workspace. They are not separate workspaces.

### Future Extensibility

Future versions may support multiple locally retained workspaces without changing the definition or identity of an individual workspace. This capability is not specified for Version 1.

## Workflow

**Status: Complete**

The workflow describes work on a previously created SameView comparison within an editable workspace. It does not describe how the comparison became available or how the user reached SameView Web.

### Workflow Precondition

A previously created SameView comparison has become available to SameView Web. The means by which it became available is defined by the relevant entry point and is outside this workflow.

The workspace workflow begins when a workspace is created from the available comparison. A single outcome-generation cycle ends when the generated outcome has been made available for its intended use.

### Standard Workflow

#### 1. Workspace Is Created

The available comparison is established as a workspace. From this point onward, the user works with the workspace rather than with the source comparison as a separate object.

#### 2. Review the Comparison

The user reviews the comparison to confirm that it is the intended comparison and to understand its current presentation before making changes.

#### 3. Prepare the Comparison

The user refines the workspace information and settings needed to support the intended result. Throughout this phase, the effective representation of the comparison reflects the Current Working State.

Preview is not a separate workflow phase. Immediate representation of the Current Working State is part of preparing the comparison.

#### 4. Choose an Outcome

The user selects the outcome to be generated. This decision establishes the context for the remaining phases of the current outcome-generation cycle.

#### 5. Configure the Outcome

**Outcome-specific settings become available only after an outcome has been selected.**

Outcome-specific settings do not exist in the workflow before the outcome selection. Once available, they apply exclusively to the currently selected outcome. They do not change the workspace unless a later specification explicitly defines otherwise.

#### 6. Generate the Outcome

The selected outcome is generated using the Current Working State and the configuration of the selected outcome. Each outcome-generation cycle generates exactly one outcome.

#### 7. Make the Outcome Available

The generated outcome is made available for its intended use. The form of availability depends on the selected outcome and is outside the scope of this chapter.

### Workflow-Wide Rules

- **Continuous Workspace:** The same workspace remains in use throughout the workflow.
- **Live Workspace:** The user works with the Current Working State during preparation. There is no separate preview workflow.
- **Single Outcome Generation:** Each pass from `Choose an Outcome` through `Make the Outcome Available` generates exactly one outcome.
- **Multiple Outcomes:** Multiple outcomes may be generated sequentially from the same workspace. Each additional outcome starts a new cycle at `Choose an Outcome`.
- **Workspace Independence:** The workspace continues to exist independently of generated outcomes. Generated outcomes do not become part of the workspace.
- **Outcome Independence:** Outcome-specific settings belong only to the selected outcome and do not change the workspace unless a later specification explicitly defines otherwise.
- **No Manual Save:** Saving is not a workflow phase or a user decision. Persistence behavior is outside the scope of this chapter.

## Workflow Rules

**Status: Complete**

These rules define the invariant behavior of the workflow. They apply regardless of the selected outcome or the current phase of the workflow.

### Workspace Rules

- A workspace cannot exist without an existing comparison.
- A workspace always represents exactly one comparison.
- Exactly one workspace is active at a time.
- The Current Working State is the single source of truth for all generated outcomes.
- A workspace may produce multiple outcomes.
- Generated outcomes never become part of the workspace.

### Workflow Progression Rules

- A workspace can only be created from a valid SameView comparison.
- An outcome may be selected at any time after a workspace has been created.
- Outcome-specific settings become available only after an outcome has been selected.
- An outcome may only be configured after it has been selected.
- An outcome may only be generated after all required outcome-specific settings have been completed.
- The selected outcome may be changed at any time before outcome generation.
- Every generation cycle ends when the generated outcome has been made available.
- Changing outcome-specific settings does not modify the Current Working State.

### Outcome Rules

- An outcome is always generated from the Current Working State.
- Every outcome represents exactly one generation cycle.
- Outcome-specific settings apply only to the selected outcome.
- Generated outcomes remain independent from one another.
- Regenerating an outcome creates a new outcome without modifying previously generated outcomes.
- Outcome generation never modifies the workspace.

## Operational States

**Status: Complete**

Operational states describe the current runtime state of SameView Web while the user is working. They are temporary product-level conditions and do not need to be persisted.

### No Workspace

No workspace is currently open. The application is waiting for a valid SameView comparison from which to create a workspace.

### Workspace Active

A workspace is open, and its Current Working State can be modified. This is the normal working state.

### Outcome Selected

An outcome has been selected, and outcome-specific settings are available. The workspace remains fully editable.

### Outcome Ready

All required outcome-specific settings have been completed, and the selected outcome is ready for generation. Any modification of the Current Working State leaves this operational state.

### Outcome Generation In Progress

The selected outcome is currently being generated.

### Outcome Available

At least one outcome has been successfully generated from the Current Working State and is available within the application. The user may make a generated outcome available for its intended use, generate additional outcomes or continue editing the workspace. Any modification of the Current Working State leaves this operational state.

## User Actions

**Status: Complete**

User actions describe the intentional actions a user can perform while working with a comparison. They represent product capabilities rather than individual user interface interactions.

### Comparison Actions

- Import Comparison
- Edit Comparison

### Outcome Actions

- Select Outcome
- Configure Outcome
- Generate Outcome

### Availability Actions

- Make Outcome Available

## Navigation Rules

**Status: Complete**

Navigation supports movement within the workflow but does not define, alter or bypass it. All workflow preconditions and Workflow Rules remain authoritative regardless of how the user moves between available workflow areas.

### Non-Linear Navigation

SameView Web is not a linear wizard. The user may move between workflow areas that are already available and may return to:

- review the comparison,
- edit the comparison,
- select a different outcome,
- configure the selected outcome again, or
- generate an additional outcome.

Movement does not perform these User Actions or make an unavailable area available.

### Workflow Authority

Navigation never replaces a product precondition. Outcome configuration remains unavailable until an outcome has been selected, and outcome generation remains subject to the requirements defined by Workflow Rules.

### Context Preservation

Navigation alone does not create a workspace, reset the active workspace, modify or discard the Current Working State, modify or discard Source Data, or implicitly remove existing information. Only an explicitly defined User Action may change the workspace.

### Operational State Independence

Navigation alone does not change an Operational State. Operational States change only as a consequence of a product-level User Action.

Editing the comparison may leave `Outcome Ready` or `Outcome Available` because it modifies the Current Working State. Moving to or from the corresponding workflow area does not cause that change.

### Scope Boundary

These rules define product-level navigation only. They do not define pages, URLs, routing, browser history, menus, tabs, buttons, dialogs, animations, responsive layout or concrete screen transitions.

## Responsive Principles

**Status: Complete**

Responsive behavior preserves the same product workflow across all supported screen sizes, device classes and input contexts. It may adapt presentation but does not change product meaning or capability.

### Workflow Independence

The same workflow phases, User Actions, Operational States and Workflow Rules apply in every supported context. Responsive behavior does not create an alternative workflow.

### Capability Independence

Product capabilities do not depend on screen size or device class. Presentation may differ, but a capability may vary only when a later product specification explicitly defines that difference.

### Context Preservation

Changes to screen size, window size or device orientation do not discard or replace the active workspace, Source Data, Current Working State, outcome selection or Operational State. Responsive adaptation never causes an implicit reset.

### Progressive Adaptation

When less space is available, only presentation may adapt. Product meaning, workflow phases, defined ordering constraints among User Actions, Workflow Rules and Operational States remain unchanged.

### Input Independence

The workflow does not depend on a particular input method. Every User Action remains available through supported input contexts, including mouse, touch and keyboard input.

### Accessibility Support

Responsive adaptation does not make a User Action inaccessible, skip a workflow phase, require an alternative workflow or hide a product capability. Detailed accessibility requirements are outside this chapter.

### Non-Goals

This chapter does not define breakpoints, screen sizes, CSS, grid or flexbox behavior, components, page layout, navigation elements, touch targets, font sizes, animations or concrete responsive layouts.

## Error Handling

**Status: Complete**

Error handling defines how failures are understood and contained within the workflow. It does not define how the user recovers from a failure.

### Error Recognition

An error must be clearly recognizable as a failure. The user must be able to understand that an error occurred, which User Action was affected and whether the current working context was affected. These principles do not prescribe how an error is presented.

### Error Locality

An error remains associated with the User Action in which it occurred. A failed action does not defer, conceal or transfer its failure to a later workflow phase.

### Preserve User Work

An error does not unnecessarily modify or discard the active workspace, Source Data, Current Working State, outcome selection or previously generated outcomes.

### Error Isolation

An error is limited to the failed User Action unless another effect is explicitly defined. It does not automatically invalidate the workspace or the remaining workflow. Independent User Actions remain available when their product preconditions continue to be satisfied.

### Understandable Errors

An error is described in product terms that are meaningful to the user. Internal exceptions, stack traces, implementation details and other program internals are not part of the product-level error description.

### No Hidden State Changes

An error does not cause unexpected product-level side effects. It does not unintentionally modify the Current Working State or Source Data, create or delete a workspace, perform an implicit reset, or leave partial changes when the affected User Action is defined as atomic.

### Non-Goals

This chapter does not define specific error messages, error codes, HTTP status codes, logging, monitoring, telemetry, exception handling, retry behavior, Recovery, undo, continue, resume or technical error-handling mechanisms.

## Recovery

**Status: Complete**

Recovery defines how the user may continue the workflow after an interruption or a failed User Action. It does not define how errors arise or are presented.

### Recoverability

The workflow remains recoverable whenever its product context is still valid. An interruption or failed User Action does not automatically end the workflow or imply the loss of existing work.

### Preserve Progress

Recovery preserves progress wherever product consistency allows. The active workspace, Source Data, Current Working State, outcome selection and previously generated outcomes remain available unless an explicit User Action validly changes them.

### Recovery after Failure

After a failed User Action, the user may repeat the same action, continue with another permitted User Action or deliberately end the workflow. The available choice remains subject to the current Operational State and product preconditions.

### Preserve Consistency

Recovery continues from a consistent product state. A partially completed User Action, incomplete outcome or contradictory Current Working State is not treated as valid completed progress.

### Workflow Authority

Recovery does not override preconditions, User Actions, Operational States or Workflow Rules and does not create an alternative workflow.

### User-Controlled Recovery

Recovery follows an explicit user decision. It does not automatically repeat a User Action, implicitly alter the workflow or independently modify the workspace.

### Non-Goals

This chapter does not define autosave, retry strategies, offline support, synchronization, cloud recovery, conflict resolution, versioning, undo or redo, technical restart mechanisms or concrete Recovery UI.

## Interaction Principles

**Status: Complete**

Interaction Principles define the product-level behavior shared by every user interaction. They complement the workflow and its rules without defining presentation or interaction design.

### Explicit User Control

Every product-level change results from an intentional User Action. The product does not independently make unexpected changes to the workspace or workflow.

### Predictable Interactions

The same User Action under the same product preconditions produces the same product-level result. Its meaning and effect remain understandable and predictable.

### Immediate Feedback

Every User Action provides recognizable product-level feedback. The user can determine that the action was performed and whether it succeeded or failed. These principles do not prescribe how feedback is presented.

### Respect Workflow Rules

An interaction does not bypass Workflow Rules. A User Action is performed only when its defined product preconditions are satisfied. Interaction Principles complement rather than replace those rules.

### Preserve Context

An interaction changes only the part of the current working context that its User Action is defined to affect. The workspace, Source Data, Current Working State and outcome selection remain unchanged unless the action requires otherwise.

### Consistent Behavior

Similar User Actions follow consistent product preconditions, success definitions, Error Handling and Recovery principles. Interactions do not introduce contradictory product rules.

### User Intent First

An interaction performs the declared product meaning of the User Action. The product does not add further product-level actions or infer implicit user intent. Product-level changes require an explicit User Action.

### Non-Goals

This chapter does not define gestures, mouse interactions, touch behavior, keyboard shortcuts, buttons, components, menus, page layout, animations, focus management, accessibility details or concrete UX patterns.

## Analytics Derivation

**Status: Complete**

Analytics requirements are derived from the product behavior defined by this specification. Analytics describes that behavior without changing the workflow, its rules or the available product capabilities.

### Product-First Derivation

The product definition is authoritative. Analytics follows the User Journey, workflow and product outcomes and does not introduce new product requirements or alter existing ones.

### User Actions as Primary Signals

Defined User Actions are the primary product-level signals for analytics. Derivation is based on actions the user performs, not on internal implementation activity.

### Workflow Progress

Analytics may describe product-level progress through workflow phases and transitions between Operational States. This chapter does not define concrete measurement points.

### Outcome-Oriented Measurement

Analytics describes achieved outcomes and the user's progress toward them. Measurement is based on product meaning rather than internal processing.

### Consistency

The same product-level User Action or workflow transition is interpreted consistently wherever it occurs. Analytics does not assign contradictory meanings to equivalent product behavior.

### Technology Independence

Product-level analytics definitions are independent of tracking technology. This chapter makes no choice among GA4, Matomo, server-side tracking, SDKs, tag managers or telemetry systems.

### Privacy by Design

Analytics respects the product's privacy principles and does not create requirements that contradict product behavior or privacy obligations. Specific privacy and consent mechanisms are outside this chapter.

### Non-Goals

This chapter does not define event names, event parameters, event schemas, tracking code, GA4 configuration, consent management, tag management, dashboards, reports, KPIs, conversion definitions or technical implementation details.
