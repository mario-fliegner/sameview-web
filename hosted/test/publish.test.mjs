// Tests for hosted/src/lib/publish.ts. Image fixtures are generated
// in-memory via sharp (matching image-processing.test.mjs /
// branding-processing.test.mjs's own convention) — nothing committed as a
// binary file. AssetStorage uses a disposable mkdtemp directory injected
// via publish()'s own deps parameter for every test in this file except
// none (this file never touches the real project data/ directory).
// Success/uniqueness/collision cases use the real local sameview_hosted
// MySQL database (the only way to prove real UNIQUE-constraint
// arbitration); every synthetic row this file creates is deleted again
// before the process exits.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { closeDb, db } from "../src/db/client.ts";
import { comparisons } from "../src/db/schema.ts";
import { createFilesystemAssetStorage } from "../src/lib/asset-storage.ts";
import {
	generateManagementToken,
	generatePublicId,
	hashManagementToken,
} from "../src/lib/hosted-identifiers.ts";
import { publish } from "../src/lib/publish.ts";

async function makeJpeg({ width = 100, height = 80 } = {}) {
	return sharp({
		create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
	})
		.jpeg({ quality: 90 })
		.toBuffer();
}

async function makePng({ width = 512, height = 512 } = {}) {
	return sharp({
		create: { width, height, channels: 4, background: { r: 50, g: 100, b: 150, alpha: 1 } },
	})
		.png()
		.toBuffer();
}

let sharedReference;
let sharedCapture;
let sharedBranding;

