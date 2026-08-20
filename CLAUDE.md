# CLAUDE.md

Guidance for Claude Code (and any other coding agent) working in this repository.

## Authoritative Documents

The following files under [docs/](docs/) are the binding functional and technical basis for this project. Read the relevant one(s) before any implementation work — do not duplicate their content here, refer back to them:

- [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md) — what SameView Web does and does not do (V1 scope)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — technology, hosting, routes, storage
- [docs/DATA_AND_PRIVACY.md](docs/DATA_AND_PRIVACY.md) — stored data, image processing, publication, deletion
- [docs/FEATURE_SPECIFICATION.md](docs/FEATURE_SPECIFICATION.md) — normative functional behavior of each feature (F-001–F-007)
- [docs/USER_WORKFLOW.md](docs/USER_WORKFLOW.md) — user journey, workspace model, workflow and operational states
- [docs/IMPORTED_COMPARISON_V1.md](docs/IMPORTED_COMPARISON_V1.md) — the V1 import and metadata contract
- [docs/IMPLEMENTATION_PLAN_V1.md](docs/IMPLEMENTATION_PLAN_V1.md) — V1 implementation phases and order; not itself a specification — approved specifications remain authoritative where they conflict
- [docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md](docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md) — binding approved product-decision baseline for Hosted Comparison (Version 2)
- [docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md](docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md) — Hosted Comparison implementation phases and order; not itself a specification — approved specifications/product decisions remain authoritative where they conflict
- [docs/AI_ENGINEERING_GUIDE.md](docs/AI_ENGINEERING_GUIDE.md) — engineering quality standards (accessibility, security, performance, i18n, etc.)
- [docs/BRAND_GUIDE.md](docs/BRAND_GUIDE.md) — brand identity, colors, typography
- [docs/deployment.md](docs/deployment.md) — Netcup/Plesk deployment contract; complements ARCHITECTURE.md

## Hard Constraints (V1)

- SameView Web is a small, realistically sized full-stack web application. No hyperscaler design.
- No microservices.
- `sameview-web` remains one repository, not a general-purpose monorepo: dedicated Embed platform-integration codebases (their own platform-specific code and tooling, e.g. a WordPress plugin) may live in clearly separated integration directories inside it, isolated from the Astro/React application structure under `src/`, and must reuse shared SameView Presentation/runtime code rather than duplicate it — see [docs/IMPLEMENTATION_PLAN_V1.md](docs/IMPLEMENTATION_PLAN_V1.md) Phase 14. A separate repository for such an integration is not prohibited but is not the default; it is adopted only for a concrete technical or organizational reason.
- The Hosted Comparison application under `hosted/` is the other approved exception to the single-application repository model: a separate, independently deployable Node.js/Astro application serving `my.sameview.app`, distinct from the Embed platform-integration directories above — see docs/ARCHITECTURE.md "Repository and Application Boundary".
- No S3 or other external object storage in V1.
- No separate frontend/backend deployments within either application.
- Stack: Astro + React + TypeScript. Two independently deployed Node.js applications on Netcup shared hosting, each its own single application: the root application (`web.sameview.app`) and the Hosted Comparison application under `hosted/` (`my.sameview.app`) — see docs/ARCHITECTURE.md "Repository and Application Boundary".
- One Netcup MySQL server, logically separated per application — see docs/ARCHITECTURE.md "MySQL Logical Separation". Not used by the browser-local SameView Web V1 workflow. Hosted Comparison (Version 2) uses its own separate database, under active implementation in `hosted/` — see docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md for current phase status.
- Persistent image storage on the local Netcup filesystem is not used by the browser-local SameView Web V1 workflow. Hosted Comparison (Version 2) actively uses local filesystem asset storage, under active implementation in `hosted/` — see docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md for current phase status.
- Production domains: `https://web.sameview.app` (root SameView Web V1 application) and `https://my.sameview.app` (Hosted Comparison application, under active implementation — see docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md for current phase status).
- Hosted Comparison (Version 2) images are stored as web-optimized WebP files, under active implementation in `hosted/` — see docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md for current phase status. The browser-local SameView Web V1 workflow has no hosted images.
- Original SameView ZIP files are never stored permanently.
- No user accounts in V1.

## Working Rules

- `docs/implementation_prompts/**` contains historical implementation, review, and handover prompts for documentation purposes only. These files are not sources of truth and must not be inspected or used by coding agents unless a task explicitly requests them.
- Always read the relevant existing files before making changes.
- Keep changes narrowly scoped to the requested task.
- Do not add frameworks, services, abstraction layers, or future functionality that wasn't asked for.
- If a task seems to require deviating from the constraints above, stop and ask instead of proceeding.
