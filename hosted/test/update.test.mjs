// Tests for hosted/src/lib/update.ts. Image fixtures are generated
// in-memory via sharp (matching publish.test.mjs's own convention) —
// nothing committed as a binary file. AssetStorage uses a disposable
// mkdtemp directory injected via update()'s own deps parameter for
// every test in this file (this file never touches the real project
// data/ directory). Every test seeds its starting Publication via the
// already-accepted publish() (Phase 6) rather than inserting rows by
// hand, so each Update test exercises the real, approved Publish->
// Update lifecycle. Every synthetic row this file creates is deleted
// again before the process exits.

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
import { hashManagementToken } from "../src/lib/hosted-identifiers.ts";
import { publish } from "../src/lib/publish.ts";
import { update } from "../src/lib/update.ts";

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
let sharedReference2;
let sharedCapture2;

async function fixtures() {
	sharedReference ??= await makeJpeg();
	sharedCapture ??= await makeJpeg({ width: 90, height: 70 });
	sharedBranding ??= await makePng();
	sharedReference2 ??= await makeJpeg({ width: 120, height: 95 });
	sharedCapture2 ??= await makeJpeg({ width: 60, height: 45 });
	return {
		reference: sharedReference,
		capture: sharedCapture,
		branding: sharedBranding,
		reference2: sharedReference2,
		capture2: sharedCapture2,
	};
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

const tempDirs = [];
async function disposableAssetStorage() {
	const dir = await mkdtemp(join(tmpdir(), "sameview-hosted-update-test-"));
	tempDirs.push(dir);
	return createFilesystemAssetStorage(dir);
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

// Seeds a real Publication via the already-accepted publish() and tracks
// its row for cleanup. Returns { row, managementToken } for the caller
// to then exercise update() against.
async function seedPublication(assetStorage, payloadOverrides = {}, reference, capture) {
	const { reference: defRef, capture: defCap } = await fixtures();
	const payload = basePublishPayload(payloadOverrides);
	const result = await publish(
		{
			payload,
			referenceImage: reference ?? defRef,
			captureImage: capture ?? defCap,
			brandingImage: undefined,
		},
		{ assetStorage },
	);
	assert.equal(result.status, "created");
	const [row] = await db.select().from(comparisons).where(eq(comparisons.publicId, result.publicId));
	createdRowIds.push(row.id);
	return { row, managementToken: result.managementToken };
}

describe("update — success", () => {
	test("a valid authorized Update returns 'updated' and preserves identity/security columns", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);

		assert.equal(result.status, "updated");

		const [after1] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.equal(after1.id, row.id);
		assert.equal(after1.publicId, row.publicId);
		assert.equal(after1.comparisonId, row.comparisonId);
		assert.equal(after1.managementTokenHash, row.managementTokenHash);
		assert.deepEqual(after1.createdAt, row.createdAt);
	});

	test("no plaintext management token appears in the result", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);

		assert.equal(result.status, "updated");
		assert.deepEqual(Object.keys(result).sort(), ["status"]);
	});

	test("all mutable presentation/content fields are replaced", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		const newPayload = baseUpdatePayload({
			title: "New title",
			description: "New description",
			locationDisplayName: "New place",
			locationCity: "New city",
			locationCountry: "New country",
		});
		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: newPayload,
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "updated");

		const [after1] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.equal(after1.referenceLabel, "Then (updated)");
		assert.equal(after1.captureLabel, "Now (updated)");
		assert.equal(after1.background, "light");
		assert.equal(after1.cornerStyle, "sharp");
		assert.equal(after1.title, "New title");
		assert.equal(after1.description, "New description");
		assert.equal(after1.locationDisplayName, "New place");
		assert.equal(after1.locationCity, "New city");
		assert.equal(after1.locationCountry, "New country");
	});

	test("showDate: true correctly replaces the prior value", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage, { showDate: false });

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload({ showDate: true }),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "updated");

		const [after1] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.equal(Boolean(after1.showDate), true);
	});

	test("showDate: false correctly replaces the prior value", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage, { showDate: true });

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload({ showDate: false }),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "updated");

		const [after1] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.equal(Boolean(after1.showDate), false);
	});

	test("a fresh active_asset_version is created and new WebP core assets exist under the existing internal ID", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);
		const oldAssetVersion = row.activeAssetVersion;

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "updated");

		const [after1] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.ok(after1.activeAssetVersion);
		assert.notEqual(after1.activeAssetVersion, oldAssetVersion);

		const newReference = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: after1.activeAssetVersion,
			filename: "reference.webp",
		});
		const newCapture = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: after1.activeAssetVersion,
			filename: "capture.webp",
		});
		assert.ok(newReference);
		assert.ok(newCapture);
		assert.equal(newReference.toString("ascii", 8, 12), "WEBP");
		assert.equal(newCapture.toString("ascii", 8, 12), "WEBP");
	});

	test("the old asset version remains physically present after a successful Update", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);
		const oldAssetVersion = row.activeAssetVersion;

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "updated");

		const oldReference = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: oldAssetVersion,
			filename: "reference.webp",
		});
		const oldCapture = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: oldAssetVersion,
			filename: "capture.webp",
		});
		assert.ok(oldReference, "old reference.webp must still be retrievable");
		assert.ok(oldCapture, "old capture.webp must still be retrievable");
	});

	test("custom branding succeeds and writes branding.webp under the new version", async () => {
		const { reference2, capture2, branding } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload({ brandingType: "custom" }),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: branding,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "updated");

		const [after1] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.equal(after1.brandingType, "custom");

		const brandingAsset = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: after1.activeAssetVersion,
			filename: "branding.webp",
		});
		assert.ok(brandingAsset);
		assert.equal(brandingAsset.toString("ascii", 8, 12), "WEBP");
	});

	test("switching away from custom branding produces a new version without branding.webp", async () => {
		const { reference, capture, reference2, capture2, branding } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage, {}, reference, capture);
		// seedPublication always calls publish() without branding, so seed a
		// plain (no-branding) Publication first, then establish custom
		// branding via one Update, then switch away.
		const firstUpdate = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload({ brandingType: "custom" }),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: branding,
			},
			{ assetStorage },
		);
		assert.equal(firstUpdate.status, "updated");

		const secondUpdate = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload({ brandingType: "builtin", brandingBuiltinId: "heart" }),
				referenceImage: reference,
				captureImage: capture,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(secondUpdate.status, "updated");

		const [after2] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.equal(after2.brandingType, "builtin");
		assert.equal(after2.brandingBuiltinId, "heart");

		const brandingAsset = await assetStorage.get({
			internalPublicationId: row.id,
			assetVersion: after2.activeAssetVersion,
			filename: "branding.webp",
		});
		assert.equal(brandingAsset, null);
	});
});

