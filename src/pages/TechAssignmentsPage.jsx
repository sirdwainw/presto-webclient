import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listTechAssignmentsApi } from "../api/tech.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

function isCompanyScopeError(e) {
  const msg = String(e?.error || e?.message || "");
  return e?.status === 400 && msg.startsWith("No company scope selected");
}

export function TechAssignmentsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const meters = useMemo(() => payload?.meters || [], [payload]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return meters;

    return meters.filter((m) => {
      const hay = [
        m?.electronicId,
        m?.accountNumber,
        m?.customerName,
        m?.address,
        m?.route,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" | ");
      return hay.includes(term);
    });
  }, [meters, q]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listTechAssignmentsApi();
        setPayload(data);
      } catch (e) {
        if (isCompanyScopeError(e) && role === "superadmin") {
          nav("/settings");
          return;
        }
        setError(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [role, nav]);

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">My Assignments</div>
        <div className="muted">
          Uses <code>GET /api/tech/assignments</code>
        </div>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Search</div>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={loading}
              placeholder="eid / account / customer / address / route"
            />
          </label>

          <div className="field">
            <div className="field-label">Counts</div>
            <div className="muted">
              Showing {filtered.length} of {meters.length}
            </div>
          </div>

          <div className="field">
            <div className="field-label">Actions</div>
            <button
              className="btn"
              onClick={() => window.location.reload()}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <LoadingBlock title="Loading assignments..." /> : null}

      {!loading && payload ? (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Meter</th>
                  <th>Electronic ID</th>
                  <th>Account #</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Route</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const mid = getEntityId(m) || String(idx);
                  return (
                    <tr key={mid}>
                      <td>
                        <Link to={`/meters/${encodeURIComponent(mid)}`}>
                          {mid}
                        </Link>
                        <div className="muted">
                          <Link
                            to={`/meters/${encodeURIComponent(mid)}/updates`}
                          >
                            updates
                          </Link>
                        </div>
                      </td>
                      <td>{m?.electronicId ?? ""}</td>
                      <td>{m?.accountNumber ?? ""}</td>
                      <td>{m?.customerName ?? ""}</td>
                      <td>{m?.address ?? ""}</td>
                      <td>{m?.route ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="muted" style={{ marginTop: 10 }}>
            {payload?.count ?? meters.length} meter(s) returned.
          </div>
        </div>
      ) : null}
    </div>
  );
}
