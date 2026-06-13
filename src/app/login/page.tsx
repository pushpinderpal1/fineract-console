"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fineract, formatError, setSession, type Session } from "@/lib/fineract";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("mifos");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setError(null); }, [username, password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Build a tentative session and ask Fineract to validate via /authentication.
    const base64Encoded = typeof window !== "undefined"
      ? window.btoa(`${username}:${password}`)
      : "";

    const tentative: Session = { username, base64Encoded, authenticated: false };

try {
      // POST /authentication with JSON body — modern Fineract (post FINERACT-726)
      await fineract({
        method: "POST",
        path: `/authentication`,
        body: { username, password },
        session: tentative,
      });
      setSession({ ...tentative, authenticated: true });
      router.replace("/loan-products");
    } catch (e) {
      const f = formatError(e);
      setError(`${f.title} — ${f.detail}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-dot" style={{
            display: "inline-block",
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--signal)",
          }} />
          Fineract Console
        </div>

        <h1 className="page-title" style={{ fontSize: 22, marginBottom: 4 }}>
          Sign in
        </h1>
        <p className="page-sub" style={{ marginBottom: 24, fontSize: 13 }}>
          Use a Fineract user account. Defaults to <code style={{ fontFamily: "var(--font-display)" }}>mifos</code>.
        </p>

        {error && (
          <div className="alert alert-bad">
            <div className="alert-label">Sign-in failed</div>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form" style={{ gap: 20 }}>
          <div className="field">
            <label className="field-label">
              Username
              <span className="field-label-code">username</span>
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field-label">
              Password
              <span className="field-label-code">password</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
