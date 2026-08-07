// TIFF/EXIF GPS removal (docs/FEATURE_SPECIFICATION.md F-005 "Remove
// Embedded Location Data"). Operates on the TIFF blob that follows a JPEG
// APP1 segment's "Exif\0\0" prefix (src/lib/jpeg-location-metadata.ts
// extracts that blob and re-wraps the result — this module never sees the
// surrounding JPEG at all).
//
// Structures considered, per the approved Phase 8 scope:
// - IFD0's own GPSInfoIFDPointer (0x8825) — the spec-defined location.
// - The Exif SubIFD (via IFD0's ExifIFDPointer, 0x8769) — defensively
//   scanned for a non-conformant, stray GPSInfoIFDPointer.
// - IFD1 (the thumbnail IFD, chained via IFD0's own next-IFD offset) — can
//   legally carry its own GPSInfoIFDPointer.
// - An embedded JPEG thumbnail referenced by IFD1's JPEGInterchangeFormat/
//   JPEGInterchangeFormatLength (0x0201/0x0202) — itself a complete,
//   independent SOI..EOI JPEG bitstream that could carry its own nested
//   EXIF/GPS; scanned via src/lib/jpeg-segments.ts and, if it has its own
//   EXIF, via this same GPS-removal logic recursively. If the thumbnail
//   carries an APP1/XMP or APP13/IPTC segment instead — which would require
//   a variable-length splice inside a fixed-offset/fixed-length structure —
//   that is treated as "unsupported-nested-structure" rather than attempted.
// - IFD chaining beyond IFD0+IFD1, and thumbnail-of-thumbnail nesting
//   beyond one level, are both depth-capped: neither is meaningful for
//   JPEG/EXIF, and a file claiming either is treated as unsafe to process
//   rather than walked further.
// - Every offset (IFD, next-IFD, external TIFF value, thumbnail range) is
//   bounds-checked against the actual buffer; a visited-IFD-offset set
//   makes cyclic offsets structurally unable to loop.
//
// Parse-then-apply, strictly: `planTiffGpsRemoval` and everything it calls
// are pure, read-only functions that only ever compute *descriptions* of
// what would need zeroing (plain {start,length} ranges) — they never
// allocate or touch a working copy of the input bytes. Only after that
// entire read-only analysis succeeds for the whole TIFF structure (main
// IFDs, SubIFD, and any embedded thumbnail) does `removeExifGpsLocation`
// make the single copy and apply every zero range to it. No partially
// modified buffer can exist while a later structure is still being
// validated.
//
// Removal never changes the TIFF blob's own length: every GPS-bearing byte
// range is overwritten with zeros in place (never spliced out), so
// `Orientation` (0x0112) and every other IFD0/SubIFD/IFD1 entry stays at
// its original byte offset, untouched.

import { parseJpegSegments } from "./jpeg-segments.ts";

const GPS_INFO_IFD_POINTER = 0x8825;
const EXIF_IFD_POINTER = 0x8769;
const JPEG_INTERCHANGE_FORMAT = 0x0201;
const JPEG_INTERCHANGE_FORMAT_LENGTH = 0x0202;
const IFD_ENTRY_SIZE = 12;
// IFD0 + IFD1 is the entire chain meaningful for JPEG/EXIF; a file claiming
// a third chained IFD is non-conformant for this container.
const MAX_IFD_CHAIN_LENGTH = 2;
// A thumbnail-of-a-thumbnail is not a structure any real EXIF writer
// produces; capping recursion at one nested level bounds the work required
// for a deliberately crafted, deeply-nested input.
const MAX_THUMBNAIL_RECURSION_DEPTH = 1;

const EXIF_PREFIX = "Exif\0\0";

// TIFF 6.0 field type -> byte size of one value. An entry's total value
// size is `size * count`; when that exceeds 4 bytes it is stored at an
// external offset rather than inline in the entry's own value field.
const TIFF_TYPE_SIZES: ReadonlyMap<number, number> = new Map([
	[1, 1], // BYTE
	[2, 1], // ASCII
	[3, 2], // SHORT
	[4, 4], // LONG
	[5, 8], // RATIONAL
	[6, 1], // SBYTE
	[7, 1], // UNDEFINED
	[8, 2], // SSHORT
	[9, 4], // SLONG
	[10, 8], // SRATIONAL
	[11, 4], // FLOAT
	[12, 8], // DOUBLE
]);

