// Unit tests for hosted/src/lib/temp-storage.ts. Every test uses a fresh,
// disposable temporary directory (never the real hosted/data/ path) as the
// injected baseDir, so nothing here ever touches real project state.

import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { createFilesystemAssetStorage } from "../src/lib/asset-storage.ts";
import { createFilesystemTempStorage } from "../src/lib/temp-storage.ts";

let baseDir;
let assetBaseDir;
let storage;

before(async () => {
	baseDir = await mkdtemp(join(tmpdir(), "sameview-hosted-temp-storage-"));
	assetBaseDir = await mkdtemp(join(tmpdir(), "sameview-hosted-asset-storage-iso-"));
});

after(async () => {
	await rm(baseDir, { recursive: true, force: true });
	await rm(assetBaseDir, { recursive: true, force: true });
});

beforeEach(() => {
	storage = createFilesystemTempStorage(baseDir);
});

describe("createFilesystemTempStorage — put/get/delete contract", () => {
	test("put then get returns the exact same bytes", async () => {
		const data = Buffer.from("temporary upload copy");
		await storage.put("upload-1", data);
		const result = await storage.get("upload-1");
		assert.ok(result);
		assert.equal(Buffer.compare(result, data), 0);
	});

	test("get on a never-written key returns null", async () => {
		const result = await storage.get("never-written-key");
		assert.equal(result, null);
	});

	test("delete removes an existing key", async () => {
		await storage.put("delete-existing", Buffer.from("x"));
		await storage.delete("delete-existing");
		const result = await storage.get("delete-existing");
		assert.equal(result, null);
	});

	test("delete on a missing key succeeds (idempotent)", async () => {
		await assert.doesNotReject(storage.delete("never-existed"));
	});
});

describe("createFilesystemTempStorage — isolation from permanent asset storage", () => {
	test("a temp key and an asset key with the same identifier never collide on disk", async () => {
		const assetStorage = createFilesystemAssetStorage(assetBaseDir);
		const sharedId = "shared-identifier";

		await storage.put(sharedId, Buffer.from("temp content"));
		await assetStorage.put(
			{ internalPublicationId: sharedId, assetVersion: "v1", filename: "reference.webp" },
			Buffer.from("asset content"),
		);

		const tempResult = await storage.get(sharedId);
		const assetResult = await assetStorage.get({
			internalPublicationId: sharedId,
			assetVersion: "v1",
			filename: "reference.webp",
		});

		assert.equal(tempResult.toString(), "temp content");
		assert.equal(assetResult.toString(), "asset content");

		// stored under entirely separate base directories
		const tempEntries = await readdir(baseDir);
		const assetEntries = await readdir(assetBaseDir);
		assert.ok(tempEntries.includes(sharedId));
		assert.ok(assetEntries.includes(sharedId));
		assert.notEqual(baseDir, assetBaseDir);
	});
});

describe("createFilesystemTempStorage — unsafe key rejection", () => {
	const unsafeKeys = [
		"..",
		"../x",
		"a/b",
		"a\\b",
		"/etc/passwd",
		"C:\\Windows\\System32",
		"..\\x",
		"",
	];

	for (const unsafeKey of unsafeKeys) {
		test(`rejects unsafe key: ${JSON.stringify(unsafeKey)}`, async () => {
			await assert.rejects(storage.put(unsafeKey, Buffer.from("x")));
			await assert.rejects(storage.get(unsafeKey));
			await assert.rejects(storage.delete(unsafeKey));
		});
	}
});
