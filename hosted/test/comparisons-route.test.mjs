// Thin tests for hosted/src/pages/api/comparisons.ts — the HTTP adapter
// only. Most status-mapping cases (malformed payload, missing files) are
// exercised for free: they short-circuit before publish() ever touches
// image processing, AssetStorage or the database, so no real fixture or
// cleanup is required. The route provides no dependency-injection seam by
// design ("HTTP adapter only"), so the 201/409 cases below necessarily
// exercise the real local sameview_hosted database and the real default
// AssetStorage directory exactly once each — both are located via the
// returned publicId and precisely cleaned up afterward. This file does
// not duplicate the full Publish integration matrix already covered by
// publish.test.mjs.

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
import { POST } from "../src/pages/api/comparisons.ts";

async function makeJpeg({ width = 100, height = 80 } = {}) {
	return sharp({
		create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
	})
		.jpeg({ quality: 90 })
		.toBuffer();
}

function basePayload(overrides = {}) {
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

function buildRequest({ payload, reference, capture, includePayload = true }) {
	const formData = new FormData();
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
	return new Request("http://localhost/api/comparisons", { method: "POST", body: formData });
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

async function cleanupByPublicId(publicId) {
	const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, publicId));
	if (row) {
		createdRowIds.push(row.id);
		createdAssetDirs.push(join(DEFAULT_ASSET_STORAGE_BASE_DIR, row.id));
	}
}

describe("POST /api/comparisons — free-to-construct failure mapping", () => {
	test("missing payload field maps to 400", async () => {
		const request = buildRequest({ includePayload: false });
		const response = await POST({ request });
		assert.equal(response.status, 400);
		const body = await response.json();
		assert.equal(typeof body.error, "string");
	});

	test("malformed (non-JSON) payload maps to 400", async () => {
		const request = buildRequest({ payload: "{not json" });
		const response = await POST({ request });
		assert.equal(response.status, 400);
	});

	test("missing reference file maps to 400", async () => {
		const capture = await makeJpeg();
		const request = buildRequest({ payload: basePayload(), capture });
		const response = await POST({ request });
		assert.equal(response.status, 400);
	});

	test("missing capture file maps to 400", async () => {
		const reference = await makeJpeg();
		const request = buildRequest({ payload: basePayload(), reference });
		const response = await POST({ request });
		assert.equal(response.status, 400);
	});
});

describe("POST /api/comparisons — success and conflict mapping (real round trip)", () => {
	test("a valid multipart request maps a successful service result to 201 with only the expected fields", async () => {
		const reference = await makeJpeg();
		const capture = await makeJpeg({ width: 90, height: 70 });
		const payload = basePayload();

		const response = await POST({ request: buildRequest({ payload, reference, capture }) });
		assert.equal(response.status, 201);

		const body = await response.json();
		await cleanupByPublicId(body.publicId);

		assert.deepEqual(Object.keys(body).sort(), ["managementToken", "publicId"]);
		assert.equal(typeof body.publicId, "string");
		assert.equal(typeof body.managementToken, "string");
	});

	test("publishing an already-published comparisonId maps to 409 with a neutral body", async () => {
		const reference = await makeJpeg();
		const capture = await makeJpeg({ width: 90, height: 70 });
		const payload = basePayload();

		const firstResponse = await POST({ request: buildRequest({ payload, reference, capture }) });
		assert.equal(firstResponse.status, 201);
		const firstBody = await firstResponse.json();
		await cleanupByPublicId(firstBody.publicId);

		const secondResponse = await POST({ request: buildRequest({ payload, reference, capture }) });
		assert.equal(secondResponse.status, 409);
		const secondBody = await secondResponse.json();
		assert.equal("publicId" in secondBody, false);
		assert.equal("managementToken" in secondBody, false);
	});
});
