# CLAUDE.md

Guidance for Claude Code (and any other coding agent) working in this repository.

## Authoritative Documents

The following files under [docs/](docs/) are the binding functional and technical basis for this project. Read the relevant one(s) before any implementation work — do not duplicate their content here, refer back to them:

- [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md) — what SameView Web does and does not do (V1 scope)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — technology, hosting, routes, storage
- [docs/DATA_AND_PRIVACY.md](docs/DATA_AND_PRIVACY.md) — stored data, image processing, publication, deletion

## Hard Constraints (V1)

- SameView Web is a small, realistically sized full-stack web application. No hyperscaler design.
- No microservices. No monorepo.
- No S3 or other external object storage in V1.
- No separate frontend/backend deployments — one application.
- Stack: Astro + React + TypeScript, one Node.js application, on Netcup shared hosting.
- One Netcup MySQL database.
- Persistent image storage on the local Netcup filesystem.
- Production domain: `https://web.sameview.app`.
- Hosted images are stored as web-optimized WebP files.
- Original SameView ZIP files are never stored permanently.
- No user accounts in V1.

## Working Rules

- Always read the relevant existing files before making changes.
- Keep changes narrowly scoped to the requested task.
- Do not add frameworks, services, abstraction layers, or future functionality that wasn't asked for.
- If a task seems to require deviating from the constraints above, stop and ask instead of proceeding.
