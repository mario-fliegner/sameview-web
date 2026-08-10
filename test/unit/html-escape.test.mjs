// Coverage for src/lib/html-escape.ts — the one place user text is made
// safe to embed into generated HTML (docs/IMPLEMENTATION_PLAN_V1.md Phase
// 9: "prevent user text from executing as markup").

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	escapeClosingTag,
	escapeHtml,
	escapeHtmlComment,
} from "../../src/lib/html-escape.ts";

describe("escapeHtml", () => {
	test("escapes the five HTML-significant characters", () => {
		assert.equal(
			escapeHtml(`<script>alert("hi & 'bye'")</script>`),
			"&lt;script&gt;alert(&quot;hi &amp; &#39;bye&#39;&quot;)&lt;/script&gt;",
		);
	});

	test("a title attempting to break out of an attribute cannot", () => {
		const malicious = `"><img src=x onerror=alert(1)>`;
		const escaped = escapeHtml(malicious);
		assert.ok(!escaped.includes('"'));
		assert.ok(!escaped.includes("<"));
		assert.ok(!escaped.includes(">"));
	});

	test("plain text is returned unchanged", () => {
		assert.equal(escapeHtml("White wall portrait"), "White wall portrait");
	});
});

describe("escapeClosingTag", () => {
	test("neutralizes a closing tag embedded inside script/style text content", () => {
		const malicious = 'const x = "</script><script>alert(1)</script>";';
		const escaped = escapeClosingTag(malicious, "script");
		assert.ok(!escaped.includes("</script>"));
		assert.match(escaped, /<\\\/script>/);
	});

	test("is case-insensitive", () => {
		assert.match(escapeClosingTag("</SCRIPT>", "script"), /<\\\/SCRIPT>/);
	});

	test("leaves unrelated text untouched", () => {
		assert.equal(escapeClosingTag("const x = 1;", "script"), "const x = 1;");
	});
});

describe("escapeHtmlComment", () => {
	test("neutralizes a --> sequence that would otherwise close the comment early", () => {
		const licenseText = "Some license text --> <script>alert(1)</script>";
		const escaped = escapeHtmlComment(licenseText);
		assert.ok(!escaped.includes("-->"));
	});

	test("leaves ordinary license text (including single hyphens) unchanged", () => {
		const licenseText =
			"Copyright 2020-2024 The Font Authors. SIL Open Font License.";
		assert.equal(escapeHtmlComment(licenseText), licenseText);
	});
});
