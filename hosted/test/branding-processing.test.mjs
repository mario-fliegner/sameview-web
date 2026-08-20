// Tests for hosted/src/lib/branding-processing.ts. All fixtures generated
// programmatically in-memory via sharp. Metadata absence verified via the
// independent hosted/test/webp-metadata-inspector.mjs.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import sharp from "sharp";
import {
	BRANDING_MAX_INPUT_BYTES,
	BRANDING_OUTPUT_SIZE,
	processBrandingImage,
} from "../src/lib/branding-processing.ts";
import { assertNoWebpMetadata } from "./webp-metadata-inspector.mjs";

async function makePng({
	width = 100,
	height = 100,
	background = { r: 50, g: 100, b: 150, alpha: 1 },
} = {}) {
	return sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();
}

async function makeTransparentPng({ width = 100, height = 100 } = {}) {
	return sharp({
		create: { width, height, channels: 4, background: { r: 200, g: 50, b: 50, alpha: 0.4 } },
	})
		.png()
		.toBuffer();
}

describe("processBrandingImage — valid input", () => {
	test("a valid PNG succeeds and returns a 512x512 WebP", async () => {
		const input = await makePng({ width: 512, height: 512 });
		const result = await processBrandingImage(input);
		assert.equal(result.ok, true);
		assert.ok(result.ok);
		assert.equal(result.value.contentType, "image/webp");
		assert.equal(result.value.width, BRANDING_OUTPUT_SIZE);
		assert.equal(result.value.height, BRANDING_OUTPUT_SIZE);
		assert.equal(result.value.data.toString("ascii", 0, 4), "RIFF");
		assert.equal(result.value.data.toString("ascii", 8, 12), "WEBP");
	});

	test("output metadata is stripped (verified independently of sharp)", async () => {
		const input = await makePng({ width: 200, height: 200 });
		const result = await processBrandingImage(input);
		assert.ok(result.ok);
		assert.doesNotThrow(() => assertNoWebpMetadata(result.value.data));
	});
});

describe("processBrandingImage — canonical format enforcement", () => {
	test("JPEG is rejected as unsupported-format", async () => {
		const input = await sharp({
			create: { width: 100, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } },
		})
			.jpeg()
			.toBuffer();
		const result = await processBrandingImage(input);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "unsupported-format");
		assert.equal(result.error.detectedFormat, "jpeg");
	});

	test("another decoded non-PNG format (WebP) is rejected as unsupported-format", async () => {
		const input = await sharp({
			create: { width: 100, height: 100, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } },
		})
			.webp()
			.toBuffer();
		const result = await processBrandingImage(input);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "unsupported-format");
		assert.equal(result.error.detectedFormat, "webp");
	});

	test("a malformed/truncated PNG is rejected as undecodable-image", async () => {
		const full = await makePng({ width: 100, height: 100 });
		const truncated = full.subarray(0, Math.floor(full.length * 0.5));
		const result = await processBrandingImage(truncated);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "undecodable-image");
	});

	test("arbitrary invalid (non-image) bytes are rejected as undecodable-image", async () => {
		const garbage = Buffer.from("definitely not a png");
		const result = await processBrandingImage(garbage);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "undecodable-image");
	});
});

describe("processBrandingImage — size/dimension limits", () => {
	test("input exceeding the byte-size limit is rejected before processing", async () => {
		const oversized = Buffer.alloc(BRANDING_MAX_INPUT_BYTES + 1);
		const result = await processBrandingImage(oversized);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "input-too-large");
	});

	test("width exceeding the per-dimension limit is rejected", async () => {
		const input = await makePng({ width: 8001, height: 10 });
		const result = await processBrandingImage(input);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "dimensions-too-large");
	});

	test("pixel count exceeding the megapixel limit is rejected", async () => {
		// 5000 x 4900 = 24,500,000 px > 24,000,000, both sides <= 8000.
		const input = await makePng({ width: 5000, height: 4900 });
		const result = await processBrandingImage(input);
		assert.equal(result.ok, false);
		assert.ok(!result.ok);
		assert.equal(result.error.code, "pixel-count-too-large");
	});
});

describe("processBrandingImage — alpha preservation", () => {
	test("a transparent PNG's alpha is preserved in the output", async () => {
		const input = await makeTransparentPng({ width: 300, height: 300 });
		const result = await processBrandingImage(input);
		assert.ok(result.ok);

		const { data, info } = await sharp(result.value.data)
			.raw()
			.ensureAlpha()
			.toBuffer({ resolveWithObject: true });
		const centerX = Math.floor(info.width / 2);
		const centerY = Math.floor(info.height / 2);
		const i = (centerY * info.width + centerX) * info.channels;
		const alpha = data[i + 3];
		// Source alpha 0.4 of 255 ~= 102; allow encoder rounding tolerance.
		assert.ok(
			alpha > 70 && alpha < 140,
			`expected semi-transparent alpha near source (~102), got ${alpha}`,
		);
	});
});

describe("processBrandingImage — normalization (fit-to-canvas, upscale/downscale)", () => {
	test("a smaller-than-canvas source is upscaled and centered, aspect ratio preserved", async () => {
		// 50x30 (5:3) source, smaller than the 512 canvas on both axes.
		const input = await makePng({ width: 50, height: 30 });
		const result = await processBrandingImage(input);
		assert.ok(result.ok);
		assert.equal(result.value.width, BRANDING_OUTPUT_SIZE);
		assert.equal(result.value.height, BRANDING_OUTPUT_SIZE);

		const { data, info } = await sharp(result.value.data)
			.raw()
			.ensureAlpha()
			.toBuffer({ resolveWithObject: true });
		function alphaAt(x, y) {
			const i = (y * info.width + x) * info.channels;
			return data[i + 3];
		}
		// scale = min(512/50, 512/30) = 10.24 -> scaled content is 512 wide,
		// 307 tall, centered vertically -> top/bottom strips are transparent
		// padding, center is opaque source content.
		assert.ok(alphaAt(256, 5) < 20, "expected transparent padding near the top edge");
		assert.ok(alphaAt(256, info.height - 6) < 20, "expected transparent padding near the bottom edge");
		assert.ok(alphaAt(256, 256) > 200, "expected opaque source content at the center");
	});

	test("a larger-than-canvas source is downscaled and centered, aspect ratio preserved", async () => {
		const input = await makePng({ width: 1000, height: 600 });
		const result = await processBrandingImage(input);
		assert.ok(result.ok);
		assert.equal(result.value.width, BRANDING_OUTPUT_SIZE);
		assert.equal(result.value.height, BRANDING_OUTPUT_SIZE);

		const { data, info } = await sharp(result.value.data)
			.raw()
			.ensureAlpha()
			.toBuffer({ resolveWithObject: true });
		function alphaAt(x, y) {
			const i = (y * info.width + x) * info.channels;
			return data[i + 3];
		}
		// scale = min(512/1000, 512/600) = 0.512 -> content 512x307, same
		// letterboxing shape as the upscale case above.
		assert.ok(alphaAt(256, 5) < 20, "expected transparent padding near the top edge");
		assert.ok(alphaAt(256, info.height - 6) < 20, "expected transparent padding near the bottom edge");
		assert.ok(alphaAt(256, 256) > 200, "expected opaque source content at the center");
	});
});
