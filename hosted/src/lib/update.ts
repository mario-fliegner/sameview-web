import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
	type AssetStorage,
	createFilesystemAssetStorage,
	DEFAULT_ASSET_STORAGE_BASE_DIR,
} from "./asset-storage.ts";
import { processBrandingImage } from "./branding-processing.ts";
import { db as defaultDb } from "../db/client.ts";
import { comparisons } from "../db/schema.ts";
import { hashManagementToken } from "./hosted-identifiers.ts";
import { processCoreImage } from "./image-processing.ts";

// Pure orchestration for the Hosted Update operation — see
// docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md Phase 7. No HTTP
// concepts here; hosted/src/pages/api/comparisons/[publicId].ts is the
// sole HTTP adapter over this module.
//
// Deliberately not shared with hosted/src/lib/publish.ts (Phase 6,
// already accepted) — the overlapping validation logic below is
// duplicated rather than extracted, per the approved Gate-2 scope, to
// keep this phase isolated, reversible and free of regression risk to
// the accepted Phase-6 implementation.

const BUILTIN_BRANDING_IDS = new Set(["heart", "star", "camera", "home", "pin", "fire"]);

const ALLOWED_PAYLOAD_KEYS = new Set([
	"referenceLabel",
	"captureLabel",
	"showDate",
	"background",
	"cornerStyle",
	"title",
	"description",
	"locationDisplayName",
	"locationCity",
	"locationCountry",
	"brandingType",
	"brandingBuiltinId",
]);

export interface UpdateRequest {
	publicId: string;
	managementToken: string | undefined;
	payload: unknown;
	referenceImage: Buffer | undefined;
	captureImage: Buffer | undefined;
	brandingImage: Buffer | undefined;
}

export interface UpdateDependencies {
	db?: typeof defaultDb;
	assetStorage?: AssetStorage;
}

export type UpdateResult =
	| { status: "updated" }
	| { status: "validation-failed"; reason: string }
	| { status: "not-found" }
	| { status: "internal-failure"; reason: string };

interface ValidatedPayload {
	referenceLabel: string;
	captureLabel: string;
	showDate: boolean;
	background: "dark" | "light";
	cornerStyle: "rounded" | "sharp";
	title: string | null;
	description: string | null;
	locationDisplayName: string | null;
	locationCity: string | null;
	locationCountry: string | null;
	brandingType: "builtin" | "custom" | null;
	brandingBuiltinId: string | null;
}

type ValidationOutcome<T> = { ok: true; value: T } | { ok: false; reason: string };

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

// Rejects any unrecognized top-level key rather than silently ignoring it
// — same allowlist discipline as Publish's validatePayload (Revision 4
// §20's "allowlisted structured fields" requirement).
function validatePayload(payload: unknown): ValidationOutcome<ValidatedPayload> {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
		return { ok: false, reason: "payload must be a JSON object" };
	}
	const record = payload as Record<string, unknown>;

	for (const key of Object.keys(record)) {
		if (!ALLOWED_PAYLOAD_KEYS.has(key)) {
			return { ok: false, reason: `unknown field: ${key}` };
		}
	}

	if (!isNonEmptyString(record.referenceLabel)) {
		return { ok: false, reason: "referenceLabel must be a non-empty string" };
	}
	if (!isNonEmptyString(record.captureLabel)) {
		return { ok: false, reason: "captureLabel must be a non-empty string" };
	}
	if (typeof record.showDate !== "boolean") {
		return { ok: false, reason: "showDate must be a boolean" };
	}
	if (record.background !== "dark" && record.background !== "light") {
		return { ok: false, reason: 'background must be "dark" or "light"' };
	}
	if (record.cornerStyle !== "rounded" && record.cornerStyle !== "sharp") {
		return { ok: false, reason: 'cornerStyle must be "rounded" or "sharp"' };
	}

	for (const key of [
		"title",
		"description",
		"locationDisplayName",
		"locationCity",
		"locationCountry",
	] as const) {
		if (record[key] !== undefined && typeof record[key] !== "string") {
			return { ok: false, reason: `${key} must be a string when present` };
		}
	}

	let brandingType: "builtin" | "custom" | null = null;
	if (record.brandingType !== undefined) {
		if (record.brandingType !== "builtin" && record.brandingType !== "custom") {
			return { ok: false, reason: 'brandingType must be "builtin" or "custom" when present' };
		}
		brandingType = record.brandingType;
	}

	let brandingBuiltinId: string | null = null;
	if (brandingType === "builtin") {
		if (
			!isNonEmptyString(record.brandingBuiltinId) ||
			!BUILTIN_BRANDING_IDS.has(record.brandingBuiltinId)
		) {
			return { ok: false, reason: "brandingBuiltinId must be one of the approved built-in IDs" };
		}
		brandingBuiltinId = record.brandingBuiltinId;
	} else if (record.brandingBuiltinId !== undefined) {
		return {
			ok: false,
			reason: 'brandingBuiltinId is only allowed when brandingType is "builtin"',
		};
	}

	return {
		ok: true,
		value: {
			referenceLabel: record.referenceLabel as string,
			captureLabel: record.captureLabel as string,
			showDate: record.showDate as boolean,
			background: record.background as "dark" | "light",
			cornerStyle: record.cornerStyle as "rounded" | "sharp",
			title: typeof record.title === "string" ? record.title : null,
			description: typeof record.description === "string" ? record.description : null,
			locationDisplayName:
				typeof record.locationDisplayName === "string" ? record.locationDisplayName : null,
			locationCity: typeof record.locationCity === "string" ? record.locationCity : null,
			locationCountry:
				typeof record.locationCountry === "string" ? record.locationCountry : null,
			brandingType,
			brandingBuiltinId,
		},
	};
}

