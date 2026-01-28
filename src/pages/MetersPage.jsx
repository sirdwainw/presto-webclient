import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listMetersApi } from "../api/meters.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { Pagination } from "../components/Pagination";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

const MISSING_OPTIONS = ["latlng", "notes", "photo", "meterSize", "any"];

export function MetersPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [missing, setMissing] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const meters = useMemo(() => payload?.meters || [], [payload]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listMetersApi({
          page,
          limit,
          q: q || undefined,
          missing: missing || undefined,
        });
        setPayload(data);
      } catch (e) {
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
  }, [page, limit, q, missing, role, nav]);

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Meters</div>
            <div className="muted">
              Uses <code>GET /api/meters</code> with optional <code>q</code>,{" "}
              <code>page</code>, <code>limit</code>, <code>missing</code>.
            </div>
          </div>
        </div>

        <div className="grid grid-4">
          <label className="field">
            <div className="field-label">Search (q)</div>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={loading}
            />
            <div className="field-hint">
              Search across
              electronicId/accountNumber/meterSerialNumber/customerName/address/route
            </div>
          </label>

          <label className="field">
            <div className="field-label">Limit</div>
            <input
              className="input"
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={loading}
            />
            <div className="field-hint">Default 50, max 200</div>
          </label>

          <label className="field">
            <div className="field-label">Missing (optional)</div>
            <select
              className="input"
              value={missing}
              onChange={(e) => setMissing(e.target.value)}
              disabled={loading}
            >
              <option value="">(none)</option>
              {MISSING_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="field-hint">
              Backend may omit extra fields unless requested.
            </div>
          </label>

          <div className="field">
            <div className="field-label">Actions</div>
            <button
              className="btn"
              onClick={() => setPage(1)}
              disabled={loading}
            >
              Apply (reset to page 1)
            </button>
            <div className="field-hint">Reloads list</div>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading ? <LoadingBlock title="Loading meters..." /> : null}

      {!loading && payload ? (
        <div className="card">
          <Pagination
            page={payload.page || page}
            limit={payload.limit || limit}
            count={payload.count || 0}
            onPageChange={setPage}
          />

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Electronic ID</th>
                  <th>Account #</th>
                  <th>Serial #</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Route</th>
                  <th>Lat</th>
                  <th>Lng</th>
                  <th>Meter Size</th>
                  <th># Pics</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {meters.map((m, idx) => {
                  const id = getEntityId(m) || String(idx);
                  return (
                    <tr key={id}>
                      <td>
                        {getEntityId(m) ? (
                          <Link
                            to={`/meters/${encodeURIComponent(getEntityId(m))}`}
                          >
                            {getEntityId(m)}
                          </Link>
                        ) : (
                          <span className="muted">(no id field)</span>
                        )}
                        {getEntityId(m) ? (
                          <div className="muted">
                            <Link
                              to={`/meters/${encodeURIComponent(getEntityId(m))}/updates`}
                            >
                              updates
                            </Link>
                          </div>
                        ) : null}
                      </td>
                      <td>{m?.electronicId ?? ""}</td>
                      <td>{m?.accountNumber ?? ""}</td>
                      <td>{m?.meterSerialNumber ?? ""}</td>
                      <td>{m?.customerName ?? ""}</td>
                      <td>{m?.address ?? ""}</td>
                      <td>{m?.route ?? ""}</td>
                      <td>{m?.latitude ?? ""}</td>
                      <td>{m?.longitude ?? ""}</td>
                      <td>{m?.meterSize ?? ""}</td>
                      <td>{m?.numberOfPictures ?? ""}</td>
                      <td className="cell-wrap">{m?.locationNotes ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={payload.page || page}
            limit={payload.limit || limit}
            count={payload.count || 0}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
