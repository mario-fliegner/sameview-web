// Global footer (docs/APPLICATION_LAYOUT.md Footer): legal navigation
// always, plus the language selector while a workspace is active
// (docs/APPLICATION_LAYOUT.md Language Selector) — in `No Workspace` the
// selector still lives in the header instead (src/components/AppHeader.tsx);
// it is never shown in both places at once.
// SameView Web does not host its own legal pages; per the approved scope,
// the footer links to the existing, already-published legal pages on
// sameview.app instead of duplicating legal content locally, using the
// current UI language's path.

import { useLocale } from "../i18n/LocaleContext";
import LanguageSelector from "./LanguageSelector";

const LEGAL_BASE_URL = "https://sameview.app";

interface AppFooterProps {
	readonly showLanguageSelector: boolean;
}

export default function AppFooter({ showLanguageSelector }: AppFooterProps) {
	const { locale, t } = useLocale();

	const links = [
		{ href: `${LEGAL_BASE_URL}/${locale}/privacy`, label: t.footer.privacy },
		{ href: `${LEGAL_BASE_URL}/${locale}/terms`, label: t.footer.terms },
		{ href: `${LEGAL_BASE_URL}/${locale}/imprint`, label: t.footer.imprint },
	];

	return (
		<footer className="app-footer">
			<nav
				className="app-footer__nav"
				aria-label={t.footer.legalNavigationLabel}
			>
				{links.map((link) => (
					<a key={link.href} href={link.href}>
						{link.label}
					</a>
				))}
			</nav>
			{showLanguageSelector && <LanguageSelector />}
		</footer>
	);
}
