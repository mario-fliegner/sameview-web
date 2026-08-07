// XMP/RDF location removal (docs/FEATURE_SPECIFICATION.md F-005 "Remove
// Embedded Location Data"). Operates on the XML packet that follows a JPEG
// APP1 segment's XMP namespace prefix
// (src/lib/jpeg-location-metadata.ts extracts that packet and re-wraps the
// result — this module never sees the surrounding JPEG).
//
// Uses the native `DOMParser`/`XMLSerializer` — a genuine Node capability
// gap (docs/AI_ENGINEERING_GUIDE.md "Testing": "Introduce browser
// automation when a capability genuinely has no Node equivalent"), not a
// convenience choice. This is deliberate, not an earlier textual/regex
// approach: RDF/XML namespace prefixes are not fixed by the XMP
// specification — only the namespace *URIs* are — so a writer may bind any
// of the properties below to a non-default prefix. Resolving elements and
// attributes by `namespaceURI` (as this module does throughout) finds every
// occurrence regardless of which prefix was used; a literal string match on
// e.g. "exif:GPSLatitude" would silently miss a differently-prefixed but
// otherwise identical property. The same DOM-based approach also correctly
// removes `Iptc4xmpExt:LocationCreated`/`LocationShown`, which are
// structured (nested rdf:Bag/Seq/li/Description) properties — DOM subtree
// removal handles arbitrary nesting depth correctly by construction, which
// a non-recursive text match cannot.
//
// Parse-then-apply, strictly: the whole document is parsed once (a single
// read-only operation — DOMParser never mutates or partially materializes
// a document; it either fully succeeds or reports a parser error), then
// every matching element and attribute across the *entire* document is
// collected into plain lists, and only after that complete, whole-document
// search finishes does this module remove anything. No element is removed
// mid-search.
//
// Adobe's Extended XMP mechanism (a packet's location-bearing content split
// across a second, GUID-linked APP1 segment for packets too large for one
// segment) is not reassembled or edited. Its presence is signaled inside
// the *primary* packet itself via the `xmpNote:HasExtendedXMP` property —
// checked here, read-only, before any removal — and is treated as
// unsupported rather than attempted.

const XMP_NOTE_NAMESPACE = "http://ns.adobe.com/xmp/note/";
const HAS_EXTENDED_XMP_LOCAL_NAME = "HasExtendedXMP";

interface LocationProperty {
	readonly namespace: string;
	readonly localName: string;
}

const EXIF_GPS_NAMESPACE = "http://ns.adobe.com/exif/1.0/";
const PHOTOSHOP_NAMESPACE = "http://ns.adobe.com/photoshop/1.0/";
const IPTC_CORE_NAMESPACE = "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/";
const IPTC_EXT_NAMESPACE = "http://iptc.org/std/Iptc4xmpExt/2008-02-29/";

// The complete EXIF GPS tag family (mirrored 1:1 into XMP's exif
// namespace), plus the specific location-related Photoshop/IPTC Core/IPTC
// Extension properties — an enumerable, finite allowlist, not a pattern
// match, so unrelated properties (dc:creator, xmp:CreateDate, ratings,
// keywords, ...) are never touched regardless of namespace or prefix.
const LOCATION_PROPERTIES: readonly LocationProperty[] = [
	...[
		"GPSVersionID",
		"GPSLatitudeRef",
		"GPSLatitude",
		"GPSLongitudeRef",
		"GPSLongitude",
		"GPSAltitudeRef",
		"GPSAltitude",
		"GPSTimeStamp",
		"GPSSatellites",
		"GPSStatus",
		"GPSMeasureMode",
		"GPSDOP",
		"GPSSpeedRef",
		"GPSSpeed",
		"GPSTrackRef",
		"GPSTrack",
		"GPSImgDirectionRef",
		"GPSImgDirection",
		"GPSMapDatum",
		"GPSDestLatitudeRef",
		"GPSDestLatitude",
		"GPSDestLongitudeRef",
		"GPSDestLongitude",
		"GPSDestBearingRef",
		"GPSDestBearing",
		"GPSDestDistanceRef",
		"GPSDestDistance",
		"GPSProcessingMethod",
		"GPSAreaInformation",
		"GPSDateStamp",
		"GPSDifferential",
		"GPSHPositioningError",
	].map((localName) => ({ namespace: EXIF_GPS_NAMESPACE, localName })),
	...["City", "State", "Country", "Location"].map((localName) => ({
		namespace: PHOTOSHOP_NAMESPACE,
		localName,
	})),
	...["Location", "CountryCode"].map((localName) => ({
		namespace: IPTC_CORE_NAMESPACE,
		localName,
	})),
	...["LocationCreated", "LocationShown"].map((localName) => ({
		namespace: IPTC_EXT_NAMESPACE,
		localName,
	})),
];