export type ExifGpsRemovalError =
	| { readonly code: "malformed-tiff-header" }
	| { readonly code: "ifd-out-of-bounds" }
	| { readonly code: "ifd-cycle-detected" }
	| { readonly code: "ifd-chain-too-long" }
	| { readonly code: "gps-ifd-out-of-bounds" }
	| { readonly code: "unsupported-nested-structure" };

export type ExifGpsRemovalResult =
	| { readonly ok: true; readonly bytes: Uint8Array }
	| { readonly ok: false; readonly error: ExifGpsRemovalError };

interface ByteRange {
	readonly start: number;
	readonly length: number;
}

interface TiffContext {
	readonly view: DataView;
	readonly length: number;
	readonly littleEndian: boolean;
}

interface IfdEntry {
	readonly entryStart: number;
	readonly tag: number;
	readonly type: number;
	readonly count: number;
	readonly valueFieldOffset: number;
}

interface ParsedIfd {
	readonly entries: readonly IfdEntry[];
	readonly nextIfdOffset: number;
	readonly headerStart: number;
	readonly headerEnd: number;
}

type PlanResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: ExifGpsRemovalError };

function readTiffContext(
	tiffBytes: Uint8Array,
): PlanResult<TiffContext & { readonly ifd0Offset: number }> {
	if (tiffBytes.length < 8) {
		return { ok: false, error: { code: "malformed-tiff-header" } };
	}
	const view = new DataView(
		tiffBytes.buffer,
		tiffBytes.byteOffset,
		tiffBytes.byteLength,
	);
	const byteOrder = String.fromCharCode(view.getUint8(0), view.getUint8(1));
	let littleEndian: boolean;
	if (byteOrder === "II") littleEndian = true;
	else if (byteOrder === "MM") littleEndian = false;
	else return { ok: false, error: { code: "malformed-tiff-header" } };

	if (view.getUint16(2, littleEndian) !== 42) {
		return { ok: false, error: { code: "malformed-tiff-header" } };
	}
	const ifd0Offset = view.getUint32(4, littleEndian);
	if (ifd0Offset < 8 || ifd0Offset >= tiffBytes.length) {
		return { ok: false, error: { code: "malformed-tiff-header" } };
	}
	return {
		ok: true,
		value: { view, length: tiffBytes.length, littleEndian, ifd0Offset },
	};
}

function readIfd(
	ctx: TiffContext,
	ifdOffset: number,
	errorCode: ExifGpsRemovalError["code"],
): PlanResult<ParsedIfd> {
	if (ifdOffset < 0 || ifdOffset + 2 > ctx.length) {
		return { ok: false, error: { code: errorCode } };
	}
	const count = ctx.view.getUint16(ifdOffset, ctx.littleEndian);
	const entriesEnd = ifdOffset + 2 + count * IFD_ENTRY_SIZE;
	if (entriesEnd + 4 > ctx.length) {
		return { ok: false, error: { code: errorCode } };
	}
	const entries: IfdEntry[] = [];
	for (let i = 0; i < count; i += 1) {
		const entryStart = ifdOffset + 2 + i * IFD_ENTRY_SIZE;
		entries.push({
			entryStart,
			tag: ctx.view.getUint16(entryStart, ctx.littleEndian),
			type: ctx.view.getUint16(entryStart + 2, ctx.littleEndian),
			count: ctx.view.getUint32(entryStart + 4, ctx.littleEndian),
			valueFieldOffset: entryStart + 8,
		});
	}
	const nextIfdOffset = ctx.view.getUint32(entriesEnd, ctx.littleEndian);
	return {
		ok: true,
		value: {
			entries,
			nextIfdOffset,
			headerStart: ifdOffset,
			headerEnd: entriesEnd + 4,
		},
	};
}

// `null` means the value is stored inline in the entry's own 4-byte value
// field, so it has no separate external byte range of its own to zero.
function entryExternalValueRange(
	ctx: TiffContext,
	entry: IfdEntry,
): PlanResult<ByteRange | null> {
	const typeSize = TIFF_TYPE_SIZES.get(entry.type);
	if (typeSize === undefined) {
		// An unrecognized TIFF field type inside a GPS-related IFD means this
		// entry's true byte extent cannot be confidently determined — zeroing
		// the wrong span would risk either leaving GPS bytes behind or
		// corrupting unrelated data, so this fails rather than guesses.
		return { ok: false, error: { code: "gps-ifd-out-of-bounds" } };
	}
	const totalSize = typeSize * entry.count;
	if (totalSize <= 4) return { ok: true, value: null };
	const externalOffset = ctx.view.getUint32(
		entry.valueFieldOffset,
		ctx.littleEndian,
	);
	if (externalOffset < 0 || externalOffset + totalSize > ctx.length) {
		return { ok: false, error: { code: "gps-ifd-out-of-bounds" } };
	}
	return { ok: true, value: { start: externalOffset, length: totalSize } };
}

