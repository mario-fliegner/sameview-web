// Pure F-003 edit transitions (docs/FEATURE_SPECIFICATION.md F-003; value
// normalization and Reference Date rules from docs/IMPORTED_COMPARISON_V1.md
// "Metadata Ownership" and "Reference Date"). No React, no DOM.
//
// Per the approved Phase 5 correction, there is no separate duplicated edit
// model: each `apply*` function below targets the corresponding known field
// directly inside a *cloned* `metadata.raw` (shallow-copying only the
// touched block), leaving every other known field, unknown field and
// optional block exactly as it was — so the existing derivation code in
// src/lib/comparison-presentation.ts keeps working unchanged against edited
// values. `applyVisibility` is the one exception: presentation visibility
// has no `metadata.raw` representation at all (see
// src/lib/workspace-state.ts for why), so it replaces
// `presentationVisibility` directly instead.
//
// Small local `isPlainObject`/`getNestedString` helpers intentionally
// duplicate src/lib/comparison-presentation.ts's own pattern (itself already
// a deliberate duplication of src/lib/import-metadata.ts's) rather than
// importing internals across module boundaries — see that module's header
// comment for the rationale, which applies identically here.

import type {
	CurrentWorkingState,
	PresentationConfiguration,
	PresentationVisibility,
} from "./workspace-state.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedString(
	raw: Record<string, unknown>,
	blockKey: string,
	fieldKey: string,
): string | undefined {
	const block = raw[blockKey];
	if (!isPlainObject(block)) return undefined;
	const value = block[fieldKey];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

// docs/IMPORTED_COMPARISON_V1.md "Web-Editable Fields" > text normalization:
// zero-width characters (U+200B–U+200F, U+2060) and Unicode bidi override/
// isolate controls (U+202A–U+202E, U+2066–U+2069), plus the BOM (U+FEFF).
// Built from explicit code points via String.fromCodePoint, rather than a
// character-class literal, so none of these invisible characters is ever
// itself silently present as raw bytes in this source file.
const ZERO_WIDTH_AND_BIDI_CODE_POINTS = [
	0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d,
	0x202e, 0x2060, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
];
const ZERO_WIDTH_AND_BIDI_PATTERN = new RegExp(
	`[${ZERO_WIDTH_AND_BIDI_CODE_POINTS.map((codePoint) =>
		String.fromCodePoint(codePoint),
	).join("")}]`,
	"g",
);

function stripZeroWidthAndBidi(value: string): string {
	return value.replace(ZERO_WIDTH_AND_BIDI_PATTERN, "");
}

// Title and location fields: single-line, line breaks become spaces.
function normalizeSingleLineText(value: string): string | undefined {
	const cleaned = stripZeroWidthAndBidi(value)
		.replace(/\t/g, " ")
		.replace(/\r\n|\r|\n/g, " ")
		.trim();
	return cleaned.length > 0 ? cleaned : undefined;
}

// Description: multi-line, line breaks preserved.
function normalizeMultiLineText(value: string): string | undefined {
	const cleaned = stripZeroWidthAndBidi(value).replace(/\t/g, " ").trim();
	return cleaned.length > 0 ? cleaned : undefined;
}

// Replaces exactly one known block's known field on a clone of
// `metadata.raw`, preserving every other field, block and unknown value.
function withRawFieldPatch(
	cws: CurrentWorkingState,
	blockKey: string,
	patch: Readonly<Record<string, string | boolean | undefined>>,
): CurrentWorkingState {
	const currentBlock = cws.metadata.raw[blockKey];
	const nextBlock: Record<string, unknown> = isPlainObject(currentBlock)
		? { ...currentBlock }
		: {};
	for (const [fieldKey, value] of Object.entries(patch)) {
		if (value === undefined) delete nextBlock[fieldKey];
		else nextBlock[fieldKey] = value;
	}
	return {
		...cws,
		metadata: {
			...cws.metadata,
			raw: { ...cws.metadata.raw, [blockKey]: nextBlock },
		},
	};
}

// --- Title (docs/IMPORTED_COMPARISON_V1.md "Content Metadata") ---

export function getTitleValue(cws: CurrentWorkingState): string {
	return getNestedString(cws.metadata.raw, "content", "title") ?? "";
}

export function applyTitle(
	cws: CurrentWorkingState,
	rawInput: string,
): CurrentWorkingState {
	return withRawFieldPatch(cws, "content", {
		title: normalizeSingleLineText(rawInput),
	});
}

// --- Description ---

export function getDescriptionValue(cws: CurrentWorkingState): string {
	return getNestedString(cws.metadata.raw, "content", "description") ?? "";
}

export function applyDescription(
	cws: CurrentWorkingState,
	rawInput: string,
): CurrentWorkingState {
	return withRawFieldPatch(cws, "content", {
		description: normalizeMultiLineText(rawInput),
	});
}

// --- Reference Date (docs/IMPORTED_COMPARISON_V1.md "Reference Date") ---

export type ReferenceDateValidationError =
	| "invalid-format"
	| "invalid-year"
	| "invalid-month"
	| "invalid-day";

export type ReferenceDateValidationResult =
	| { readonly ok: true; readonly value: string | undefined }
	| { readonly ok: false; readonly error: ReferenceDateValidationError };

const YEAR_ONLY = /^(\d{4})$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;
const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

function isValidYear(year: number): boolean {
	return year >= 1826 && year <= new Date().getFullYear();
}

// Validates a raw Reference Date input against the three supported
// precisions without mutating anything. An empty normalized value is valid
// and means "absent" (removal), matching "an empty normalized value means
// that the field is absent" in IMPORTED_COMPARISON_V1.md.
export function validateReferenceDateInput(
	rawInput: string,
): ReferenceDateValidationResult {
	const normalized = normalizeSingleLineText(rawInput);
	if (normalized === undefined) return { ok: true, value: undefined };

	const yearOnly = YEAR_ONLY.exec(normalized);
	if (yearOnly) {
		const year = Number(yearOnly[1]);
		if (!isValidYear(year)) return { ok: false, error: "invalid-year" };
		return { ok: true, value: normalized };
	}

	const yearMonth = YEAR_MONTH.exec(normalized);
	if (yearMonth) {
		const year = Number(yearMonth[1]);
		const month = Number(yearMonth[2]);
		if (!isValidYear(year)) return { ok: false, error: "invalid-year" };
		if (month < 1 || month > 12) return { ok: false, error: "invalid-month" };
		return { ok: true, value: normalized };
	}

	const fullDate = FULL_DATE.exec(normalized);
	if (fullDate) {
		const year = Number(fullDate[1]);
		const month = Number(fullDate[2]);
		const day = Number(fullDate[3]);
		if (!isValidYear(year)) return { ok: false, error: "invalid-year" };
		if (month < 1 || month > 12) return { ok: false, error: "invalid-month" };
		if (day < 1 || day > daysInMonth(year, month)) {
			return { ok: false, error: "invalid-day" };
		}
		return { ok: true, value: normalized };
	}

	return { ok: false, error: "invalid-format" };
}

export function getReferenceDateValue(cws: CurrentWorkingState): string {
	return getNestedString(cws.metadata.raw, "reference", "date") ?? "";
}

// Applies an already-validated Reference Date value (see
// validateReferenceDateInput). Callers must not call this with an unvalidated
// raw input — invalid input must never partially apply.
export function applyReferenceDate(
	cws: CurrentWorkingState,
	value: string | undefined,
): CurrentWorkingState {
	// docs/IMPORTED_COMPARISON_V1.md "Reference Date": a manual change updates
	// or removes reference.date, sets dateSource to "manual" only when a value
	// is present, removes dateSource when the date is removed, and always sets
	// userEdited to true.
	return withRawFieldPatch(cws, "reference", {
		date: value,
		dateSource: value === undefined ? undefined : "manual",
		userEdited: true,
	});
}

// --- Location (docs/IMPORTED_COMPARISON_V1.md "Location Metadata") ---

export function getLocationDisplayNameValue(cws: CurrentWorkingState): string {
	return getNestedString(cws.metadata.raw, "location", "displayName") ?? "";
}

export function getLocationCityValue(cws: CurrentWorkingState): string {
	return getNestedString(cws.metadata.raw, "location", "city") ?? "";
}

export function getLocationCountryValue(cws: CurrentWorkingState): string {
	return getNestedString(cws.metadata.raw, "location", "country") ?? "";
}

export function applyLocationDisplayName(
	cws: CurrentWorkingState,
	rawInput: string,
): CurrentWorkingState {
	return withRawFieldPatch(cws, "location", {
		displayName: normalizeSingleLineText(rawInput),
	});
}

export function applyLocationCity(
	cws: CurrentWorkingState,
	rawInput: string,
): CurrentWorkingState {
	return withRawFieldPatch(cws, "location", {
		city: normalizeSingleLineText(rawInput),
	});
}

export function applyLocationCountry(
	cws: CurrentWorkingState,
	rawInput: string,
): CurrentWorkingState {
	return withRawFieldPatch(cws, "location", {
		country: normalizeSingleLineText(rawInput),
	});
}

// --- Presentation visibility (docs/APPLICATION_LAYOUT.md "Comparison
// Information"; independent of `additional.visibility`, see
// src/lib/workspace-state.ts) ---

export function applyVisibility(
	cws: CurrentWorkingState,
	patch: Partial<PresentationVisibility>,
): CurrentWorkingState {
	return {
		...cws,
		presentationVisibility: { ...cws.presentationVisibility, ...patch },
	};
}

// --- Presentation Configuration (docs/COMPARISON_PRESENTATION.md Part 3
// "Canvas", "Comparison Stage"; independent of Source Data, see
// src/lib/workspace-state.ts) ---

export function applyPresentationConfiguration(
	cws: CurrentWorkingState,
	patch: Partial<PresentationConfiguration>,
): CurrentWorkingState {
	return {
		...cws,
		presentationConfiguration: {
			...cws.presentationConfiguration,
			...patch,
		},
	};
}

// docs/COMPARISON_PRESENTATION.md "Custom Color Editing": accepts a value
// with or without a leading `#`; the stored value is always normalized to
// `#RRGGBB` in uppercase. No error code is returned — the same section is
// explicit that an invalid value receives "only a subtle error state — no
// explanatory error text", so callers need only a valid/invalid distinction,
// never a specific reason.
const HEX_COLOR = /^#?([0-9a-fA-F]{6})$/;

export function normalizeHexColor(rawInput: string): string | undefined {
	const match = HEX_COLOR.exec(rawInput.trim());
	if (!match) return undefined;
	return `#${(match[1] as string).toUpperCase()}`;
}
