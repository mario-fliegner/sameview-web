// Ports the SameView Android production comparison-label priority chain
// (sameview/app/src/main/java/com/isardomains/sameview/ui/compare/CompareLabelLogic.kt
// `computeCompareLabels`) so the Web slider's on-image labels match the
// Android app's behavior exactly, including which side wins a tie and when
// the comparison falls back to "Past"/"Present" instead of a formatted date.
//
// Pure and free of React/DOM dependencies on purpose, mirroring the Kotlin
// original (no Compose/Context dependency there; no React/DOM dependency
// here) — kept in its own module, separate from the visual slider component,
// so ComparisonSlider.tsx never needs to know how a label was derived, only
// what to render (docs/IMPORTED_COMPARISON_V1.md "Derived Slider Labels").

import type { Locale } from "../i18n/translations";

export interface CompareSliderLabels {
	readonly left: string;
	readonly right: string;
}

export interface CompareSliderLabelFallbacks {
	// Level 4: reference.date present but indistinguishable from the capture
	// at its own stored precision (Android: compare_label_past/present).
	readonly past: string;
	readonly present: string;
	// Level 5: no reference.date at all (Android: compare_label_reference/current).
	readonly reference: string;
	readonly current: string;
}

// Android's SimpleDateFormat("MMM yyyy" / "d MMM", locale) fixes the token
// order itself and only localizes the month name — Intl's own `month`/`day`
// combination would instead reorder per locale convention, which is not what
// Android does. Building the fixed-order string from a locale-aware month
// abbreviation alone reproduces that exactly.
function monthAbbreviation(date: Date, locale: Locale): string {
	return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}

// referenceDate: ISO 8601 at year ("YYYY"), month ("YYYY-MM") or day
// ("YYYY-MM-DD") precision, as stored in reference.date; undefined when
// absent (docs/IMPORTED_COMPARISON_V1.md "Reference Label" precision table).
export function computeCompareSliderLabels(
	referenceDate: string | undefined,
	captureTimestampMs: number,
	locale: Locale,
	fallbacks: CompareSliderLabelFallbacks,
): CompareSliderLabels {
	// Level 5 — no reference.date.
	if (!referenceDate) {
		return { left: fallbacks.reference, right: fallbacks.current };
	}

	const refYear = Number(referenceDate.slice(0, 4));
	const captureDate = new Date(captureTimestampMs);
	const capYear = captureDate.getFullYear();

	// Level 1 — different years.
	if (refYear !== capYear) {
		return { left: String(refYear), right: String(capYear) };
	}

	// Level 2 — same year, different months, month precision available.
	if (referenceDate.length >= 7) {
		const refMonth = Number(referenceDate.slice(5, 7)) - 1;
		const capMonth = captureDate.getMonth();
		if (refMonth !== capMonth) {
			const refDate = new Date(refYear, refMonth, 1);
			return {
				left: `${monthAbbreviation(refDate, locale)} ${refYear}`,
				right: `${monthAbbreviation(captureDate, locale)} ${capYear}`,
			};
		}
	}

	// Level 3 — same year and month, day precision available (includes the
	// two dates falling on the same day — Android still shows both sides).
	if (referenceDate.length >= 10) {
		const refMonth = Number(referenceDate.slice(5, 7)) - 1;
		const refDay = Number(referenceDate.slice(8, 10));
		const refDate = new Date(refYear, refMonth, refDay);
		return {
			left: `${refDay} ${monthAbbreviation(refDate, locale)}`,
			right: `${captureDate.getDate()} ${monthAbbreviation(captureDate, locale)}`,
		};
	}

	// Level 4 — reference.date present but the two dates are indistinguishable
	// at the precision actually stored.
	return { left: fallbacks.past, right: fallbacks.present };
}
