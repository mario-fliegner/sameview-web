// Derives display-ready comparison information from the Current Working
// State's metadata (docs/IMPORTED_COMPARISON_V1.md "Content Metadata",
// "Location Metadata", "Derived Slider Labels") for the Viewer
// (docs/FEATURE_SPECIFICATION.md F-002). This is the one place that reads
// `metadata.raw` for these fields — UI components consume only the derived
// `ComparisonPresentation` shape below, never `raw` directly.
//
// Pure and free of React/DOM dependencies on purpose: docs/ARCHITECTURE.md
// lists "Derive slider-label snapshots when generating an outcome" as its
// own capability, distinct from "Display slider" — the later Outcome
// Snapshot generator (Phase 7) can call this same function unchanged, so the
// live Viewer and a generated output never diverge on how these values are
// computed.
//
// Small, local JSON-reading helpers intentionally duplicate
// src/lib/import-metadata.ts's pattern rather than importing its internals:
// that module's stated scope is import-critical values only, not display
// derivation, and widening its exports for a few lines of straightforward
// duplication would blur that boundary.

import type { Locale } from "../i18n/translations";
import {
	type CompareSliderLabelFallbacks,
	type CompareSliderLabels,
	computeCompareSliderLabels,
} from "./compare-slider-labels.ts";
import type { ResolvedImportedMetadata } from "./import-metadata";

export interface ComparisonLocation {
	readonly displayName: string | undefined;
	readonly city: string | undefined;
	readonly country: string | undefined;
}

export interface ComparisonPresentation {
	readonly title: string | undefined;
	readonly description: string | undefined;
	readonly referenceLabel: string;
	readonly captureLabel: string;
	// docs/COMPARISON_PRESENTATION.md Part 2 "Time": the optional "Reference
	// → Capture · Duration" addition, `undefined` whenever no duration can be
	// shown (reference.date absent, malformed, or later than the capture
	// timestamp — see `deriveDurationLabel` below). Presentation-only, not an
	// F-003 comparison-information value, so it has no corresponding
	// `get*Value`/`apply*` pair in src/lib/comparison-edit.ts — only its
	// independent visibility (`PresentationVisibility.timeDifference`) is
	// user-editable.
	readonly durationLabel: string | undefined;
	readonly location: ComparisonLocation | undefined;
	// The Viewer's on-image labels beside the slider handle — distinct from
	// referenceLabel/captureLabel above (the sidebar's independent,
	// non-capture-aware formatting). Computed by the ported Android priority
	// chain in ./compare-slider-labels, which compares reference.date against
	// the capture date rather than formatting each in isolation.
	readonly sliderLabels: CompareSliderLabels;
}

// docs/COMPARISON_PRESENTATION.md Part 2 "Time" examples ("7 years", "1
// month", "Same year"): explicit singular/plural/zero-duration wording
// supplied by the caller, exactly like `sliderLabelFallbacks` below — never
// hard-coded here, and never pluralized programmatically (this codebase
// introduces no i18n/ICU dependency for that; German's own "Jahr"/"Jahre"
// and "Monat"/"Monate" cannot be derived from the English forms anyway).
export interface DurationLabelFallbacks {
	readonly year: string;
	readonly years: string;
	readonly month: string;
	readonly months: string;
	readonly sameYear: string;
}

export interface DeriveComparisonPresentationOptions {
	// UI copy, not app logic — supplied by the caller so this module never
	// hard-codes per-locale wording itself (docs/APPLICATION_LAYOUT.md
	// Internationalization: "the layout must not contain hard-coded
	// user-facing strings").
	readonly referenceFallbackLabel: string;
	readonly sliderLabelFallbacks: CompareSliderLabelFallbacks;
	readonly durationLabelFallbacks: DurationLabelFallbacks;
}

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

