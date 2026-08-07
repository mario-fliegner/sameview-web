// Coverage for src/lib/jpeg-location-metadata.ts against synthetic JPEGs.
// Deliberately excludes XMP: DOMParser (src/lib/xmp-location-removal.ts)
// has no Node equivalent, so any case exercising the XMP dispatch path
// lives in test/e2e/jpeg-location-metadata.spec.ts instead — see
// docs/AI_ENGINEERING_GUIDE.md "Testing". Every case here never reaches
// that code path, so full Node coverage of the orchestrator's EXIF/IPTC
// dispatch, segment pass-through and error propagation is still possible.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { removeEmbeddedLocationData } from "../../src/lib/jpeg-location-metadata.ts";

function concatBytes(...parts) {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function textBytes(text) {
	return Uint8Array.from(Array.from(text).map((c) => c.charCodeAt(0)));
}

function segment(marker, payload) {
	const length = payload.length + 2;
	return concatBytes(
		Uint8Array.from([0xff, marker, (length >> 8) & 0xff, length & 0xff]),
		Uint8Array.from(payload),
	);
}

const SOS = segment(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
const SCAN_DATA = Uint8Array.from([0x7f, 0x00, 0xff, 0x00]);
const EOI = Uint8Array.from([0xff, 0xd9]);
const SOI = Uint8Array.from([0xff, 0xd8]);

function buildJpeg(...segments) {
	return concatBytes(SOI, ...segments, SOS, SCAN_DATA, EOI);
}

// ---- Minimal single-IFD TIFF builder (IFD0 only, optional GPS IFD) ----

function ifdBytes(entries, littleEndian, gpsOffset) {
	const length = 2 + entries.length * 12 + 4;
	const buf = new Uint8Array(length);
	const view = new DataView(buf.buffer);
	view.setUint16(0, entries.length, littleEndian);
	entries.forEach((entry, i) => {
		const eo = 2 + i * 12;
		view.setUint16(eo, entry.tag, littleEndian);
		view.setUint16(eo + 2, entry.type, littleEndian);
		view.setUint32(eo + 4, entry.count, littleEndian);
		if (entry.tag === 0x8825 && gpsOffset !== undefined) {
			view.setUint32(eo + 8, gpsOffset, littleEndian);
		} else {
			buf.set(entry.inline, eo + 8);
		}
	});
	view.setUint32(2 + entries.length * 12, 0, littleEndian);
	return buf;
}

function buildTiffWithOptionalGps(includeGps) {
	const littleEndian = false;
	const ifd0Entries = [
		{ tag: 0x0112, type: 3, count: 1, inline: Uint8Array.from([0, 1, 0, 0]) },
	];
	if (includeGps) {
		ifd0Entries.push({
			tag: 0x8825,
			type: 4,
			count: 1,
			inline: Uint8Array.from([0, 0, 0, 0]),
		});
	}
	const ifd0 = ifdBytes(
		ifd0Entries,
		littleEndian,
		includeGps ? 8 + 2 + ifd0Entries.length * 12 + 4 : undefined,
	);
	const gpsEntries = [
		{
			tag: 1,
			type: 2,
			count: 2,
			inline: Uint8Array.from(["N".charCodeAt(0), 0, 0, 0]),
		},
	];
	const gps = includeGps
		? ifdBytes(gpsEntries, littleEndian)
		: new Uint8Array(0);

	const header = new Uint8Array(8);
	const hv = new DataView(header.buffer);
	hv.setUint8(0, 0x4d);
	hv.setUint8(1, 0x4d);
	hv.setUint16(2, 42, littleEndian);
	hv.setUint32(4, 8, littleEndian);
	return concatBytes(header, ifd0, gps);
}

function exifApp1(includeGps) {
	const prefix = textBytes("Exif\0\0");
	return segment(
		0xe1,
		concatBytes(prefix, buildTiffWithOptionalGps(includeGps)),
	);
}

// ---- Minimal Photoshop/IPTC APP13 builder ----

function iptcApp13(includeCity) {
	const prefix = textBytes("Photoshop 3.0\0");
	const iimDataset = (record, dataset, payload) => {
		const lengthBytes = new Uint8Array(2);
		new DataView(lengthBytes.buffer).setUint16(0, payload.length, false);
		return concatBytes(
			Uint8Array.from([0x1c, record, dataset]),
			lengthBytes,
			payload,
		);
	};
	const iim = includeCity
		? concatBytes(
				iimDataset(2, 5, textBytes("Title")),
				iimDataset(2, 90, textBytes("Munich")),
			)
		: iimDataset(2, 5, textBytes("Title"));
	const idBytes = new Uint8Array(2);
	new DataView(idBytes.buffer).setUint16(0, 0x0404, false);
	const sizeBytes = new Uint8Array(4);
	new DataView(sizeBytes.buffer).setUint32(0, iim.length, false);
	const paddedIim =
		iim.length % 2 === 0 ? iim : concatBytes(iim, Uint8Array.from([0]));
	const irb = concatBytes(
		textBytes("8BIM"),
		idBytes,
		Uint8Array.from([0, 0]),
		sizeBytes,
		paddedIim,
	);
	return segment(0xed, concatBytes(prefix, irb));
}

describe("removeEmbeddedLocationData", () => {
	test("a JPEG with no APP1/APP13 segments is returned byte-identical", () => {
		const app0 = segment(0xe0, textBytes("JFIF\0"));
		const bytes = buildJpeg(app0);
		const result = removeEmbeddedLocationData(bytes);
		assert.equal(result.ok, true);
		assert.deepEqual(Array.from(result.bytes), Array.from(bytes));
	});

	test("EXIF and IPTC together (no XMP) are both correctly processed", () => {
		const bytes = buildJpeg(exifApp1(true), iptcApp13(true));
		const result = removeEmbeddedLocationData(bytes);
		assert.equal(result.ok, true);

		const text = Array.from(result.bytes)
			.map((b) => String.fromCharCode(b))
			.join("");
		assert.ok(
			text.includes("Title"),
			"non-location IPTC dataset must be preserved",
		);
		assert.ok(!text.includes("Munich"), "IPTC City must be removed");

		// Scan data and EOI remain byte-for-byte identical.
		const originalTail = bytes.subarray(
			bytes.length - (SCAN_DATA.length + EOI.length),
		);
		const resultTail = result.bytes.subarray(
			result.bytes.length - (SCAN_DATA.length + EOI.length),
		);
		assert.deepEqual(Array.from(resultTail), Array.from(originalTail));
	});

	test("EXIF with no GPS, alongside IPTC with no location dataset: fully byte-identical output", () => {
		const bytes = buildJpeg(exifApp1(false), iptcApp13(false));
		const result = removeEmbeddedLocationData(bytes);
		assert.equal(result.ok, true);
		assert.deepEqual(Array.from(result.bytes), Array.from(bytes));
	});

	test("non-JPEG bytes are rejected", () => {
		const result = removeEmbeddedLocationData(
			Uint8Array.from([0x00, 0x01, 0x02]),
		);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "not-a-jpeg");
	});

	test("an EXIF failure is propagated, wrapped, without touching the rest of the image", () => {
		// A GPSInfoIFDPointer aimed out of bounds — see exif-gps-removal.test.mjs
		// for the underlying failure mode.
		const prefix = textBytes("Exif\0\0");
		const badEntries = [
			{
				tag: 0x8825,
				type: 4,
				count: 1,
				inline: Uint8Array.from([0, 0x0f, 0x42, 0x40]),
			},
		];
		const badIfd0 = ifdBytes(badEntries, false);
		const header = new Uint8Array(8);
		const hv = new DataView(header.buffer);
		hv.setUint8(0, 0x4d);
		hv.setUint8(1, 0x4d);
		hv.setUint16(2, 42, false);
		hv.setUint32(4, 8, false);
		const badTiff = concatBytes(header, badIfd0);
		const badExifApp1 = segment(0xe1, concatBytes(prefix, badTiff));

		const bytes = buildJpeg(badExifApp1);
		const result = removeEmbeddedLocationData(bytes);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "exif-removal-failed");
		assert.equal(result.error.error.code, "gps-ifd-out-of-bounds");
	});
});
