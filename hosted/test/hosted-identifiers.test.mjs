// Tests for hosted/src/lib/hosted-identifiers.ts. The duplicate-key
// classification tests exercise the real local sameview_hosted MySQL
// database through Drizzle's own db.insert(...) path, since the wrapped
// err.cause shape was verified empirically (not assumed) against exactly
// this path during Phase 6 Gate 1. Everything runs inside one transaction
// that is always rolled back — no permanent data change.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import {
	boolean,
	char,
	mysqlTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
	classifyInsertError,
	generateManagementToken,
	generatePublicId,
	hashManagementToken,
} from "../src/lib/hosted-identifiers.ts";

describe("generatePublicId", () => {
	test("produces exactly 12 characters", () => {
		assert.equal(generatePublicId().length, 12);
	});

	test("uses only Base64url-compatible characters", () => {
		assert.match(generatePublicId(), /^[A-Za-z0-9_-]{12}$/);
	});

	test("is different across calls", () => {
		assert.notEqual(generatePublicId(), generatePublicId());
	});
});

describe("generateManagementToken", () => {
	test("produces exactly 43 characters", () => {
		assert.equal(generateManagementToken().length, 43);
	});

	test("uses only Base64url-compatible characters", () => {
		assert.match(generateManagementToken(), /^[A-Za-z0-9_-]{43}$/);
	});

	test("is different across calls", () => {
		assert.notEqual(generateManagementToken(), generateManagementToken());
	});
});

describe("hashManagementToken", () => {
	test("produces exactly 64 lowercase hex characters", () => {
		const hash = hashManagementToken(generateManagementToken());
		assert.match(hash, /^[0-9a-f]{64}$/);
	});

	test("is deterministic for the same token", () => {
		const token = generateManagementToken();
		assert.equal(hashManagementToken(token), hashManagementToken(token));
	});

	test("the plaintext token never equals its own hash", () => {
		const token = generateManagementToken();
		assert.notEqual(hashManagementToken(token), token);
	});
});

describe("classifyInsertError — non-duplicate / malformed shapes", () => {
	test("a plain Error returns unknown", () => {
		assert.equal(classifyInsertError(new Error("boom")), "unknown");
	});

	test("null/non-object input returns unknown", () => {
		assert.equal(classifyInsertError(null), "unknown");
		assert.equal(classifyInsertError("boom"), "unknown");
		assert.equal(classifyInsertError(undefined), "unknown");
	});

	test("an error with a cause missing the expected MySQL fields returns unknown", () => {
		const err = new Error("wrapped");
		err.cause = { code: "ER_SOME_OTHER_ERROR", errno: 1234 };
		assert.equal(classifyInsertError(err), "unknown");
	});

	test("an error whose cause is not an object returns unknown", () => {
		const err = new Error("wrapped");
		err.cause = "not an object";
		assert.equal(classifyInsertError(err), "unknown");
	});

	test("a duplicate-shaped cause with an unrecognized constraint name returns unknown", () => {
		const err = new Error("wrapped");
		err.cause = {
			code: "ER_DUP_ENTRY",
			errno: 1062,
			sqlState: "23000",
			sqlMessage: "Duplicate entry 'x' for key 'some_other_table.some_other_unique'",
		};
		assert.equal(classifyInsertError(err), "unknown");
	});
});

describe("classifyInsertError — real Drizzle/MySQL duplicate-key shape", () => {
	const comparisons = mysqlTable("comparisons", {
		id: char("id", { length: 36 }).primaryKey(),
		comparisonId: char("comparison_id", { length: 36 }).notNull().unique(),
		publicId: varchar("public_id", { length: 12 }).notNull().unique(),
		managementTokenHash: varchar("management_token_hash", { length: 64 })
			.notNull()
			.unique(),
		title: varchar("title", { length: 255 }),
		description: text("description"),
		referenceLabel: varchar("reference_label", { length: 255 }).notNull(),
		captureLabel: varchar("capture_label", { length: 255 }).notNull(),
		showDate: boolean("show_date").notNull().default(true),
		locationDisplayName: varchar("location_display_name", { length: 255 }),
		locationCity: varchar("location_city", { length: 255 }),
		locationCountry: varchar("location_country", { length: 255 }),
		brandingType: varchar("branding_type", { length: 50 }),
		brandingBuiltinId: varchar("branding_builtin_id", { length: 100 }),
		background: varchar("background", { length: 10 }).notNull(),
		cornerStyle: varchar("corner_style", { length: 10 }).notNull(),
		activeAssetVersion: varchar("active_asset_version", { length: 36 }),
		status: varchar("status", { length: 20 }).notNull().default("active"),
		createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
	});

	const pool = mysql.createPool(
		"mysql://sameview:sameview@localhost:3306/sameview_hosted",
	);
	const db = drizzle(pool, { mode: "default" });

	after(async () => {
		await pool.end();
	});

	function baseRow(overrides = {}) {
		return {
			id: randomUUID(),
			comparisonId: randomUUID(),
			publicId: generatePublicId(),
			managementTokenHash: hashManagementToken(generateManagementToken()),
			referenceLabel: "ref",
			captureLabel: "cap",
			showDate: true,
			background: "dark",
			cornerStyle: "rounded",
			...overrides,
		};
	}

	async function captureInsertError(rowOverrides) {
		let captured;
		try {
			await db.transaction(async (tx) => {
				const seed = baseRow({});
				await tx.insert(comparisons).values(seed);
				try {
					await tx.insert(comparisons).values(baseRow(rowOverrides(seed)));
				} catch (err) {
					captured = err;
				}
				throw new Error("__intentional_rollback__");
			});
		} catch (err) {
			if (err.message !== "__intentional_rollback__") {
				throw err;
			}
		}
		return captured;
	}

	test("classifies a comparison_id duplicate", async () => {
		const err = await captureInsertError((seed) => ({ comparisonId: seed.comparisonId }));
		assert.ok(err, "expected an insert error to have been captured");
		assert.equal(classifyInsertError(err), "comparison_id");
	});

	test("classifies a public_id duplicate", async () => {
		const err = await captureInsertError((seed) => ({ publicId: seed.publicId }));
		assert.ok(err, "expected an insert error to have been captured");
		assert.equal(classifyInsertError(err), "public_id");
	});

	test("classifies a management_token_hash duplicate", async () => {
		const err = await captureInsertError((seed) => ({
			managementTokenHash: seed.managementTokenHash,
		}));
		assert.ok(err, "expected an insert error to have been captured");
		assert.equal(classifyInsertError(err), "management_token_hash");
	});
});
