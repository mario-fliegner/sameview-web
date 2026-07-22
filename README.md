# SameView Web

Developer setup notes. For product scope, architecture and data handling, see [docs/](docs/).

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

## Other Commands

- `pnpm build` — production build
- `pnpm preview` — preview the production build locally
- `pnpm typecheck` — type-check the project (`astro check`)
- `pnpm lint` — lint with Biome
- `pnpm db:generate` — generate a new SQL migration from `src/db/schema.ts`
- `pnpm db:migrate` — apply pending migrations (does not start the app)
- `pnpm db:studio` — open Drizzle Studio

## Full Local Reset

```sh
docker compose down -v
docker compose up -d
pnpm db:migrate
```
