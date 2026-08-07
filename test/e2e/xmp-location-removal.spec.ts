// Browser-only coverage for src/lib/xmp-location-removal.ts, per
// docs/AI_ENGINEERING_GUIDE.md "Testing": the native DOMParser/XMLSerializer
// this module uses has no Node equivalent (see that module's own header
// comment), so this is exactly the kind of capability gap Playwright exists
// for in this project — not a UI test.
//
// Uses the existing test-only harness (test/e2e/harness/) rather than the
// real application: this module needs nothing from the app's UI, only a
// real browser's DOMParser/XMLSerializer, exactly like
// test/e2e/import-pipeline.spec.ts already does for validateImageContent.
// `window.__importHarness__.removeXmpLocation` is exposed by that harness.

import { expect, test } from "@playwright/test";

type SerializableResult =
	| { readonly ok: true; readonly bytes: readonly number[] }
	| { readonly ok: false; readonly error: { readonly code: string } };

function xmpPacket(descriptionAttributes: string, innerXml = ""): string {
	return [
		'<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
		'<x:xmpmeta xmlns:x="adobe:ns:meta/">',
		' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
		`  <rdf:Description rdf:about="" ${descriptionAttributes}>${innerXml}</rdf:Description>`,
		" </rdf:RDF>",
		"</x:xmpmeta>",
		'<?xpacket end="w"?>',
	].join("\n");
}

async function runRemoveXmpLocation(
	page: import("@playwright/test").Page,
	xml: string,
): Promise<SerializableResult> {
	return page.evaluate((xmlText) => {
		const bytes = new TextEncoder().encode(xmlText);
		const result = window.__importHarness__.removeXmpLocation(bytes);
		return result.ok
			? { ok: true as const, bytes: Array.from(result.bytes) }
			: { ok: false as const, error: result.error };
	}, xml);
}

function decodeText(bytes: readonly number[]): string {
	return new TextDecoder().decode(new Uint8Array(bytes));
}

test.beforeEach(async ({ page }) => {
	await page.goto("/");
});

test("removes a location property written as an attribute, preserves an unrelated attribute", async ({
	page,
}) => {
	const xml = xmpPacket(
		'xmlns:exif="http://ns.adobe.com/exif/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" exif:GPSLatitude="37,25.3453N" dc:creator="Alice"',
	);
	const result = await runRemoveXmpLocation(page, xml);
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	const text = decodeText(result.bytes);
	expect(text).not.toContain("GPSLatitude");
	expect(text).toContain("Alice");
});

test("removes a location property written in expanded element form", async ({
	page,
}) => {
	const xml = xmpPacket(
		'xmlns:exif="http://ns.adobe.com/exif/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"',
		"<exif:GPSLatitude>37,25.3453N</exif:GPSLatitude><dc:title>Untitled</dc:title>",
	);
	const result = await runRemoveXmpLocation(page, xml);
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	const text = decodeText(result.bytes);
	expect(text).not.toContain("GPSLatitude");
	expect(text).not.toContain("37,25.3453N");
	expect(text).toContain("Untitled");
});

test("finds a location property regardless of which namespace prefix it is bound to", async ({
	page,
}) => {
	// Bound to a non-default prefix ("myexif") for the same namespace URI —
	// resolution must be by URI, never by the literal prefix string.
	const xml = xmpPacket(
		'xmlns:myexif="http://ns.adobe.com/exif/1.0/" myexif:GPSLatitude="37,25.3453N"',
	);
	const result = await runRemoveXmpLocation(page, xml);
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	const text = decodeText(result.bytes);
	expect(text).not.toContain("GPSLatitude");
});

test("removes a structured, nested LocationCreated property and preserves a sibling property", async ({
	page,
}) => {
	const xml = xmpPacket(
		'xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:dc="http://purl.org/dc/elements/1.1/"',
		[
			"<Iptc4xmpExt:LocationCreated>",
			" <rdf:Bag>",
			"  <rdf:li>",
			'   <rdf:Description Iptc4xmpExt:City="Munich" Iptc4xmpExt:CountryName="Germany"/>',
			"  </rdf:li>",
			" </rdf:Bag>",
			"</Iptc4xmpExt:LocationCreated>",
			"<dc:title>Kept</dc:title>",
		].join(""),
	);
	const result = await runRemoveXmpLocation(page, xml);
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	const text = decodeText(result.bytes);
	expect(text).not.toContain("LocationCreated");
	expect(text).not.toContain("Munich");
	expect(text).toContain("Kept");
});

test("a packet with only unrelated properties is returned with those properties intact", async ({
	page,
}) => {
	const xml = xmpPacket(
		'xmlns:dc="http://purl.org/dc/elements/1.1/" dc:creator="Alice" dc:rights="All rights reserved"',
	);
	const result = await runRemoveXmpLocation(page, xml);
	expect(result.ok).toBe(true);
	if (!result.ok) return;
	const text = decodeText(result.bytes);
	expect(text).toContain("Alice");
	expect(text).toContain("All rights reserved");
});

test("malformed XML is rejected as a parse error", async ({ page }) => {
	const result = await runRemoveXmpLocation(page, "<rdf:RDF><unclosed>");
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(result.error.code).toBe("parse-error");
});

test("a packet signaling Extended XMP (xmpNote:HasExtendedXMP) is reported as unsupported", async ({
	page,
}) => {
	const xml = xmpPacket(
		'xmlns:xmpNote="http://ns.adobe.com/xmp/note/" xmpNote:HasExtendedXMP="1F4A2B3C4D5E6F708192A3B4C5D6E7F8"',
	);
	const result = await runRemoveXmpLocation(page, xml);
	expect(result.ok).toBe(false);
	if (result.ok) return;
	expect(result.error.code).toBe("extended-xmp-detected");
});