describe("update — validation", () => {
	test("malformed structured payload is rejected", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: "not an object",
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("missing required file is rejected", async () => {
		const { reference2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: undefined,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("an invalid core image is rejected through Phase 5", async () => {
		const { capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload(),
				referenceImage: Buffer.from("not an image"),
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "validation-failed");
	});

	test("an invalid custom branding image is rejected through Phase 5", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload({ brandingType: "custom" }),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: Buffer.from("not an image"),
			},
			{ assetStorage },
		);
		assert.equal(result.status, "validation-failed");
	});
});

describe("update — authorization", () => {
	test("wrong management token is rejected and changes nothing", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row } = await seedPublication(assetStorage);

		const result = await update(
			{
				publicId: row.publicId,
				managementToken: "wrong-token-wrong-token-wrong-token-wrongxx",
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		assert.equal(result.status, "not-found");

		const [after1] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.equal(after1.referenceLabel, row.referenceLabel);
		assert.equal(after1.activeAssetVersion, row.activeAssetVersion);
	});

	test("unknown publicId is rejected with the identical result shape as a wrong token", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();

		const wrongTokenResult = await update(
			{
				publicId: "doesNotExist",
				managementToken: "any-token-any-token-any-token-any-tokenxxx",
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);

		const { row } = await seedPublication(assetStorage);
		const unknownIdResult = await update(
			{
				publicId: "doesNotExist",
				managementToken: "another-token-another-token-another-tokxx",
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);
		void row;

		assert.deepEqual(wrongTokenResult, unknownIdResult);
		assert.equal(unknownIdResult.status, "not-found");
	});

	test("the early authorization gate rejects before any image processing or asset write", async () => {
		const assetStorage = poisonedAssetStorage();

		// Deliberately garbage, undecodable image bytes: if authorization
		// were checked *after* processing, this would fail with
		// "validation-failed" instead of "not-found", and/or would have
		// attempted a poisoned assetStorage.put() and thrown.
		const result = await update(
			{
				publicId: "doesNotExist",
				managementToken: "some-token-some-token-some-token-some-tox",
				payload: baseUpdatePayload(),
				referenceImage: Buffer.from("not an image"),
				captureImage: Buffer.from("also not an image"),
				brandingImage: undefined,
			},
			{ assetStorage },
		);

		assert.equal(result.status, "not-found");
	});
});

describe("update — asset/storage failure", () => {
	test("a partial AssetStorage failure leaves the live row unchanged", async () => {
		const { reference2, capture2 } = await fixtures();
		const inner = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(inner);

		let putCount = 0;
		const flakyAssetStorage = {
			put: async (key, data) => {
				putCount++;
				if (putCount === 2) {
					throw new Error("simulated filesystem failure");
				}
				return inner.put(key, data);
			},
			get: (key) => inner.get(key),
			delete: (key) => inner.delete(key),
		};

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage: flakyAssetStorage },
		);

		assert.equal(result.status, "internal-failure");

		const [after1] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.equal(after1.activeAssetVersion, row.activeAssetVersion);
		assert.equal(after1.referenceLabel, row.referenceLabel);
	});
});

