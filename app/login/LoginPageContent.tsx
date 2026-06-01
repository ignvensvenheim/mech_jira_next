"use client";

import "../page.css";
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { sanitizeAdminCallbackUrl } from "@/lib/authRedirect";

export default function LoginPageContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeAdminCallbackUrl(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError(t("login.requiredError"));
      return;
    }

    setLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setLoading(false);

    if (result?.error) {
      setError(t("login.invalidCredentials"));
      return;
    }

    if (result?.ok) {
      router.push(callbackUrl);
      return;
    }

    setError(t("login.invalidCredentials"));
  };

  return (
    <div className="page login-page">
      <div className="page__layout page__layout--full">
        <section className="page__content login-page__content">
          <div className="login-page__card-wrap">
            <div className="auth-card">
              <h1 className="auth-title">{t("login.title")}</h1>
              <p className="auth-subtitle">{t("login.subtitle")}</p>
              <form onSubmit={onSubmit} className="auth-form">
                <label>
                  <div className="auth-label">{t("login.emailOrUsername")}</div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("login.emailPlaceholder")}
                    className="auth-input"
                    autoComplete="email"
                  />
                </label>
                <label>
                  <div className="auth-label">{t("login.password")}</div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("login.passwordPlaceholder")}
                    className="auth-input"
                    autoComplete="current-password"
                  />
                </label>
                {error && <div className="auth-error">{error}</div>}
                <div className="login-page__buttons">
                  <button type="submit" className="auth-button" disabled={loading}>
                    {loading ? t("login.signingIn") : t("login.signIn")}
                  </button>
                  <Link href="/" className="auth-button auth-button--secondary">
                    {t("common.backToHome")}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
