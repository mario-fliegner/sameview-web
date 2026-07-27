// Pure, client-safe parsing and validation of a SameView `metadata.json`
// import against the Version 1 import contract defined in
// docs/IMPORTED_COMPARISON_V1.md. Resolves the import-critical values
// (capture timestamp, reference/capture file declarations) using the
// documented current-field-before-legacy-fallback rules. The original
// parsed object is returned unchanged, alongside the resolved values, so
// nothing is rewritten, normalized or discarded.
//
// Session identity is deliberately not resolved or required here: it is
// authoritatively the archive/session directory name, a ZIP-resolution-level
// concern, not a metadata-parsing-level one (see "Session Identity" in
// docs/IMPORTED_COMPARISON_V1.md). The optional `session.id` / `sessionId`
// value is still exposed when present, for later cross-checking.
//
// No Node, browser, server or framework API is used, so this module is safe
// to import from later browser-side import code.

export type SupportedMetadataVersion = 2 | 3 | 4 | 5 | 6;

export interface ResolvedImportedMetadata {
	readonly version: SupportedMetadataVersion;
	/** Informational only; not validated. See module-level comment. */
	readonly sessionId: string | undefined;
	readonly captureTimestampMs: number;
	readonly referenceFile: string;
	readonly captureFile: string;
	/** The complete parsed metadata object, including all unknown fields. */
	readonly raw: Record<string, unknown>;
}

export type ImportedMetadataError =
	| { readonly code: "malformed-json" }
	| { readonly code: "root-not-object" }
	| { readonly code: "missing-version" }
	| { readonly code: "invalid-version-type" }
	| { readonly code: "unsupported-version" }
	| { readonly code: "invalid-capture-timestamp" }
	| { readonly code: "invalid-reference-file" }
	| { readonly code: "invalid-capture-file" };

export type ImportedMetadataResult =
	| { readonly ok: true; readonly value: ResolvedImportedMetadata }
	| { readonly ok: false; readonly error: ImportedMetadataError };

const SUPPORTED_VERSIONS: ReadonlySet<number> = new Set([2, 3, 4, 5, 6]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedString(
	root: Record<string, unknown>,
	blockKey: string,
	fieldKey: string,
): string | undefined {
	const block = root[blockKey];
	if (!isPlainObject(block)) return undefined;
	const value = block[fieldKey];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNestedNumber(
	root: Record<string, unknown>,
	blockKey: string,
	fieldKey: string,
): number | undefined {
	const block = root[blockKey];
	if (!isPlainObject(block)) return undefined;
	const value = block[fieldKey];
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function getTopLevelString(
	root: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = root[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

// Confirmed directly against the SameView Android source (not inferred):
// `SessionStorage.kt` writes `put("version", METADATA_VERSION)` and
// `SessionScanner.kt` reads `json.getInt("version")` — a top-level integer
// field named `version`, not `metadataVersion`.
function readDeclaredVersion(raw: Record<string, unknown>): unknown {
	return raw.version;
}

function isSupportedMetadataVersion(
	value: number,
): value is SupportedMetadataVersion {
	return Number.isInteger(value) && SUPPORTED_VERSIONS.has(value);
}

// Informational only — see module-level comment. Mirrors the fields the
// Android writer produces (`session.id` from schema version 5 onward;
// flat `sessionId` is undocumented in the current Android reader but
// exposed here defensively) without requiring either to be present.
function resolveSessionId(raw: Record<string, unknown>): string | undefined {
	return (
		getNestedString(raw, "session", "id") ?? getTopLevelString(raw, "sessionId")
	);
}

// Confirmed directly against `SessionScanner.kt`: the fallback for a missing
// or invalid `capture.timestampMs` is the nested `session.createdAtMs`, not
// a flat `sessionTimestampMs` field (which the current Android reader does
// not read anywhere).
function resolveCaptureTimestampMs(
	raw: Record<string, unknown>,
): number | undefined {
	return (
		getNestedNumber(raw, "capture", "timestampMs") ??
		getNestedNumber(raw, "session", "createdAtMs")
	);
}

// `files.reference`/`files.capture` are confirmed required and read as the
// only form by the Android reader across all supported versions (2–6). The
// flat fallback is not exercised by the current Android reader or its test
// suite; it is retained here only as unconfirmed, defensive tolerance.
function resolveReferenceFile(
	raw: Record<string, unknown>,
): string | undefined {
	return (
		getNestedString(raw, "files", "reference") ??
		getTopLevelString(raw, "referenceFile")
	);
}

function resolveCaptureFile(raw: Record<string, unknown>): string | undefined {
	return (
		getNestedString(raw, "files", "capture") ??
		getTopLevelString(raw, "captureFile")
	);
}

export function parseImportedMetadata(
	jsonText: string,
): ImportedMetadataResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		return { ok: false, error: { code: "malformed-json" } };
	}

	if (!isPlainObject(parsed)) {
		return { ok: false, error: { code: "root-not-object" } };
	}
	const raw = parsed;

	const declaredVersion = readDeclaredVersion(raw);
	if (declaredVersion === undefined) {
		return { ok: false, error: { code: "missing-version" } };
	}
	if (
		typeof declaredVersion !== "number" ||
		!Number.isFinite(declaredVersion)
	) {
		return { ok: false, error: { code: "invalid-version-type" } };
	}
	if (!isSupportedMetadataVersion(declaredVersion)) {
		return { ok: false, error: { code: "unsupported-version" } };
	}

	const captureTimestampMs = resolveCaptureTimestampMs(raw);
	if (captureTimestampMs === undefined) {
		return { ok: false, error: { code: "invalid-capture-timestamp" } };
	}

	const referenceFile = resolveReferenceFile(raw);
	if (referenceFile === undefined) {
		return { ok: false, error: { code: "invalid-reference-file" } };
	}

	const captureFile = resolveCaptureFile(raw);
	if (captureFile === undefined) {
		return { ok: false, error: { code: "invalid-capture-file" } };
	}

	return {
		ok: true,
		value: {
			version: declaredVersion,
			sessionId: resolveSessionId(raw),
			captureTimestampMs,
			referenceFile,
			captureFile,
			raw,
		},
	};
}
