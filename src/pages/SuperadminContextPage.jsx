import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCompaniesApi } from "../api/companies.api";
import { setAdminContextApi } from "../api/admin.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { SuccessBanner } from "../components/SuccessBanner";
import { useAuth } from "../auth/AuthContext";
import { getEntityId, setToken } from "../api/apiClient";

export function SuperadminContextPage() {
  const { user, refreshMe } = useAuth();
  const nav = useNavigate();

  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companiesError, setCompaniesError] = useState(null);
  const [companiesPayload, setCompaniesPayload] = useState(null);

  const companies = useMemo(
    () => companiesPayload?.companies || [],
    [companiesPayload],
  );

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function load() {
      setLoadingCompanies(true);
      setCompaniesError(null);
      try {
        const data = await listCompaniesApi(); // { companies: [...] }
        setCompaniesPayload(data);

        // If user already has activeCompanyId, try to preselect
        if (user?.activeCompanyId)
          setSelectedCompanyId(String(user.activeCompanyId));
      } catch (e) {
        setCompaniesError(e);
      } finally {
        setLoadingCompanies(false);
      }
    }
    load();
  }, [user?.activeCompanyId]);

  async function onSave() {
    setSaveError(null);
    setSuccess("");
    setSaving(true);
    try {
      // Contract: { companyId } and response { token, activeCompanyId }
      const data = await setAdminContextApi({ companyId: selectedCompanyId });
      if (data?.token) setToken(data.token);
      await refreshMe();
      setSuccess("Company context set.");
      nav("/dashboard", { replace: true });
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">Select Company Context</div>
        <div className="muted">
          Superadmin only. Uses <code>GET /api/companies</code> and{" "}
          <code>POST /api/admin/context</code>.
          <br />
          This endpoint returns a <strong>new token</strong> that includes{" "}
          <code>activeCompanyId</code>, and the UI replaces the stored token.
        </div>
      </div>

      <ErrorBanner
        error={companiesError}
        onDismiss={() => setCompaniesError(null)}
      />
      {loadingCompanies ? <LoadingBlock title="Loading companies..." /> : null}

      {!loadingCompanies && companiesPayload ? (
        <div className="card">
          <SuccessBanner message={success} onDismiss={() => setSuccess("")} />
          <ErrorBanner error={saveError} onDismiss={() => setSaveError(null)} />

          <div className="grid grid-2">
            <label className="field">
              <div className="field-label">Company</div>
              <select
                className="input"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                disabled={saving}
              >
                <option value="">Select...</option>
                {companies.map((c, idx) => {
                  const id = getEntityId(c) || String(idx);
                  const name = c?.name ?? "(unnamed)";
                  return (
                    <option key={id} value={id}>
                      {name} — {id}
                    </option>
                  );
                })}
              </select>
              <div className="field-hint">
                IDs are taken from runtime object (id/_id/$oid if present).
              </div>
            </label>

            <div className="field">
              <div className="field-label">Actions</div>
              <button
                className="btn btn-primary"
                onClick={onSave}
                disabled={saving || !selectedCompanyId}
              >
                {saving ? "Saving..." : "Set Context"}
              </button>
              <div className="field-hint">
                Calls POST /api/admin/context with {`{ companyId }`}.
              </div>
            </div>
          </div>

          <div className="card card-subtle" style={{ marginTop: 12 }}>
            <div className="h2">Raw companies payload</div>
            <pre className="json">
              {JSON.stringify(companiesPayload, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