function getTopLevelString(
	raw: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = raw[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

// docs/IMPORTED_COMPARISON_V1.md documents a legacy `title` fallback for
// `content.title` (unconfirmed against any real export, but tolerated
// defensively) — mirrors import-metadata.ts's current-field-then-fallback
// pattern for this one field.
function resolveTitle(raw: Record<string, unknown>): string | undefined {
	return (
		getNestedString(raw, "content", "title") ?? getTopLevelString(raw, "title")
	);
}

function resolveDescription(raw: Record<string, unknown>): string | undefined {
	return getNestedString(raw, "content", "description");
}

function resolveLocation(
	raw: Record<string, unknown>,
): ComparisonLocation | undefined {
	const displayName = getNestedString(raw, "location", "displayName");
	const city = getNestedString(raw, "location", "city");
	const country = getNestedString(raw, "location", "country");
	if (!displayName && !city && !country) return undefined;
	return { displayName, city, country };
}

const REFERENCE_DATE_YEAR = /^(\d{4})$/;
const REFERENCE_DATE_YEAR_MONTH = /^(\d{4})-(\d{2})$/;
const REFERENCE_DATE_FULL = /^(\d{4})-(\d{2})-(\d{2})$/;

// docs/IMPORTED_COMPARISON_V1.md "Derived Slider Labels" > "Reference Label".
function deriveReferenceLabel(
	raw: Record<string, unknown>,
	locale: Locale,
	fallback: string,
): string {
	const value = getNestedString(raw, "reference", "date");
	if (!value) return fallback;

	// The capture groups below are non-null whenever `.exec()` itself
	// returns non-null, since each regex is anchored and wholly composed of
	// capturing groups — TypeScript's indexed-access typing just can't prove
	// that on its own.
	const yearOnly = REFERENCE_DATE_YEAR.exec(value);
	if (yearOnly) return yearOnly[1] as string;

	const yearMonth = REFERENCE_DATE_YEAR_MONTH.exec(value);
	if (yearMonth) {
		const year = yearMonth[1] as string;
		const month = yearMonth[2] as string;
		const date = new Date(Number(year), Number(month) - 1, 1);
		return new Intl.DateTimeFormat(locale, {
			year: "numeric",
			month: "long",
		}).format(date);
	}

	const full = REFERENCE_DATE_FULL.exec(value);
	if (full) {
		const year = full[1] as string;
		const month = full[2] as string;
		const day = full[3] as string;
		const date = new Date(Number(year), Number(month) - 1, Number(day));
		return new Intl.DateTimeFormat(locale, {
			year: "numeric",
			month: "long",
			day: "numeric",
		}).format(date);
	}

	// Malformed/unexpected value: treated as absent rather than thrown.
	return fallback;
}

// docs/IMPORTED_COMPARISON_V1.md "Derived Slider Labels" > "Capture Label":
// "formatted using the browser's locale and local time zone" —
// Intl.DateTimeFormat already uses the runtime's local time zone by default.
function deriveCaptureLabel(
	captureTimestampMs: number,
	locale: Locale,
): string {
	return new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(new Date(captureTimestampMs));
}

// docs/COMPARISON_PRESENTATION.md Part 2 "Time" ("Reference → Capture ·
// Duration") and Part 3 "Comparison Information" ("Show Time Difference").
// Deliberately its own small function, never merged into `deriveReferenceLabel`
// above: that function only ever formats the stored reference value in
// isolation, while this one additionally relates it to `captureTimestampMs` —
// two different computations that happen to start from the same raw value.
// Reuses this file's own `REFERENCE_DATE_YEAR`/`REFERENCE_DATE_YEAR_MONTH`/
// `REFERENCE_DATE_FULL` precision regexes rather than re-parsing the value
// with new patterns, so the precision this function honors can never drift
// from the precision `deriveReferenceLabel` itself already established for
// the very same stored string.
//
// "Never a higher precision than known" (docs): a `YYYY`-only reference
// yields a year-only difference; `YYYY-MM`/`YYYY-MM-DD` both yield
// years+months — a stored day is used only internally, to decide whether a
// partially elapsed month already counts, and is itself never rendered
// (docs: "Tage niemals anzeigen" / "a day is used ... only to determine
// whether an additional month has fully elapsed").
//
// The month/day carry below is the same calendar-age algorithm every
// "years between two dates" calculation uses (subtract the components,
// borrow a month from the years when the month delta goes negative, then —
// only when a stored day makes it possible — borrow one more month when the
// capture day has not yet reached the reference day-of-month). No date
// library is introduced for this: `Date`'s own `getFullYear`/`getMonth`/
// `getDate` accessors are the same primitives `deriveReferenceLabel` and
// ./compare-slider-labels.ts already use throughout this codebase.
function deriveDurationLabel(
	raw: Record<string, unknown>,
	captureTimestampMs: number,
	fallbacks: DurationLabelFallbacks,
): string | undefined {
	const value = getNestedString(raw, "reference", "date");
	if (!value) return undefined;

	let year: number;
	// 0-based month/day, present only at the precision actually stored —
	// `month` stays `undefined` for a `YYYY`-only value, `day` stays
	// `undefined` unless the full `YYYY-MM-DD` precision is stored.
	let month: number | undefined;
	let day: number | undefined;

	const yearOnly = REFERENCE_DATE_YEAR.exec(value);
	const yearMonth = REFERENCE_DATE_YEAR_MONTH.exec(value);
	const full = REFERENCE_DATE_FULL.exec(value);
	if (yearOnly) {
		year = Number(yearOnly[1]);
	} else if (yearMonth) {
		year = Number(yearMonth[1]);
		month = Number(yearMonth[2]) - 1;
	} else if (full) {
		year = Number(full[1]);
		month = Number(full[2]) - 1;
		day = Number(full[3]);
	} else {
		// Malformed/unexpected value: no duration, matching
		// `deriveReferenceLabel`'s own "treated as absent" handling above.
		return undefined;
	}

	const captureDate = new Date(captureTimestampMs);
	// The earliest possible moment the stored precision could mean (Jan 1 for
	// a year-only value, the 1st for a month-only value) — sufficient to
	// decide "Reference Date > Capture Date" without assuming a day that was
	// never actually recorded.
	const referenceDate = new Date(year, month ?? 0, day ?? 1);
	if (referenceDate.getTime() > captureDate.getTime()) return undefined;

	let years = captureDate.getFullYear() - year;
	let months: number | undefined;

	if (month !== undefined) {
		months = captureDate.getMonth() - month;
		if (months < 0) {
			years -= 1;
			months += 12;
		}
		// A day precision further refines whether the last, still-partial
		// month already counts: it does not until the capture day-of-month
		// has reached the reference day-of-month (e.g. 31 May → 1 Jun is
		// not yet "1 month", only once a full month has actually elapsed).
		if (day !== undefined && captureDate.getDate() < day) {
			months -= 1;
			if (months < 0) {
				years -= 1;
				months += 12;
			}
		}
	}

	if (years === 0 && (months === undefined || months === 0)) {
		return fallbacks.sameYear;
	}

	const parts: string[] = [];
	if (years > 0) {
		parts.push(
			years === 1 ? `1 ${fallbacks.year}` : `${years} ${fallbacks.years}`,
		);
	}
	if (months) {
		parts.push(
			months === 1 ? `1 ${fallbacks.month}` : `${months} ${fallbacks.months}`,
		);
	}
	return parts.join(" ");
}

export function deriveComparisonPresentation(
	metadata: ResolvedImportedMetadata,
	locale: Locale,
	options: DeriveComparisonPresentationOptions,
): ComparisonPresentation {
	const raw = metadata.raw;
	return {
		title: resolveTitle(raw),
		description: resolveDescription(raw),
		referenceLabel: deriveReferenceLabel(
			raw,
			locale,
			options.referenceFallbackLabel,
		),
		captureLabel: deriveCaptureLabel(metadata.captureTimestampMs, locale),
		durationLabel: deriveDurationLabel(
			raw,
			metadata.captureTimestampMs,
			options.durationLabelFallbacks,
		),
		location: resolveLocation(raw),
		sliderLabels: computeCompareSliderLabels(
			getNestedString(raw, "reference", "date"),
			metadata.captureTimestampMs,
			locale,
			options.sliderLabelFallbacks,
		),
	};
}
