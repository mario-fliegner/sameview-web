import { createHash, randomBytes } from "node:crypto";

// public_id: 72 random bits (9 bytes), Base64url without padding, 12 chars
// — see docs/HOSTED_COMPARISON_APPROVED_PRODUCT_DECISIONS_2026-08-19.md
// "Identifier formats".
export function generatePublicId(): string {
	return randomBytes(9).toString("base64url");
}

// management_token: 256 random bits (32 bytes), Base64url without padding,
// ~43 chars. Plaintext returned only once by the Publish service; only its
// SHA-256 hash is ever persisted.
export function generateManagementToken(): string {
	return randomBytes(32).toString("base64url");
}

export function hashManagementToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export type DuplicateConstraint =
	| "comparison_id"
	| "public_id"
	| "management_token_hash"
	| "unknown";

// Constraint names come from hosted/drizzle/0000_careless_ser_duncan.sql —
// our own migration, not an assumed/guessed format.
const CONSTRAINT_NAMES: Record<Exclude<DuplicateConstraint, "unknown">, string> = {
	comparison_id: "comparisons_comparison_id_unique",
	public_id: "comparisons_public_id_unique",
	management_token_hash: "comparisons_management_token_hash_unique",
};

interface MysqlDuplicateCause {
	code?: unknown;
	errno?: unknown;
	sqlState?: unknown;
	sqlMessage?: unknown;
}

// Drizzle's mysql2 driver wraps the real duplicate-key error inside
// err.cause rather than exposing code/errno/sqlState/sqlMessage on the
// DrizzleQueryError itself — verified directly against the real local
// MySQL 8.0.46 database via db.insert(...), not assumed from raw mysql2
// behavior. Classifying against err.code here would silently never match.
export function classifyInsertError(err: unknown): DuplicateConstraint {
	if (typeof err !== "object" || err === null) {
		return "unknown";
	}
	const cause = (err as { cause?: unknown }).cause;
	if (typeof cause !== "object" || cause === null) {
		return "unknown";
	}
	const causeRecord = cause as MysqlDuplicateCause;
	if (
		causeRecord.code !== "ER_DUP_ENTRY" ||
		causeRecord.errno !== 1062 ||
		causeRecord.sqlState !== "23000" ||
		typeof causeRecord.sqlMessage !== "string"
	) {
		return "unknown";
	}
	for (const [constraint, constraintName] of Object.entries(CONSTRAINT_NAMES)) {
		if (causeRecord.sqlMessage.includes(constraintName)) {
			return constraint as DuplicateConstraint;
		}
	}
	return "unknown";
}
