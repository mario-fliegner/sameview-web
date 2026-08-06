// Coverage for src/lib/comparison-edit.ts against
// docs/IMPORTED_COMPARISON_V1.md "Web-Editable Fields" (text normalization),
// "Reference Date" (validation and manual-edit semantics), and
// docs/FEATURE_SPECIFICATION.md F-003 (independent value/visibility edits,
// unknown/immutable field preservation). Pure, deterministic logic — no
// browser API — so this belongs in the Node unit suite, not Playwright.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	applyDescription,
	applyLocationCity,
	applyLocationCountry,
	applyLocationDisplayName,
	applyPresentationConfiguration,
	applyReferenceDate,
	applyTitle,
	applyVisibility,
	getDescriptionValue,
	getLocationCityValue,
	getLocationCountryValue,
	getLocationDisplayNameValue,
	getReferenceDateValue,
	getTitleValue,
	normalizeHexColor,
	validateReferenceDateInput,
} from "../../src/lib/comparison-edit.ts";
import {
	DEFAULT_BRANDING_DRAFT,
	DEFAULT_PRESENTATION_CONFIGURATION,
	DEFAULT_PRESENTATION_VISIBILITY,
} from "../../src/lib/workspace-state.ts";

function fakeCurrentWorkingState(raw = {}) {
	return {
		sessionDirectory: "2024-01-15_10-30-00",
		metadata: {
			version: 6,
			sessionId: undefined,
			captureTimestampMs: 1700000000000,
			referenceFile: "reference.jpg",
			captureFile: "capture.jpg",
			raw,
		},
		files: {
			referenceBytes: new Uint8Array([1, 2, 3]),
			captureBytes: new Uint8Array([4, 5, 6]),
			referenceOriginalBytes: undefined,
			captureOriginalBytes: undefined,
			referenceSourceOriginalBytes: undefined,
			brandingHandleBytes: undefined,
		},
		presentationVisibility: DEFAULT_PRESENTATION_VISIBILITY,
		presentationConfiguration: DEFAULT_PRESENTATION_CONFIGURATION,
		brandingDraft: DEFAULT_BRANDING_DRAFT,
	};
}

describe("applyTitle / getTitleValue", () => {
	test("sets content.title and is readable back", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyTitle(cws, "  A new title  ");
		assert.equal(getTitleValue(next), "A new title");
		assert.equal(next.metadata.raw.content.title, "A new title");
	});

	test("replaces line breaks and tabs with spaces (single-line field)", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyTitle(cws, "Line one\nLine\ttwo\r\nLine three");
		assert.equal(getTitleValue(next), "Line one Line two Line three");
	});

	test("strips zero-width and bidi override characters", () => {
		const cws = fakeCurrentWorkingState();
		// Built from code points (zero-width space U+200B, RTL override
		// U+202E) rather than literal characters, so this source file never
		// itself silently contains an invisible character.
		const withZeroWidth = [
			"Hello",
			String.fromCodePoint(0x200b),
			"world",
			String.fromCodePoint(0x202e),
			"test",
		].join("");
		const next = applyTitle(cws, withZeroWidth);
		assert.equal(getTitleValue(next), "Helloworldtest");
	});

	test("a blank normalized value removes the field entirely (hide differs from remove)", () => {
		const cws = fakeCurrentWorkingState({ content: { title: "Existing" } });
		const next = applyTitle(cws, "   ");
		assert.equal(getTitleValue(next), "");
		assert.equal("title" in next.metadata.raw.content, false);
	});

	test("preserves unrelated known and unknown fields in the same and sibling blocks", () => {
		const cws = fakeCurrentWorkingState({
			content: { title: "Old", description: "Keep me", unknownField: 42 },
			reference: { date: "2024" },
			unknownBlock: { a: 1 },
		});
		const next = applyTitle(cws, "New title");
		assert.equal(next.metadata.raw.content.description, "Keep me");
		assert.equal(next.metadata.raw.content.unknownField, 42);
		assert.equal(next.metadata.raw.reference.date, "2024");
		assert.deepEqual(next.metadata.raw.unknownBlock, { a: 1 });
	});

	test("never mutates the original Current Working State", () => {
		const cws = fakeCurrentWorkingState({ content: { title: "Old" } });
		const before = JSON.stringify(cws.metadata.raw);
		applyTitle(cws, "New title");
		assert.equal(JSON.stringify(cws.metadata.raw), before);
	});
});

