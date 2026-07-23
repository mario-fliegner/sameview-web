# SameView Web

SameView Web is the companion web application for SameView, the Android app used to create interactive before/after
photo comparisons.

The Android app creates the comparison. SameView Web lets you import that comparison, adjust its presentation, export
it as a standalone HTML file, and optionally publish it online with a shareable link.

## Quick Start

```sh
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

## Prerequisites

- Node.js 22 LTS (minimum for local development; production runs Node.js 26.5.0 — see [docs/deployment.md](docs/deployment.md))
- pnpm (via Corepack)
- Docker Desktop

## Local Setup

1. Copy `.env.example` to `.env`
2. `docker compose up -d` — starts MySQL and phpMyAdmin together
3. Wait for the MySQL container to report healthy
4. `pnpm db:migrate`
5. `pnpm dev`

## Local Database Administration (phpMyAdmin)

`docker compose up -d` also starts a local-only phpMyAdmin, purely as a development admin UI (never used in
production, no PHP added to the app itself):

- URL: <http://localhost:8081>
- Username: the value of `MYSQL_USER` from your local `.env`
- Password: the value of `MYSQL_PASSWORD` from your local `.env`
- Optional root access: username `root`, password from `MYSQL_ROOT_PASSWORD`

Nothing is pre-filled — phpMyAdmin shows its normal login form and connects to the local `mysql` container.

## Important URLs

- Application: <http://localhost:4321>
- phpMyAdmin: <http://localhost:8081>

## Other Commands

- `pnpm build` — production build
- `pnpm preview` — preview the production build locally
- `pnpm typecheck` — type-check the project (`astro check`)
- `pnpm lint` — lint with Biome
- `pnpm test` — run the test suite
- `pnpm db:generate` — generate a new SQL migration from `src/db/schema.ts`
- `pnpm db:migrate` — apply pending migrations (does not start the app)
- `pnpm db:studio` — open Drizzle Studio

## Full Local Reset

`docker compose down -v` deletes the local database volume — all local development data is lost.

```sh
docker compose down -v
docker compose up -d
pnpm db:migrate
```

## Release Process

Production deployments are automated through GitHub Actions.

1. Commit and push your changes.
2. Create a semantic version tag (e.g. `v1.2.0`).
3. Push the tag to GitHub.
4. The deployment workflow builds the project and deploys it automatically.

For deployment details, workflow behavior and infrastructure information, see:
- [docs/deployment.md](docs/deployment.md)

> **Note**
> Pushing a semantic version tag triggers a production deployment.
> Do not create or push release tags unless a production deployment is intended.

## Documentation

- [Product Scope](docs/PRODUCT_SCOPE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Engineering Guide](docs/AI_ENGINEERING_GUIDE.md)
- [Deployment](docs/deployment.md)
- [Data & Privacy](docs/DATA_AND_PRIVACY.md)
