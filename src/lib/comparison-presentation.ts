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
	readonly location: ComparisonLocation | undefined;
	// The Viewer's on-image labels beside the slider handle — distinct from
	// referenceLabel/captureLabel above (the sidebar's independent,
	// non-capture-aware formatting). Computed by the ported Android priority
	// chain in ./compare-slider-labels, which compares reference.date against
	// the capture date rather than formatting each in isolation.
	readonly sliderLabels: CompareSliderLabels;
}

export interface DeriveComparisonPresentationOptions {
	// UI copy, not app logic — supplied by the caller so this module never
	// hard-codes per-locale wording itself (docs/APPLICATION_LAYOUT.md
	// Internationalization: "the layout must not contain hard-coded
	// user-facing strings").
	readonly referenceFallbackLabel: string;
	readonly sliderLabelFallbacks: CompareSliderLabelFallbacks;
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
		location: resolveLocation(raw),
		sliderLabels: computeCompareSliderLabels(
			getNestedString(raw, "reference", "date"),
			metadata.captureTimestampMs,
			locale,
			options.sliderLabelFallbacks,
		),
	};
}