describe("applyDescription / getDescriptionValue", () => {
	test("preserves internal line breaks (multi-line field)", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyDescription(cws, "Line one\nLine two\n\nLine three");
		assert.equal(getDescriptionValue(next), "Line one\nLine two\n\nLine three");
	});

	test("still trims leading/trailing whitespace and strips tabs", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyDescription(cws, "  Has\ttab and edges  \n");
		assert.equal(getDescriptionValue(next), "Has tab and edges");
	});

	test("a blank normalized value removes the field", () => {
		const cws = fakeCurrentWorkingState({
			content: { description: "Existing" },
		});
		const next = applyDescription(cws, "\n\n  ");
		assert.equal("description" in next.metadata.raw.content, false);
	});
});

describe("validateReferenceDateInput", () => {
	test("an empty input is valid and means absent", () => {
		assert.deepEqual(validateReferenceDateInput("   "), {
			ok: true,
			value: undefined,
		});
	});

	test("accepts YYYY, YYYY-MM and YYYY-MM-DD precisions", () => {
		assert.deepEqual(validateReferenceDateInput("2024"), {
			ok: true,
			value: "2024",
		});
		assert.deepEqual(validateReferenceDateInput("2024-05"), {
			ok: true,
			value: "2024-05",
		});
		assert.deepEqual(validateReferenceDateInput("2024-05-06"), {
			ok: true,
			value: "2024-05-06",
		});
	});

	test("rejects a year before 1826", () => {
		assert.deepEqual(validateReferenceDateInput("1825"), {
			ok: false,
			error: "invalid-year",
		});
	});

	test("rejects a year after the current year", () => {
		const nextYear = new Date().getFullYear() + 1;
		assert.deepEqual(validateReferenceDateInput(String(nextYear)), {
			ok: false,
			error: "invalid-year",
		});
	});

	test("rejects an out-of-range month", () => {
		assert.deepEqual(validateReferenceDateInput("2024-13"), {
			ok: false,
			error: "invalid-month",
		});
		assert.deepEqual(validateReferenceDateInput("2024-00"), {
			ok: false,
			error: "invalid-month",
		});
	});

	test("rejects a day invalid for its year and month", () => {
		// 2023 is not a leap year: February has 28 days.
		assert.deepEqual(validateReferenceDateInput("2023-02-29"), {
			ok: false,
			error: "invalid-day",
		});
		assert.deepEqual(validateReferenceDateInput("2024-04-31"), {
			ok: false,
			error: "invalid-day",
		});
	});

	test("accepts a valid leap-day date", () => {
		assert.deepEqual(validateReferenceDateInput("2024-02-29"), {
			ok: true,
			value: "2024-02-29",
		});
	});

	test("rejects malformed or non-zero-padded input", () => {
		assert.deepEqual(validateReferenceDateInput("not-a-date"), {
			ok: false,
			error: "invalid-format",
		});
		assert.deepEqual(validateReferenceDateInput("2024-5-6"), {
			ok: false,
			error: "invalid-format",
		});
		assert.deepEqual(validateReferenceDateInput("24-05-06"), {
			ok: false,
			error: "invalid-format",
		});
	});
});

describe("applyReferenceDate", () => {
	test("setting a value sets dateSource to manual and userEdited to true", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyReferenceDate(cws, "2024-05-06");
		assert.equal(getReferenceDateValue(next), "2024-05-06");
		assert.equal(next.metadata.raw.reference.dateSource, "manual");
		assert.equal(next.metadata.raw.reference.userEdited, true);
	});

	test("removing the value removes dateSource but still sets userEdited to true", () => {
		const cws = fakeCurrentWorkingState({
			reference: { date: "2024", dateSource: "exif" },
		});
		const next = applyReferenceDate(cws, undefined);
		assert.equal(getReferenceDateValue(next), "");
		assert.equal("dateSource" in next.metadata.raw.reference, false);
		assert.equal(next.metadata.raw.reference.userEdited, true);
	});

	test("never touches capture.timestampMs or unrelated blocks", () => {
		const cws = fakeCurrentWorkingState({
			capture: { timestampMs: 1700000000000 },
			content: { title: "Keep me" },
		});
		const next = applyReferenceDate(cws, "2024");
		assert.equal(next.metadata.raw.capture.timestampMs, 1700000000000);
		assert.equal(next.metadata.raw.content.title, "Keep me");
		assert.equal(
			next.metadata.captureTimestampMs,
			cws.metadata.captureTimestampMs,
		);
	});
});

