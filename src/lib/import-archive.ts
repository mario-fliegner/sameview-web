// Structural validation of a SameView export ZIP archive, per the archive
// rules in docs/ARCHITECTURE.md ("Upload Limits", "Export Structure"). This
// module answers only structural questions derivable from ZIP entry names
// and their declared (header) sizes: archive size, file count, uncompressed
// total size, nested ZIP entries, unsafe paths and duplicate paths.
//
// It deliberately does not decompress any entry content, parse metadata.json,
// or determine how many SameView sessions the archive contains — resolving
// "exactly one valid session" requires parsing each candidate session's
// metadata.json (via parseImportedMetadata in import-metadata.ts) and is the
// responsibility of the file/metadata resolution step that follows this one.
//
// Entry sizes are read from the ZIP central directory via zip.js'
// ZipReader#getEntries(), which does not decompress entry content — this is
// required so the uncompressed-size limit can reject an oversized archive
// before any decompression is attempted (see docs/ARCHITECTURE.md "Upload
// Limits": "Maximum uncompressed total size: 50 MB").
//
// Browser-safe: no Node, server, Astro or React API is used.

import {
	TextWriter,
	Uint8ArrayReader,
	Uint8ArrayWriter,
	ZipReader,
} from "@zip.js/zip.js";

export const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
export const MAX_ARCHIVE_FILE_COUNT = 20;
export const MAX_UNCOMPRESSED_TOTAL_BYTES = 50 * 1024 * 1024;

export interface ArchiveEntryInfo {
	readonly path: string;
	readonly uncompressedSize: number;
}

export type ArchiveValidationError =
	| { readonly code: "archive-too-large" }
	| { readonly code: "unreadable-archive" }
	| { readonly code: "too-many-files" }
	| { readonly code: "unsafe-entry-path"; readonly path: string }
	| { readonly code: "nested-archive-entry"; readonly path: string }
	| { readonly code: "duplicate-entry-path"; readonly path: string }
	| { readonly code: "uncompressed-total-too-large" };

export type ArchiveValidationResult =
	| { readonly ok: true; readonly entries: readonly ArchiveEntryInfo[] }
	| { readonly ok: false; readonly error: ArchiveValidationError };

// SameView export ZIPs never contain a nested ZIP entry (docs/ARCHITECTURE.md:
// "Nested archives are not allowed"). Detection is scoped to ZIP-in-ZIP only,
// by filename extension — no broader archive-format policy (JAR, RAR, 7z,
// etc.) is part of the product contract.
function isNestedZipEntry(path: string): boolean {
	return path.toLowerCase().endsWith(".zip");
}

function isSafeEntryPath(path: string): boolean {
	if (path.length === 0) return false;
	if (path.startsWith("/") || path.startsWith("\\")) return false;
	if (/^[A-Za-z]:[\\/]/.test(path)) return false;
	const segments = path.split(/[/\\]/);
	return !segments.some((segment) => segment === "." || segment === "..");
}

// Pure: operates only on already-extracted entry metadata (name + declared
// uncompressed size), so every rule is testable with plain literal arrays,
// without needing a real ZIP file for most cases.
export function validateArchiveEntries(
	entries: readonly ArchiveEntryInfo[],
): ArchiveValidationResult {
	if (entries.length > MAX_ARCHIVE_FILE_COUNT) {
		return { ok: false, error: { code: "too-many-files" } };
	}

	const seenPaths = new Set<string>();
	let uncompressedTotal = 0;

	for (const entry of entries) {
		if (!isSafeEntryPath(entry.path)) {
			return {
				ok: false,
				error: { code: "unsafe-entry-path", path: entry.path },
			};
		}
		if (isNestedZipEntry(entry.path)) {
			return {
				ok: false,
				error: { code: "nested-archive-entry", path: entry.path },
			};
		}
		if (seenPaths.has(entry.path)) {
			return {
				ok: false,
				error: { code: "duplicate-entry-path", path: entry.path },
			};
		}
		seenPaths.add(entry.path);
		uncompressedTotal += entry.uncompressedSize;
	}

	if (uncompressedTotal > MAX_UNCOMPRESSED_TOTAL_BYTES) {
		return { ok: false, error: { code: "uncompressed-total-too-large" } };
	}

	return { ok: true, entries };
}

// Thin adapter: reads real ZIP bytes into the same ArchiveEntryInfo shape
// validateArchiveEntries operates on, using only central-directory metadata
// (no entry content is decompressed). Directory entries are excluded — the
// SameView Android exporter never writes them (confirmed against
// SessionBackupExporter.kt), and they carry no uncompressed size of their own.
export async function validateArchive(
	zipBytes: Uint8Array,
): Promise<ArchiveValidationResult> {
	if (zipBytes.byteLength > MAX_ARCHIVE_BYTES) {
		return { ok: false, error: { code: "archive-too-large" } };
	}

	let entries: ArchiveEntryInfo[];
	try {
		const reader = new ZipReader(new Uint8ArrayReader(zipBytes));
		const rawEntries = await reader.getEntries();
		await reader.close();
		entries = rawEntries
			.filter((entry) => !entry.directory)
			.map((entry) => ({
				path: entry.filename,
				uncompressedSize: entry.uncompressedSize,
			}));
	} catch {
		return { ok: false, error: { code: "unreadable-archive" } };
	}

	return validateArchiveEntries(entries);
}

// Decompresses and returns exactly one named entry's content as UTF-8 text —
// used by the file/metadata resolution step to read a candidate session's
// metadata.json without decompressing anything else in the archive. Returns
// undefined if no entry with that exact path exists.
export async function readEntryText(
	zipBytes: Uint8Array,
	path: string,
): Promise<string | undefined> {
	const reader = new ZipReader(new Uint8ArrayReader(zipBytes));
	try {
		const entries = await reader.getEntries();
		const entry = entries.find((e) => !e.directory && e.filename === path);
		if (!entry || entry.directory) return undefined;
		return await entry.getData(new TextWriter());
	} finally {
		await reader.close();
	}
}

// Decompresses and returns exactly one named entry's raw content bytes —
// used to hand a resolved image file (e.g. reference.jpg) to browser-side
// decode validation (src/lib/import-image.ts). Returns undefined if no entry
// with that exact path exists.
export async function readEntryBytes(
	zipBytes: Uint8Array,
	path: string,
): Promise<Uint8Array | undefined> {
	const reader = new ZipReader(new Uint8ArrayReader(zipBytes));
	try {
		const entries = await reader.getEntries();
		const entry = entries.find((e) => !e.directory && e.filename === path);
		if (!entry || entry.directory) return undefined;
		return await entry.getData(new Uint8ArrayWriter());
	} finally {
		await reader.close();
	}
}
