// The single hydrated React root for the interactive application
// (docs/APPLICATION_LAYOUT.md Global Layout). Astro's AppLayout.astro is
// responsible only for the document shell (<html>/<head>/skip link) and
// mounts this component once via `client:load`; everything a user actually
// interacts with — header, workspace, footer — lives in this one tree so
// that locale and (future) workspace-wide state can be shared with ordinary
// React context instead of a cross-island store.

import { useEffect } from "react";
import { LocaleProvider, useLocale } from "../i18n/LocaleContext";
import AppFooter from "./AppFooter";
import AppHeader from "./AppHeader";
import ImportSection from "./ImportSection";

function AppShell() {
	const { t } = useLocale();

	// The <title> is corrected here (rather than left at Astro's
	// server-rendered default) so it also updates when the language changes
	// without a reload, per docs/APPLICATION_LAYOUT.md Internationalization
	// ("page title"). Must run in an effect, not during render: this
	// component is also rendered to a string on the server (client:load),
	// where `document` does not exist.
	useEffect(() => {
		document.title = t.meta.title;
	}, [t]);

	return (
		<>
			<AppHeader />
			<main id="main-content" tabIndex={-1}>
				<ImportSection />
			</main>
			<AppFooter />
		</>
	);
}

export default function App() {
	return (
		<LocaleProvider>
			<AppShell />
		</LocaleProvider>
	);
}