export type XmpLocationRemovalError =
	| { readonly code: "parse-error" }
	| { readonly code: "extended-xmp-detected" };

export type XmpLocationRemovalResult =
	| { readonly ok: true; readonly bytes: Uint8Array }
	| { readonly ok: false; readonly error: XmpLocationRemovalError };

function findElementsByNamespace(
	doc: Document,
	namespace: string,
	localName: string,
): Element[] {
	const found = doc.getElementsByTagNameNS(namespace, localName);
	const elements: Element[] = [];
	for (let i = 0; i < found.length; i += 1) {
		const element = found.item(i);
		if (element) elements.push(element);
	}
	return elements;
}

interface AttributeMatch {
	readonly element: Element;
	readonly name: string;
}

function findAttributesByNamespace(
	doc: Document,
	namespace: string,
	localName: string,
): AttributeMatch[] {
	const matches: AttributeMatch[] = [];
	const allElements = doc.getElementsByTagName("*");
	for (let i = 0; i < allElements.length; i += 1) {
		const element = allElements.item(i);
		if (!element) continue;
		for (let a = 0; a < element.attributes.length; a += 1) {
			const attribute = element.attributes.item(a);
			if (!attribute) continue;
			if (
				attribute.namespaceURI === namespace &&
				attribute.localName === localName
			) {
				matches.push({ element, name: attribute.name });
			}
		}
	}
	return matches;
}

export function removeXmpLocation(
	xmpPayload: Uint8Array,
): XmpLocationRemovalResult {
	const text = new TextDecoder("utf-8", { fatal: false }).decode(xmpPayload);
	const doc = new DOMParser().parseFromString(text, "application/xml");
	if (doc.getElementsByTagName("parsererror").length > 0) {
		return { ok: false, error: { code: "parse-error" } };
	}

	const hasExtendedXmpMarker =
		findElementsByNamespace(
			doc,
			XMP_NOTE_NAMESPACE,
			HAS_EXTENDED_XMP_LOCAL_NAME,
		).length > 0 ||
		findAttributesByNamespace(
			doc,
			XMP_NOTE_NAMESPACE,
			HAS_EXTENDED_XMP_LOCAL_NAME,
		).length > 0;
	if (hasExtendedXmpMarker) {
		return { ok: false, error: { code: "extended-xmp-detected" } };
	}

	// Read-only: the entire document is searched for every targeted property
	// before anything is removed.
	const elementsToRemove: Element[] = [];
	const attributesToRemove: AttributeMatch[] = [];
	for (const target of LOCATION_PROPERTIES) {
		elementsToRemove.push(
			...findElementsByNamespace(doc, target.namespace, target.localName),
		);
		attributesToRemove.push(
			...findAttributesByNamespace(doc, target.namespace, target.localName),
		);
	}

	for (const element of elementsToRemove) element.remove();
	for (const { element, name } of attributesToRemove)
		element.removeAttribute(name);

	const serialized = new XMLSerializer().serializeToString(doc);
	return { ok: true, bytes: new TextEncoder().encode(serialized) };
}
