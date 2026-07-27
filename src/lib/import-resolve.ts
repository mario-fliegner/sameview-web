// Resolves a structurally-validated archive (src/lib/import-archive.ts) into
// exactly one valid SameView session and its files, per Phase 2 sub-step 3
// of docs/IMPLEMENTATION_PLAN_V1.md: "resolve exactly one referenced
// reference file and capture file plus accepted optional files."
//
// Rules applied here, and their evidence:
// - A candidate session directory is one that contains a `metadata.json`
//   entry; it is valid only if that metadata.json parses successfully via
//   parseImportedMetadata AND, when its resolved sessionId is present, it
//   matches the directory name — mirroring the Android project's own
//   forward-compatibility guidance for future importers
//   (SESSION_BACKUP_EXPORT_V1.md §11.1: "Verify that session.id matches the
//   subdirectory name; skip on mismatch").
// - More than one valid session directory is rejected (docs/ARCHITECTURE.md,
//   docs/IMPORTED_COMPARISON_V1.md "Session Identity").
// - The required `files.reference`/`files.capture` must exist as actual
//   archive entries within the one valid session directory.
// - Optional files (`files.referenceOriginal`, `files.captureOriginal`,
//   `files.referenceSourceOriginal`, `files.brandingHandle`) are resolved
//   only when both declared and actually present; a declared-but-missing
//   optional file is tolerated, not an import failure — confirmed against
//   the real Android reader (SessionScannerTest.kt:
//   v2_referenceOriginalMissing_sessionIsStillVisible).
//
// Browser-safe: no Node, server, Astro or React API is used.

import type { ArchiveEntryInfo } from "./import-archive.ts";
import { readEntryText } from "./import-archive.ts";
import type {
	ImportedMetadataError,
	ImportedMetadataResult,
	ResolvedImportedMetadata,
} from "./import-metadata.ts";
import { parseImportedMetadata } from "./import-metadata.ts";

export interface ResolvedSession {
	readonly sessionDirectory: string;
	readonly metadata: ResolvedImportedMetadata;
	readonly referenceFilePath: string;
	readonly captureFilePath: string;
	readonly referenceOriginalFilePath: string | undefined;
	readonly captureOriginalFilePath: string | undefined;
	readonly referenceSourceOriginalFilePath: string | undefined;
	readonly brandingHandleFilePath: string | undefined;
}

export type ImportResolutionError =
	| { readonly code: "no-session-found" }
	| {
			readonly code: "invalid-session-metadata";
			readonly sessionDirectory: string;
			readonly metadataError: ImportedMetadataError;
	  }
	| {
			readonly code: "multiple-session-directories";
			readonly directories: readonly string[];
	  }
	| {
			readonly code: "missing-reference-file";
			readonly sessionDirectory: string;
			readonly path: string;
	  }
	| {
			readonly code: "missing-capture-file";
			readonly sessionDirectory: string;
			readonly path: string;
	  };

export type ImportResolutionResult =
	| { readonly ok: true; readonly value: ResolvedSession }
	| { readonly ok: false; readonly error: ImportResolutionError };

