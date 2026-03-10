"use client";

import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

export default function AppHeader() {
  const { t } = useI18n();

  return (
    <header className="header">
      <div className="header__inner">
        <Link
          href="/"
          className="header__logo-link"
          aria-label={t("header.homeAria")}
        >
          <img src="/logo.svg" alt="Svenheim" className="header__logo" />
        </Link>
        <div className="header__right">
          <span className="header__title">{t("header.title")}</span>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

