// Pure coverage for src/i18n/translations.ts: guards against a translation
// key existing in one locale but not the other, which would otherwise only
// surface as a silent blank string in the UI (docs/APPLICATION_LAYOUT.md
// Internationalization: "the layout must not contain hard-coded user-facing
// strings" for either locale).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	defaultLocale,
	locales,
	translations,
} from "../../src/i18n/translations.ts";

function collectKeyPaths(value, prefix = "") {
	if (typeof value !== "object" || value === null) return [prefix];
	return Object.keys(value)
		.sort()
		.flatMap((key) =>
			collectKeyPaths(value[key], prefix ? `${prefix}.${key}` : key),
		);
}

describe("translations", () => {
	test("declares the same key paths for every locale", () => {
		const [first, ...rest] = locales;
		const expectedKeys = collectKeyPaths(translations[first]);
		for (const locale of rest) {
			assert.deepEqual(
				collectKeyPaths(translations[locale]),
				expectedKeys,
				`locale "${locale}" has different keys than "${first}"`,
			);
		}
	});

	test("every value is a non-empty string", () => {
		for (const locale of locales) {
			for (const path of collectKeyPaths(translations[locale])) {
				const value = path
					.split(".")
					.reduce((node, key) => node[key], translations[locale]);
				assert.equal(
					typeof value,
					"string",
					`translations.${locale}.${path} must be a string`,
				);
				assert.ok(
					value.length > 0,
					`translations.${locale}.${path} must not be empty`,
				);
			}
		}
	});

	test("defaultLocale is one of the declared locales", () => {
		assert.ok(locales.includes(defaultLocale));
	});
});
