// Normalizes a Web-uploaded Custom Branding image (docs/FEATURE_SPECIFICATION.md
// F-004; docs/COMPARISON_PRESENTATION.md Part 2 "Handle") into the single,
// final branding asset — produced exactly once, then reused unchanged by
// every consumer (Preview, Fullscreen, BrandingDraft, Current Working
// State and, later, Outcome Snapshot / Standalone HTML).
//
// Mirrors the SameView Android app's own BrandingNormalizer
// (sameview/app/src/main/java/com/isardomains/sameview/branding/BrandingNormalizer.kt)
// algorithm exactly, so an imported Android branding-handle.png and a
// freshly normalized Web upload are the same asset shape: OUTPUT_SIZE ×
// OUTPUT_SIZE, transparent RGBA PNG, fit-scaled and centered, never
// cropped. That import path (src/lib/import-source-data.ts) never calls
// this module — an already-normalized, imported asset must reach the
// Current Working State byte-identical, never re-normalized (see
// src/lib/branding.ts's own header comment).
//
// Decodes the original exactly once. The same decoded ImageBitmap is used
// both to read actual pixel dimensions (the 40-megapixel check, reusing
// src/lib/import-image.ts's own MAX_IMAGE_PIXELS threshold rather than a
// second, independently chosen number) and as the drawImage source for the
// one-time resize — there is deliberately no second createImageBitmap call
// and this module's caller (src/components/BrandingSection.tsx) must not
// call src/lib/import-image.ts's validateImageContent for this same bytes
// value, which would decode the same original a second time.
//
// Privacy: the output is metadata-clean by construction, not by an
// additional stripping step. An ImageBitmap and a <canvas> 2D context both
// carry only decoded pixel data — no EXIF, GPS, XMP, IPTC or ICC profile
// segment from the source has any path into a canvas-drawn image or its
// re-encoded PNG. The exact same reasoning already documented for
// Android's Bitmap -> PNG round-trip (BrandingNormalizer.kt's own doc
// comment) applies unchanged here; no metadata library is introduced.
//
// Browser-only by necessity (createImageBitmap, <canvas>, no Node
// equivalent) — like src/lib/import-image.ts, this module cannot be
// covered by the Node test runner; see test/e2e/branding-normalization.spec.ts.

import { MAX_IMAGE_PIXELS } from "./import-image.ts";

// The normalized branding asset's fixed output dimension, both axes —
// identical to Android's BrandingNormalizer.OUTPUT_SIZE. Chosen for parity
// with the imported-Android asset shape, not derived from any Web-specific
// on-screen size (the Handle's rendered CSS size never scales with the
// Presentation Canvas — see src/lib/comparison-handle-geometry.ts — so a
// fixed target unrelated to viewport size is correct here, exactly as it
// is for Android).
export const BRANDING_OUTPUT_SIZE = 512;

export type BrandingImageNormalizationError =
	| { readonly code: "undecodable-image" }
	| {
			readonly code: "image-too-large";
			readonly width: number;
			readonly height: number;
	  }
	| { readonly code: "processing-failed" };

export type BrandingImageNormalizationResult =
	| { readonly ok: true; readonly bytes: Uint8Array }
	| { readonly ok: false; readonly error: BrandingImageNormalizationError };

// Normalizes `bytes` (an original Web upload) into a BRANDING_OUTPUT_SIZE ×
// BRANDING_OUTPUT_SIZE transparent RGBA PNG. `bytes` itself is never
// retained by this function beyond the single decode below; the caller is
// likewise expected not to retain it once normalization succeeds (see
// src/components/BrandingSection.tsx).
export async function normalizeBrandingImage(
	bytes: Uint8Array,
): Promise<BrandingImageNormalizationResult> {
	let bitmap: ImageBitmap;
	try {
		// `imageOrientation: "from-image"` applies the source's EXIF
		// orientation during this one decode (the direct Web equivalent of
		// Android's ImageDecoder, which does the same automatically) — no
		// separate orientation-reading step, no second decode.
		//
		// The cast works around Uint8Array's ArrayBufferLike generic (which
		// includes SharedArrayBuffer) not structurally matching BlobPart; the
		// bytes handled here are always a plain ArrayBuffer-backed view —
		// the identical cast already used in src/lib/import-image.ts.
		bitmap = await createImageBitmap(new Blob([bytes as unknown as BlobPart]), {
			imageOrientation: "from-image",
		});
	} catch {
		return { ok: false, error: { code: "undecodable-image" } };
	}

	// Post-orientation-correction dimensions — matches what
	// src/lib/import-image.ts's validateImageContent would have measured for
	// the same file, so the 40-megapixel limit (docs/ARCHITECTURE.md "Image
	// Limits") is enforced identically for this upload path without a
	// second decode to re-measure it.
	const { width, height } = bitmap;

	if (width * height > MAX_IMAGE_PIXELS) {
		bitmap.close();
		return { ok: false, error: { code: "image-too-large", width, height } };
	}

	try {
		const canvas = document.createElement("canvas");
		canvas.width = BRANDING_OUTPUT_SIZE;
		canvas.height = BRANDING_OUTPUT_SIZE;
		const context = canvas.getContext("2d");
		if (!context) {
			return { ok: false, error: { code: "processing-failed" } };
		}

		// Fit — preserves aspect ratio, centers the source, never crops.
		// Identical formula to Android's BrandingNormalizer.normalize().
		const scale = Math.min(
			BRANDING_OUTPUT_SIZE / width,
			BRANDING_OUTPUT_SIZE / height,
		);
		const scaledWidth = Math.max(1, Math.round(width * scale));
		const scaledHeight = Math.max(1, Math.round(height * scale));
		const left = (BRANDING_OUTPUT_SIZE - scaledWidth) / 2;
		const top = (BRANDING_OUTPUT_SIZE - scaledHeight) / 2;

		// A freshly created canvas is fully transparent (every pixel
		// 0,0,0,0) — never explicitly filled with a background color, so
		// existing source transparency is preserved and a non-square source
		// gets transparent margins on its shorter axis, never a solid fill.
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";
		context.drawImage(bitmap, left, top, scaledWidth, scaledHeight);

		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/png");
		});
		if (!blob) {
			return { ok: false, error: { code: "processing-failed" } };
		}

		const arrayBuffer = await blob.arrayBuffer();
		return { ok: true, bytes: new Uint8Array(arrayBuffer) };
	} catch {
		return { ok: false, error: { code: "processing-failed" } };
	} finally {
		bitmap.close();
	}
}
