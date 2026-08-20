// Tests for hosted/src/lib/image-processing.ts. All fixtures are generated
// programmatically in-memory via sharp itself (for pixel content) or hand
// -built byte sequences (for malformed/invalid input) — nothing is
// committed as a binary file. Metadata absence in output is verified via
// the independent hosted/test/webp-metadata-inspector.mjs, never via
// sharp's own metadata() reading its own output.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import sharp from "sharp";
import {
	CORE_MAX_INPUT_BYTES,
	CORE_OUTPUT_MAX_BYTES,
	processCoreImage,
} from "../src/lib/image-processing.ts";
import { assertNoWebpMetadata } from "./webp-metadata-inspector.mjs";

async function makeJpeg({ width = 100, height = 80, background = { r: 100, g: 150, b: 200 } } = {}) {
	return sharp({ create: { width, height, channels: 3, background } })
		.jpeg({ quality: 90 })
		.toBuffer();
}

async function makePng({ width = 100, height = 80 } = {}) {
	return sharp({
		create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
	})
		.png()
		.toBuffer();
}

describe("processCoreImage — valid input", () => {
	test("a valid JPEG succeeds and returns WebP output", async () => {
		const input = await makeJpeg({ width: 100, height: 80 });
		const result = await processCoreImage(input);
		assert.equal(result.ok, true);
		assert.ok(result.ok);
		assert.equal(result.value.contentType, "image/webp");
		assert.equal(result.value.width, 100);
		assert.equal(result.value.height, 80);
		// WebP signature: "RIFF"...."WEBP"
		assert.equal(result.value.data.toString("ascii", 0, 4), "RIFF");
		assert.equal(result.value.data.toString("ascii", 8, 12), "WEBP");
	});

	test("output metadata is stripped (verified independently of sharp)", async () => {
		const base = await makeJpeg({ width: 60, height: 40 });
		const withExif = await sharp(base)
			.withMetadata({ orientation: 1 })
			.jpeg({ quality: 90 })
			.toBuffer();
		const result = await processCoreImage(withExif);
		assert.ok(result.ok);
		assert.doesNotThrow(() => assertNoWebpMetadata(result.value.data));
	});
});

describe("processCoreImage — format/content validation", () => {
	test("a decodable non-JPEG (PNG) is rejected as unsupported-format", async () => {
		const input = await makePng();
		const result = await processCoreImage(input);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "unsupported-format");
		assert.equal(result.error.detectedFormat, "png");
	});

	test("a malformed/truncated JPEG is rejected as undecodable-image", async () => {
		const full = await makeJpeg({ width: 100, height: 100 });
		const truncated = full.subarray(0, Math.floor(full.length * 0.5));
		const result = await processCoreImage(truncated);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "undecodable-image");
	});

	test("arbitrary invalid (non-image) bytes are rejected as undecodable-image", async () => {
		const garbage = Buffer.from("this is not an image, just plain text bytes");
		const result = await processCoreImage(garbage);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "undecodable-image");
	});
});

describe("processCoreImage — size/dimension limits", () => {
	test("input exceeding the byte-size limit is rejected before processing", async () => {
		// A buffer that merely exceeds the byte threshold — content is
		// irrelevant since the byte-size guard runs before any decode.
		const oversized = Buffer.alloc(CORE_MAX_INPUT_BYTES + 1);
		const result = await processCoreImage(oversized);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "input-too-large");
	});

	test("width exceeding the per-dimension limit is rejected", async () => {
		const input = await makeJpeg({ width: 8001, height: 10 });
		const result = await processCoreImage(input);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "dimensions-too-large");
	});

	test("height exceeding the per-dimension limit is rejected", async () => {
		const input = await makeJpeg({ width: 10, height: 8001 });
		const result = await processCoreImage(input);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "dimensions-too-large");
	});

	test("pixel count exceeding the megapixel limit (both sides within the per-dimension limit) is rejected", async () => {
		// 7100 x 5700 = 40,470,000 px > 40,000,000, both sides <= 8000.
		const input = await makeJpeg({ width: 7100, height: 5700 });
		const result = await processCoreImage(input);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "pixel-count-too-large");
	});
});

