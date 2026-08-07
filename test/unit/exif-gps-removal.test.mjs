// Coverage for src/lib/exif-gps-removal.ts against a hand-built, generic
// TIFF/IFD layout builder (no real photo needed — GPS EXIF as actually
// written by SameView Android's own GpsExifWriter.kt uses exactly this
// tag shape: GPSLatitudeRef/GPSLatitude/GPSLongitudeRef/GPSLongitude,
// optionally GPSAltitudeRef/GPSAltitude, GPSDateStamp/GPSTimeStamp,
// GPSProcessingMethod, via the standard android.media.ExifInterface writer
// — i.e. a conformant, standard TIFF GPS IFD).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { removeExifGpsLocation } from "../../src/lib/exif-gps-removal.ts";

// ---- Generic two-pass TIFF/IFD layout builder ------------------------
//
// A "chunk" is either an IFD (a list of 12-byte entries plus a next-IFD
// pointer) or a raw bytes blob (used for external entry values and for an
// embedded thumbnail JPEG). Chunks are named and laid out sequentially
// after the fixed 8-byte TIFF header; entries may reference another
// chunk's own eventual offset by name ("pointerTo"), which the two-pass
// design resolves without caring about declaration or layout order — this
// is what makes both forward references (IFD0 -> a GPS IFD placed later)
// and self/cyclic references (a next-IFD pointer aimed at IFD0 itself)
// equally easy to construct.

function ifdChunk(entries, nextPointer = null) {
	const length = 2 + entries.length * 12 + 4;
	return {
		length: () => length,
		build: (offsetOf, littleEndian) => {
			const buf = new Uint8Array(length);
			const view = new DataView(buf.buffer);
			view.setUint16(0, entries.length, littleEndian);
			entries.forEach((entry, i) => {
				const eo = 2 + i * 12;
				view.setUint16(eo, entry.tag, littleEndian);
				view.setUint16(eo + 2, entry.type, littleEndian);
				view.setUint32(eo + 4, entry.count, littleEndian);
				if ("pointerTo" in entry) {
					view.setUint32(eo + 8, offsetOf(entry.pointerTo), littleEndian);
				} else if ("literalValue" in entry) {
					view.setUint32(eo + 8, entry.literalValue, littleEndian);
				} else {
					buf.set(entry.inline, eo + 8);
				}
			});
			const nextValue =
				typeof nextPointer === "string"
					? offsetOf(nextPointer)
					: (nextPointer ?? 0);
			view.setUint32(2 + entries.length * 12, nextValue, littleEndian);
			return buf;
		},
	};
}

function bytesChunk(bytes) {
	const arr = Uint8Array.from(bytes);
	return { length: () => arr.length, build: () => arr };
}

