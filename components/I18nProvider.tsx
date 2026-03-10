"use client";

import React from "react";
import { Locale, translate, TranslationKey } from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "mechanikai-locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("en");

  React.useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "lt") {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLocale = React.useCallback((value: Locale) => {
    setLocaleState(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    document.documentElement.lang = value;
  }, []);

  const t = React.useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale]
  );

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = React.useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return value;
}

