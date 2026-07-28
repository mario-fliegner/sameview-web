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
		readonly hiddenHeading: string;
		readonly heroInstruction: string;
		readonly chooseExportButton: string;
		readonly helperCaption: string;
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
			hiddenHeading: "Start a workspace with a SameView Export",
			heroInstruction: "Start with your SameView Export",
			chooseExportButton: "Choose Export",
			helperCaption: "Processed on your device. Nothing is uploaded.",
			importing: "Setting up your workspace…",
			importFailed:
				"That doesn't look like a SameView Export — try another file.",
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
			hiddenHeading: "Starte einen Arbeitsbereich mit einem SameView-Export",
			heroInstruction: "Starte mit deinem SameView-Export",
			chooseExportButton: "Export auswählen",
			helperCaption:
				"Wird auf deinem Gerät verarbeitet. Nichts wird hochgeladen.",
			importing: "Arbeitsbereich wird eingerichtet…",
			importFailed:
				"Das sieht nicht nach einem SameView-Export aus — versuche es mit einer anderen Datei.",
		},
		workspace: {
			title: "Vergleich importiert",
			sessionLabel: "Sitzung",
		},
	},
};
