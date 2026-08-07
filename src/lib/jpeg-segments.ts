// Framework-independent JPEG marker segment parsing and rebuilding
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 8). This module has no knowledge of
// EXIF, XMP, IPTC or GPS — it only understands the JPEG marker-segment
// container itself: where each segment starts, what its payload bounds are,
// and how to reassemble a JPEG from an original buffer plus a set of
// per-segment payload replacements.
//
// Two real, independent callers exist: src/lib/jpeg-location-metadata.ts
// (the outer comparison image) and src/lib/exif-gps-removal.ts (an
// EXIF-embedded thumbnail JPEG, itself a complete nested SOI..EOI
// bitstream) — both need the identical marker-walk, which is why this is
// its own module rather than folded into either caller.
//
// Every byte from the SOS (start of scan) marker onward is always treated
// as opaque and copied verbatim by both `parseJpegSegments` (which never
// reads past it) and `rebuildJpeg` (which always copies it unchanged) — no
// compressed image data is ever decoded, inspected or re-encoded here.

const MARKER_PREFIX = 0xff;
const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const TEM = 0x01;
const RST_MIN = 0xd0;
const RST_MAX = 0xd7;

export interface JpegSegment {
	readonly marker: number;
	/** Offset of this segment's own leading 0xFF marker-prefix byte. */
	readonly start: number;
	readonly payloadStart: number;
	readonly payloadLength: number;
}

export type JpegParseError =
	| { readonly code: "not-a-jpeg" }
	| { readonly code: "truncated-segment" }
	| { readonly code: "segment-length-out-of-bounds" };

export type JpegParseResult =
	| {
			readonly ok: true;
			readonly segments: readonly JpegSegment[];
			readonly scanDataStart: number;
	  }
	| { readonly ok: false; readonly error: JpegParseError };

// Enumerates every marker segment from just after SOI up to (not including)
// SOS. Markers with no length field (TEM, RSTn) are skipped — none of them
// can legally carry EXIF/XMP/IPTC, so callers never need to see them.
// `scanDataStart` is the offset of the SOS marker's own leading 0xFF byte;
// everything from there to the end of `bytes` (scan data through EOI) is
// the caller's responsibility to copy verbatim.
export function parseJpegSegments(bytes: Uint8Array): JpegParseResult {
	if (bytes.length < 2) return { ok: false, error: { code: "not-a-jpeg" } };
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (view.getUint8(0) !== MARKER_PREFIX || view.getUint8(1) !== SOI) {
		return { ok: false, error: { code: "not-a-jpeg" } };
	}

	const segments: JpegSegment[] = [];
	let offset = 2;

	while (true) {
		if (offset >= bytes.length) {
			return { ok: false, error: { code: "truncated-segment" } };
		}
		if (view.getUint8(offset) !== MARKER_PREFIX) {
			return { ok: false, error: { code: "truncated-segment" } };
		}
		// Skip 0xFF fill bytes preceding the actual marker byte.
		let markerOffset = offset + 1;
		while (
			markerOffset < bytes.length &&
			view.getUint8(markerOffset) === MARKER_PREFIX
		) {
			markerOffset += 1;
		}
		if (markerOffset >= bytes.length) {
			return { ok: false, error: { code: "truncated-segment" } };
		}
		const marker = view.getUint8(markerOffset);
		const segmentStart = markerOffset - 1;

		if (marker === SOS) {
			return { ok: true, segments, scanDataStart: segmentStart };
		}
		if (marker === EOI) {
			// EOI before SOS is not a structure this feature needs to support.
			return { ok: false, error: { code: "truncated-segment" } };
		}
		if (marker === TEM || (marker >= RST_MIN && marker <= RST_MAX)) {
			offset = markerOffset + 1;
			continue;
		}

		const lengthOffset = markerOffset + 1;
		if (lengthOffset + 2 > bytes.length) {
			return { ok: false, error: { code: "truncated-segment" } };
		}
		const length = view.getUint16(lengthOffset, false);
		if (length < 2) {
			return { ok: false, error: { code: "segment-length-out-of-bounds" } };
		}
		const payloadStart = lengthOffset + 2;
		const payloadLength = length - 2;
		if (payloadStart + payloadLength > bytes.length) {
			return { ok: false, error: { code: "segment-length-out-of-bounds" } };
		}

		segments.push({ marker, start: segmentStart, payloadStart, payloadLength });
		offset = payloadStart + payloadLength;
	}
}

// Rebuilds a complete JPEG from `bytes`' own SOI and every segment in
// `segments` (in original order): a segment present in `payloadOverrides`
// (keyed by that segment's own `start`) is re-emitted with the override's
// bytes as its payload and a freshly computed 2-byte length field; every
// other segment is copied byte-for-byte unchanged. Everything from
// `scanDataStart` onward — scan data and EOI — is always copied verbatim.
//
// An override is never larger than the segment it replaces in this
// feature's actual call sites (EXIF removal is length-preserving; XMP and
// IPTC removal only ever remove bytes), and every original segment's own
// payload was already validated to fit the 16-bit JPEG length field by
// `parseJpegSegments` — so the recomputed length field below can never
// overflow in practice; this is an invariant of the callers, not something
// this generic rebuild function re-derives on its own.
export function rebuildJpeg(
	bytes: Uint8Array,
	scanDataStart: number,
	segments: readonly JpegSegment[],
	payloadOverrides: ReadonlyMap<number, Uint8Array>,
): Uint8Array {
	const parts: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI

	for (const segment of segments) {
		const override = payloadOverrides.get(segment.start);
		if (override === undefined) {
			parts.push(
				bytes.subarray(
					segment.start,
					segment.payloadStart + segment.payloadLength,
				),
			);
			continue;
		}
		const length = override.length + 2;
		const header = new Uint8Array(4);
		new DataView(header.buffer).setUint16(2, length, false);
		header[0] = MARKER_PREFIX;
		header[1] = segment.marker;
		parts.push(header, override);
	}

	parts.push(bytes.subarray(scanDataStart));

	const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
	const output = new Uint8Array(totalLength);
	let writeOffset = 0;
	for (const part of parts) {
		output.set(part, writeOffset);
		writeOffset += part.length;
	}
	return output;
}
