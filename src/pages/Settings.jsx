import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { meApi, setActiveCompanyApi } from "../api/auth.api";
import { listCompaniesApi } from "../api/companies.api";
import { setToken } from "../api/apiClient";
import { ErrorBanner } from "../components/ErrorBanner";
import { SuccessBanner } from "../components/SuccessBanner";
import { LoadingBlock } from "../components/LoadingBlock";

export default function Settings() {
  const { user, refreshMe } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setMessage("");

      try {
        const [meRes, companiesRes] = await Promise.all([
          meApi(),
          listCompaniesApi(),
        ]);

        if (cancelled) return;

        const meUser = meRes?.user ?? meRes ?? null;
        const list = companiesRes?.companies ?? companiesRes ?? [];

        setCompanies(Array.isArray(list) ? list : []);
        setSelectedCompanyId(meUser?.activeCompanyId || "");
      } catch (e) {
        if (cancelled) return;
        setError(e?.error || e?.message || "Failed to load settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCompanyName = useMemo(() => {
    const id = user?.activeCompanyId;
    if (!id) return "(none)";
    const found = companies.find((c) => c._id === id || c.id === id);
    return found?.name || found?.companyName || id;
  }, [companies, user?.activeCompanyId]);

  const selectedCompanyName = useMemo(() => {
    if (!selectedCompanyId) return "(none)";
    const found = companies.find(
      (c) => c._id === selectedCompanyId || c.id === selectedCompanyId
    );
    return found?.name || found?.companyName || selectedCompanyId;
  }, [companies, selectedCompanyId]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!selectedCompanyId) {
        setError("Please select a company.");
        return;
      }

      const res = await setActiveCompanyApi(selectedCompanyId);

      if (res?.token) {
        setToken(res.token);
      }

      await refreshMe();
      setMessage("Active company saved.");
    } catch (e2) {
      setError(e2?.error || e2?.message || "Failed to save active company.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingBlock title="Loading settings..." />;
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">Settings</div>
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Choose the company you are currently working under so Presto loads the
          correct scoped data.
        </p>
      </div>

      {error ? <ErrorBanner error={error} onDismiss={() => setError("")} /> : null}
      {message ? <SuccessBanner>{message}</SuccessBanner> : null}

      <div className="grid grid-2">
        <div className="card">
          <div className="h2">Account</div>
          <div className="stack" style={{ marginTop: 12 }}>
            <div>
              <div className="field-label">Email</div>
              <div>{user?.email || "(unknown)"}</div>
            </div>
            <div>
              <div className="field-label">Role</div>
              <div>{user?.role || "(unknown)"}</div>
            </div>
            <div>
              <div className="field-label">Active Company</div>
              <div>{activeCompanyName}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="card">
          <div className="h2">Active Company</div>
          <p className="muted" style={{ marginTop: 8 }}>
            Select the company context you want to work in right now.
          </p>

          <div className="stack" style={{ marginTop: 12 }}>
            <label className="field">
              <div className="field-label">Select company</div>
              <select
                className="input"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                disabled={saving}
              >
                <option value="">-- Choose a company --</option>
                {companies.map((c) => {
                  const id = c._id ?? c.id;
                  const label = c.name ?? c.companyName ?? id;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="muted">
              Selected: <strong>{selectedCompanyName}</strong>
            </div>

            <div className="row">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving || !selectedCompanyId}
              >
                {saving ? "Saving..." : "Switch Active Company"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}