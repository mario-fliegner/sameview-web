import type { APIRoute } from "astro";
import { update, type UpdateRequest } from "../../../lib/update.ts";

// HTTP adapter only — parses multipart/form-data, delegates every actual
// decision to update() (hosted/src/lib/update.ts), and maps its result
// to a response. No DB/storage/image-processing orchestration lives here.
//
// Route path and response shape are provisional Phase-7 working choices
// — see docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md Phase 7/12; the
// external cross-client contract is frozen at Phase 12, not here.

export const prerender = false;

async function fileFieldToBuffer(value: FormDataEntryValue | null): Promise<Buffer | undefined> {
	if (value === null || typeof value === "string") {
		return undefined;
	}
	const arrayBuffer = await value.arrayBuffer();
	return Buffer.from(arrayBuffer);
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

export const PUT: APIRoute = async ({ params, request }) => {
	const publicId = params.publicId;
	if (typeof publicId !== "string" || publicId.length === 0) {
		return jsonResponse(400, { error: "invalid_request" });
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return jsonResponse(400, { error: "invalid_request" });
	}

	const managementTokenField = formData.get("managementToken");
	const managementToken =
		typeof managementTokenField === "string" ? managementTokenField : undefined;

	const payloadField = formData.get("payload");
	if (typeof payloadField !== "string") {
		return jsonResponse(400, { error: "invalid_request" });
	}

	let payload: unknown;
	try {
		payload = JSON.parse(payloadField);
	} catch {
		return jsonResponse(400, { error: "invalid_request" });
	}

	const updateRequest: UpdateRequest = {
		publicId,
		managementToken,
		payload,
		referenceImage: await fileFieldToBuffer(formData.get("reference")),
		captureImage: await fileFieldToBuffer(formData.get("capture")),
		brandingImage: await fileFieldToBuffer(formData.get("branding")),
	};

	const result = await update(updateRequest);

	switch (result.status) {
		case "updated":
			return jsonResponse(200, {});
		case "validation-failed":
			return jsonResponse(400, { error: "validation_failed" });
		case "not-found":
			return jsonResponse(404, { error: "not_found" });
		case "internal-failure":
			return jsonResponse(500, { error: "internal_failure" });
		default:
			return jsonResponse(500, { error: "internal_failure" });
	}
};