describe("processCoreImage — orientation, resize, no-upscale", () => {
	test("EXIF orientation is applied to actual pixel data, not just accepted as success", async () => {
		// 40x20 white canvas with an 8x8 red marker at the top-left corner,
		// tagged with EXIF orientation 6 ("rotate 90 CW to display
		// correctly"). If autoOrient() genuinely rotates pixel data (not
		// merely reports success), the output dimensions swap (40x20 ->
		// 20x40) and the red marker moves from top-left to top-right.
		const base = await sharp({
			create: { width: 40, height: 20, channels: 3, background: { r: 255, g: 255, b: 255 } },
		})
			.composite([
				{
					input: await sharp({
						create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 0, b: 0 } },
					})
						.png()
						.toBuffer(),
					left: 0,
					top: 0,
				},
			])
			.jpeg({ quality: 100 })
			.toBuffer();
		const oriented = await sharp(base)
			.withMetadata({ orientation: 6 })
			.jpeg({ quality: 100 })
			.toBuffer();

		const result = await processCoreImage(oriented);
		assert.ok(result.ok);
		// Dimensions swapped: stored 40x20 -> displayed 20x40.
		assert.equal(result.value.width, 20);
		assert.equal(result.value.height, 40);

		const { data, info } = await sharp(result.value.data)
			.raw()
			.toBuffer({ resolveWithObject: true });
		function pixelAt(x, y) {
			const i = (y * info.width + x) * info.channels;
			return [data[i], data[i + 1], data[i + 2]];
		}
		const [rNearMarker] = pixelAt(info.width - 2, 1);
		const [rOppositeCorner] = pixelAt(1, info.height - 2);
		assert.ok(rNearMarker > 200, `expected red near top-right, got R=${rNearMarker}`);
		assert.ok(
			rOppositeCorner > 200,
			`expected white (not red-cleared) at bottom-left, got R=${rOppositeCorner}`,
		);
		const [, gOppositeCorner, bOppositeCorner] = pixelAt(1, info.height - 2);
		assert.ok(
			gOppositeCorner > 200 && bOppositeCorner > 200,
			"bottom-left corner should remain white (marker must not appear there)",
		);
	});

	test("a source smaller than 1920px long edge is not upscaled", async () => {
		const input = await makeJpeg({ width: 300, height: 200 });
		const result = await processCoreImage(input);
		assert.ok(result.ok);
		assert.equal(result.value.width, 300);
		assert.equal(result.value.height, 200);
	});

	test("a source larger than 1920px long edge is resized to exactly 1920 on the long edge, aspect ratio preserved", async () => {
		const input = await makeJpeg({ width: 3840, height: 2160 }); // 16:9, long edge 3840
		const result = await processCoreImage(input);
		assert.ok(result.ok);
		assert.equal(result.value.width, 1920);
		assert.equal(result.value.height, 1080);
	});
});

describe("processCoreImage — output size enforcement", () => {
	test("processed output exceeding 350,000 bytes is rejected", async () => {
		// Full-resolution random noise is essentially incompressible for
		// lossy WebP at quality 80, reliably producing far more than
		// 350,000 bytes at 1920x1920 — verified empirically during Gate 3
		// implementation (~2.3MB), independent of the random seed. Generated
		// entirely in-memory; nothing is committed.
		const width = 1920;
		const height = 1920;
		const channels = 3;
		const raw = Buffer.alloc(width * height * channels);
		for (let i = 0; i < raw.length; i += 1) {
			raw[i] = Math.floor(Math.random() * 256);
		}
		const noisyJpeg = await sharp(raw, { raw: { width, height, channels } })
			.jpeg({ quality: 100 })
			.toBuffer();

		const result = await processCoreImage(noisyJpeg);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "output-too-large");
		assert.ok(result.error.bytes > CORE_OUTPUT_MAX_BYTES);
	});
});
