// Coverage for src/lib/iptc-location-removal.ts against hand-built
// Photoshop IRB / IPTC-IIM byte sequences (no real photo needed).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { removeIptcLocation } from "../../src/lib/iptc-location-removal.ts";

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

const PHOTOSHOP_PREFIX = textBytes("Photoshop 3.0\0");
const IRB_SIGNATURE = textBytes("8BIM");

function pascalName(name = "") {
	const raw = concatBytes(Uint8Array.from([name.length]), textBytes(name));
	return raw.length % 2 === 0 ? raw : concatBytes(raw, new Uint8Array([0]));
}

function irbBlock(resourceId, data, name = "") {
	const idBytes = new Uint8Array(2);
	new DataView(idBytes.buffer).setUint16(0, resourceId, false);
	const sizeBytes = new Uint8Array(4);
	new DataView(sizeBytes.buffer).setUint32(0, data.length, false);
	const paddedData =
		data.length % 2 === 0 ? data : concatBytes(data, new Uint8Array([0]));
	return concatBytes(
		IRB_SIGNATURE,
		idBytes,
		pascalName(name),
		sizeBytes,
		paddedData,
	);
}

function iimDataset(record, dataset, payload) {
	const lengthBytes = new Uint8Array(2);
	new DataView(lengthBytes.buffer).setUint16(0, payload.length, false);
	return concatBytes(
		Uint8Array.from([0x1c, record, dataset]),
		lengthBytes,
		payload,
	);
}

function buildApp13(...irbBlocks) {
	return concatBytes(PHOTOSHOP_PREFIX, ...irbBlocks);
}

const RECORD_APPLICATION = 2;
const DATASET_CITY = 90;
const DATASET_OBJECT_NAME = 5;

describe("removeIptcLocation", () => {
	test("removes a location dataset (City) and preserves a non-location dataset (ObjectName)", () => {
		const iim = concatBytes(
			iimDataset(RECORD_APPLICATION, DATASET_OBJECT_NAME, textBytes("Sunset")),
			iimDataset(RECORD_APPLICATION, DATASET_CITY, textBytes("Munich")),
		);
		const payload = buildApp13(irbBlock(0x0404, iim));

		const result = removeIptcLocation(payload);
		assert.equal(result.ok, true);

		const text = Array.from(result.bytes)
			.map((b) => String.fromCharCode(b))
			.join("");
		assert.ok(text.includes("Sunset"), "ObjectName must be preserved");
		assert.ok(!text.includes("Munich"), "City must be removed");
	});

	test("no IPTC-NAA resource block at all: output is byte-identical", () => {
		const payload = buildApp13(
			irbBlock(0x0000, textBytes("unrelated resource")),
		);
		const result = removeIptcLocation(payload);
		assert.equal(result.ok, true);
		assert.deepEqual(Array.from(result.bytes), Array.from(payload));
	});

	test("IPTC-NAA present but with no location datasets: content is unchanged", () => {
		const iim = iimDataset(
			RECORD_APPLICATION,
			DATASET_OBJECT_NAME,
			textBytes("Title"),
		);
		const payload = buildApp13(irbBlock(0x0404, iim));
		const result = removeIptcLocation(payload);
		assert.equal(result.ok, true);
		assert.deepEqual(Array.from(result.bytes), Array.from(payload));
	});

	test("removes all five targeted location datasets, preserving a non-location one", () => {
		const iim = concatBytes(
			iimDataset(RECORD_APPLICATION, DATASET_OBJECT_NAME, textBytes("Kept")),
			iimDataset(RECORD_APPLICATION, 90, textBytes("City")),
			iimDataset(RECORD_APPLICATION, 92, textBytes("Sublocation")),
			iimDataset(RECORD_APPLICATION, 95, textBytes("Province")),
			iimDataset(RECORD_APPLICATION, 101, textBytes("Country")),
			iimDataset(RECORD_APPLICATION, 103, textBytes("DE")),
		);
		const payload = buildApp13(irbBlock(0x0404, iim));
		const result = removeIptcLocation(payload);
		assert.equal(result.ok, true);

		const text = Array.from(result.bytes)
			.map((b) => String.fromCharCode(b))
			.join("");
		assert.ok(text.includes("Kept"));
		for (const removed of [
			"City",
			"Sublocation",
			"Province",
			"Country",
			"DE",
		]) {
			assert.ok(!text.includes(removed), `${removed} must be removed`);
		}
	});

	test("another IRB resource block alongside IPTC-NAA is preserved unchanged", () => {
		const otherBlock = irbBlock(0x0000, textBytes("caption resource"), "name");
		const iim = iimDataset(
			RECORD_APPLICATION,
			DATASET_CITY,
			textBytes("Munich"),
		);
		const iptcBlock = irbBlock(0x0404, iim);
		const payload = buildApp13(otherBlock, iptcBlock);

		const result = removeIptcLocation(payload);
		assert.equal(result.ok, true);
		const resultOtherBlock = result.bytes.subarray(
			PHOTOSHOP_PREFIX.length,
			PHOTOSHOP_PREFIX.length + otherBlock.length,
		);
		assert.deepEqual(Array.from(resultOtherBlock), Array.from(otherBlock));
	});

	test("a malformed IRB signature is rejected", () => {
		const bogus = concatBytes(
			PHOTOSHOP_PREFIX,
			textBytes("XXXX"),
			Uint8Array.from([0x04, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
		);
		const result = removeIptcLocation(bogus);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "malformed-irb");
	});

	test("an extended-length IIM dataset is reported as unsupported", () => {
		const extendedLengthField = new Uint8Array(2);
		new DataView(extendedLengthField.buffer).setUint16(0, 0x8001, false); // high bit set
		const iim = concatBytes(
			Uint8Array.from([0x1c, RECORD_APPLICATION, DATASET_CITY]),
			extendedLengthField,
			Uint8Array.from([0x00]), // 1 byte, representing the "length of length" field only
		);
		const payload = buildApp13(irbBlock(0x0404, iim));
		const result = removeIptcLocation(payload);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "unsupported-extended-dataset");
	});

	test("an out-of-bounds declared resource data length is rejected", () => {
		const idBytes = new Uint8Array(2);
		new DataView(idBytes.buffer).setUint16(0, 0x0404, false);
		const sizeBytes = new Uint8Array(4);
		new DataView(sizeBytes.buffer).setUint32(0, 9999, false); // declares far more than supplied
		const truncated = concatBytes(
			PHOTOSHOP_PREFIX,
			IRB_SIGNATURE,
			idBytes,
			pascalName(""),
			sizeBytes,
			textBytes("short"),
		);
		const result = removeIptcLocation(truncated);
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "irb-out-of-bounds");
	});
});