// The whole GPS IFD structure — its own header/entry bytes plus every
// entry's external value data — is zeroed, not merely unlinked from IFD0's
// pointer: an orphaned-but-still-present GPS IFD would still let a
// byte-scanning tool recover coordinates, which does not satisfy "remove".
function planGpsIfdRemoval(
	ctx: TiffContext,
	gpsIfdOffset: number,
): PlanResult<readonly ByteRange[]> {
	const ifdResult = readIfd(ctx, gpsIfdOffset, "gps-ifd-out-of-bounds");
	if (!ifdResult.ok) return ifdResult;
	const ifd = ifdResult.value;
	const ranges: ByteRange[] = [
		{ start: ifd.headerStart, length: ifd.headerEnd - ifd.headerStart },
	];
	for (const entry of ifd.entries) {
		const valueRange = entryExternalValueRange(ctx, entry);
		if (!valueRange.ok) return valueRange;
		if (valueRange.value) ranges.push(valueRange.value);
	}
	return { ok: true, value: ranges };
}

function isExifApp1(
	bytes: Uint8Array,
	payloadStart: number,
	payloadLength: number,
): boolean {
	if (payloadLength < EXIF_PREFIX.length) return false;
	const slice = bytes.subarray(payloadStart, payloadStart + EXIF_PREFIX.length);
	return String.fromCharCode(...slice) === EXIF_PREFIX;
}

// Scans an embedded EXIF thumbnail's own JPEG marker structure. Only a
// nested EXIF (which this function handles by recursing into
// `planTiffGpsRemoval`) is supported; a nested XMP or IPTC/Photoshop
// segment cannot be safely handled inside a fixed-offset/fixed-length
// embedded structure, so it is reported as unsupported rather than
// attempted.
function planEmbeddedThumbnailGpsRemoval(
	thumbBytes: Uint8Array,
	recursionDepth: number,
): PlanResult<readonly ByteRange[]> {
	const parseResult = parseJpegSegments(thumbBytes);
	if (!parseResult.ok) {
		return { ok: false, error: { code: "unsupported-nested-structure" } };
	}
	const ranges: ByteRange[] = [];
	for (const segment of parseResult.segments) {
		if (segment.marker === 0xe1) {
			if (isExifApp1(thumbBytes, segment.payloadStart, segment.payloadLength)) {
				const tiffStart = segment.payloadStart + EXIF_PREFIX.length;
				const nestedTiff = thumbBytes.subarray(
					tiffStart,
					segment.payloadStart + segment.payloadLength,
				);
				const nestedPlan = planTiffGpsRemoval(nestedTiff, recursionDepth);
				if (!nestedPlan.ok) return nestedPlan;
				for (const range of nestedPlan.value) {
					ranges.push({ start: tiffStart + range.start, length: range.length });
				}
			} else {
				// Any other APP1 payload (XMP, or anything unrecognized) inside a
				// thumbnail cannot be safely handled here.
				return { ok: false, error: { code: "unsupported-nested-structure" } };
			}
		} else if (segment.marker === 0xed) {
			return { ok: false, error: { code: "unsupported-nested-structure" } };
		}
	}
	return { ok: true, value: ranges };
}

