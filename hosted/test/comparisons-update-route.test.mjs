// Thin tests for hosted/src/pages/api/comparisons/[publicId].ts — the
// HTTP adapter only. Malformed-payload/missing-file cases are exercised
// for free: they short-circuit before update() ever touches image
// processing, AssetStorage or the database. The route provides no
// dependency-injection seam by design ("HTTP adapter only"), so the
// success case below necessarily exercises the real local
// sameview_hosted database and the real default AssetStorage directory
// (via a seeded Publish through the same real stack) — cleaned up
// precisely afterward via the row's own internal id. This file does not
// duplicate the full Update orchestration matrix already covered by
// update.test.mjs.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { closeDb, db } from "../src/db/client.ts";
import { comparisons } from "../src/db/schema.ts";
import { DEFAULT_ASSET_STORAGE_BASE_DIR } from "../src/lib/asset-storage.ts";
import { publish } from "../src/lib/publish.ts";
import { PUT } from "../src/pages/api/comparisons/[publicId].ts";

async function makeJpeg({ width = 100, height = 80 } = {}) {
	return sharp({
		create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
	})
		.jpeg({ quality: 90 })
		.toBuffer();
}

function basePublishPayload(overrides = {}) {
	return {
		comparisonId: randomUUID(),
		referenceLabel: "Then",
		captureLabel: "Now",
		showDate: true,
		background: "dark",
		cornerStyle: "rounded",
		...overrides,
	};
}

function baseUpdatePayload(overrides = {}) {
	return {
		referenceLabel: "Then (updated)",
		captureLabel: "Now (updated)",
		showDate: true,
		background: "light",
		cornerStyle: "sharp",
		...overrides,
	};
}

function buildRequest({ publicId, payload, managementToken, reference, capture, includePayload = true }) {
	const formData = new FormData();
	if (managementToken !== undefined) {
		formData.append("managementToken", managementToken);
	}
	if (includePayload) {
		formData.append(
			"payload",
			typeof payload === "string" ? payload : JSON.stringify(payload),
		);
	}
	if (reference) {
		formData.append("reference", new Blob([reference], { type: "image/jpeg" }), "reference.jpg");
	}
	if (capture) {
		formData.append("capture", new Blob([capture], { type: "image/jpeg" }), "capture.jpg");
	}
	return new Request(`http://localhost/api/comparisons/${publicId}`, {
		method: "PUT",
		body: formData,
	});
}

const createdRowIds = [];
const createdAssetDirs = [];

after(async () => {
	for (const id of createdRowIds) {
		await db.delete(comparisons).where(eq(comparisons.id, id));
	}
	for (const dir of createdAssetDirs) {
		await rm(dir, { recursive: true, force: true });
	}
	await closeDb();
});

async function seedRealPublication() {
	const reference = await makeJpeg();
	const capture = await makeJpeg({ width: 90, height: 70 });
	const payload = basePublishPayload();
	const result = await publish({
		payload,
		referenceImage: reference,
		captureImage: capture,
		brandingImage: undefined,
	});
	assert.equal(result.status, "created");
	const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
	createdRowIds.push(row.id);
	createdAssetDirs.push(join(DEFAULT_ASSET_STORAGE_BASE_DIR, row.id));
	return { row, managementToken: result.managementToken };
}

describe("PUT /api/comparisons/[publicId] — free-to-construct failure mapping", () => {
	test("malformed (non-JSON) payload maps to 400", async () => {
		const request = buildRequest({
			publicId: "someId",
			payload: "{not json",
			managementToken: "irrelevant-token-irrelevant-token-irreleva",
		});
		const response = await PUT({ params: { publicId: "someId" }, request });
		assert.equal(response.status, 400);
	});

	test("missing required multipart file maps to 400", async () => {
		const reference = await makeJpeg();
		const request = buildRequest({
			publicId: "someId",
			payload: baseUpdatePayload(),
			managementToken: "irrelevant-token-irrelevant-token-irreleva",
			reference,
		});
		const response = await PUT({ params: { publicId: "someId" }, request });
		assert.equal(response.status, 400);
	});
});

describe("PUT /api/comparisons/[publicId] — success and authorization mapping (real round trip)", () => {
	test("a valid authorized multipart request maps a successful service result to 200 with an empty body", async () => {
		const { row, managementToken } = await seedRealPublication();
		const reference2 = await makeJpeg({ width: 120, height: 95 });
		const capture2 = await makeJpeg({ width: 60, height: 45 });

		const request = buildRequest({
			publicId: row.publicId,
			payload: baseUpdatePayload(),
			managementToken,
			reference: reference2,
			capture: capture2,
		});
		const response = await PUT({ params: { publicId: row.publicId }, request });
		assert.equal(response.status, 200);

		const body = await response.json();
		assert.deepEqual(body, {});
	});

	test("wrong managementToken maps to 404 with a neutral body", async () => {
		const { row } = await seedRealPublication();
		const reference2 = await makeJpeg({ width: 120, height: 95 });
		const capture2 = await makeJpeg({ width: 60, height: 45 });

		const request = buildRequest({
			publicId: row.publicId,
			payload: baseUpdatePayload(),
			managementToken: "wrong-wrong-wrong-wrong-wrong-wrong-wrongxx",
			reference: reference2,
			capture: capture2,
		});
		const response = await PUT({ params: { publicId: row.publicId }, request });
		assert.equal(response.status, 404);
		const body = await response.json();
		assert.deepEqual(body, { error: "not_found" });
		assert.equal("managementToken" in body, false);
	});

	test("unknown publicId maps to the identical 404/body as a wrong token", async () => {
		const reference2 = await makeJpeg({ width: 120, height: 95 });
		const capture2 = await makeJpeg({ width: 60, height: 45 });

		const request = buildRequest({
			publicId: "totallyUnknownId",
			payload: baseUpdatePayload(),
			managementToken: "any-token-any-token-any-token-any-tokenxxx",
			reference: reference2,
			capture: capture2,
		});
		const response = await PUT({ params: { publicId: "totallyUnknownId" }, request });
		assert.equal(response.status, 404);
		const body = await response.json();
		assert.deepEqual(body, { error: "not_found" });
	});
});
