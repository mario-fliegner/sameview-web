# SameView App Web – Engineering Guide

This document defines engineering quality standards for the project.

## HTML5
- Semantic HTML5
- Valid heading hierarchy
- Native elements over generic divs
- Standards-compliant markup

## Accessibility
- Keyboard support
- Visible focus
- Proper labels
- Alt texts
- WCAG-friendly contrast
- Reduced motion support

## Astro
- Prefer Astro components
- React only for interactivity
- Minimal hydration
- Progressive enhancement
- Preserve server/client boundaries

## Reusability
- Reuse existing components
- Avoid duplication
- No premature abstraction

## Code Quality
- Keep solutions simple
- No dead code
- No unnecessary dependencies
- Strong TypeScript
- Avoid any where possible

## State
- Local state first
- Derive instead of duplicate
- Avoid unnecessary effects

## UX
- Mobile first
- Clear primary actions
- Intentional loading/error states
- No unnecessary dialogs
- Reason from the user's perspective first: what they are trying to accomplish, what they must understand right now, what the simplest experience looks like — as a product designer and user first, an engineer second
- Technical implementation supports the product experience; it does not define it. Do not let architecture, data structures, transport formats or developer terminology dictate what the user sees
- Every visible element must communicate something distinct or provide a distinct interaction; merge or remove elements that duplicate what another already communicates
- Fix unclear hierarchy with structure, not with more text or more UI

## Responsive Design
- Fluid layouts
- No horizontal scrolling
- Test common breakpoints

## Performance
- Minimize JS
- Lazy-load non-critical assets
- Prevent CLS
- Optimize LCP without harming UX

## Security
- Validate input
- Keep secrets server-side
- Parameterized database access
- Prevent abuse
- No unsafe HTML rendering

## Privacy
- No hidden tracking
- No unnecessary cookies
- Respect SameView privacy principles

## SEO
- Correct titles
- Canonicals
- hreflang
- Structured data reflects reality

## Internationalization
- Keep DE/EN consistent
- Natural translations
- Preserve established terminology
- Describe the product and the user's action, not the internal implementation — e.g. "SameView Export" is product terminology; "ZIP" is a transport detail and appears only when the user genuinely needs that technical fact
- Calm, precise, direct language; no marketing slogans, exaggerated emotional language, generic SaaS wording or unnecessary technical explanation

## Database
- Server-side access only
- Drizzle-first
- Safe migrations
- No destructive changes without approval

## Testing
- Node's built-in test runner is the default for deterministic logic: parsing, validation, normalization, state transitions, derivation, escaping, serialization.
- Automated browser testing with Playwright is the approved strategy for critical browser workflows that cannot be proportionately verified by Node unit tests alone.
- Manual verification is supplementary only, reserved for what cannot realistically be automated: native OS dialogs, real assistive technologies, limited real-device spot checks.
- Browser automation stays proportional and targeted at critical user workflows; it does not duplicate deterministic unit tests.
- Introduce browser automation when a capability genuinely has no Node equivalent, not merely when UI exists — e.g. Phase 2's image-decode validation (`createImageBitmap`), which is unavailable in Node and was the actual trigger for introducing Playwright, earlier than the workspace-UI phase originally assumed.
- Functional and workflow tests verify behavior through stable `data-testid` attributes, not through translated labels, button copy, headings, status messages or other mutable UI text, and not through presentational CSS classes. A copy or translation change must never break an otherwise unchanged functional test.
- Dedicated copy/localization tests may intentionally assert visible wording; dedicated accessibility tests may use roles, accessible names and other accessibility APIs where the test is specifically about accessibility. Keep these responsibilities separate from functional/workflow tests.
- Use the smallest reasonable number of `data-testid` attributes; they complement, not replace, semantic HTML and accessibility.
- A platform integration (e.g. [docs/EMBED_IN_WEBSITE.md](EMBED_IN_WEBSITE.md)) is not considered verified by unit tests, artifact tests or a mocked/approximated host environment alone — its real customer workflow must be verified against a real instance of the target platform. See the relevant platform integration document (e.g. [docs/WORDPRESS_INTEGRATION.md](WORDPRESS_INTEGRATION.md)) for the concrete target-platform test environment.

## Browser Compatibility
- Stable APIs
- Progressive enhancement

## Pre-Implementation Review

Performed after analysis, before implementation begins. Concise yes/no questions.

### Product (Pre-Implementation)

- Is the user's actual problem clearly understood?
- Is the planned behavior defined by the approved specifications?

### Scope

- Is the implementation limited to the approved scope?
- Can the solution be simplified further without losing required functionality?

### Decisions

- Are all required product decisions already made?
- Are any assumptions being introduced that should instead be clarified first?

### Engineering (Pre-Implementation)

- Does the planned solution follow the existing architecture?
- Are the required tests identified before implementation begins?

## Quality Gate

Before completion verify as applicable:
- semantics
- accessibility
- responsiveness
- performance
- security
- privacy
- SEO
- i18n
- documentation consistency
- information hierarchy
- copy clarity
- test selector stability

## Completion Review

Performed after implementation, before considering the work complete. Concise yes/no questions that operationalize the principles and Quality Gate above — not a restatement of them.

### Product (Completion)

- Does the implementation match the approved specifications?
- Does it solve the user's problem from the user's perspective?

### UI / UX

- Does every visible UI element provide unique value?
- Can any UI, copy or interaction be removed or simplified?

### Copy

- Is product terminology used consistently?
- Is the wording clear, concise and consistent with the Brand Guide?

### Engineering (Completion)

- Is the implementation proportionate?
- Were unnecessary abstractions, dependencies or architectural changes avoided?

### Testing

- Are the implemented tests appropriate for the change?
- Are functional tests independent from mutable UI text?

### Documentation

- Were only the approved files changed?
- Do any specifications require updating?
- Are remaining risks explicitly documented?

### Product Value

- Does every increase in implementation complexity provide demonstrable product value?

## Proportionality

- Keep solutions proportionate to the current product scope.
- Avoid overengineering.
- Prefer the simplest solution that fully satisfies the approved requirements.
- Do not introduce additional layers, abstractions, architecture or complexity unless they solve a demonstrated need.
- Grow architecture and documentation only when increasing product complexity genuinely requires it.
- Before adding a UI element, copy, interaction or abstraction, verify it provides unique value the user needs.
- Do not add explanatory UI merely because the underlying implementation is complex; do not expose technical complexity to the user unless it is necessary for understanding, control, trust or error recovery.

## Specification Discipline

- Specifications are the source of truth.
- Keep specifications focused, cohesive and free of unnecessary overlap.
- Reuse and extend existing specifications before creating new ones.
- Create new specification documents only when they define a distinct responsibility that cannot reasonably be integrated into an existing specification.
- Do not duplicate requirements across multiple specifications.