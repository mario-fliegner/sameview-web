// Ordinary React context for the current UI language — no external state
// library, no cross-island store. This is safe here specifically because the
// whole interactive application is a single hydrated React tree (see
// src/components/App.tsx); every consumer of `useLocale` is a descendant of
// the same LocaleProvider, so plain context is sufficient to keep them in
// sync. See docs/APPLICATION_LAYOUT.md "Language Selector": switching must
// update the whole UI immediately, without a page reload or losing workspace
// state, which rules out route-based locale switching (see
// src/i18n/translations.ts for why).

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	defaultLocale,
	type Locale,
	locales,
	type Translations,
	translations,
} from "./translations";

const STORAGE_KEY = "sameview-web:locale";

interface LocaleContextValue {
	readonly locale: Locale;
	readonly t: Translations;
	readonly setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function isLocale(value: string | null): value is Locale {
	return value !== null && (locales as readonly string[]).includes(value);
}

function readStoredLocale(): Locale | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		return isLocale(stored) ? stored : undefined;
	} catch {
		// localStorage may be unavailable (private browsing, disabled storage).
		// Falling back to the default locale keeps the app usable.
		return undefined;
	}
}

export function LocaleProvider({ children }: { children: ReactNode }) {
	// Starts at the server-rendered default so hydration never mismatches;
	// a persisted preference (if any) is applied right after mount instead.
	const [locale, setLocale] = useState<Locale>(defaultLocale);

	useEffect(() => {
		// Runs once, on mount only, to apply a persisted preference: `locale`
		// is deliberately excluded from the dependency array.
		const stored = readStoredLocale();
		if (stored && stored !== defaultLocale) setLocale(stored);
	}, []);

	useEffect(() => {
		try {
			window.localStorage.setItem(STORAGE_KEY, locale);
		} catch {
			// Ignore: persistence is a convenience, not a correctness requirement.
		}
		document.documentElement.lang = locale;
	}, [locale]);

	const value: LocaleContextValue = {
		locale,
		t: translations[locale],
		setLocale,
	};

	return (
		<LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
	);
}

export function useLocale(): LocaleContextValue {
	const context = useContext(LocaleContext);
	if (!context) {
		throw new Error("useLocale must be used within a LocaleProvider");
	}
	return context;
}
