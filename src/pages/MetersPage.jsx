import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listMetersApi } from "../api/meters.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { Pagination } from "../components/Pagination";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

const MISSING_OPTIONS = ["latlng", "notes", "photo", "meterSize", "any"];

function windowMs(val) {
  switch (val) {
    case "1h":
      return 1 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 0; // off
  }
}

export function MetersPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [missing, setMissing] = useState("");

  const [highlightWindow, setHighlightWindow] = useState("24h");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const meters = useMemo(() => payload?.meters || [], [payload]);

  function isRecentApproved(meter) {
    const ms = windowMs(highlightWindow);
    if (!ms) return false;

    const t = meter?.lastApprovedUpdateAt
      ? new Date(meter.lastApprovedUpdateAt).getTime()
      : 0;

    if (!t || Number.isNaN(t)) return false;
    return Date.now() - t <= ms;
  }

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
              Uses <code>GET /api/meters</code>. Rows highlight based on{" "}
              <code>meter.lastApprovedUpdateAt</code>.
            </div>
          </div>
        </div>

        <div className="grid grid-5">
          <label className="field">
            <div className="field-label">Search (q)</div>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={loading}
            />
            <div className="field-hint">
              electronicId/accountNumber/serial/customer/address/route
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
            <div className="field-hint">Filter “missing data”</div>
          </label>

          <label className="field">
            <div className="field-label">Highlight recently approved</div>
            <select
              className="input"
              value={highlightWindow}
              onChange={(e) => setHighlightWindow(e.target.value)}
              disabled={loading}
            >
              <option value="off">off</option>
              <option value="1h">last 1 hour</option>
              <option value="24h">last 24 hours</option>
              <option value="7d">last 7 days</option>
              <option value="30d">last 30 days</option>
            </select>
            <div className="field-hint">Uses lastApprovedUpdateAt</div>
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
                  const mid = getEntityId(m);

                  return (
                    <tr
                      key={id}
                      className={isRecentApproved(m) ? "row-recent" : ""}
                    >
                      <td>
                        {mid ? (
                          <Link to={`/meters/${encodeURIComponent(mid)}`}>
                            {mid}
                          </Link>
                        ) : (
                          <span className="muted">(no id field)</span>
                        )}

                        {mid ? (
                          <div className="muted">
                            <Link
                              to={`/meters/${encodeURIComponent(mid)}/updates`}
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
