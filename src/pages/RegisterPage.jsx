import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ErrorBanner } from "../components/ErrorBanner";
import { FormField } from "../components/FormField";

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("tech");
  const [companyId, setCompanyId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body = {
        name: name.trim(),
        email: email.trim(),
        password,
      };

      if (role) body.role = role;
      if (companyId.trim()) body.companyId = companyId.trim();

      await register(body);
      nav("/dashboard", { replace: true });
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
            <div className="h1">Create account</div>
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Set up a Presto account and choose the role/company details needed
              for your environment.
            </p>
          </div>

          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          <form onSubmit={onSubmit} className="stack">
            <FormField label="Name">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </FormField>

            <FormField label="Email">
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                disabled={loading}
              />
            </FormField>

            <FormField label="Password">
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                disabled={loading}
              />
            </FormField>

            <div className="grid grid-2">
              <FormField
                label="Role"
                hint="Allowed roles: tech, admin, superadmin"
              >
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading}
                >
                  <option value="tech">tech</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </FormField>

              <FormField label="Company ID (optional)" hint="You can set this later">
                <input
                  className="input"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  disabled={loading}
                />
              </FormField>
            </div>

            <div className="row">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Account"}
              </button>
            </div>

            <div className="muted">
              Already have an account? <Link to="/login">Sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}