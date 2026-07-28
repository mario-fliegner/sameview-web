// Global header (docs/APPLICATION_LAYOUT.md Header, Header Actions):
// identity, plus exactly one right-aligned control depending on state —
// the language selector in `No Workspace`, or the "Replace Export" action in
// `Workspace Active`. Never both: once a workspace is active, the language
// selector moves to the footer instead (src/components/AppFooter.tsx;
// docs/APPLICATION_LAYOUT.md Language Selector), keeping this header a
// single, compact, extensible control group rather than two unrelated ones
// competing for the same row — this is also what keeps it a single row on
// mobile. Workspace status and the click handler are owned by the shared
// app shell (src/components/App.tsx), not by this component, so this header
// stays a plain, prop-driven view.

import type { RefObject } from "react";
import { useLocale } from "../i18n/LocaleContext";
import LanguageSelector from "./LanguageSelector";

interface AppHeaderProps {
	readonly showReplaceExport: boolean;
	readonly replaceExportDisabled: boolean;
	readonly onReplaceExportClick: () => void;
	// Lets the app shell return focus to this exact button when
	// ReplacementModeOverlay closes via Cancel or Escape
	// (docs/AI_ENGINEERING_GUIDE.md Accessibility: visible, predictable
	// focus), without this component needing to know why.
	readonly replaceExportButtonRef?: RefObject<HTMLButtonElement | null>;
}

export default function AppHeader({
	showReplaceExport,
	replaceExportDisabled,
	onReplaceExportClick,
	replaceExportButtonRef,
}: AppHeaderProps) {
	const { t } = useLocale();

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
			<div className="app-header__controls">
				{showReplaceExport ? (
					<button
						type="button"
						ref={replaceExportButtonRef}
						className="app-header__action"
						data-testid="replace-export-button"
						disabled={replaceExportDisabled}
						onClick={onReplaceExportClick}
					>
						{t.header.replaceExportButton}
					</button>
				) : (
					<LanguageSelector />
				)}
			</div>
		</header>
	);
}