async function fixtures() {
	sharedReference ??= await makeJpeg();
	sharedCapture ??= await makeJpeg({ width: 90, height: 70 });
	sharedBranding ??= await makePng();
	return { reference: sharedReference, capture: sharedCapture, branding: sharedBranding };
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

const tempDirs = [];
async function disposableAssetStorage() {
	const dir = await mkdtemp(join(tmpdir(), "sameview-hosted-publish-test-"));
	tempDirs.push(dir);
	return createFilesystemAssetStorage(dir);
}

function countingAssetStorage(inner) {
	let putCount = 0;
	return {
		put: async (key, data) => {
			putCount++;
			return inner.put(key, data);
		},
		get: (key) => inner.get(key),
		delete: (key) => inner.delete(key),
		getPutCount: () => putCount,
	};
}

function poisonedAssetStorage() {
	return {
		put: async () => {
			throw new Error("assetStorage.put must not be called for this case");
		},
		get: async () => null,
		delete: async () => {},
	};
}

function poisonedDb() {
	return {
		insert: () => ({
			values: async () => {
				throw new Error("db.insert must not be called for this case");
			},
		}),
	};
}

const createdRowIds = [];
async function cleanupRow(id) {
	if (id) {
		await db.delete(comparisons).where(eq(comparisons.id, id));
	}
}

after(async () => {
	for (const id of createdRowIds) {
		await cleanupRow(id);
	}
	for (const dir of tempDirs) {
		await rm(dir, { recursive: true, force: true });
	}
	await closeDb();
});

async function publishAndTrack(request, deps) {
	const result = await publish(request, deps);
	if (result.status === "created") {
		const [row] = await db
			.select()
			.from(comparisons)
			.where(eq(comparisons.publicId, result.publicId));
		if (row) {
			createdRowIds.push(row.id);
		}
	}
	return result;
}

describe("publish — success", () => {
	test("a fresh comparisonId creates exactly one row", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const payload = basePayload();

		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);

		assert.equal(result.status, "created");
		const rows = await db
			.select()
			.from(comparisons)
			.where(eq(comparisons.comparisonId, payload.comparisonId));
		assert.equal(rows.length, 1);
	});

	test("showDate: true persists as a truthy value", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const payload = basePayload({ showDate: true });

		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(result.status, "created");

		const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
		assert.equal(Boolean(row.showDate), true);
	});

	test("showDate: false persists as a falsy value", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const payload = basePayload({ showDate: false });

		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(result.status, "created");

		const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
		assert.equal(Boolean(row.showDate), false);
	});

	test("title/description/location present are persisted", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const payload = basePayload({
			title: "My Comparison",
			description: "A description",
			locationDisplayName: "Somewhere",
			locationCity: "Some City",
			locationCountry: "Some Country",
		});

		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(result.status, "created");

		const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
		assert.equal(row.title, "My Comparison");
		assert.equal(row.description, "A description");
		assert.equal(row.locationDisplayName, "Somewhere");
		assert.equal(row.locationCity, "Some City");
		assert.equal(row.locationCountry, "Some Country");
	});

	test("absent title/description/location persist as NULL", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const payload = basePayload();

		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(result.status, "created");

		const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
		assert.equal(row.title, null);
		assert.equal(row.description, null);
		assert.equal(row.locationDisplayName, null);
		assert.equal(row.locationCity, null);
		assert.equal(row.locationCountry, null);
	});

	test("built-in branding persists semantic configuration and writes no branding.webp", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const payload = basePayload({ brandingType: "builtin", brandingBuiltinId: "heart" });

		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(result.status, "created");

		const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
		assert.equal(row.brandingType, "builtin");
		assert.equal(row.brandingBuiltinId, "heart");

		const brandingAsset = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: row.activeAssetVersion,
			filename: "branding.webp",
		});
		assert.equal(brandingAsset, null);
	});

	test("custom branding writes branding.webp", async () => {
		const { reference, capture, branding } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const payload = basePayload({ brandingType: "custom" });

		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: branding },
			{ assetStorage },
		);
		assert.equal(result.status, "created");

		const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
		assert.equal(row.brandingType, "custom");

		const brandingAsset = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: row.activeAssetVersion,
			filename: "branding.webp",
		});
		assert.ok(brandingAsset);
		assert.equal(brandingAsset.toString("ascii", 8, 12), "WEBP");
	});

	test("reference/capture are stored and retrievable, active_asset_version matches", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const payload = basePayload();

		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(result.status, "created");

		const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
		assert.ok(row.activeAssetVersion);

		const storedReference = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: row.activeAssetVersion,
			filename: "reference.webp",
		});
		const storedCapture = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: row.activeAssetVersion,
			filename: "capture.webp",
		});
		assert.ok(storedReference);
		assert.ok(storedCapture);
		assert.equal(storedReference.toString("ascii", 8, 12), "WEBP");
		assert.equal(storedCapture.toString("ascii", 8, 12), "WEBP");
	});

	test("success returns publicId and a plaintext managementToken never persisted, hash matches", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const payload = basePayload();

		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(result.status, "created");
		assert.ok(result.publicId);
		assert.ok(result.managementToken);

		const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
		assert.notEqual(row.managementTokenHash, result.managementToken);
		assert.equal(row.managementTokenHash, hashManagementToken(result.managementToken));
	});
});

