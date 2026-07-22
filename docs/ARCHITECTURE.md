# SameView Web – Architecture

## Technology

- Astro
- React
- TypeScript
- Node.js (single application)
- MySQL (Netcup)
- Local filesystem (Netcup)

## Hosting

- Domain: https://web.sameview.app
- One Node.js application
- One MySQL database
- One persistent upload directory

## Responsibilities

Browser:
- Import ZIP
- Display slider
- Edit presentation data
- Generate the standalone HTML export (client-side, no upload required)

Server:
- Validate uploads
- Process images
- Remove metadata
- Encode WebP
- Publish comparisons
- Generate management tokens

The server always validates, decodes, strips metadata from and re-encodes images submitted for online publication itself. It never trusts client-side image processing, including any processing done for the standalone HTML export. The limits defined below apply to online publication; the client-side standalone HTML export has no server upload and should apply the same checks where practicable, but is not server-enforced.

## Main Routes

/
 /new
 /v/<public-id>
 /manage/<management-token>

## Identifiers

- `internal_id`: a UUID, used only internally for database rows and the filesystem path. Never exposed in a URL.
- `public_id`: an independent, random, URL-safe string of about 10–12 characters, used in the public route `/v/<public-id>`.
- `management_token`: an independent, long, cryptographically random token, used in the private route `/manage/<management-token>`. Only a secure hash of it is stored in the database.
- Sequential database IDs must never appear in public URLs or storage paths.

## Upload Limits

- Maximum ZIP size: 25 MB
- Maximum number of contained files: 20
- Maximum uncompressed total size: 50 MB
- Nested archives are not allowed
- ZIP entries with absolute paths or path traversal segments (e.g. `../`) are rejected

## Export Structure

- A valid import must contain a supported `metadata.json`
- Relevant files are determined from the references in `metadata.json`
- Exactly one referenced `reference` file and exactly one referenced `capture` file are required
- Additional known SameView files may also be present (e.g. original images, HEIC source files, branding files)
- Files that are not referenced or not recognized are not processed automatically

## Image Limits

Input:

- Maximum resolution per processed file: 40 megapixels
- Files must be decoded and validated based on their actual content; file extension and browser-supplied MIME type alone are not sufficient
- Only the reference and capture files actually needed for publication are processed

Hosted output:

- Scaled to a maximum of 1920 px on the long edge
- Stored as WebP
- Target size: approximately 200 KB per image, without forcing this via visibly unusable compression
- Absolute limit: 350 KB per processed image; if exceeded despite valid processing, publication is rejected with a clear error message

## Abuse Protection

- Version 1 has no user accounts; anonymous publishing must be protected against automated abuse.
- Simple server-side rate limiting is sufficient for Version 1.
- No CAPTCHA and no external anti-spam services are used in Version 1.
- The concrete technical implementation (e.g. Redis, in-memory) is not yet defined.
- Failed publication attempts may use the same protection mechanisms.

## Storage

Database:
- metadata
- identifiers

Filesystem:
comparisons/<internal-id>/
- reference.webp
- capture.webp

Original ZIP files are not stored.

## Backup

- The MySQL database and the persistent image storage are covered by the regular Netcup backups.
- A detailed backup and restore strategy is not part of Version 1.
- SameView Web is not a backup system for complete SameView exports.

## Local Development

- The Astro/Node application runs locally directly on the host via pnpm; it does not run in a Docker container locally.
- MySQL runs locally as a single container via Docker Desktop.
- The compose file is named `compose.yaml`; the deprecated filename `docker-compose.yml` is not used.
- No additional containers (e.g. phpMyAdmin, Adminer, Redis, backend containers) are introduced.
- Production uses the existing Netcup MySQL database; local and production use the same versioned database schema.
- Credentials are provided exclusively via environment variables.
- A `.env.example` will be committed later; the real `.env` and other local secrets are never committed.

## MySQL Configuration

Production already uses MySQL Community Server 8.0.46; the local Docker version must use the same version, not `mysql:latest`.

Binding for SameView Web:

- Character set: utf8mb4
- Collation: utf8mb4_unicode_ci
- Timestamps: UTC

These settings apply regardless of any older databases still using utf8mb3.

## Local Docker Compose

The `compose.yaml` must satisfy at least these binding requirements:

- one MySQL service
- one persistent named volume
- a healthcheck
- configuration via environment variables
- MySQL pinned to version 8.0.46

Additional technical settings are explicitly permitted as long as they exclusively serve these requirements — for example MySQL server parameters for `utf8mb4` and `utf8mb4_unicode_ci`, UTC configuration, a restart policy, port mapping, or the concrete healthcheck implementation. No unrelated services or features are added.

The application connects exclusively via `DATABASE_URL`.

Intended local flow:

1. `docker compose up -d`
2. `pnpm db:migrate`
3. `pnpm dev`

A full local reset will later be possible by removing the Docker volume and re-running the migrations.

## Database Schema and Migrations

- The database schema is fully versioned.
- Schema and SQL migrations are stored in the repository.
- Tables are never created automatically via `CREATE TABLE IF NOT EXISTS` on application startup.
- Changes happen exclusively through versioned migrations.
- Migrations do not run automatically on normal web application startup; they are a deliberate development/deployment step.
- The schema and migrations are managed with Drizzle ORM and Drizzle Kit; migrations are generated into `drizzle/`.

## Initial Data Model

Version 1 needs a single table, `comparisons`, consisting exclusively of:

- `id` — internal UUID, primary key, generated by the application, never exposed publicly
- `public_id` — cryptographically random, URL-safe public ID, unique
- `management_token_hash` — hash of the private management token, unique
- `title` (optional)
- `description` (optional)
- `reference_label` (optional)
- `capture_label` (optional)
- `reference_path` — relative persistent file path
- `capture_path` — relative persistent file path
- `created_at` (UTC)
- `updated_at` (UTC)

Further decisions:

- Binary images are never stored in MySQL.
- There is no files table, no token table, no user table, no account table and no consent table.
- File paths are never derived from user input.

## Planned Repository Structure

```text
sameview-web/
├── docs/
├── drizzle/
├── src/
│   ├── db/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── pages/
│   └── server/
├── compose.yaml
├── .env.example
└── package.json
```
