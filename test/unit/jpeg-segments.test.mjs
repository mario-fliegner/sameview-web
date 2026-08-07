// Coverage for src/lib/jpeg-segments.ts: pure JPEG marker segment parsing
// and rebuilding, against hand-built minimal synthetic JPEG byte sequences
// (no real image files needed — this module never touches pixel data).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseJpegSegments, rebuildJpeg } from "../../src/lib/jpeg-segments.ts";

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

function segment(marker, payload) {
	const length = payload.length + 2;
	return concatBytes(
		new Uint8Array([0xff, marker, (length >> 8) & 0xff, length & 0xff]),
		Uint8Array.from(payload),
	);
}

const SOI = new Uint8Array([0xff, 0xd8]);
const SOS = segment(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
const SCAN_DATA = new Uint8Array([0x7f, 0x00, 0xff, 0x00, 0x01]);
const EOI = new Uint8Array([0xff, 0xd9]);

function buildJpeg(...segments) {
	return concatBytes(SOI, ...segments, SOS, SCAN_DATA, EOI);
}

describe("parseJpegSegments", () => {
	test("parses a minimal JPEG with one APP0 segment", () => {
		const app0 = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00]);
		const bytes = buildJpeg(app0);
		const result = parseJpegSegments(bytes);

		assert.equal(result.ok, true);
		assert.equal(result.segments.length, 1);
		const [found] = result.segments;
		assert.equal(found.marker, 0xe0);
		assert.equal(found.start, 2);
		assert.equal(found.payloadStart, 6);
		assert.equal(found.payloadLength, 5);
		assert.equal(result.scanDataStart, 2 + app0.length);
	});

	test("parses multiple segments in order", () => {
		const app0 = segment(0xe0, [1, 2, 3]);
		const app1 = segment(0xe1, [4, 5, 6, 7]);
		const dqt = segment(0xdb, new Array(10).fill(0));
		const bytes = buildJpeg(app0, app1, dqt);
		const result = parseJpegSegments(bytes);

		assert.equal(result.ok, true);
		assert.deepEqual(
			result.segments.map((s) => s.marker),
			[0xe0, 0xe1, 0xdb],
		);
	});

	test("rejects bytes with no SOI marker", () => {
		const result = parseJpegSegments(new Uint8Array([0x00, 0x01, 0x02]));
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "not-a-jpeg");
	});

	test("rejects empty/too-short input", () => {
		const result = parseJpegSegments(new Uint8Array([0xff]));
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "not-a-jpeg");
	});

	test("rejects a truncated segment (length bytes missing)", () => {
		const bytes = concatBytes(SOI, new Uint8Array([0xff, 0xe0]));
		const result = parseJpegSegments(bytes);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "truncated-segment");
	});

	test("rejects a segment whose declared length exceeds the buffer", () => {
		// Declares a payload length of 100 bytes but supplies none.
		const bytes = concatBytes(SOI, new Uint8Array([0xff, 0xe0, 0x00, 0x64]));
		const result = parseJpegSegments(bytes);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "segment-length-out-of-bounds");
	});

	test("rejects a segment with an impossible length field (< 2)", () => {
		const bytes = concatBytes(SOI, new Uint8Array([0xff, 0xe0, 0x00, 0x00]));
		const result = parseJpegSegments(bytes);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "segment-length-out-of-bounds");
	});

	test("skips RSTn and TEM markers, which carry no length field", () => {
		const app0 = segment(0xe0, [1, 2, 3]);
		const bytes = concatBytes(
			SOI,
			new Uint8Array([0xff, 0x01]), // TEM
			new Uint8Array([0xff, 0xd0]), // RST0
			app0,
			SOS,
			SCAN_DATA,
			EOI,
		);
		const result = parseJpegSegments(bytes);
		assert.equal(result.ok, true);
		assert.equal(result.segments.length, 1);
		assert.equal(result.segments[0].marker, 0xe0);
	});
});

describe("rebuildJpeg", () => {
	test("with no overrides, reproduces the input byte-for-byte", () => {
		const app0 = segment(0xe0, [1, 2, 3]);
		const app1 = segment(0xe1, [4, 5, 6]);
		const bytes = buildJpeg(app0, app1);
		const parsed = parseJpegSegments(bytes);
		assert.equal(parsed.ok, true);

		const rebuilt = rebuildJpeg(
			bytes,
			parsed.scanDataStart,
			parsed.segments,
			new Map(),
		);
		assert.deepEqual(Array.from(rebuilt), Array.from(bytes));
	});

	test("with an override, replaces only that segment's payload and recomputes its length", () => {
		const app0 = segment(0xe0, [1, 2, 3]);
		const app1 = segment(0xe1, [4, 5, 6, 7, 8]);
		const bytes = buildJpeg(app0, app1);
		const parsed = parseJpegSegments(bytes);
		assert.equal(parsed.ok, true);

		const app1Segment = parsed.segments[1];
		const newPayload = new Uint8Array([9, 9]);
		const overrides = new Map([[app1Segment.start, newPayload]]);
		const rebuilt = rebuildJpeg(
			bytes,
			parsed.scanDataStart,
			parsed.segments,
			overrides,
		);

		const reparsed = parseJpegSegments(rebuilt);
		assert.equal(reparsed.ok, true);
		assert.equal(reparsed.segments.length, 2);
		assert.equal(reparsed.segments[0].payloadLength, 3); // app0 unchanged
		assert.equal(reparsed.segments[1].payloadLength, 2); // app1 shrunk
		const rebuiltApp1Payload = rebuilt.subarray(
			reparsed.segments[1].payloadStart,
			reparsed.segments[1].payloadStart + reparsed.segments[1].payloadLength,
		);
		assert.deepEqual(Array.from(rebuiltApp1Payload), [9, 9]);
	});

	test("scan data and EOI are always copied verbatim, regardless of overrides", () => {
		const app0 = segment(0xe0, [1, 2, 3]);
		const bytes = buildJpeg(app0);
		const parsed = parseJpegSegments(bytes);
		assert.equal(parsed.ok, true);

		const overrides = new Map([
			[parsed.segments[0].start, new Uint8Array([9])],
		]);
		const rebuilt = rebuildJpeg(
			bytes,
			parsed.scanDataStart,
			parsed.segments,
			overrides,
		);

		const originalScanOnward = bytes.subarray(parsed.scanDataStart);
		const rebuiltScanOnward = rebuilt.subarray(
			rebuilt.length - originalScanOnward.length,
		);
		assert.deepEqual(
			Array.from(rebuiltScanOnward),
			Array.from(originalScanOnward),
		);
	});
});
