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

## Database
- Server-side access only
- Drizzle-first
- Safe migrations
- No destructive changes without approval

## Browser Compatibility
- Stable APIs
- Progressive enhancement

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

## Proportionality

- Keep solutions proportionate to the current product scope.
- Avoid overengineering.
- Prefer the simplest solution that fully satisfies the approved requirements.
- Do not introduce additional layers, abstractions, architecture or complexity unless they solve a demonstrated need.
- Grow architecture and documentation only when increasing product complexity genuinely requires it.

## Specification Discipline

- Specifications are the source of truth.
- Keep specifications focused, cohesive and free of unnecessary overlap.
- Reuse and extend existing specifications before creating new ones.
- Create new specification documents only when they define a distinct responsibility that cannot reasonably be integrated into an existing specification.
- Do not duplicate requirements across multiple specifications.