// Escapes plain text before it is embedded into generated HTML
// (docs/IMPLEMENTATION_PLAN_V1.md Phase 9: "prevent user text from
// executing as markup") — every user-authored Outcome Snapshot string
// (Title, Description, Location parts) passes through this before
// src/lib/comparison-artifact-markup.ts composes it into markup. Pure, no
// DOM: a plain character-class substitution, safe for both text-node
// content and double-quoted HTML attribute values (the five characters
// below cover both contexts, per the OWASP HTML entity encoding
// recommendation for those two contexts).

const ESCAPE_MAP: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

export function escapeHtml(text: string): string {
	return text.replace(
		/[&<>"']/g,
		(character) => ESCAPE_MAP[character] ?? character,
	);
}

// A `<script>`/`<style>` element's raw text content is not parsed as HTML
// markup, but `</script>`/`</style>` inside it still terminates the element
// early — this guards embedded JS/CSS text (and the invisible font-license
// HTML comment, which could otherwise be closed early by a stray `-->` in
// third-party license text) against that, without the (incorrect, and
// unnecessary here) HTML entity escaping `escapeHtml` above performs.
export function escapeClosingTag(text: string, tagName: string): string {
	const pattern = new RegExp(`</(${tagName})`, "gi");
	return text.replace(pattern, "<\\/$1");
}

// Guards a value embedded inside an HTML comment (`<!-- ... -->`, used for
// the invisible font-license comment) against a `-->` sequence inside the
// source text closing the comment early. `-` is replaced with a Unicode
// look-alike (U+2010 HYPHEN) rather than removed, so the license text's own
// content is not silently altered in a way that could matter for a legal
// text — only the exact three-character terminator sequence is affected.
export function escapeHtmlComment(text: string): string {
	return text.replace(/-->/g, "‐‐>");
}
