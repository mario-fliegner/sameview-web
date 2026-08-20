import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Provider-neutral Asset Storage boundary for permanent, versioned Hosted
// binary assets — see docs/ARCHITECTURE.md "Asset Storage". Filesystem is
// the initial provider only; the interface itself carries no
// filesystem/S3-specific concept, so a later S3-compatible implementation
// can satisfy the same contract without redesigning callers.

export type AssetFilename = "reference.webp" | "capture.webp" | "branding.webp";

const ALLOWED_FILENAMES: ReadonlySet<AssetFilename> = new Set([
	"reference.webp",
	"capture.webp",
	"branding.webp",
]);

export interface AssetKey {
	internalPublicationId: string;
	assetVersion: string;
	filename: AssetFilename;
}

export interface AssetStorage {
	put(key: AssetKey, data: Buffer): Promise<void>;
	get(key: AssetKey): Promise<Buffer | null>;
	delete(key: AssetKey): Promise<void>;
}

// Rejects a dynamic path segment rather than sanitizing/normalizing it into
// a different, safe-looking value — path traversal must fail loudly. Both
// POSIX and Windows separators are rejected unconditionally, regardless of
// the current OS, since path.join's platform-specific behavior must never
// be relied on to make an unsafe segment safe.
function assertSafeSegment(value: string, label: string): void {
	if (value.length === 0) {
		throw new Error(`Invalid asset key: ${label} must not be empty`);
	}
	if (value === "." || value === "..") {
		throw new Error(`Invalid asset key: ${label} must not be "." or ".."`);
	}
	if (value.includes("/") || value.includes("\\")) {
		throw new Error(
			`Invalid asset key: ${label} must not contain a path separator`,
		);
	}
	if (value.includes("\0")) {
		throw new Error(`Invalid asset key: ${label} must not contain a NUL byte`);
	}
}

function assertValidKey(key: AssetKey): void {
	assertSafeSegment(key.internalPublicationId, "internalPublicationId");
	assertSafeSegment(key.assetVersion, "assetVersion");
	if (!ALLOWED_FILENAMES.has(key.filename)) {
		throw new Error(`Invalid asset key: unsupported filename "${key.filename}"`);
	}
}

// baseDir is the "comparisons" root itself (e.g. <cwd>/data/comparisons in
// production/dev, or a disposable temp directory in tests) — the mapping
// below does not re-add a "comparisons" path segment, avoiding
// data/comparisons/comparisons/... duplication.
function resolveAssetPath(baseDir: string, key: AssetKey): string {
	return join(
		baseDir,
		key.internalPublicationId,
		"versions",
		key.assetVersion,
		key.filename,
	);
}

export function createFilesystemAssetStorage(baseDir: string): AssetStorage {
	return {
		async put(key, data) {
			assertValidKey(key);
			const filePath = resolveAssetPath(baseDir, key);
			await mkdir(dirname(filePath), { recursive: true });
			await writeFile(filePath, data);
		},

		async get(key) {
			assertValidKey(key);
			const filePath = resolveAssetPath(baseDir, key);
			try {
				return await readFile(filePath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") {
					return null;
				}
				throw error;
			}
		},

		async delete(key) {
			assertValidKey(key);
			const filePath = resolveAssetPath(baseDir, key);
			await rm(filePath, { force: true });
		},
	};
}

// Default real base directory for non-test callers, resolved relative to
// the Hosted application's own working directory (matching the same
// process.cwd()-relative assumption hosted/src/db/client.ts and
// hosted/drizzle.config.ts already rely on for ".env"). Nothing in Phase 4
// calls createFilesystemAssetStorage(DEFAULT_ASSET_STORAGE_BASE_DIR) yet —
// this constant exists for later phases to use.
export const DEFAULT_ASSET_STORAGE_BASE_DIR = join(
	process.cwd(),
	"data",
	"comparisons",
);
