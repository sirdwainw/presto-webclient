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

  // Contract: role? companyId?
  const [role, setRole] = useState("");
  const [companyId, setCompanyId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = { name, email, password };
      if (role) body.role = role;
      if (companyId) body.companyId = companyId;

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
        <div className="h1">Register</div>
        <p className="muted">Create an account.</p>

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

          <FormField
            label="Role (optional)"
            hint="Allowed roles per contract: tech, admin, superadmin"
          >
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
            >
              <option value="">(leave unset)</option>
              <option value="tech">tech</option>
              <option value="admin">admin</option>
              <option value="superadmin">superadmin</option>
            </select>
          </FormField>

          <FormField
            label="Company ID (optional)"
            hint="Only provide if your backend expects companyId on registration."
          >
            <input
              className="input"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={loading}
            />
          </FormField>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>

          <div className="muted">
            Already have an account? <Link to="/login">Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
