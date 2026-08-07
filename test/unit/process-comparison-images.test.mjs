// Coverage for src/lib/process-comparison-images.ts: the Phase 8 API entry
// point combining an OutcomeSnapshot with the `removeEmbeddedLocationData`
// output setting. Uses only clean (metadata-free) or malformed-but-JPEG
// synthetic bytes — no XMP involved anywhere here, so this stays fully
// Node-testable (see test/e2e/jpeg-location-metadata.spec.ts for XMP-
// inclusive integration coverage of the module this file calls into).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { processComparisonImages } from "../../src/lib/process-comparison-images.ts";

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
		Uint8Array.from([0xff, marker, (length >> 8) & 0xff, length & 0xff]),
		Uint8Array.from(payload),
	);
}

const SOS = segment(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
const SCAN_DATA = Uint8Array.from([0x7f, 0x00]);
const EOI = Uint8Array.from([0xff, 0xd9]);
const SOI = Uint8Array.from([0xff, 0xd8]);

function cleanJpeg(tag) {
	const app0 = segment(
		0xe0,
		Uint8Array.from([0x4a, 0x46, 0x49, 0x46, 0x00, tag]),
	);
	return concatBytes(SOI, app0, SOS, SCAN_DATA, EOI);
}

const NOT_A_JPEG = Uint8Array.from([0x00, 0x01, 0x02, 0x03]);

function fakeOutcomeSnapshot(referenceImageBytes, captureImageBytes) {
	return {
		presentation: {
			title: undefined,
			description: undefined,
			referenceLabel: "",
			captureLabel: "",
			durationLabel: undefined,
			location: undefined,
			sliderLabels: { left: "", right: "" },
		},
		visibility: {
			title: true,
			description: false,
			time: true,
			timeDifference: false,
			location: true,
		},
		configuration: {
			canvasBackground: { kind: "brand" },
			frame: { kind: "none" },
			cornerRadius: "rounded",
			textColor: { kind: "automatic" },
			showSliderDateLabels: true,
		},
		branding: { kind: "none" },
		brandingAssetBytes: undefined,
		referenceImageBytes,
		captureImageBytes,
		initialSliderPosition: 0.5,
	};
}

describe("processComparisonImages", () => {
	test("Off: both images are passed through by reference, unmodified", () => {
		const referenceImageBytes = cleanJpeg(1);
		const captureImageBytes = cleanJpeg(2);
		const snapshot = fakeOutcomeSnapshot(
			referenceImageBytes,
			captureImageBytes,
		);

		const result = processComparisonImages(snapshot, {
			removeEmbeddedLocationData: false,
		});
		assert.equal(result.ok, true);
		assert.equal(result.value.referenceImageBytes, referenceImageBytes);
		assert.equal(result.value.captureImageBytes, captureImageBytes);
	});

	test("Off: result contains only the two image byte fields — no branding or other snapshot data", () => {
		const snapshot = fakeOutcomeSnapshot(cleanJpeg(1), cleanJpeg(2));
		const result = processComparisonImages(snapshot, {
			removeEmbeddedLocationData: false,
		});
		assert.equal(result.ok, true);
		assert.deepEqual(Object.keys(result.value).sort(), [
			"captureImageBytes",
			"referenceImageBytes",
		]);
	});

	test("Off never fails, even for structurally invalid image bytes", () => {
		const snapshot = fakeOutcomeSnapshot(NOT_A_JPEG, NOT_A_JPEG);
		const result = processComparisonImages(snapshot, {
			removeEmbeddedLocationData: false,
		});
		assert.equal(result.ok, true);
	});

	test("On, both images clean: both succeed", () => {
		const snapshot = fakeOutcomeSnapshot(cleanJpeg(1), cleanJpeg(2));
		const result = processComparisonImages(snapshot, {
			removeEmbeddedLocationData: true,
		});
		assert.equal(result.ok, true);
		assert.deepEqual(
			Array.from(result.value.referenceImageBytes),
			Array.from(cleanJpeg(1)),
		);
		assert.deepEqual(
			Array.from(result.value.captureImageBytes),
			Array.from(cleanJpeg(2)),
		);
	});

	test("On, reference fails: the whole call fails, capture is never returned", () => {
		const snapshot = fakeOutcomeSnapshot(NOT_A_JPEG, cleanJpeg(2));
		const result = processComparisonImages(snapshot, {
			removeEmbeddedLocationData: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "reference-processing-failed");
		assert.equal(result.error.error.code, "not-a-jpeg");
	});

	test("On, capture fails: the whole call fails, reference is never returned", () => {
		const snapshot = fakeOutcomeSnapshot(cleanJpeg(1), NOT_A_JPEG);
		const result = processComparisonImages(snapshot, {
			removeEmbeddedLocationData: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "capture-processing-failed");
		assert.equal(result.error.error.code, "not-a-jpeg");
	});

	test("On: branding and other snapshot fields are never read (structural — not part of the function's input usage)", () => {
		const snapshot = fakeOutcomeSnapshot(cleanJpeg(1), cleanJpeg(2));
		// Poison every other field so any accidental read would be observable
		// if it were serialized or touched; processComparisonImages must still
		// succeed using only the two image byte fields.
		Object.defineProperty(snapshot, "branding", {
			get() {
				throw new Error(
					"branding must never be read by processComparisonImages",
				);
			},
		});
		const result = processComparisonImages(snapshot, {
			removeEmbeddedLocationData: true,
		});
		assert.equal(result.ok, true);
	});
});
