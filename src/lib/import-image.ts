// Content-based image validation for the required reference/capture files,
// per docs/ARCHITECTURE.md "Image Limits": "Files must be decoded and
// validated based on their actual content; file extension and browser-
// supplied MIME type alone are not sufficient" and "Maximum resolution per
// processed file: 40 megapixels".
//
// This module only decodes and measures — it performs no re-encoding,
// resizing, or metadata stripping (that is Phase 8 / docs/IMPLEMENTATION_PLAN_V1.md
// Phase 8, out of scope here).
//
// Browser-only by necessity: createImageBitmap has no Node equivalent, so
// this module cannot be covered by the Node test runner — see
// test/e2e/import-pipeline.spec.ts for its coverage.

export const MAX_IMAGE_PIXELS = 40_000_000;

export type ImageValidationError =
	| { readonly code: "undecodable-image" }
	| {
			readonly code: "image-too-large";
			readonly width: number;
			readonly height: number;
	  };

export type ImageValidationResult =
	| { readonly ok: true; readonly width: number; readonly height: number }
	| { readonly ok: false; readonly error: ImageValidationError };

export async function validateImageContent(
	bytes: Uint8Array,
): Promise<ImageValidationResult> {
	let bitmap: ImageBitmap;
	try {
		// The cast works around Uint8Array's ArrayBufferLike generic (which
		// includes SharedArrayBuffer) not structurally matching BlobPart; the
		// bytes handled here are always a plain ArrayBuffer-backed view.
		bitmap = await createImageBitmap(new Blob([bytes as unknown as BlobPart]));
	} catch {
		return { ok: false, error: { code: "undecodable-image" } };
	}

	const { width, height } = bitmap;
	bitmap.close();

	if (width * height > MAX_IMAGE_PIXELS) {
		return { ok: false, error: { code: "image-too-large", width, height } };
	}

	return { ok: true, width, height };
}