describe("Location fields", () => {
	test("each field can be set and read independently", () => {
		let cws = fakeCurrentWorkingState();
		cws = applyLocationDisplayName(cws, "Marienplatz");
		cws = applyLocationCity(cws, "Munich");
		cws = applyLocationCountry(cws, "Germany");
		assert.equal(getLocationDisplayNameValue(cws), "Marienplatz");
		assert.equal(getLocationCityValue(cws), "Munich");
		assert.equal(getLocationCountryValue(cws), "Germany");
	});

	test("removing one field preserves the other two", () => {
		let cws = fakeCurrentWorkingState({
			location: {
				displayName: "Marienplatz",
				city: "Munich",
				country: "Germany",
			},
		});
		cws = applyLocationCity(cws, "");
		assert.equal(getLocationDisplayNameValue(cws), "Marienplatz");
		assert.equal(getLocationCityValue(cws), "");
		assert.equal(getLocationCountryValue(cws), "Germany");
	});
});

describe("applyVisibility", () => {
	test("patches only the given keys, leaving the rest at their current value", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyVisibility(cws, { description: true });
		assert.deepEqual(next.presentationVisibility, {
			...DEFAULT_PRESENTATION_VISIBILITY,
			description: true,
		});
	});

	test("never touches metadata.raw", () => {
		const cws = fakeCurrentWorkingState({ content: { title: "Untouched" } });
		const next = applyVisibility(cws, { title: false });
		assert.equal(next.metadata.raw, cws.metadata.raw);
	});

	test("is independent of any additional.visibility value present in raw metadata", () => {
		const cws = fakeCurrentWorkingState({
			additional: { visibility: "public" },
		});
		const next = applyVisibility(cws, { title: false });
		assert.equal(next.metadata.raw.additional.visibility, "public");
		assert.equal(next.presentationVisibility.title, false);
	});
});

// docs/COMPARISON_PRESENTATION.md Part 3 "Canvas", "Comparison Stage".
describe("applyPresentationConfiguration", () => {
	test("patches only the given keys, leaving the rest at their default value", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyPresentationConfiguration(cws, {
			cornerRadius: "sharp",
		});
		assert.deepEqual(next.presentationConfiguration, {
			...DEFAULT_PRESENTATION_CONFIGURATION,
			cornerRadius: "sharp",
		});
	});

	test("replaces the whole Background value, including its color, in one patch", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyPresentationConfiguration(cws, {
			canvasBackground: { kind: "custom", color: "#FF00FF" },
		});
		assert.deepEqual(next.presentationConfiguration.canvasBackground, {
			kind: "custom",
			color: "#FF00FF",
		});
	});

	test("replaces the whole Text value, including its color, in one patch", () => {
		const cws = fakeCurrentWorkingState();
		const next = applyPresentationConfiguration(cws, {
			textColor: { kind: "custom", color: "#00FF00" },
		});
		assert.deepEqual(next.presentationConfiguration.textColor, {
			kind: "custom",
			color: "#00FF00",
		});
	});

	test("never touches metadata.raw", () => {
		const cws = fakeCurrentWorkingState({ content: { title: "Untouched" } });
		const next = applyPresentationConfiguration(cws, {
			showSliderDateLabels: false,
		});
		assert.equal(next.metadata.raw, cws.metadata.raw);
	});
});

// docs/COMPARISON_PRESENTATION.md "Custom Color Editing".
describe("normalizeHexColor", () => {
	test("accepts a value with a leading #, uppercased", () => {
		assert.equal(normalizeHexColor("#ff00ff"), "#FF00FF");
	});

	test("accepts a value without a leading #, uppercased", () => {
		assert.equal(normalizeHexColor("ff00ff"), "#FF00FF");
	});

	test("accepts surrounding whitespace", () => {
		assert.equal(normalizeHexColor("  #abcabc  "), "#ABCABC");
	});

	test("rejects a value with the wrong number of digits", () => {
		assert.equal(normalizeHexColor("#fff"), undefined);
	});

	test("rejects a non-hex value", () => {
		assert.equal(normalizeHexColor("not-a-color"), undefined);
	});

	test("rejects an empty value", () => {
		assert.equal(normalizeHexColor(""), undefined);
	});
});
