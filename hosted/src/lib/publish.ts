import { randomUUID } from "node:crypto";
import {
	type AssetStorage,
	createFilesystemAssetStorage,
	DEFAULT_ASSET_STORAGE_BASE_DIR,
} from "./asset-storage.ts";
import { processBrandingImage } from "./branding-processing.ts";
import { db as defaultDb } from "../db/client.ts";
import { comparisons } from "../db/schema.ts";
import {
	classifyInsertError,
	generateManagementToken,
	generatePublicId,
	hashManagementToken,
} from "./hosted-identifiers.ts";
import { processCoreImage } from "./image-processing.ts";

// Pure orchestration for the Hosted Publish operation — see
// docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md Phase 6. No HTTP
// concepts here; hosted/src/pages/api/comparisons.ts is the sole HTTP
// adapter over this module.

const BUILTIN_BRANDING_IDS = new Set(["heart", "star", "camera", "home", "pin", "fire"]);

const UUID_V4_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_PAYLOAD_KEYS = new Set([
	"comparisonId",
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

// Bounded retry count for a generated (public_id / management_token_hash)
// collision — an implementation-level engineering choice: Identifier
// Formats only says "regenerate on the extremely unlikely event of
// collision" without a fixed number; 5 is generous headroom given the
// underlying 72-/256-bit random spaces.
const MAX_GENERATED_ID_ATTEMPTS = 5;

export interface PublishRequest {
	payload: unknown;
	referenceImage: Buffer | undefined;
	captureImage: Buffer | undefined;
	brandingImage: Buffer | undefined;
}

export interface PublishDependencies {
	db?: typeof defaultDb;
	assetStorage?: AssetStorage;
	generatePublicId?: () => string;
	generateManagementToken?: () => string;
}

export type PublishResult =
	| { status: "created"; publicId: string; managementToken: string }
	| { status: "validation-failed"; reason: string }
	| { status: "conflict" }
	| { status: "internal-failure"; reason: string };

interface ValidatedPayload {
	comparisonId: string;
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
// — Revision 4 §20 requires validating against "allowlisted structured
// fields"; silently dropping an unknown field risks masking a client
// contract mismatch rather than surfacing it.
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

	if (!isNonEmptyString(record.comparisonId) || !UUID_V4_PATTERN.test(record.comparisonId)) {
		return { ok: false, reason: "comparisonId must be a valid UUID v4" };
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
			comparisonId: record.comparisonId as string,
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
	request: PublishRequest,
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

export async function publish(
	request: PublishRequest,
	deps: PublishDependencies = {},
): Promise<PublishResult> {
	const db = deps.db ?? defaultDb;
	const assetStorage =
		deps.assetStorage ?? createFilesystemAssetStorage(DEFAULT_ASSET_STORAGE_BASE_DIR);
	const generateNewPublicId = deps.generatePublicId ?? generatePublicId;
	const generateNewManagementToken = deps.generateManagementToken ?? generateManagementToken;

	const payloadResult = validatePayload(request.payload);
	if (!payloadResult.ok) {
		return { status: "validation-failed", reason: payloadResult.reason };
	}
	const payload = payloadResult.value;

	const binariesResult = validateBinaries(payload, request);
	if (!binariesResult.ok) {
		return { status: "validation-failed", reason: binariesResult.reason };
	}
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

	const id = randomUUID();
	const assetVersion = randomUUID();

	await assetStorage.put(
		{ internalPublicationId: id, assetVersion, filename: "reference.webp" },
		referenceResult.value.data,
	);
	await assetStorage.put(
		{ internalPublicationId: id, assetVersion, filename: "capture.webp" },
		captureResult.value.data,
	);
	if (brandingResultData) {
		await assetStorage.put(
			{ internalPublicationId: id, assetVersion, filename: "branding.webp" },
			brandingResultData,
		);
	}

	let publicId = generateNewPublicId();
	let managementToken = generateNewManagementToken();
	let managementTokenHash = hashManagementToken(managementToken);

	for (let attempt = 1; attempt <= MAX_GENERATED_ID_ATTEMPTS; attempt++) {
		try {
			await db.insert(comparisons).values({
				id,
				comparisonId: payload.comparisonId,
				publicId,
				managementTokenHash,
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
			});
			return { status: "created", publicId, managementToken };
		} catch (err) {
			const classification = classifyInsertError(err);
			if (classification === "comparison_id") {
				return { status: "conflict" };
			}
			if (classification === "public_id") {
				if (attempt < MAX_GENERATED_ID_ATTEMPTS) {
					publicId = generateNewPublicId();
				}
				continue;
			}
			if (classification === "management_token_hash") {
				if (attempt < MAX_GENERATED_ID_ATTEMPTS) {
					managementToken = generateNewManagementToken();
					managementTokenHash = hashManagementToken(managementToken);
				}
				continue;
			}
			return { status: "internal-failure", reason: "unexpected database error" };
		}
	}

	return { status: "internal-failure", reason: "generated identifier retry exhausted" };
}