export interface SessionCandidate {
	readonly directory: string;
	readonly metadataResult: ImportedMetadataResult;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDeclaredFile(
	raw: Record<string, unknown>,
	key: string,
): string | undefined {
	const filesBlock = raw.files;
	if (!isPlainObject(filesBlock)) return undefined;
	const value = filesBlock[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveOptionalFile(
	entryPaths: ReadonlySet<string>,
	sessionDirectory: string,
	raw: Record<string, unknown>,
	key: string,
): string | undefined {
	const declared = getDeclaredFile(raw, key);
	if (declared === undefined) return undefined;
	const fullPath = `${sessionDirectory}/${declared}`;
	return entryPaths.has(fullPath) ? fullPath : undefined;
}

// Pure: takes already-parsed candidates (no ZIP/decompression involved), so
// every valid-count and file-resolution rule is testable with plain literal
// data. The real-archive orchestration that produces `candidates` is
// resolveImportedSession, below.
export function resolveSessionFromCandidates(
	candidates: readonly SessionCandidate[],
	entries: readonly ArchiveEntryInfo[],
): ImportResolutionResult {
	const valid = candidates.filter(
		(candidate) =>
			candidate.metadataResult.ok &&
			(candidate.metadataResult.value.sessionId === undefined ||
				candidate.metadataResult.value.sessionId === candidate.directory),
	);

	if (valid.length === 0) {
		const onlyCandidate = candidates.length === 1 ? candidates[0] : undefined;
		if (onlyCandidate && !onlyCandidate.metadataResult.ok) {
			return {
				ok: false,
				error: {
					code: "invalid-session-metadata",
					sessionDirectory: onlyCandidate.directory,
					metadataError: onlyCandidate.metadataResult.error,
				},
			};
		}
		return { ok: false, error: { code: "no-session-found" } };
	}

	if (valid.length > 1) {
		return {
			ok: false,
			error: {
				code: "multiple-session-directories",
				directories: valid.map((candidate) => candidate.directory),
			},
		};
	}

	const session = valid[0];
	if (!session?.metadataResult.ok) {
		return { ok: false, error: { code: "no-session-found" } };
	}
	const { directory, metadataResult } = session;
	const metadata = metadataResult.value;
	const entryPaths = new Set(entries.map((entry) => entry.path));

	const referenceFilePath = `${directory}/${metadata.referenceFile}`;
	if (!entryPaths.has(referenceFilePath)) {
		return {
			ok: false,
			error: {
				code: "missing-reference-file",
				sessionDirectory: directory,
				path: referenceFilePath,
			},
		};
	}

	const captureFilePath = `${directory}/${metadata.captureFile}`;
	if (!entryPaths.has(captureFilePath)) {
		return {
			ok: false,
			error: {
				code: "missing-capture-file",
				sessionDirectory: directory,
				path: captureFilePath,
			},
		};
	}

	return {
		ok: true,
		value: {
			sessionDirectory: directory,
			metadata,
			referenceFilePath,
			captureFilePath,
			referenceOriginalFilePath: resolveOptionalFile(
				entryPaths,
				directory,
				metadata.raw,
				"referenceOriginal",
			),
			captureOriginalFilePath: resolveOptionalFile(
				entryPaths,
				directory,
				metadata.raw,
				"captureOriginal",
			),
			referenceSourceOriginalFilePath: resolveOptionalFile(
				entryPaths,
				directory,
				metadata.raw,
				"referenceSourceOriginal",
			),
			brandingHandleFilePath: resolveOptionalFile(
				entryPaths,
				directory,
				metadata.raw,
				"brandingHandle",
			),
		},
	};
}

function topLevelDirectory(path: string): string | undefined {
	const slashIndex = path.indexOf("/");
	return slashIndex > 0 ? path.slice(0, slashIndex) : undefined;
}

function discoverCandidateDirectories(
	entries: readonly ArchiveEntryInfo[],
): string[] {
	const directories = new Set<string>();
	for (const entry of entries) {
		const dir = topLevelDirectory(entry.path);
		if (dir !== undefined) directories.add(dir);
	}
	const entryPaths = new Set(entries.map((entry) => entry.path));
	return [...directories].filter((dir) =>
		entryPaths.has(`${dir}/metadata.json`),
	);
}

// Real-archive orchestrator: discovers candidate session directories from
// already-validated archive entries, reads and parses each candidate's real
// metadata.json, then delegates to the pure resolver above.
export async function resolveImportedSession(
	zipBytes: Uint8Array,
	entries: readonly ArchiveEntryInfo[],
): Promise<ImportResolutionResult> {
	const candidateDirectories = discoverCandidateDirectories(entries);

	const candidates: SessionCandidate[] = [];
	for (const directory of candidateDirectories) {
		const text = await readEntryText(zipBytes, `${directory}/metadata.json`);
		const metadataResult: ImportedMetadataResult =
			text === undefined
				? { ok: false, error: { code: "malformed-json" } }
				: parseImportedMetadata(text);
		candidates.push({ directory, metadataResult });
	}

	return resolveSessionFromCandidates(candidates, entries);
}
