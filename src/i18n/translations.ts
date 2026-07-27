// Plain typed translation dictionary for SameView Web's application shell.
// Adapted from the dictionary pattern used by the sameview-website reference
// project (a plain `{ de: {...}, en: {...} }` object), but without its
// locale-prefixed routing: docs/APPLICATION_LAYOUT.md requires that changing
// the language never reloads the page or resets the active workspace, and
// V1 has no workspace persistence (docs/IMPLEMENTATION_PLAN_V1.md Section 9),
// so a route change is not an option here. See src/i18n/LocaleContext.tsx for
// how this dictionary is consumed.

export type Locale = "de" | "en";

export const locales: readonly Locale[] = ["de", "en"];

export const defaultLocale: Locale = "en";

export interface Translations {
	readonly meta: {
		readonly title: string;
	};
	readonly header: {
		readonly brandName: string;
		readonly logoAlt: string;
		readonly languageSelectorLabel: string;
		readonly switchToGerman: string;
		readonly switchToEnglish: string;
	};
	readonly footer: {
		readonly legalNavigationLabel: string;
		readonly privacy: string;
		readonly terms: string;
		readonly imprint: string;
	};
	readonly importSection: {
		readonly title: string;
		readonly description: string;
		readonly dropzoneLabel: string;
		readonly dropzoneOr: string;
		readonly selectButton: string;
		readonly privacyNoticeLine1: string;
		readonly privacyNoticeLine2: string;
		readonly supportedFormat: string;
		readonly importing: string;
		readonly importFailed: string;
	};
	readonly workspace: {
		readonly title: string;
		readonly sessionLabel: string;
	};
}

export const translations: Record<Locale, Translations> = {
	en: {
		meta: {
			title: "SameView Web",
		},
		header: {
			brandName: "SameView Web",
			logoAlt: "SameView",
			languageSelectorLabel: "Language",
			switchToGerman: "Switch to German",
			switchToEnglish: "Switch to English",
		},
		footer: {
			legalNavigationLabel: "Legal",
			privacy: "Privacy",
			terms: "Terms",
			imprint: "Imprint",
		},
		importSection: {
			title: "Import Comparison",
			description:
				"Continue working with an exported SameView comparison directly in your browser.",
			dropzoneLabel: "Drag & Drop",
			dropzoneOr: "or",
			selectButton: "Select SameView Export (.zip)",
			privacyNoticeLine1: "Processed locally in your browser.",
			privacyNoticeLine2: "Nothing is uploaded.",
			supportedFormat: "Supports SameView Export (.zip)",
			importing: "Importing…",
			importFailed:
				"This file could not be imported as a SameView comparison. Please choose a valid SameView export ZIP.",
		},
		workspace: {
			title: "Comparison imported",
			sessionLabel: "Session",
		},
	},
	de: {
		meta: {
			title: "SameView Web",
		},
		header: {
			brandName: "SameView Web",
			logoAlt: "SameView",
			languageSelectorLabel: "Sprache",
			switchToGerman: "Auf Deutsch umschalten",
			switchToEnglish: "Auf Englisch umschalten",
		},
		footer: {
			legalNavigationLabel: "Rechtliches",
			privacy: "Datenschutz",
			terms: "Nutzungsbedingungen",
			imprint: "Impressum",
		},
		importSection: {
			title: "Vergleich importieren",
			description:
				"Arbeite direkt im Browser mit einem exportierten SameView-Vergleich weiter.",
			dropzoneLabel: "Ziehen & Ablegen",
			dropzoneOr: "oder",
			selectButton: "SameView-Export auswählen (.zip)",
			privacyNoticeLine1: "Wird lokal in deinem Browser verarbeitet.",
			privacyNoticeLine2: "Es wird nichts hochgeladen.",
			supportedFormat: "Unterstützt SameView-Export (.zip)",
			importing: "Wird importiert…",
			importFailed:
				"Diese Datei konnte nicht als SameView-Vergleich importiert werden. Bitte wähle einen gültigen SameView-Export als ZIP-Datei.",
		},
		workspace: {
			title: "Vergleich importiert",
			sessionLabel: "Sitzung",
		},
	},
};