function planTiffGpsRemoval(
	tiffBytes: Uint8Array,
	recursionDepth: number,
): PlanResult<readonly ByteRange[]> {
	const contextResult = readTiffContext(tiffBytes);
	if (!contextResult.ok) return contextResult;
	const ctx = contextResult.value;

	const ranges: ByteRange[] = [];
	const visited = new Set<number>();
	let chainLength = 0;
	let currentOffset: number | undefined = ctx.ifd0Offset;
	let isFirstIfd = true;

	while (currentOffset !== undefined) {
		if (visited.has(currentOffset)) {
			return { ok: false, error: { code: "ifd-cycle-detected" } };
		}
		chainLength += 1;
		if (chainLength > MAX_IFD_CHAIN_LENGTH) {
			return { ok: false, error: { code: "ifd-chain-too-long" } };
		}
		visited.add(currentOffset);

		const ifdResult = readIfd(ctx, currentOffset, "ifd-out-of-bounds");
		if (!ifdResult.ok) return ifdResult;
		const ifd = ifdResult.value;

		let subIfdOffset: number | undefined;
		let thumbnailOffset: number | undefined;
		let thumbnailLength: number | undefined;

		for (const entry of ifd.entries) {
			if (entry.tag === GPS_INFO_IFD_POINTER) {
				ranges.push({ start: entry.entryStart, length: IFD_ENTRY_SIZE });
				const gpsOffset = ctx.view.getUint32(
					entry.valueFieldOffset,
					ctx.littleEndian,
				);
				const gpsPlan = planGpsIfdRemoval(ctx, gpsOffset);
				if (!gpsPlan.ok) return gpsPlan;
				ranges.push(...gpsPlan.value);
			} else if (isFirstIfd && entry.tag === EXIF_IFD_POINTER) {
				subIfdOffset = ctx.view.getUint32(
					entry.valueFieldOffset,
					ctx.littleEndian,
				);
			} else if (!isFirstIfd && entry.tag === JPEG_INTERCHANGE_FORMAT) {
				thumbnailOffset = ctx.view.getUint32(
					entry.valueFieldOffset,
					ctx.littleEndian,
				);
			} else if (!isFirstIfd && entry.tag === JPEG_INTERCHANGE_FORMAT_LENGTH) {
				thumbnailLength = ctx.view.getUint32(
					entry.valueFieldOffset,
					ctx.littleEndian,
				);
			}
		}

		// Defensive, beyond-spec check: GPSInfoIFDPointer normatively belongs
		// in IFD0, but a non-conformant writer could place it in the Exif
		// SubIFD instead. A SubIFD that cannot itself be read is tolerated
		// silently here — the SubIFD is not otherwise required by this
		// feature, only defensively inspected for a stray GPS tag.
		if (isFirstIfd && subIfdOffset !== undefined) {
			const subIfdResult = readIfd(ctx, subIfdOffset, "ifd-out-of-bounds");
			if (subIfdResult.ok) {
				for (const entry of subIfdResult.value.entries) {
					if (entry.tag === GPS_INFO_IFD_POINTER) {
						ranges.push({ start: entry.entryStart, length: IFD_ENTRY_SIZE });
						const gpsOffset = ctx.view.getUint32(
							entry.valueFieldOffset,
							ctx.littleEndian,
						);
						const gpsPlan = planGpsIfdRemoval(ctx, gpsOffset);
						if (!gpsPlan.ok) return gpsPlan;
						ranges.push(...gpsPlan.value);
					}
				}
			}
		}

		if (
			!isFirstIfd &&
			thumbnailOffset !== undefined &&
			thumbnailLength !== undefined
		) {
			if (thumbnailLength > 0) {
				if (
					thumbnailOffset < 0 ||
					thumbnailOffset + thumbnailLength > tiffBytes.length
				) {
					return { ok: false, error: { code: "ifd-out-of-bounds" } };
				}
				if (recursionDepth >= MAX_THUMBNAIL_RECURSION_DEPTH) {
					return { ok: false, error: { code: "unsupported-nested-structure" } };
				}
				const thumbBytes = tiffBytes.subarray(
					thumbnailOffset,
					thumbnailOffset + thumbnailLength,
				);
				const thumbPlan = planEmbeddedThumbnailGpsRemoval(
					thumbBytes,
					recursionDepth + 1,
				);
				if (!thumbPlan.ok) return thumbPlan;
				for (const range of thumbPlan.value) {
					ranges.push({
						start: thumbnailOffset + range.start,
						length: range.length,
					});
				}
			}
		}

		currentOffset = ifd.nextIfdOffset !== 0 ? ifd.nextIfdOffset : undefined;
		isFirstIfd = false;
	}

	return { ok: true, value: ranges };
}

function applyZeroRanges(
	tiffBytes: Uint8Array,
	ranges: readonly ByteRange[],
): Uint8Array {
	const output = tiffBytes.slice();
	for (const range of ranges) {
		output.fill(0, range.start, range.start + range.length);
	}
	return output;
}

export function removeExifGpsLocation(
	tiffBytes: Uint8Array,
): ExifGpsRemovalResult {
	const planResult = planTiffGpsRemoval(tiffBytes, 0);
	if (!planResult.ok) return planResult;
	return { ok: true, bytes: applyZeroRanges(tiffBytes, planResult.value) };
}