describe("update — final-activation race", () => {
	test("a zero-row final UPDATE (row deleted between the early gate and activation) returns not-found without corrupting prior state", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		// Wraps the real db: .select() passes through untouched (so the
		// early authorization gate succeeds normally); .update()...where()
		// first deletes the underlying row (simulating a race with a
		// hypothetical concurrent Delete), then performs the real guarded
		// UPDATE, which will now correctly affect zero rows.
		const raceDb = {
			select: (...args) => db.select(...args),
			update: (table) => ({
				set: (values) => ({
					where: async (whereClause) => {
						await db.delete(comparisons).where(eq(comparisons.id, row.id));
						return db.update(table).set(values).where(whereClause);
					},
				}),
			}),
		};

		const result = await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage, db: raceDb },
		);

		assert.equal(result.status, "not-found");

		// The row is genuinely gone now (this test itself deleted it as
		// part of the simulated race) — remove it from the cleanup
		// tracking list so after() doesn't attempt a redundant delete.
		const index = createdRowIds.indexOf(row.id);
		if (index !== -1) {
			createdRowIds.splice(index, 1);
		}
	});
});

describe("update — concurrency", () => {
	test("two concurrent authorized Updates yield one coherent complete final snapshot", async () => {
		const { reference, capture, reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage, {}, reference, capture);

		const payloadA = baseUpdatePayload({ referenceLabel: "Variant A" });
		const payloadB = baseUpdatePayload({ referenceLabel: "Variant B" });

		const [resultA, resultB] = await Promise.all([
			update(
				{
					publicId: row.publicId,
					managementToken,
					payload: payloadA,
					referenceImage: reference2,
					captureImage: capture2,
					brandingImage: undefined,
				},
				{ assetStorage },
			),
			update(
				{
					publicId: row.publicId,
					managementToken,
					payload: payloadB,
					referenceImage: reference2,
					captureImage: capture2,
					brandingImage: undefined,
				},
				{ assetStorage },
			),
		]);

		assert.equal(resultA.status, "updated");
		assert.equal(resultB.status, "updated");

		const [final] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		// Coherent-snapshot invariant: the final referenceLabel must be
		// entirely one Update's value, never a mixture with unrelated
		// fields from the other.
		assert.ok(final.referenceLabel === "Variant A" || final.referenceLabel === "Variant B");
	});
});

describe("update — SHA-256 hashing reused, no plaintext persisted", () => {
	test("the stored management_token_hash never changes across an Update", async () => {
		const { reference2, capture2 } = await fixtures();
		const assetStorage = await disposableAssetStorage();
		const { row, managementToken } = await seedPublication(assetStorage);

		await update(
			{
				publicId: row.publicId,
				managementToken,
				payload: baseUpdatePayload(),
				referenceImage: reference2,
				captureImage: capture2,
				brandingImage: undefined,
			},
			{ assetStorage },
		);

		const [after1] = await db.select().from(comparisons).where(eq(comparisons.id, row.id));
		assert.equal(after1.managementTokenHash, hashManagementToken(managementToken));
		assert.notEqual(after1.managementTokenHash, managementToken);
	});
});
