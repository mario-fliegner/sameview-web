// Browser-only integration coverage for src/lib/jpeg-location-metadata.ts,
// specifically the one scenario that genuinely needs a real browser: a
// single JPEG carrying EXIF, XMP *and* IPTC location data together, which
// exercises the orchestrator's XMP dispatch (DOMParser — no Node
// equivalent, see src/lib/xmp-location-removal.ts's own header comment).
// Every other orchestrator case (no XMP involved) is already covered by
// test/unit/jpeg-location-metadata.test.mjs in Node.
//
// `window.__importHarness__.removeEmbeddedLocationData` is exposed by that
// harness (test/e2e/harness/harness.ts).

import { expect, test } from "@playwright/test";

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function textBytes(text: string): Uint8Array {
	return Uint8Array.from(Array.from(text).map((c) => c.charCodeAt(0)));
}

function segment(marker: number, payload: Uint8Array): Uint8Array {
	const length = payload.length + 2;
	return concatBytes(
		Uint8Array.from([0xff, marker, (length >> 8) & 0xff, length & 0xff]),
		payload,
	);
}

const SOS = segment(
	0xda,
	Uint8Array.from([0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]),
);
const SCAN_DATA = Uint8Array.from([0x7f, 0x00]);
const EOI = Uint8Array.from([0xff, 0xd9]);
const SOI = Uint8Array.from([0xff, 0xd8]);

function buildJpeg(...segments: readonly Uint8Array[]): Uint8Array {
	return concatBytes(SOI, ...segments, SOS, SCAN_DATA, EOI);
}

// ---- EXIF (GPS in IFD0) ----
function exifApp1WithGps(): Uint8Array {
	const littleEndian = false;
	const orientationEntry = Uint8Array.from([
		0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
	]);
	const gpsPointerEntry = new Uint8Array(12);
	const gpsPointerView = new DataView(gpsPointerEntry.buffer);
	gpsPointerView.setUint16(0, 0x8825, littleEndian);
	gpsPointerView.setUint16(2, 4, littleEndian);
	gpsPointerView.setUint32(4, 1, littleEndian);
	// GPS IFD placed immediately after IFD0: header(8) + ifd0(2+2*12+4=30) = 38
	gpsPointerView.setUint32(8, 38, littleEndian);

	const ifd0 = new Uint8Array(2 + 2 * 12 + 4);
	new DataView(ifd0.buffer).setUint16(0, 2, littleEndian);
	ifd0.set(orientationEntry, 2);
	ifd0.set(gpsPointerEntry, 14);
	// next-IFD offset (0) already zero-initialized.

	const gpsLatRefEntry = new Uint8Array(12);
	const gpsView = new DataView(gpsLatRefEntry.buffer);
	gpsView.setUint16(0, 1, littleEndian); // GPSLatitudeRef
	gpsView.setUint16(2, 2, littleEndian); // ASCII
	gpsView.setUint32(4, 2, littleEndian); // count 2
	gpsLatRefEntry.set(textBytes("N\0"), 8);

	const gpsIfd = new Uint8Array(2 + 1 * 12 + 4);
	new DataView(gpsIfd.buffer).setUint16(0, 1, littleEndian);
	gpsIfd.set(gpsLatRefEntry, 2);

	const header = new Uint8Array(8);
	const hv = new DataView(header.buffer);
	hv.setUint8(0, 0x4d);
	hv.setUint8(1, 0x4d);
	hv.setUint16(2, 42, littleEndian);
	hv.setUint32(4, 8, littleEndian);

	const tiff = concatBytes(header, ifd0, gpsIfd);
	return segment(0xe1, concatBytes(textBytes("Exif\0\0"), tiff));
}

// ---- XMP (a location property + an unrelated one) ----
function xmpApp1WithLocation(): Uint8Array {
	const xml = [
		'<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
		'<x:xmpmeta xmlns:x="adobe:ns:meta/">',
		' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
		'  <rdf:Description rdf:about="" xmlns:exif="http://ns.adobe.com/exif/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" exif:GPSLatitude="37,25.3453N" dc:creator="Alice"/>',
		" </rdf:RDF>",
		"</x:xmpmeta>",
		'<?xpacket end="w"?>',
	].join("\n");
	return segment(
		0xe1,
		concatBytes(textBytes("http://ns.adobe.com/xap/1.0/\0"), textBytes(xml)),
	);
}

// ---- IPTC (a City dataset + an unrelated ObjectName dataset) ----
function iptcApp13WithCity(): Uint8Array {
	const iimDataset = (record: number, dataset: number, payload: Uint8Array) => {
		const lengthBytes = new Uint8Array(2);
		new DataView(lengthBytes.buffer).setUint16(0, payload.length, false);
		return concatBytes(
			Uint8Array.from([0x1c, record, dataset]),
			lengthBytes,
			payload,
		);
	};
	const iim = concatBytes(
		iimDataset(2, 5, textBytes("Title")),
		iimDataset(2, 90, textBytes("Munich")),
	);
	const paddedIim =
		iim.length % 2 === 0 ? iim : concatBytes(iim, Uint8Array.from([0]));
	const idBytes = new Uint8Array(2);
	new DataView(idBytes.buffer).setUint16(0, 0x0404, false);
	const sizeBytes = new Uint8Array(4);
	new DataView(sizeBytes.buffer).setUint32(0, iim.length, false);
	const irb = concatBytes(
		textBytes("8BIM"),
		idBytes,
		Uint8Array.from([0, 0]),
		sizeBytes,
		paddedIim,
	);
	return segment(0xed, concatBytes(textBytes("Photoshop 3.0\0"), irb));
}

test.beforeEach(async ({ page }) => {
	await page.goto("/");
});

test("a JPEG carrying EXIF, XMP and IPTC location data together has all three removed, unrelated data and scan bytes preserved", async ({
	page,
}) => {
	const bytes = buildJpeg(
		exifApp1WithGps(),
		xmpApp1WithLocation(),
		iptcApp13WithCity(),
	);

	const result = await page.evaluate((inputBytes) => {
		const outcome = window.__importHarness__.removeEmbeddedLocationData(
			new Uint8Array(inputBytes),
		);
		return outcome.ok
			? { ok: true as const, bytes: Array.from(outcome.bytes) }
			: { ok: false as const, error: outcome.error };
	}, Array.from(bytes));

	expect(result.ok).toBe(true);
	if (!result.ok) return;

	const resultBytes = new Uint8Array(result.bytes);
	const text = Array.from(resultBytes)
		.map((b) => String.fromCharCode(b))
		.join("");

	// XMP: location removed, unrelated dc:creator preserved.
	expect(text).not.toContain("GPSLatitude");
	expect(text).toContain("Alice");
	// IPTC: City removed, unrelated Title (ObjectName) preserved.
	expect(text).not.toContain("Munich");
	expect(text).toContain("Title");
	// EXIF: GPSLatitudeRef ("N") value's containing structure is zeroed; the
	// surrounding ASCII marker text is not itself meaningful to assert on
	// byte-for-byte here (it's binary), covered precisely in
	// test/unit/exif-gps-removal.test.mjs instead.

	// Scan data and EOI are always byte-identical.
	const originalTail = bytes.subarray(
		bytes.length - (SCAN_DATA.length + EOI.length),
	);
	const resultTail = resultBytes.subarray(
		resultBytes.length - (SCAN_DATA.length + EOI.length),
	);
	expect(Array.from(resultTail)).toEqual(Array.from(originalTail));
});
