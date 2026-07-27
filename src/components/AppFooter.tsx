// Global footer (docs/APPLICATION_LAYOUT.md Footer): legal navigation only.
// SameView Web does not host its own legal pages; per the approved scope,
// the footer links to the existing, already-published legal pages on
// sameview.app instead of duplicating legal content locally, using the
// current UI language's path.

import { useLocale } from "../i18n/LocaleContext";

const LEGAL_BASE_URL = "https://sameview.app";

export default function AppFooter() {
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
		</footer>
	);
}
