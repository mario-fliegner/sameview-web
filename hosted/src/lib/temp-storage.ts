import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Temporary, non-public processing-area primitive — see
// docs/DATA_AND_PRIVACY.md "Temporary Processing Data". Structurally
// separate from AssetStorage (asset-storage.ts): no versioning semantics,
// keyed by a single opaque string rather than the structured AssetKey,
// stored under its own sibling base directory. Scheduled/stale-file
// cleanup is explicitly not implemented here — that belongs to Phase 10.

export interface TempStorage {
	put(key: string, data: Buffer): Promise<void>;
	get(key: string): Promise<Buffer | null>;
	delete(key: string): Promise<void>;
}

// Rejects an unsafe key rather than sanitizing/normalizing it — same rule
// set as asset-storage.ts's segment validation, applied to the single key.
function assertSafeKey(value: string): void {
	if (value.length === 0) {
		throw new Error("Invalid temp storage key: must not be empty");
	}
	if (value === "." || value === "..") {
		throw new Error('Invalid temp storage key: must not be "." or ".."');
	}
	if (value.includes("/") || value.includes("\\")) {
		throw new Error(
			"Invalid temp storage key: must not contain a path separator",
		);
	}
	if (value.includes("\0")) {
		throw new Error("Invalid temp storage key: must not contain a NUL byte");
	}
}

function resolveTempPath(baseDir: string, key: string): string {
	return join(baseDir, key);
}

export function createFilesystemTempStorage(baseDir: string): TempStorage {
	return {
		async put(key, data) {
			assertSafeKey(key);
			const filePath = resolveTempPath(baseDir, key);
			await mkdir(dirname(filePath), { recursive: true });
			await writeFile(filePath, data);
		},

		async get(key) {
			assertSafeKey(key);
			const filePath = resolveTempPath(baseDir, key);
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
			assertSafeKey(key);
			const filePath = resolveTempPath(baseDir, key);
			await rm(filePath, { force: true });
		},
	};
}

// Default real base directory for non-test callers — sibling to
// asset-storage.ts's DEFAULT_ASSET_STORAGE_BASE_DIR under the same data/
// root. Nothing in Phase 4 calls createFilesystemTempStorage(this) yet.
export const DEFAULT_TEMP_STORAGE_BASE_DIR = join(process.cwd(), "data", "tmp");
