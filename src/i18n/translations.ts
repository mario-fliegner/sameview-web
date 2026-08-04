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
		readonly replaceExportButton: string;
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
		readonly importSucceeded: string;
		readonly importFailed: string;
	};
	readonly workspace: {
		readonly title: string;
		readonly sessionLabel: string;
		readonly referenceFallbackLabel: string;
		readonly referenceHeading: string;
		readonly captureHeading: string;
		readonly locationHeading: string;
		readonly loadingLabel: string;
		readonly sliderLabel: string;
		readonly referenceImageAlt: string;
		readonly captureImageAlt: string;
		// On-image comparison labels beside the slider handle (Android
		// CompareLabelLogic.kt's Level 4/5 fallback wording:
		// compare_label_past/present/reference/current) — distinct from
		// referenceFallbackLabel/referenceHeading/captureHeading above, which
		// are the sidebar's own separate wording.
		readonly sliderPastLabel: string;
		readonly sliderPresentLabel: string;
		readonly sliderReferenceLabel: string;
		readonly sliderCurrentLabel: string;
		// Accessible names for the Fullscreen Mode entry/exit icon buttons
		// (docs/APPLICATION_LAYOUT.md "Fullscreen Mode") — both buttons are
		// icon-only, so these strings are never shown as visible text.
		readonly fullscreenOpenButton: string;
		readonly fullscreenCloseButton: string;
	};
	readonly replacementMode: {
		readonly validatingHeading: string;
		readonly validatingMessage: string;
		readonly confirmHeading: string;
		readonly confirmDescription: string;
		readonly currentSessionLabel: string;
		readonly newSessionLabel: string;
		readonly confirmButton: string;
		readonly cancelButton: string;
	};
	readonly editInspector: {
		readonly heading: string;
		readonly comparisonInformationHeading: string;
		readonly titleLabel: string;
		readonly showTitleLabel: string;
		readonly descriptionLabel: string;
		readonly showDescriptionLabel: string;
		readonly timeLegend: string;
		readonly showTimeLabel: string;
		readonly referenceDateLabel: string;
		readonly captureDateLabel: string;
		readonly referenceDateErrors: {
			readonly "invalid-format": string;
			readonly "invalid-year": string;
			readonly "invalid-month": string;
			readonly "invalid-day": string;
		};
		readonly locationLegend: string;
		readonly showLocationLabel: string;
		readonly locationDisplayNameLabel: string;
		readonly locationCityLabel: string;
		readonly locationCountryLabel: string;
		readonly presentation: {
			readonly heading: string;
			readonly colorsLegend: string;
			readonly backgroundLegend: string;
			readonly backgroundOptions: {
				readonly transparent: string;
				readonly white: string;
				readonly black: string;
				readonly brand: string;
				readonly custom: string;
			};
			readonly frameLegend: string;
			readonly frameOptions: {
				readonly none: string;
				readonly white: string;
				readonly black: string;
				readonly custom: string;
			};
			readonly textLegend: string;
			readonly textOptions: {
				readonly automatic: string;
				readonly light: string;
				readonly dark: string;
				readonly custom: string;
			};
			readonly shapeLegend: string;
			readonly cornersLegend: string;
			readonly cornerOptions: {
				readonly sharp: string;
				readonly rounded: string;
			};
			readonly customColorHeading: string;
			readonly customColorSwatchLabel: string;
			readonly customColorHexLabel: string;
			readonly sliderLegend: string;
			readonly showSliderDateLabelsLabel: string;
		};
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
			replaceExportButton: "Replace Export",
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
			importSucceeded: "Workspace ready.",
			importFailed:
				"That doesn't look like a SameView Export — try another file.",
		},
		workspace: {
			title: "Comparison imported",
			sessionLabel: "Session",
			referenceFallbackLabel: "Then",
			referenceHeading: "Reference",
			captureHeading: "Capture",
			locationHeading: "Location",
			loadingLabel: "Loading comparison…",
			sliderLabel: "Comparison position",
			referenceImageAlt: "Reference photo",
			captureImageAlt: "New photo",
			sliderPastLabel: "Past",
			sliderPresentLabel: "Present",
			sliderReferenceLabel: "Reference",
			sliderCurrentLabel: "Current",
			fullscreenOpenButton: "Fullscreen",
			fullscreenCloseButton: "Exit fullscreen",
		},
		replacementMode: {
			validatingHeading: "Preparing replacement…",
			validatingMessage: "Validating your selected export…",
			confirmHeading: "Replace your workspace?",
			confirmDescription:
				"Your current workspace will be discarded and replaced with this export.",
			currentSessionLabel: "Current session",
			newSessionLabel: "New session",
			confirmButton: "Replace",
			cancelButton: "Cancel",
		},
		editInspector: {
			heading: "Edit Inspector",
			comparisonInformationHeading: "Comparison information",
			titleLabel: "Title",
			showTitleLabel: "Show title",
			descriptionLabel: "Description",
			showDescriptionLabel: "Show description",
			timeLegend: "Photo dates",
			showTimeLabel: "Show photo dates",
			referenceDateLabel: "Reference photo date",
			captureDateLabel: "Capture photo date",
			referenceDateErrors: {
				"invalid-format": "Use YYYY, YYYY-MM or YYYY-MM-DD.",
				"invalid-year": "Enter a year between 1826 and the current year.",
				"invalid-month": "Enter a month between 01 and 12.",
				"invalid-day": "Enter a valid day for that month.",
			},
			locationLegend: "Location",
			showLocationLabel: "Show place",
			locationDisplayNameLabel: "Place name",
			locationCityLabel: "City",
			locationCountryLabel: "Country",
			presentation: {
				heading: "Presentation",
				colorsLegend: "Colors",
				backgroundLegend: "Background",
				backgroundOptions: {
					transparent: "Transparent",
					white: "White",
					black: "Black",
					brand: "Brand",
					custom: "Custom",
				},
				frameLegend: "Frame",
				frameOptions: {
					none: "None",
					white: "White",
					black: "Black",
					custom: "Custom",
				},
				textLegend: "Text",
				textOptions: {
					automatic: "Automatic",
					light: "Light",
					dark: "Dark",
					custom: "Custom",
				},
				shapeLegend: "Shape",
				cornersLegend: "Corners",
				cornerOptions: {
					sharp: "Sharp",
					rounded: "Rounded",
				},
				customColorHeading: "Custom color",
				customColorSwatchLabel: "Color",
				customColorHexLabel: "HEX",
				sliderLegend: "Slider",
				showSliderDateLabelsLabel: "Show date labels",
			},
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
			replaceExportButton: "Export ersetzen",
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
			importSucceeded: "Arbeitsbereich bereit.",
			importFailed:
				"Das sieht nicht nach einem SameView-Export aus — versuche es mit einer anderen Datei.",
		},
		workspace: {
			title: "Vergleich importiert",
			sessionLabel: "Sitzung",
			referenceFallbackLabel: "Damals",
			referenceHeading: "Referenz",
			captureHeading: "Aufnahme",
			locationHeading: "Ort",
			loadingLabel: "Vergleich wird geladen…",
			sliderLabel: "Vergleichsposition",
			referenceImageAlt: "Referenzfoto",
			captureImageAlt: "Neues Foto",
			sliderPastLabel: "Früher",
			sliderPresentLabel: "Heute",
			sliderReferenceLabel: "Referenz",
			sliderCurrentLabel: "Aktuell",
			fullscreenOpenButton: "Vollbild",
			fullscreenCloseButton: "Vollbild beenden",
		},
		replacementMode: {
			validatingHeading: "Ersetzung wird vorbereitet…",
			validatingMessage: "Der ausgewählte Export wird validiert…",
			confirmHeading: "Arbeitsbereich ersetzen?",
			confirmDescription:
				"Dein aktueller Arbeitsbereich wird verworfen und durch diesen Export ersetzt.",
			currentSessionLabel: "Aktuelle Sitzung",
			newSessionLabel: "Neue Sitzung",
			confirmButton: "Ersetzen",
			cancelButton: "Abbrechen",
		},
		editInspector: {
			heading: "Bearbeitungsbereich",
			comparisonInformationHeading: "Vergleichsinformationen",
			titleLabel: "Titel",
			showTitleLabel: "Titel anzeigen",
			descriptionLabel: "Beschreibung",
			showDescriptionLabel: "Beschreibung anzeigen",
			timeLegend: "Datumsangaben",
			showTimeLabel: "Datumsangaben anzeigen",
			referenceDateLabel: "Referenzdatum",
			captureDateLabel: "Aufnahmedatum",
			referenceDateErrors: {
				"invalid-format": "Verwende JJJJ, JJJJ-MM oder JJJJ-MM-TT.",
				"invalid-year":
					"Gib ein Jahr zwischen 1826 und dem aktuellen Jahr ein.",
				"invalid-month": "Gib einen Monat zwischen 01 und 12 ein.",
				"invalid-day": "Gib einen gültigen Tag für diesen Monat ein.",
			},
			locationLegend: "Ort",
			showLocationLabel: "Ort anzeigen",
			locationDisplayNameLabel: "Ortsname",
			locationCityLabel: "Stadt",
			locationCountryLabel: "Land",
			presentation: {
				heading: "Präsentation",
				colorsLegend: "Farben",
				backgroundLegend: "Hintergrund",
				backgroundOptions: {
					transparent: "Transparent",
					white: "Weiß",
					black: "Schwarz",
					brand: "Markenfarbe",
					custom: "Benutzerdefiniert",
				},
				frameLegend: "Rahmen",
				frameOptions: {
					none: "Kein",
					white: "Weiß",
					black: "Schwarz",
					custom: "Benutzerdefiniert",
				},
				textLegend: "Text",
				textOptions: {
					automatic: "Automatisch",
					light: "Hell",
					dark: "Dunkel",
					custom: "Benutzerdefiniert",
				},
				shapeLegend: "Form",
				cornersLegend: "Ecken",
				cornerOptions: {
					sharp: "Eckig",
					rounded: "Abgerundet",
				},
				customColorHeading: "Eigene Farbe",
				customColorSwatchLabel: "Farbe",
				customColorHexLabel: "HEX",
				sliderLegend: "Regler",
				showSliderDateLabelsLabel: "Datumsangaben anzeigen",
			},
		},
	},
};
