import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listMyTechUpdatesApi } from "../api/techUpdates.api";
import { deleteUpdateApi } from "../api/updates.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { SuccessBanner } from "../components/SuccessBanner";
import { Pagination } from "../components/Pagination";
import { JsonView } from "../components/JsonView";
import { getEntityId } from "../api/apiClient";
import { MeterLabel } from "../components/MeterLabel";

function fmt(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

function getMeterIdFromUpdate(u) {
  const midFromMeter = getEntityId(u?.meter);
  if (midFromMeter) return midFromMeter;

  if (typeof u?.meterId === "string") return u.meterId;
  return getEntityId(u?.meterId) || "";
}

export function TechUpdatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get("status") || "submitted";
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") || 50), 1),
    200,
  );

  const statusForApi = statusParam === "all" ? undefined : statusParam;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState("");

  const updates = useMemo(() => payload?.updates || [], [payload]);

  function patchParams(next) {
    const sp = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") sp.delete(k);
      else sp.set(k, String(v));
    });
    setSearchParams(sp);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listMyTechUpdatesApi({
        status: statusForApi,
        page,
        limit,
      });
      setPayload(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusParam, page, limit]);

  async function doDelete(u) {
    const id = getEntityId(u);
    if (!id) return;

    setActionError(null);
    setSuccess("");
    setBusyId(id);
    try {
      await deleteUpdateApi(id);
      setSuccess("Update deleted.");
      await load();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusyId("");
    }
  }

  function canDelete(u) {
    return String(u?.status) === "submitted";
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">My Updates</div>
            <div className="muted">
              Your submitted / approved / rejected updates.
            </div>
          </div>
          <Link className="btn" to="/dashboard">
            Dashboard
          </Link>
        </div>

        <div className="chip-row" style={{ marginTop: 12 }}>
          {[
            ["submitted", "submitted"],
            ["approved", "approved"],
            ["rejected", "rejected"],
            ["all", "all"],
          ].map(([val, label]) => (
            <button
              key={val}
              className={`chip ${statusParam === val ? "active" : ""}`}
              onClick={() => patchParams({ status: val, page: 1 })}
              disabled={loading}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Status</div>
            <select
              className="input"
              value={statusParam}
              onChange={(e) => patchParams({ status: e.target.value, page: 1 })}
              disabled={loading}
            >
              <option value="submitted">submitted</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="all">all</option>
            </select>
          </label>

          <label className="field">
            <div className="field-label">Limit</div>
            <input
              className="input"
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) =>
                patchParams({ limit: Number(e.target.value), page: 1 })
              }
              disabled={loading}
            />
          </label>

          <div className="field">
            <div className="field-label">Actions</div>
            <button className="btn" onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={success} onDismiss={() => setSuccess("")} />
      <ErrorBanner error={actionError} onDismiss={() => setActionError(null)} />

      {loading ? <LoadingBlock title="Loading your updates..." /> : null}

      {!loading && payload ? (
        <div className="card">
          <Pagination
            page={payload.page || page}
            limit={payload.limit || limit}
            count={payload.count || 0}
            onPageChange={(p) => patchParams({ page: p })}
          />

          <div className="stack" style={{ marginTop: 12 }}>
            {updates.map((u, idx) => {
              const updateId = getEntityId(u);
              const busy = updateId && busyId === updateId;

              const meterId = getMeterIdFromUpdate(u);
              const meter = u?.meter || null;

              const title = `${String(u?.status || "update")} • ${fmt(u?.createdAt)}`;

              return (
                <div className="card card-subtle" key={updateId || idx}>
                  <div className="row space-between">
                    <div>
                      <div className="h3">{title}</div>

                      <div style={{ marginTop: 8 }}>
                        <MeterLabel
                          meter={meter}
                          meterId={meterId}
                          to={
                            meterId
                              ? `/meters/${encodeURIComponent(meterId)}`
                              : undefined
                          }
                          showSystemId={false}
                        />
                      </div>

                      {updateId ? (
                        <div
                          className="muted"
                          style={{ marginTop: 6, fontSize: 12 }}
                        >
                          System Update ID: <code>{updateId}</code>
                        </div>
                      ) : null}
                    </div>

                    <div className="row" style={{ alignItems: "flex-start" }}>
                      {updateId ? (
                        <Link
                          className="btn"
                          to={`/updates/${encodeURIComponent(updateId)}`}
                        >
                          Details
                        </Link>
                      ) : null}

                      {meterId ? (
                        <Link
                          className="btn"
                          to={`/meters/${encodeURIComponent(meterId)}/updates`}
                        >
                          Meter Updates
                        </Link>
                      ) : null}

                      <button
                        className="btn btn-danger"
                        disabled={!updateId || busy || !canDelete(u)}
                        onClick={() => doDelete(u)}
                        title={
                          canDelete(u)
                            ? "Delete submitted update"
                            : "Only submitted updates can be deleted"
                        }
                      >
                        {busy ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  <details style={{ marginTop: 10 }}>
                    <summary className="muted">Show raw JSON (debug)</summary>
                    <JsonView data={u} />
                  </details>
                </div>
              );
            })}
          </div>

          <Pagination
            page={payload.page || page}
            limit={payload.limit || limit}
            count={payload.count || 0}
            onPageChange={(p) => patchParams({ page: p })}
          />
        </div>
      ) : null}
    </div>
  );
}
