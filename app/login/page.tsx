"use client";

import "../page.css";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Username/email and password are required.");
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
      setError("Invalid credentials.");
      return;
    }

    if (result?.ok) {
      router.push(callbackUrl);
      return;
    }

    setError("Invalid credentials.");
  };

  return (
    <div className="page">
      <div className="page__layout">
        <section className="page__content">
          <div className="auth-card">
            <h1 className="auth-title">Admin Login</h1>
            <p className="auth-subtitle">Sign in to access the admin panel.</p>
            <form onSubmit={onSubmit} className="auth-form">
              <label>
                <div className="auth-label">Email or username</div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com or ignven"
                  className="auth-input"
                />
              </label>
              <label>
                <div className="auth-label">Password</div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input"
                />
              </label>
              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
              {error && <div className="auth-error">{error}</div>}
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
