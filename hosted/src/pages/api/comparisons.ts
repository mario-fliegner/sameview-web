import type { APIRoute } from "astro";
import { publish, type PublishRequest } from "../../lib/publish.ts";

// HTTP adapter only — parses multipart/form-data, delegates every actual
// decision to publish() (hosted/src/lib/publish.ts), and maps its result
// to a response. No DB/storage/image-processing orchestration lives here.
//
// Route path and response shape are provisional Phase-6 working choices —
// see docs/HOSTED_COMPARISON_IMPLEMENTATION_PLAN_V1.md Phase 6/12; the
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

export const POST: APIRoute = async ({ request }) => {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return jsonResponse(400, { error: "invalid_request" });
	}

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

	const publishRequest: PublishRequest = {
		payload,
		referenceImage: await fileFieldToBuffer(formData.get("reference")),
		captureImage: await fileFieldToBuffer(formData.get("capture")),
		brandingImage: await fileFieldToBuffer(formData.get("branding")),
	};

	const result = await publish(publishRequest);

	switch (result.status) {
		case "created":
			return jsonResponse(201, {
				publicId: result.publicId,
				managementToken: result.managementToken,
			});
		case "validation-failed":
			return jsonResponse(400, { error: "validation_failed" });
		case "conflict":
			return jsonResponse(409, { error: "not_published" });
		case "internal-failure":
			return jsonResponse(500, { error: "internal_failure" });
		default:
			return jsonResponse(500, { error: "internal_failure" });
	}
};
