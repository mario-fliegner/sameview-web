// The DE/EN language selector (docs/APPLICATION_LAYOUT.md Language
// Selector), extracted so the same control isn't duplicated between its two
// possible locations: the header in `No Workspace` (src/components/
// AppHeader.tsx) and the footer in `Workspace Active`
// (src/components/AppFooter.tsx). The two call sites are mutually
// exclusive — this component itself doesn't know which state it's in.

import { useLocale } from "../i18n/LocaleContext";
import type { Locale } from "../i18n/translations";
import { locales } from "../i18n/translations";

const LANGUAGE_LABEL: Record<Locale, string> = {
	de: "DE",
	en: "EN",
};

export default function LanguageSelector() {
	const { locale, setLocale, t } = useLocale();

	return (
		<nav
			className="language-selector"
			aria-label={t.header.languageSelectorLabel}
		>
			{locales.map((candidate, index) => (
				<span key={candidate}>
					{index > 0 && (
						<span className="language-selector__separator" aria-hidden="true">
							|
						</span>
					)}
					<button
						type="button"
						className="language-selector__button"
						aria-current={candidate === locale ? "true" : undefined}
						title={
							candidate === "de"
								? t.header.switchToGerman
								: t.header.switchToEnglish
						}
						disabled={candidate === locale}
						onClick={() => setLocale(candidate)}
					>
						{LANGUAGE_LABEL[candidate]}
					</button>
				</span>
			))}
		</nav>
	);
}
