// src/pages/Settings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { meApi, setActiveCompanyApi } from "../api/auth.api";
import { listCompaniesApi } from "../api/companies.api";
import { setToken } from "../api/apiClient";

export default function Settings() {
  const { user, refreshMe } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  // Load current user + allowed companies
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
        setError(e?.error || e?.message || "Failed to load Settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Helpful computed values
  const activeCompanyName = useMemo(() => {
    const id = user?.activeCompanyId;
    if (!id) return "(none)";
    const found = companies.find((c) => c._id === id || c.id === id);
    return found?.name || found?.companyName || id;
  }, [companies, user?.activeCompanyId]);

  const selectedCompanyName = useMemo(() => {
    if (!selectedCompanyId) return "(none)";
    const found = companies.find(
      (c) => c._id === selectedCompanyId || c.id === selectedCompanyId,
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

      // Backend returns { token, activeCompanyId }
      const res = await setActiveCompanyApi(selectedCompanyId);

      if (res?.token) {
        // Keep API layer + AuthContext consistent
        setToken(res.token);
      }

      // Refresh auth user so role/company updates everywhere
      await refreshMe();

      setMessage("Active company saved.");
    } catch (e2) {
      setError(e2?.error || e2?.message || "Failed to save active company.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Settings</h2>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 760 }}>
      <h2>Settings</h2>

      <p style={{ marginTop: 8 }}>
        Choose the company you’re currently working under. 
      </p>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #d33",
            borderRadius: 8,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #2a7",
            borderRadius: 8,
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Account</h3>
        <div style={{ lineHeight: 1.8 }}>
          <div>
            <strong>Email:</strong> {user?.email || "(unknown)"}
          </div>
          <div>
            <strong>Role:</strong> {user?.role || "(unknown)"}
          </div>
          <div>
            <strong>Active Company:</strong> {activeCompanyName}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Active Company</h3>

        <label style={{ display: "block", marginBottom: 8 }}>
          Select company
        </label>

        <select
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          style={{ width: "100%", padding: 10 }}
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

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          Selected: <strong>{selectedCompanyName}</strong>
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={saving || !selectedCompanyId}>
            {saving ? "Saving…" : "Switch Active Company"}
          </button>
        </div>
      </form>
    </div>
  );
}
