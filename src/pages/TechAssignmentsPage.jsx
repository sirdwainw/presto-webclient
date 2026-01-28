import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listTechAssignmentsApi } from "../api/tech.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { Pagination } from "../components/Pagination";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";

export function TechAssignmentsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [active, setActive] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const assignments = useMemo(() => payload?.assignments || [], [payload]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listTechAssignmentsApi({ active, page, limit });
        setPayload(data);
      } catch (e) {
        // Tech-specific error per contract: 400 { error: "No company scope for tech user" }
        if (
          e?.status === 400 &&
          e?.error === "No company scope selected" &&
          role === "superadmin"
        ) {
          nav("/superadmin/context");
          return;
        }
        setError(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [active, page, limit, role, nav]);

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">My Assignments</div>
        <div className="muted">
          Uses <code>GET /api/tech/assignments</code>
        </div>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Active</div>
            <select
              className="input"
              value={String(active)}
              onChange={(e) => setActive(e.target.value === "true")}
              disabled={loading}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>

          <label className="field">
            <div className="field-label">Limit</div>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={loading}
            />
            <div className="field-hint">Default 100, max 500</div>
          </label>

          <div className="field">
            <div className="field-label">Actions</div>
            <button
              className="btn"
              onClick={() => setPage(1)}
              disabled={loading}
            >
              Apply (page 1)
            </button>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <LoadingBlock title="Loading assignments..." /> : null}

      {!loading && payload ? (
        <div className="card">
          <Pagination
            page={payload.page || page}
            limit={payload.limit || limit}
            count={payload.count || 0}
            onPageChange={setPage}
          />
          <div className="h2">Raw payload</div>
          <JsonView data={payload} />
          <div className="muted">
            {assignments.length} assignment(s) in payload.
          </div>
        </div>
      ) : null}
    </div>
  );
}
