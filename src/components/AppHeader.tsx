// Global header (docs/APPLICATION_LAYOUT.md Header): identity and the
// language selector. No primary workspace actions are implemented yet
// (`Replace Export` is a later, separate iteration; docs/APPLICATION_LAYOUT.md
// Header Actions already defines "No Workspace: no primary actions", which is
// the only state this iteration implements).

import { useLocale } from "../i18n/LocaleContext";
import type { Locale } from "../i18n/translations";
import { locales } from "../i18n/translations";

const LANGUAGE_LABEL: Record<Locale, string> = {
	de: "DE",
	en: "EN",
};

export default function AppHeader() {
	const { locale, setLocale, t } = useLocale();

	return (
		<header className="app-header">
			<div className="app-header__brand">
				<img
					className="app-header__logo"
					src="/assets/logo.webp"
					alt={t.header.logoAlt}
					width={32}
					height={32}
				/>
				<p className="app-header__name">{t.header.brandName}</p>
			</div>
			<nav
				className="app-header__lang"
				aria-label={t.header.languageSelectorLabel}
			>
				{locales.map((candidate, index) => (
					<span key={candidate}>
						{index > 0 && (
							<span className="app-header__lang-separator" aria-hidden="true">
								|
							</span>
						)}
						<button
							type="button"
							className="app-header__lang-button"
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
		</header>
	);
}
