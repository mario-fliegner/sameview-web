// Unit tests for hosted/src/lib/asset-storage.ts. Every test uses a fresh,
// disposable temporary directory (never the real hosted/data/ path) as the
// injected baseDir, so nothing here ever touches real project state.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { createFilesystemAssetStorage } from "../src/lib/asset-storage.ts";

let baseDir;
let storage;

before(async () => {
	baseDir = await mkdtemp(join(tmpdir(), "sameview-hosted-asset-storage-"));
});

after(async () => {
	await rm(baseDir, { recursive: true, force: true });
});

beforeEach(() => {
	storage = createFilesystemAssetStorage(baseDir);
});

const validKey = {
	internalPublicationId: "3f9a1b2c-1111-4a2b-9c3d-abcdef123456",
	assetVersion: "v1",
	filename: "reference.webp",
};

describe("createFilesystemAssetStorage — put/get/delete contract", () => {
	test("put then get returns the exact same bytes", async () => {
		const data = Buffer.from("hello reference");
		await storage.put(validKey, data);
		const result = await storage.get(validKey);
		assert.ok(result);
		assert.equal(Buffer.compare(result, data), 0);
	});

	test("get on a never-written key returns null", async () => {
		const result = await storage.get({
			internalPublicationId: "never-written-id",
			assetVersion: "v1",
			filename: "capture.webp",
		});
		assert.equal(result, null);
	});

	test("delete removes an existing key", async () => {
		const key = { ...validKey, internalPublicationId: "delete-existing-id" };
		await storage.put(key, Buffer.from("to be deleted"));
		await storage.delete(key);
		const result = await storage.get(key);
		assert.equal(result, null);
	});

	test("delete on a missing key succeeds (idempotent)", async () => {
		await assert.doesNotReject(
			storage.delete({
				internalPublicationId: "never-existed-id",
				assetVersion: "v1",
				filename: "branding.webp",
			}),
		);
	});

	test("a second put to the same key overwrites the content", async () => {
		const key = { ...validKey, internalPublicationId: "overwrite-id" };
		await storage.put(key, Buffer.from("first"));
		await storage.put(key, Buffer.from("second"));
		const result = await storage.get(key);
		assert.equal(result.toString(), "second");
	});

	test("branding.webp is accepted as a valid filename", async () => {
		const key = {
			internalPublicationId: "branding-id",
			assetVersion: "v1",
			filename: "branding.webp",
		};
		await assert.doesNotReject(storage.put(key, Buffer.from("branding")));
	});

	test("the resulting on-disk path matches the exact approved layout", async () => {
		const key = {
			internalPublicationId: "layout-check-id",
			assetVersion: "v7",
			filename: "capture.webp",
		};
		await storage.put(key, Buffer.from("layout"));
		const expectedPath = join(
			baseDir,
			"layout-check-id",
			"versions",
			"v7",
			"capture.webp",
		);
		assert.ok(existsSync(expectedPath));

		// no duplicated "comparisons" segment: baseDir already is the
		// comparisons root, so exactly one "versions" directory should sit
		// directly under the publication-id directory.
		const entries = await readdir(join(baseDir, "layout-check-id"));
		assert.deepEqual(entries, ["versions"]);
	});
});

describe("createFilesystemAssetStorage — unsafe key rejection", () => {
	const unsafeInternalPublicationIds = [
		"..",
		"../x",
		"a/b",
		"a\\b",
		"/etc/passwd",
		"C:\\Windows\\System32",
		"..\\x",
		"",
	];

	for (const unsafeId of unsafeInternalPublicationIds) {
		test(`rejects unsafe internalPublicationId: ${JSON.stringify(unsafeId)}`, async () => {
			await assert.rejects(
				storage.put(
					{ internalPublicationId: unsafeId, assetVersion: "v1", filename: "reference.webp" },
					Buffer.from("x"),
				),
			);
			// nothing should have been written as a side effect of the rejection
			const entries = await readdir(baseDir).catch(() => []);
			assert.ok(!entries.includes(unsafeId));
		});
	}

	test("rejects unsafe assetVersion", async () => {
		await assert.rejects(
			storage.put(
				{ internalPublicationId: "some-id", assetVersion: "../escape", filename: "reference.webp" },
				Buffer.from("x"),
			),
		);
	});

	test("rejects an unsupported filename", async () => {
		await assert.rejects(
			storage.put(
				{ internalPublicationId: "some-id", assetVersion: "v1", filename: "not-allowed.webp" },
				Buffer.from("x"),
			),
		);
	});

	test("rejects unsafe keys on get and delete too, not only put", async () => {
		await assert.rejects(
			storage.get({ internalPublicationId: "..", assetVersion: "v1", filename: "reference.webp" }),
		);
		await assert.rejects(
			storage.delete({ internalPublicationId: "..", assetVersion: "v1", filename: "reference.webp" }),
		);
	});
});
