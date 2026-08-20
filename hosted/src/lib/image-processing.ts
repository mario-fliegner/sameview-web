import sharp from "sharp";
import type { Metadata, OutputInfo } from "sharp";

// Server-side processing pipeline for the two core Hosted Comparison
// images (capture.jpg/reference.jpg) — see docs/ARCHITECTURE.md "Image
// Limits", "Upload and Processing"; docs/DATA_AND_PRIVACY.md "Image
// Processing (Hosted Publication)", "Size and Processing Constraints".
// Pure Buffer-in/Buffer-out: no filesystem, no AssetStorage/TempStorage,
// no API route — see Phase 5's own "pure processing pipeline" objective.
//
// The Hosted publishing client (Android, later Web) always sends JPEG for
// these two files (docs/DATA_AND_PRIVACY.md "Hosted Source Images"); the
// server independently validates actual decoded content — never the
// filename/extension/claimed MIME — and never trusts any client-side
// processing already performed (docs/ARCHITECTURE.md "Upload and
// Processing").

export interface ProcessedImage {
	data: Buffer;
	width: number;
	height: number;
	contentType: "image/webp";
}

export type ProcessingError =
	| { code: "input-too-large" }
	| { code: "unsupported-format"; detectedFormat: string | null }
	| { code: "undecodable-image" }
	| { code: "dimensions-too-large"; width: number; height: number }
	| { code: "pixel-count-too-large"; width: number; height: number }
	| { code: "output-too-large"; bytes: number };

export type ProcessingResult =
	| { ok: true; value: ProcessedImage }
	| { ok: false; error: ProcessingError };

export const CORE_MAX_INPUT_BYTES = 20_000_000;
export const CORE_MAX_PIXELS = 40_000_000;
export const CORE_MAX_DIMENSION = 8000;
export const CORE_OUTPUT_MAX_LONG_EDGE = 1920;
export const CORE_OUTPUT_QUALITY = 80;
export const CORE_OUTPUT_MAX_BYTES = 350_000;

export async function processCoreImage(
	buffer: Buffer,
): Promise<ProcessingResult> {
	// Byte-size guard — rejected before any bytes are handed to sharp at all.
	if (buffer.byteLength > CORE_MAX_INPUT_BYTES) {
		return { ok: false, error: { code: "input-too-large" } };
	}

	// limitInputPixels is deliberately left at sharp's own generous default
	// (~268M px, comfortably above any legitimate 8000x8000-bounded input)
	// rather than the tighter approved 40M-pixel limit: sharp enforces
	// limitInputPixels during metadata() itself (verified empirically —
	// it throws "Input image exceeds pixel limit" before dimensions are
	// ever readable), which would make an accurate pixel-count-too-large
	// error (including the actual width/height) impossible to report. The
	// default still acts as an outer safety net against a truly pathological
	// header; the approved 40M-pixel/8000px limits are enforced precisely,
	// with accurate reporting, by the explicit check below — before
	// rotate()/resize()/toBuffer() (the actually expensive operations) ever
	// run, which is what "reject before attempting decode" means in
	// practice for a cheap, header-only metadata() read.
	const pipeline = sharp(buffer, { failOn: "warning" });

	let metadata: Metadata;
	try {
		metadata = await pipeline.metadata();
	} catch {
		return { ok: false, error: { code: "undecodable-image" } };
	}

	if (metadata.format !== "jpeg") {
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

	if (width > CORE_MAX_DIMENSION || height > CORE_MAX_DIMENSION) {
		return { ok: false, error: { code: "dimensions-too-large", width, height } };
	}
	if (width * height > CORE_MAX_PIXELS) {
		return { ok: false, error: { code: "pixel-count-too-large", width, height } };
	}

	let outputBuffer: Buffer;
	let outputInfo: OutputInfo;
	try {
		const result = await pipeline
			// Auto-orient from the EXIF Orientation tag (applies it to pixel
			// data, then removes the tag) — required explicitly, since default
			// output already strips all metadata (including orientation)
			// regardless, and resize()/webp()/toBuffer() never auto-rotate on
			// their own.
			.rotate()
			.resize({
				width: CORE_OUTPUT_MAX_LONG_EDGE,
				height: CORE_OUTPUT_MAX_LONG_EDGE,
				fit: "inside",
				withoutEnlargement: true,
			})
			.webp({ quality: CORE_OUTPUT_QUALITY })
			// No .withMetadata() call: sharp's own documented default output
			// behavior strips all metadata (EXIF/XMP/IPTC/GPS/ICC).
			.toBuffer({ resolveWithObject: true });
		outputBuffer = result.data;
		outputInfo = result.info;
	} catch {
		return { ok: false, error: { code: "undecodable-image" } };
	}

	if (outputBuffer.byteLength > CORE_OUTPUT_MAX_BYTES) {
		return {
			ok: false,
			error: { code: "output-too-large", bytes: outputBuffer.byteLength },
		};
	}

	return {
		ok: true,
		value: {
			data: outputBuffer,
			width: outputInfo.width,
			height: outputInfo.height,
			contentType: "image/webp",
		},
	};
}