function buildTiff(littleEndian, ifd0Name, namedChunks, order) {
	const header = new Uint8Array(8);
	const hv = new DataView(header.buffer);
	if (littleEndian) {
		hv.setUint8(0, 0x49);
		hv.setUint8(1, 0x49);
	} else {
		hv.setUint8(0, 0x4d);
		hv.setUint8(1, 0x4d);
	}
	hv.setUint16(2, 42, littleEndian);

	let cursor = 8;
	const offsets = {};
	for (const name of order) {
		offsets[name] = cursor;
		cursor += namedChunks[name].length();
	}
	hv.setUint32(4, offsets[ifd0Name], littleEndian);
	const offsetOf = (name) => {
		if (!(name in offsets)) throw new Error(`unknown chunk: ${name}`);
		return offsets[name];
	};

	const parts = [header];
	for (const name of order)
		parts.push(namedChunks[name].build(offsetOf, littleEndian));
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

// ---- Tag/type constants -------------------------------------------------
const TAG_ORIENTATION = 0x0112;
const TAG_GPS_INFO = 0x8825;
const TAG_EXIF_IFD = 0x8769;
const TAG_JPEG_INTERCHANGE_FORMAT = 0x0201;
const TAG_JPEG_INTERCHANGE_FORMAT_LENGTH = 0x0202;
const TAG_GPS_LATITUDE_REF = 1;
const TAG_GPS_LATITUDE = 2;
const TAG_GPS_LONGITUDE_REF = 3;
const TAG_GPS_LONGITUDE = 4;

const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;
const TYPE_ASCII = 2;

function asciiInline2(text) {
	// 1 char + NUL terminator, exactly 2 bytes — fits inline.
	return Uint8Array.from([text.charCodeAt(0), 0]);
}

function rationalBytes24() {
	// 3 RATIONAL values (8 bytes each) of non-zero filler — real content is
	// irrelevant to these tests, only that it gets zeroed is checked.
	return Uint8Array.from(new Array(24).fill(0).map((_, i) => (i % 251) + 1));
}

function orientationEntry(value = 1) {
	return {
		tag: TAG_ORIENTATION,
		type: TYPE_SHORT,
		count: 1,
		inline: Uint8Array.from([0, value, 0, 0]),
	};
}

function gpsIfdChunk() {
	return ifdChunk([
		{
			tag: TAG_GPS_LATITUDE_REF,
			type: TYPE_ASCII,
			count: 2,
			inline: asciiInline2("N"),
		},
		{
			tag: TAG_GPS_LATITUDE,
			type: TYPE_RATIONAL,
			count: 3,
			pointerTo: "gpsLatValue",
		},
		{
			tag: TAG_GPS_LONGITUDE_REF,
			type: TYPE_ASCII,
			count: 2,
			inline: asciiInline2("E"),
		},
		{
			tag: TAG_GPS_LONGITUDE,
			type: TYPE_RATIONAL,
			count: 3,
			pointerTo: "gpsLonValue",
		},
	]);
}

function withGpsValueChunks(chunks) {
	return {
		...chunks,
		gpsLatValue: bytesChunk(rationalBytes24()),
		gpsLonValue: bytesChunk(rationalBytes24()),
	};
}

describe("removeExifGpsLocation", () => {
	for (const littleEndian of [true, false]) {
		const label = littleEndian ? "little-endian (II)" : "big-endian (MM)";

		test(`removes GPS IFD referenced from IFD0 and preserves Orientation — ${label}`, () => {
			const chunks = withGpsValueChunks({
				ifd0: ifdChunk([
					orientationEntry(1),
					{ tag: TAG_GPS_INFO, type: TYPE_LONG, count: 1, pointerTo: "gpsIfd" },
				]),
				gpsIfd: gpsIfdChunk(),
			});
			const order = ["ifd0", "gpsIfd", "gpsLatValue", "gpsLonValue"];
			const tiff = buildTiff(littleEndian, "ifd0", chunks, order);

			const result = removeExifGpsLocation(tiff);
			assert.equal(result.ok, true);
			assert.equal(result.bytes.length, tiff.length);

			// Orientation entry (IFD0's first entry, right after the 2-byte count)
			// is byte-identical.
			const orientationEntryBytes = result.bytes.subarray(10, 22);
			assert.deepEqual(
				Array.from(orientationEntryBytes),
				Array.from(tiff.subarray(10, 22)),
			);

			// GPSInfoIFDPointer entry (IFD0's second entry) is fully zeroed.
			const gpsPointerEntryBytes = result.bytes.subarray(22, 34);
			assert.deepEqual(Array.from(gpsPointerEntryBytes), new Array(12).fill(0));

			// The GPS IFD's own header/entries and both external RATIONAL blocks
			// are fully zeroed — including the inline ASCII ref values.
			const gpsIfdStart = 8 + chunks.ifd0.length();
			const gpsIfdLength = chunks.gpsIfd.length();
			const zeroedGpsIfd = result.bytes.subarray(
				gpsIfdStart,
				gpsIfdStart + gpsIfdLength,
			);
			assert.deepEqual(
				Array.from(zeroedGpsIfd),
				new Array(gpsIfdLength).fill(0),
			);

			const latValueStart = gpsIfdStart + gpsIfdLength;
			const zeroedLat = result.bytes.subarray(
				latValueStart,
				latValueStart + 24,
			);
			assert.deepEqual(Array.from(zeroedLat), new Array(24).fill(0));
			const lonValueStart = latValueStart + 24;
			const zeroedLon = result.bytes.subarray(
				lonValueStart,
				lonValueStart + 24,
			);
			assert.deepEqual(Array.from(zeroedLon), new Array(24).fill(0));
		});
	}

	test("no GPS present: output is byte-identical to input", () => {
		const chunks = { ifd0: ifdChunk([orientationEntry(6)]) };
		const tiff = buildTiff(false, "ifd0", chunks, ["ifd0"]);

		const result = removeExifGpsLocation(tiff);
		assert.equal(result.ok, true);
		assert.deepEqual(Array.from(result.bytes), Array.from(tiff));
	});

	test("GPSInfoIFDPointer targets an out-of-bounds offset", () => {
		const chunks = {
			ifd0: ifdChunk([
				{ tag: TAG_GPS_INFO, type: TYPE_LONG, count: 1, literalValue: 999_999 },
			]),
		};
		const tiff = buildTiff(false, "ifd0", chunks, ["ifd0"]);

		const result = removeExifGpsLocation(tiff);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "gps-ifd-out-of-bounds");
	});

	test("GPS present only in IFD1: IFD0 stays untouched, IFD1's GPS is removed", () => {
		const chunks = withGpsValueChunks({
			ifd0: ifdChunk([orientationEntry(1)], "ifd1"),
			ifd1: ifdChunk([
				{ tag: TAG_GPS_INFO, type: TYPE_LONG, count: 1, pointerTo: "gpsIfd" },
			]),
			gpsIfd: gpsIfdChunk(),
		});
		const order = ["ifd0", "ifd1", "gpsIfd", "gpsLatValue", "gpsLonValue"];
		const tiff = buildTiff(false, "ifd0", chunks, order);

		const result = removeExifGpsLocation(tiff);
		assert.equal(result.ok, true);
		assert.equal(result.bytes.length, tiff.length);

		const ifd0Bytes = result.bytes.subarray(8, 8 + chunks.ifd0.length());
		assert.deepEqual(
			Array.from(ifd0Bytes),
			Array.from(tiff.subarray(8, 8 + chunks.ifd0.length())),
		);

		const gpsIfdStart = 8 + chunks.ifd0.length() + chunks.ifd1.length();
		const zeroedGpsIfd = result.bytes.subarray(
			gpsIfdStart,
			gpsIfdStart + chunks.gpsIfd.length(),
		);
		assert.deepEqual(
			Array.from(zeroedGpsIfd),
			new Array(chunks.gpsIfd.length()).fill(0),
		);
	});

	test("a stray GPSInfoIFDPointer inside the Exif SubIFD is defensively removed", () => {
		const chunks = withGpsValueChunks({
			ifd0: ifdChunk([
				{ tag: TAG_EXIF_IFD, type: TYPE_LONG, count: 1, pointerTo: "subIfd" },
			]),
			subIfd: ifdChunk([
				{ tag: TAG_GPS_INFO, type: TYPE_LONG, count: 1, pointerTo: "gpsIfd" },
			]),
			gpsIfd: gpsIfdChunk(),
		});
		const order = ["ifd0", "subIfd", "gpsIfd", "gpsLatValue", "gpsLonValue"];
		const tiff = buildTiff(false, "ifd0", chunks, order);

		const result = removeExifGpsLocation(tiff);
		assert.equal(result.ok, true);

		// IFD0's own ExifIFDPointer entry (not itself GPS-related) is preserved.
		const ifd0Bytes = result.bytes.subarray(8, 8 + chunks.ifd0.length());
		assert.deepEqual(
			Array.from(ifd0Bytes),
			Array.from(tiff.subarray(8, 8 + chunks.ifd0.length())),
		);

		// Only the offending GPSInfoIFDPointer *entry* within the SubIFD is
		// zeroed — the SubIFD itself legitimately holds other, non-GPS Exif
		// data and is not wholesale erased. The SubIFD's own entry-count
		// field (2 bytes: count = 1) is preserved; only the one 12-byte entry
		// that follows it is zeroed.
		const subIfdStart = 8 + chunks.ifd0.length();
		const subIfdCountBytes = result.bytes.subarray(
			subIfdStart,
			subIfdStart + 2,
		);
		assert.deepEqual(
			Array.from(subIfdCountBytes),
			Array.from(tiff.subarray(subIfdStart, subIfdStart + 2)),
		);
		const zeroedEntry = result.bytes.subarray(
			subIfdStart + 2,
			subIfdStart + 14,
		);
		assert.deepEqual(Array.from(zeroedEntry), new Array(12).fill(0));

		const gpsIfdStart = subIfdStart + chunks.subIfd.length();
		const zeroedGpsIfd = result.bytes.subarray(
			gpsIfdStart,
			gpsIfdStart + chunks.gpsIfd.length(),
		);
		assert.deepEqual(
			Array.from(zeroedGpsIfd),
			new Array(chunks.gpsIfd.length()).fill(0),
		);
	});

	test("GPS inside an embedded IFD1 thumbnail JPEG is removed; outer structure untouched, total length unchanged", () => {
		// Build the thumbnail's own inner TIFF (GPS only, no Orientation).
		const innerChunks = withGpsValueChunks({
			innerIfd0: ifdChunk([
				{ tag: TAG_GPS_INFO, type: TYPE_LONG, count: 1, pointerTo: "gpsIfd" },
			]),
			gpsIfd: gpsIfdChunk(),
		});
		const innerTiff = buildTiff(false, "innerIfd0", innerChunks, [
			"innerIfd0",
			"gpsIfd",
			"gpsLatValue",
			"gpsLonValue",
		]);

		// Wrap it as a minimal JPEG: SOI + APP1(Exif prefix + innerTiff) + SOS + scan + EOI.
		const exifPrefix = Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
		const app1Payload = new Uint8Array(exifPrefix.length + innerTiff.length);
		app1Payload.set(exifPrefix, 0);
		app1Payload.set(innerTiff, exifPrefix.length);
		const app1Length = app1Payload.length + 2;
		const app1 = new Uint8Array(4 + app1Payload.length);
		app1.set([0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff], 0);
		app1.set(app1Payload, 4);
		const sos = Uint8Array.from([
			0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
		]);
		const scanAndEoi = Uint8Array.from([0x7f, 0xff, 0xd9]);
		const thumbnailJpeg = new Uint8Array(
			2 + app1.length + sos.length + scanAndEoi.length,
		);
		thumbnailJpeg.set([0xff, 0xd8], 0);
		thumbnailJpeg.set(app1, 2);
		thumbnailJpeg.set(sos, 2 + app1.length);
		thumbnailJpeg.set(scanAndEoi, 2 + app1.length + sos.length);

		const outerChunks = {
			ifd0: ifdChunk([orientationEntry(1)], "ifd1"),
			ifd1: ifdChunk([
				{
					tag: TAG_JPEG_INTERCHANGE_FORMAT,
					type: TYPE_LONG,
					count: 1,
					pointerTo: "thumb",
				},
				{
					tag: TAG_JPEG_INTERCHANGE_FORMAT_LENGTH,
					type: TYPE_LONG,
					count: 1,
					literalValue: thumbnailJpeg.length,
				},
			]),
			thumb: bytesChunk(thumbnailJpeg),
		};
		const order = ["ifd0", "ifd1", "thumb"];
		const tiff = buildTiff(false, "ifd0", outerChunks, order);

		const result = removeExifGpsLocation(tiff);
		assert.equal(result.ok, true);
		assert.equal(result.bytes.length, tiff.length);

		const thumbStart =
			8 + outerChunks.ifd0.length() + outerChunks.ifd1.length();
		const processedThumb = result.bytes.subarray(
			thumbStart,
			thumbStart + thumbnailJpeg.length,
		);
		// The GPS IFD inside the thumbnail's own EXIF must be zeroed. Layout
		// within thumbnailJpeg: SOI(2) + APP1 marker/length(4) + "Exif\0\0"(6)
		// = innerTiff start; the inner TIFF's own 8-byte header precedes its
		// IFD0, and the GPS IFD immediately follows that IFD0.
		const innerTiffStart = 2 + 4 + exifPrefix.length;
		const gpsIfdOffsetWithinThumb =
			innerTiffStart + 8 + innerChunks.innerIfd0.length();
		const zeroedInnerGpsIfd = processedThumb.subarray(
			gpsIfdOffsetWithinThumb,
			gpsIfdOffsetWithinThumb + innerChunks.gpsIfd.length(),
		);
		assert.deepEqual(
			Array.from(zeroedInnerGpsIfd),
			new Array(innerChunks.gpsIfd.length()).fill(0),
		);

		// The outer IFD0 (Orientation) and the thumbnail's own JPEG framing
		// (SOI/APP1 header/SOS/scan/EOI bytes) are untouched.
		const ifd0Bytes = result.bytes.subarray(8, 8 + outerChunks.ifd0.length());
		assert.deepEqual(
			Array.from(ifd0Bytes),
			Array.from(tiff.subarray(8, 8 + outerChunks.ifd0.length())),
		);
		assert.deepEqual(Array.from(processedThumb.subarray(0, 2)), [0xff, 0xd8]); // SOI preserved
	});

	test("a thumbnail carrying an XMP APP1 segment is reported as an unsupported nested structure", () => {
		const xmpPrefixText = "http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>";
		const xmpBytes = Uint8Array.from(
			Array.from(xmpPrefixText).map((c) => c.charCodeAt(0)),
		);
		const app1Length = xmpBytes.length + 2;
		const app1 = new Uint8Array(4 + xmpBytes.length);
		app1.set([0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff], 0);
		app1.set(xmpBytes, 4);
		const sos = Uint8Array.from([
			0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
		]);
		const scanAndEoi = Uint8Array.from([0x7f, 0xff, 0xd9]);
		const thumbnailJpeg = new Uint8Array(
			2 + app1.length + sos.length + scanAndEoi.length,
		);
		thumbnailJpeg.set([0xff, 0xd8], 0);
		thumbnailJpeg.set(app1, 2);
		thumbnailJpeg.set(sos, 2 + app1.length);
		thumbnailJpeg.set(scanAndEoi, 2 + app1.length + sos.length);

		const outerChunks = {
			ifd0: ifdChunk([], "ifd1"),
			ifd1: ifdChunk([
				{
					tag: TAG_JPEG_INTERCHANGE_FORMAT,
					type: TYPE_LONG,
					count: 1,
					pointerTo: "thumb",
				},
				{
					tag: TAG_JPEG_INTERCHANGE_FORMAT_LENGTH,
					type: TYPE_LONG,
					count: 1,
					literalValue: thumbnailJpeg.length,
				},
			]),
			thumb: bytesChunk(thumbnailJpeg),
		};
		const tiff = buildTiff(false, "ifd0", outerChunks, [
			"ifd0",
			"ifd1",
			"thumb",
		]);

		const result = removeExifGpsLocation(tiff);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "unsupported-nested-structure");
	});

	test("a cyclic next-IFD offset is detected rather than looped forever", () => {
		const chunks = { ifd0: ifdChunk([], "ifd0") }; // points back at itself
		const tiff = buildTiff(false, "ifd0", chunks, ["ifd0"]);

		const result = removeExifGpsLocation(tiff);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "ifd-cycle-detected");
	});

	test("a third chained IFD exceeds the supported chain length", () => {
		const chunks = {
			ifd0: ifdChunk([], "ifd1"),
			ifd1: ifdChunk([], "ifd2"),
			ifd2: ifdChunk([]),
		};
		const tiff = buildTiff(false, "ifd0", chunks, ["ifd0", "ifd1", "ifd2"]);

		const result = removeExifGpsLocation(tiff);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "ifd-chain-too-long");
	});

	test("a malformed TIFF byte-order marker is rejected", () => {
		const bytes = Uint8Array.from([
			0x58, 0x58, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00,
		]);
		const result = removeExifGpsLocation(bytes);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "malformed-tiff-header");
	});

	test("a truncated buffer is rejected", () => {
		const result = removeExifGpsLocation(Uint8Array.from([0x4d, 0x4d, 0x00]));
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "malformed-tiff-header");
	});
});
