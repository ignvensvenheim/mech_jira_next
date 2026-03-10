"use client";

import { useI18n } from "@/components/I18nProvider";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-switcher" aria-label={t("header.language")}>
      <button
        type="button"
        className={`lang-btn${locale === "en" ? " active" : ""}`}
        onClick={() => setLocale("en")}
      >
        {t("header.english")}
      </button>
      <button
        type="button"
        className={`lang-btn${locale === "lt" ? " active" : ""}`}
        onClick={() => setLocale("lt")}
      >
        {t("header.lithuanian")}
      </button>
    </div>
  );
}
