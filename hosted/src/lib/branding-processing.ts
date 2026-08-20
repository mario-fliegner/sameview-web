import sharp from "sharp";
import type { Metadata, OutputInfo } from "sharp";
import type { ProcessedImage, ProcessingResult } from "./image-processing.ts";

// Server-side processing pipeline for optional Hosted custom branding —
// see docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md §25
// "Custom branding image".
//
// The canonical Hosted branding publication payload is always PNG, already
// normalized client-side to a 512x512 RGBA canvas (Android's
// BrandingNormalizer / src/lib/branding-image-normalize.ts's own mirrored
// algorithm) before it is ever part of a Publish/Update request — Hosted
// never receives an arbitrary, un-normalized user-picked source image for
// branding. Nevertheless the server independently validates and
// re-processes every submission — never trusting that a given client
// actually sent the expected canonical shape (docs/ARCHITECTURE.md
// "Upload and Processing": "it never trusts client-side processing").
// The 512x512 fit/upscale step below is this defensive re-normalization —
// a no-op in the expected common case, not a routine general-purpose
// resize workload.

export const BRANDING_MAX_INPUT_BYTES = 10_000_000;
export const BRANDING_MAX_PIXELS = 24_000_000;
export const BRANDING_MAX_DIMENSION = 8000;
export const BRANDING_OUTPUT_SIZE = 512;

export async function processBrandingImage(
	buffer: Buffer,
): Promise<ProcessingResult> {
	if (buffer.byteLength > BRANDING_MAX_INPUT_BYTES) {
		return { ok: false, error: { code: "input-too-large" } };
	}

	// See hosted/src/lib/image-processing.ts's identical comment: sharp's
	// limitInputPixels rejects during metadata() itself, before dimensions
	// are readable, which would make accurate pixel-count-too-large
	// reporting impossible. Left at sharp's own default; the approved
	// 24M-pixel/8000px limits are enforced precisely below.
	const pipeline = sharp(buffer, { failOn: "warning" });

	let metadata: Metadata;
	try {
		metadata = await pipeline.metadata();
	} catch {
		return { ok: false, error: { code: "undecodable-image" } };
	}

	if (metadata.format !== "png") {
		return {
			ok: false,
			error: {
				code: "unsupported-format",
				detectedFormat: metadata.format ?? null,
			},
		};
	}

	const { width, height } = metadata;
	if (width == null || height == null) {
		return { ok: false, error: { code: "undecodable-image" } };
	}

	if (width > BRANDING_MAX_DIMENSION || height > BRANDING_MAX_DIMENSION) {
		return { ok: false, error: { code: "dimensions-too-large", width, height } };
	}
	if (width * height > BRANDING_MAX_PIXELS) {
		return { ok: false, error: { code: "pixel-count-too-large", width, height } };
	}

	let outputBuffer: Buffer;
	let outputInfo: OutputInfo;
	try {
		const result = await pipeline
			.rotate()
			// Fit-to-canvas, centered, preserving aspect ratio, never cropped;
			// upscaling permitted (unlike core images) — mirrors
			// src/lib/branding-image-normalize.ts's existing, approved
			// algorithm exactly. Transparent background so a non-square source
			// gets transparent padding on its shorter axis, never a solid fill.
			.resize({
				width: BRANDING_OUTPUT_SIZE,
				height: BRANDING_OUTPUT_SIZE,
				fit: "contain",
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.webp({
				lossless: true,
				preset: "icon",
				effort: 6,
				exact: true,
			})
			// No .withMetadata() call: output is metadata-free by default.
			.toBuffer({ resolveWithObject: true });
		outputBuffer = result.data;
		outputInfo = result.info;
	} catch {
		return { ok: false, error: { code: "undecodable-image" } };
	}

	// No branding output-byte limit is specified anywhere in the approved
	// sources — only the 512x512 pixel-dimension bound applies (see
	// docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md §25).
	// Branding therefore never returns "output-too-large".

	const value: ProcessedImage = {
		data: outputBuffer,
		width: outputInfo.width,
		height: outputInfo.height,
		contentType: "image/webp",
	};
	return { ok: true, value };
}