function validateBinaries(
	payload: ValidatedPayload,
	request: UpdateRequest,
): ValidationOutcome<true> {
	if (!Buffer.isBuffer(request.referenceImage)) {
		return { ok: false, reason: "reference image is required" };
	}
	if (!Buffer.isBuffer(request.captureImage)) {
		return { ok: false, reason: "capture image is required" };
	}
	if (payload.brandingType === "custom") {
		if (!Buffer.isBuffer(request.brandingImage)) {
			return { ok: false, reason: "branding image is required for custom branding" };
		}
	} else if (request.brandingImage !== undefined) {
		return { ok: false, reason: "branding image is only allowed for custom branding" };
	}
	return { ok: true, value: true };
}

export async function update(
	request: UpdateRequest,
	deps: UpdateDependencies = {},
): Promise<UpdateResult> {
	const db = deps.db ?? defaultDb;
	const assetStorage =
		deps.assetStorage ?? createFilesystemAssetStorage(DEFAULT_ASSET_STORAGE_BASE_DIR);

	const payloadResult = validatePayload(request.payload);
	if (!payloadResult.ok) {
		return { status: "validation-failed", reason: payloadResult.reason };
	}
	const payload = payloadResult.value;

	const binariesResult = validateBinaries(payload, request);
	if (!binariesResult.ok) {
		return { status: "validation-failed", reason: binariesResult.reason };
	}

	if (!isNonEmptyString(request.managementToken)) {
		return { status: "validation-failed", reason: "managementToken is required" };
	}
	const managementTokenHash = hashManagementToken(request.managementToken);

	// Early authorization/existence gate — a pure read, no lasting effect.
	// Rejects before any image processing or permanent asset write, so an
	// unauthenticated caller cannot force expensive work merely by knowing
	// a (non-secret) public_id. This is NOT the authority boundary itself;
	// the final guarded UPDATE below is re-evaluated fresh and remains
	// solely authoritative regardless of what this lookup observed.
	const [existingRow] = await db
		.select({ id: comparisons.id })
		.from(comparisons)
		.where(
			and(
				eq(comparisons.publicId, request.publicId),
				eq(comparisons.managementTokenHash, managementTokenHash),
			),
		);
	if (!existingRow) {
		return { status: "not-found" };
	}
	const internalPublicationId = existingRow.id;

	// validateBinaries already proved these are Buffers.
	const referenceImage = request.referenceImage as Buffer;
	const captureImage = request.captureImage as Buffer;

	const referenceResult = await processCoreImage(referenceImage);
	if (!referenceResult.ok) {
		return {
			status: "validation-failed",
			reason: `reference image: ${referenceResult.error.code}`,
		};
	}
	const captureResult = await processCoreImage(captureImage);
	if (!captureResult.ok) {
		return { status: "validation-failed", reason: `capture image: ${captureResult.error.code}` };
	}

	let brandingResultData: Buffer | null = null;
	if (payload.brandingType === "custom") {
		const brandingImage = request.brandingImage as Buffer;
		const brandingResult = await processBrandingImage(brandingImage);
		if (!brandingResult.ok) {
			return {
				status: "validation-failed",
				reason: `branding image: ${brandingResult.error.code}`,
			};
		}
		brandingResultData = brandingResult.value.data;
	}

	const assetVersion = randomUUID();

	try {
		await assetStorage.put(
			{ internalPublicationId, assetVersion, filename: "reference.webp" },
			referenceResult.value.data,
		);
		await assetStorage.put(
			{ internalPublicationId, assetVersion, filename: "capture.webp" },
			captureResult.value.data,
		);
		if (brandingResultData) {
			await assetStorage.put(
				{ internalPublicationId, assetVersion, filename: "branding.webp" },
				brandingResultData,
			);
		}
	} catch {
		// The live row is untouched — activation is never attempted. Any
		// files already written under this fresh, never-activated version
		// become a Phase-10 cleanup candidate; nothing is deleted here.
		return { status: "internal-failure", reason: "asset storage write failed" };
	}

	try {
		const result = await db
			.update(comparisons)
			.set({
				title: payload.title,
				description: payload.description,
				referenceLabel: payload.referenceLabel,
				captureLabel: payload.captureLabel,
				showDate: payload.showDate,
				locationDisplayName: payload.locationDisplayName,
				locationCity: payload.locationCity,
				locationCountry: payload.locationCountry,
				brandingType: payload.brandingType,
				brandingBuiltinId: payload.brandingBuiltinId,
				background: payload.background,
				cornerStyle: payload.cornerStyle,
				activeAssetVersion: assetVersion,
			})
			.where(
				and(
					eq(comparisons.publicId, request.publicId),
					eq(comparisons.managementTokenHash, managementTokenHash),
				),
			);
		// mysql2 UPDATE result: [ResultSetHeader, FieldPacket[]] — verified
		// directly against the real local database, not assumed.
		const affectedRows = result[0].affectedRows;
		if (affectedRows === 0) {
			return { status: "not-found" };
		}
		return { status: "updated" };
	} catch {
		return { status: "internal-failure", reason: "unexpected database error" };
	}
}