describe("publish — validation", () => {
	test("malformed structured payload is rejected", async () => {
		const result = await publish(
			{ payload: "not an object", referenceImage: undefined, captureImage: undefined, brandingImage: undefined },
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("an unknown structured field is rejected", async () => {
		const payload = { ...basePayload(), extraField: "not allowed" };
		const result = await publish(
			{ payload, referenceImage: undefined, captureImage: undefined, brandingImage: undefined },
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("missing reference is rejected", async () => {
		const { capture } = await fixtures();
		const result = await publish(
			{ payload: basePayload(), referenceImage: undefined, captureImage: capture, brandingImage: undefined },
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("missing capture is rejected", async () => {
		const { reference } = await fixtures();
		const result = await publish(
			{ payload: basePayload(), referenceImage: reference, captureImage: undefined, brandingImage: undefined },
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("an invalid (undecodable) reference image is rejected through Phase 5", async () => {
		const { capture } = await fixtures();
		const result = await publish(
			{
				payload: basePayload(),
				referenceImage: Buffer.from("not an image"),
				captureImage: capture,
				brandingImage: undefined,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("an invalid custom branding image is rejected through Phase 5", async () => {
		const { reference, capture } = await fixtures();
		const result = await publish(
			{
				payload: basePayload({ brandingType: "custom" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: Buffer.from("not an image"),
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("custom branding without a branding file is rejected", async () => {
		const { reference, capture } = await fixtures();
		const result = await publish(
			{
				payload: basePayload({ brandingType: "custom" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: undefined,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("built-in branding with a branding file is rejected", async () => {
		const { reference, capture, branding } = await fixtures();
		const result = await publish(
			{
				payload: basePayload({ brandingType: "builtin", brandingBuiltinId: "heart" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: branding,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("built-in branding without an ID is rejected", async () => {
		const { reference, capture } = await fixtures();
		const result = await publish(
			{
				payload: basePayload({ brandingType: "builtin" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: undefined,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("custom branding with a built-in ID is rejected", async () => {
		const { reference, capture, branding } = await fixtures();
		const result = await publish(
			{
				payload: basePayload({ brandingType: "custom", brandingBuiltinId: "heart" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: branding,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("no branding type with a branding file is rejected", async () => {
		const { reference, capture, branding } = await fixtures();
		const result = await publish(
			{ payload: basePayload(), referenceImage: reference, captureImage: capture, brandingImage: branding },
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("no branding type with a branding ID is rejected", async () => {
		const { reference, capture } = await fixtures();
		const result = await publish(
			{
				payload: basePayload({ brandingBuiltinId: "heart" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: undefined,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("an invalid background value is rejected", async () => {
		const { reference, capture } = await fixtures();
		const result = await publish(
			{
				payload: basePayload({ background: "purple" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: undefined,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("an invalid corner style value is rejected", async () => {
		const { reference, capture } = await fixtures();
		const result = await publish(
			{
				payload: basePayload({ cornerStyle: "wavy" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: undefined,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("a missing/non-boolean showDate is rejected", async () => {
		const { reference, capture } = await fixtures();
		const payloadWithoutShowDate = basePayload();
		delete payloadWithoutShowDate.showDate;
		const result = await publish(
			{ payload: payloadWithoutShowDate, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");

		const nonBooleanResult = await publish(
			{
				payload: basePayload({ showDate: "true" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: undefined,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(nonBooleanResult.status, "validation-failed");
	});

	test("an invalid/non-v4 comparisonId is rejected", async () => {
		const { reference, capture } = await fixtures();
		const result = await publish(
			{
				payload: basePayload({ comparisonId: "not-a-uuid" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: undefined,
			},
			{ db: poisonedDb(), assetStorage: poisonedAssetStorage() },
		);
		assert.equal(result.status, "validation-failed");
	});
});

describe("publish — DB uniqueness / concurrency", () => {
	test("two concurrent Publish calls for the same comparisonId create only one row", async () => {
		const { reference, capture } = await fixtures();
		const assetStorageA = await disposableAssetStorage();
		const assetStorageB = await disposableAssetStorage();
		const payload = basePayload();

		const [resultA, resultB] = await Promise.all([
			publishAndTrack(
				{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
				{ assetStorage: assetStorageA },
			),
			publishAndTrack(
				{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
				{ assetStorage: assetStorageB },
			),
		]);

		const statuses = [resultA.status, resultB.status].sort();
		assert.deepEqual(statuses, ["conflict", "created"]);

		const rows = await db
			.select()
			.from(comparisons)
			.where(eq(comparisons.comparisonId, payload.comparisonId));
		assert.equal(rows.length, 1);

		const conflictResult = resultA.status === "conflict" ? resultA : resultB;
		assert.equal("publicId" in conflictResult, false);
		assert.equal("managementToken" in conflictResult, false);
	});
});

describe("publish — generated-identifier collision behavior", () => {
	test("a public_id collision is retried and only the colliding identifier is regenerated", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = countingAssetStorage(await disposableAssetStorage());

		// Seed a real row occupying a known public_id.
		const seedPayload = basePayload();
		const seedResult = await publishAndTrack(
			{ payload: seedPayload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(seedResult.status, "created");
		const collidingPublicId = seedResult.publicId;

		let calls = 0;
		const managementTokenCalls = [];

		const payload = basePayload();
		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{
				assetStorage,
				generatePublicId: () => {
					calls++;
					return calls === 1 ? collidingPublicId : generatePublicId();
				},
				generateManagementToken: () => {
					managementTokenCalls.push(1);
					return generateManagementToken();
				},
			},
		);

		assert.equal(result.status, "created");
		assert.equal(calls, 2, "expected exactly one retry (two generation calls)");
		assert.notEqual(result.publicId, collidingPublicId);
		// Only the colliding identifier (publicId) was regenerated — the
		// management token generator is still called once per attempt as
		// part of the initial setup, but no *extra* token regeneration
		// should occur for a pure public_id collision.
		assert.equal(managementTokenCalls.length, 1);
	});

	test("a management_token_hash collision is retried and only the token is regenerated", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();

		const seedPayload = basePayload();
		const seedResult = await publishAndTrack(
			{ payload: seedPayload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(seedResult.status, "created");
		const collidingHash = hashManagementToken(seedResult.managementToken);

		let tokenCalls = 0;
		let publicIdCalls = 0;
		// Force the first generated token to hash to the same value the seed
		// row already used, by directly returning the seed's own plaintext
		// token on the first call (same input -> same SHA-256 output).
		const payload = basePayload();
		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{
				assetStorage,
				generatePublicId: () => {
					publicIdCalls++;
					return generatePublicId();
				},
				generateManagementToken: () => {
					tokenCalls++;
					return tokenCalls === 1 ? seedResult.managementToken : generateManagementToken();
				},
			},
		);

		assert.equal(result.status, "created");
		assert.equal(tokenCalls, 2, "expected exactly one retry (two token generation calls)");
		assert.equal(publicIdCalls, 1, "public_id should not be regenerated for a token-hash collision");
		assert.notEqual(hashManagementToken(result.managementToken), collidingHash);
	});

	test("the asset version is reused and assets are not rewritten across retries", async () => {
		const { reference, capture } = await fixtures();
		const inner = await disposableAssetStorage();
		const assetStorage = countingAssetStorage(inner);

		const seedPayload = basePayload();
		const seedResult = await publishAndTrack(
			{ payload: seedPayload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(seedResult.status, "created");
		const collidingPublicId = seedResult.publicId;

		const countBeforeRetryCase = assetStorage.getPutCount();

		let calls = 0;
		const payload = basePayload();
		const result = await publishAndTrack(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{
				assetStorage,
				generatePublicId: () => {
					calls++;
					return calls === 1 ? collidingPublicId : generatePublicId();
				},
			},
		);

		assert.equal(result.status, "created");
		// reference.webp + capture.webp = 2 put() calls for this one publish,
		// regardless of the one forced public_id retry in between.
		assert.equal(assetStorage.getPutCount() - countBeforeRetryCase, 2);
	});

	test("retry exhaustion after 5 attempts is deterministic and creates no row", async () => {
		const { reference, capture } = await fixtures();
		const assetStorage = await disposableAssetStorage();

		// Seed a real row that permanently occupies the fixed public_id every
		// attempt below will keep colliding against, so all 5 attempts are a
		// genuine constraint violation, not an accidental first-try success.
		const seedPayload = basePayload();
		const seedResult = await publishAndTrack(
			{ payload: seedPayload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{ assetStorage },
		);
		assert.equal(seedResult.status, "created");
		const alwaysCollidingPublicId = seedResult.publicId;

		const payload = basePayload();
		let calls = 0;
		const result = await publish(
			{ payload, referenceImage: reference, captureImage: capture, brandingImage: undefined },
			{
				assetStorage,
				generatePublicId: () => {
					calls++;
					return alwaysCollidingPublicId;
				},
			},
		);

		assert.equal(result.status, "internal-failure");
		assert.equal(calls, 5);

		const rows = await db
			.select()
			.from(comparisons)
			.where(eq(comparisons.comparisonId, payload.comparisonId));
		assert.equal(rows.length, 0);
	});
});
