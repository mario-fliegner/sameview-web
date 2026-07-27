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
- [docs/AI_ENGINEERING_GUIDE.md](docs/AI_ENGINEERING_GUIDE.md) — engineering quality standards (accessibility, security, performance, i18n, etc.)
- [docs/BRAND_GUIDE.md](docs/BRAND_GUIDE.md) — brand identity, colors, typography
- [docs/deployment.md](docs/deployment.md) — Netcup/Plesk deployment contract; complements ARCHITECTURE.md

## Hard Constraints (V1)

- SameView Web is a small, realistically sized full-stack web application. No hyperscaler design.
- No microservices. No monorepo.
- No S3 or other external object storage in V1.
- No separate frontend/backend deployments — one application.
- Stack: Astro + React + TypeScript, one Node.js application, on Netcup shared hosting.
- One Netcup MySQL database — prepared technical foundation for planned Version 2 Hosted Publication, not used by the Version 1 browser-local workflow.
- Persistent image storage on the local Netcup filesystem — prepared technical foundation for planned Version 2 Hosted Publication, not used by the Version 1 browser-local workflow.
- Production domain: `https://web.sameview.app`.
- Hosted images are stored as web-optimized WebP files — applies to planned Version 2 Hosted Publication; Version 1 has no hosted images.
- Original SameView ZIP files are never stored permanently.
- No user accounts in V1.

## Working Rules

- Always read the relevant existing files before making changes.
- Keep changes narrowly scoped to the requested task.
- Do not add frameworks, services, abstraction layers, or future functionality that wasn't asked for.
- If a task seems to require deviating from the constraints above, stop and ask instead of proceeding.
