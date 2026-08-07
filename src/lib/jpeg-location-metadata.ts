// Top-level Phase 8 JPEG entry point (docs/FEATURE_SPECIFICATION.md F-005
// "Remove Embedded Location Data"; docs/IMPLEMENTATION_PLAN_V1.md Phase 8).
// Walks the outer JPEG's own marker segments (src/lib/jpeg-segments.ts),
// sniffs each APP1/APP13 segment's payload prefix to identify EXIF, XMP or
// Photoshop/IPTC content, and delegates removal to the corresponding
// format-specific module. Every other segment — and everything from the
// SOS marker onward — passes through byte-for-byte unchanged.
//
// Parse-then-apply across the *whole image*, strictly: this function loops
// over every segment, calling the read-only-then-copy-once
// removeExifGpsLocation/removeXmpLocation/removeIptcLocation for each one
// that needs processing, and only ever *collects* each segment's own
// independent result into a local `payloadOverrides` map — it never builds
// or touches a combined "whole image" output buffer while that loop is
// still running. `rebuildJpeg` (the one place a full new image buffer is
// assembled) is called exactly once, only after every segment in the image
// has been successfully processed. If any segment fails, this function
// returns immediately; the original `bytes` are never touched, and no
// partially-assembled output is ever produced or returned.
//
// Browser-only overall, by contract, even though most of the work above
// this dispatch (JPEG segment walking, EXIF/TIFF, IPTC/IIM) is plain
// `DataView` logic with no browser dependency: the XMP path calls
// `removeXmpLocation`, which requires the native `DOMParser` — see that
// module's own header comment. Any JPEG with no XMP segment never reaches
// that code path, so plenty of coverage of this function is possible from
// Node (test/unit/jpeg-location-metadata.test.mjs); full coverage
// including the XMP dispatch requires Playwright
// (test/e2e/jpeg-location-metadata.spec.ts) — see
// docs/AI_ENGINEERING_GUIDE.md "Testing".

import {
	type ExifGpsRemovalError,
	removeExifGpsLocation,
} from "./exif-gps-removal.ts";
import {
	type IptcLocationRemovalError,
	removeIptcLocation,
} from "./iptc-location-removal.ts";
import { parseJpegSegments, rebuildJpeg } from "./jpeg-segments.ts";
import {
	removeXmpLocation,
	type XmpLocationRemovalError,
} from "./xmp-location-removal.ts";

const APP1_MARKER = 0xe1;
const APP13_MARKER = 0xed;
const EXIF_PREFIX = "Exif\0\0";
const XMP_PREFIX = "http://ns.adobe.com/xap/1.0/\0";
const PHOTOSHOP_PREFIX = "Photoshop 3.0\0";

export type LocationMetadataRemovalError =
	| { readonly code: "not-a-jpeg" }
	| { readonly code: "malformed-jpeg-structure" }
	| {
			readonly code: "exif-removal-failed";
			readonly error: ExifGpsRemovalError;
	  }
	| {
			readonly code: "xmp-removal-failed";
			readonly error: XmpLocationRemovalError;
	  }
	| {
			readonly code: "iptc-removal-failed";
			readonly error: IptcLocationRemovalError;
	  };

export type LocationMetadataRemovalResult =
	| { readonly ok: true; readonly bytes: Uint8Array }
	| { readonly ok: false; readonly error: LocationMetadataRemovalError };

function matchesAsciiPrefix(
	bytes: Uint8Array,
	payloadStart: number,
	payloadLength: number,
	prefix: string,
): boolean {
	if (payloadLength < prefix.length) return false;
	const slice = bytes.subarray(payloadStart, payloadStart + prefix.length);
	return String.fromCharCode(...slice) === prefix;
}

function prefixedPayload(prefix: string, bytes: Uint8Array): Uint8Array {
	const prefixBytes = new TextEncoder().encode(prefix);
	const combined = new Uint8Array(prefixBytes.length + bytes.length);
	combined.set(prefixBytes, 0);
	combined.set(bytes, prefixBytes.length);
	return combined;
}

export function removeEmbeddedLocationData(
	bytes: Uint8Array,
): LocationMetadataRemovalResult {
	const parseResult = parseJpegSegments(bytes);
	if (!parseResult.ok) {
		return {
			ok: false,
			error:
				parseResult.error.code === "not-a-jpeg"
					? { code: "not-a-jpeg" }
					: { code: "malformed-jpeg-structure" },
		};
	}
	const { segments, scanDataStart } = parseResult;

	// Plan phase: every segment needing processing is handled here, each
	// producing its own independent replacement payload; nothing is written
	// into a shared "whole image" buffer yet.
	const payloadOverrides = new Map<number, Uint8Array>();
	for (const segment of segments) {
		if (segment.marker === APP1_MARKER) {
			if (
				matchesAsciiPrefix(
					bytes,
					segment.payloadStart,
					segment.payloadLength,
					EXIF_PREFIX,
				)
			) {
				const tiffStart = segment.payloadStart + EXIF_PREFIX.length;
				const tiffBytes = bytes.subarray(
					tiffStart,
					segment.payloadStart + segment.payloadLength,
				);
				const result = removeExifGpsLocation(tiffBytes);
				if (!result.ok) {
					return {
						ok: false,
						error: { code: "exif-removal-failed", error: result.error },
					};
				}
				payloadOverrides.set(
					segment.start,
					prefixedPayload(EXIF_PREFIX, result.bytes),
				);
			} else if (
				matchesAsciiPrefix(
					bytes,
					segment.payloadStart,
					segment.payloadLength,
					XMP_PREFIX,
				)
			) {
				const xmpStart = segment.payloadStart + XMP_PREFIX.length;
				const xmpBytes = bytes.subarray(
					xmpStart,
					segment.payloadStart + segment.payloadLength,
				);
				const result = removeXmpLocation(xmpBytes);
				if (!result.ok) {
					return {
						ok: false,
						error: { code: "xmp-removal-failed", error: result.error },
					};
				}
				payloadOverrides.set(
					segment.start,
					prefixedPayload(XMP_PREFIX, result.bytes),
				);
			}
			// Any other APP1 payload is not EXIF or XMP and is passed through
			// unchanged — it cannot legally carry the location structures this
			// feature targets.
		} else if (segment.marker === APP13_MARKER) {
			if (
				matchesAsciiPrefix(
					bytes,
					segment.payloadStart,
					segment.payloadLength,
					PHOTOSHOP_PREFIX,
				)
			) {
				const payload = bytes.subarray(
					segment.payloadStart,
					segment.payloadStart + segment.payloadLength,
				);
				const result = removeIptcLocation(payload);
				if (!result.ok) {
					return {
						ok: false,
						error: { code: "iptc-removal-failed", error: result.error },
					};
				}
				payloadOverrides.set(segment.start, result.bytes);
			}
		}
	}

	// Apply phase: reached only after every segment above succeeded.
	return {
		ok: true,
		bytes: rebuildJpeg(bytes, scanDataStart, segments, payloadOverrides),
	};
}
