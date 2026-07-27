// Orchestrates the existing import pipeline (archive structural validation,
// session/file resolution, content-based image validation) into one
// immutable SourceData value, per docs/FEATURE_SPECIFICATION.md F-001 steps
// 3-8 and docs/IMPORTED_COMPARISON_V1.md Import Validity. A workspace must
// only be created from a complete, valid SourceData — see
// src/lib/workspace-state.ts.
//
// The image validator is an injectable dependency so this orchestration's
// sequencing and error propagation is Node-testable without a browser; the
// real, browser-only validateImageContent (src/lib/import-image.ts) is used
// by default and is what actually runs in the application and in Playwright.

import type { ArchiveValidationError } from "./import-archive.ts";
import { readEntryBytes, validateArchive } from "./import-archive.ts";
import type {
	ImageValidationError,
	ImageValidationResult,
} from "./import-image.ts";
import { validateImageContent } from "./import-image.ts";
import type { ImportResolutionError } from "./import-resolve.ts";
import { resolveImportedSession } from "./import-resolve.ts";
import type { SourceData } from "./workspace-state.ts";

export type CreateSourceDataError =
	| { readonly code: "archive-invalid"; readonly error: ArchiveValidationError }
	| {
			readonly code: "resolution-failed";
			readonly error: ImportResolutionError;
	  }
	| { readonly code: "file-read-failed"; readonly path: string }
	| {
			readonly code: "reference-image-invalid";
			readonly error: ImageValidationError;
	  }
	| {
			readonly code: "capture-image-invalid";
			readonly error: ImageValidationError;
	  };

export type CreateSourceDataResult =
	| { readonly ok: true; readonly value: SourceData }
	| { readonly ok: false; readonly error: CreateSourceDataError };

export interface CreateSourceDataDeps {
	readonly validateImage: (bytes: Uint8Array) => Promise<ImageValidationResult>;
}

const defaultDeps: CreateSourceDataDeps = {
	validateImage: validateImageContent,
};

export async function createSourceDataFromZip(
	zipBytes: Uint8Array,
	deps: CreateSourceDataDeps = defaultDeps,
): Promise<CreateSourceDataResult> {
	const archiveResult = await validateArchive(zipBytes);
	if (!archiveResult.ok) {
		return {
			ok: false,
			error: { code: "archive-invalid", error: archiveResult.error },
		};
	}

	const sessionResult = await resolveImportedSession(
		zipBytes,
		archiveResult.entries,
	);
	if (!sessionResult.ok) {
		return {
			ok: false,
			error: { code: "resolution-failed", error: sessionResult.error },
		};
	}
	const session = sessionResult.value;

	const referenceBytes = await readEntryBytes(
		zipBytes,
		session.referenceFilePath,
	);
	if (!referenceBytes) {
		return {
			ok: false,
			error: { code: "file-read-failed", path: session.referenceFilePath },
		};
	}
	const captureBytes = await readEntryBytes(zipBytes, session.captureFilePath);
	if (!captureBytes) {
		return {
			ok: false,
			error: { code: "file-read-failed", path: session.captureFilePath },
		};
	}

	const referenceImage = await deps.validateImage(referenceBytes);
	if (!referenceImage.ok) {
		return {
			ok: false,
			error: { code: "reference-image-invalid", error: referenceImage.error },
		};
	}
	const captureImage = await deps.validateImage(captureBytes);
	if (!captureImage.ok) {
		return {
			ok: false,
			error: { code: "capture-image-invalid", error: captureImage.error },
		};
	}

	// Optional files: resolved only when resolveImportedSession already
	// confirmed they exist as entries; a decompression failure here is
	// tolerated as absence, matching the established tolerance for optional
	// files (see src/lib/import-resolve.ts).
	const referenceOriginalBytes = session.referenceOriginalFilePath
		? await readEntryBytes(zipBytes, session.referenceOriginalFilePath)
		: undefined;
	const captureOriginalBytes = session.captureOriginalFilePath
		? await readEntryBytes(zipBytes, session.captureOriginalFilePath)
		: undefined;
	const referenceSourceOriginalBytes = session.referenceSourceOriginalFilePath
		? await readEntryBytes(zipBytes, session.referenceSourceOriginalFilePath)
		: undefined;
	const brandingHandleBytes = session.brandingHandleFilePath
		? await readEntryBytes(zipBytes, session.brandingHandleFilePath)
		: undefined;

	return {
		ok: true,
		value: {
			sessionDirectory: session.sessionDirectory,
			metadata: session.metadata,
			files: {
				referenceBytes,
				captureBytes,
				referenceOriginalBytes,
				captureOriginalBytes,
				referenceSourceOriginalBytes,
				brandingHandleBytes,
			},
		},
	};
}
