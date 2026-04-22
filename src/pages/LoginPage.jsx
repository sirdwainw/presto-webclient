import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ErrorBanner } from "../components/ErrorBanner";
import { FormField } from "../components/FormField";

const DEMO_EMAIL = "demo@presto-app.com";
const DEMO_PASSWORD = "Demo123!";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || loc.state?.from || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState("");

  function handleDemoFill() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
    setInfo("Demo credentials loaded.");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo("");
    setLoading(true);
    try {
      await login({ email, password });
      nav(from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-center">
      <div className="card card-narrow">
        <div className="stack">
          <div>
            <div className="h1">Welcome back to Presto</div>
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Sign in to access assignments, location updates, dashboards, and
              review tools.
            </p>
          </div>

          <div className="card card-subtle">
            <div className="h2" style={{ marginBottom: 8 }}>
              Demo access
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Exploring Presto for portfolio review? Load the demo account to
              enter a sample environment with limited access and sample data.
            </p>

            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleDemoFill}
                disabled={loading}
                title="Loads demo credentials into the form"
              >
                Use Demo Account
              </button>
            </div>
          </div>

          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          {info ? (
            <div
              className="card card-subtle"
              style={{
                padding: 10,
                border: "1px solid rgba(80,180,120,.35)",
              }}
            >
              <div className="muted">{info}</div>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="stack">
            <FormField label="Email">
              <input
                className="input"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setInfo("");
                }}
                type="email"
                required
                autoComplete="email"
                disabled={loading}
              />
            </FormField>

            <FormField label="Password">
              <input
                className="input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setInfo("");
                }}
                type="password"
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </FormField>

            <div className="row">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </div>

            <div className="muted">
              Registration is temporarily disabled for portfolio review. Please
              use the demo account above.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}