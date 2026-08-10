// Browser-safe `Uint8Array` → Base64 (docs/IMPLEMENTATION_PLAN_V1.md Phase
// 9: Standalone HTML embeds every binary asset — images, branding, the
// selected Presentation Font — as `data:` URIs). Chunked rather than a
// single `btoa(String.fromCharCode(...bytes))`: spreading a large
// `Uint8Array` (a multi-megabyte photo is well within this app's own 40 MP
// input limit) as individual call arguments risks exceeding the engine's
// maximum call-stack/argument-count long before that.
const CHUNK_SIZE = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
		const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
	return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}
