import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listReviewUpdatesApi, reviewUpdateApi } from "../api/review.api";
import { deleteUpdateApi } from "../api/updates.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { Pagination } from "../components/Pagination";
import { SuccessBanner } from "../components/SuccessBanner";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";
import { MeterLabel } from "../components/MeterLabel";

function fmt(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

function getMeterIdFromUpdate(u) {
  // Prefer populated meter object
  const midFromMeter = getEntityId(u?.meter);
  if (midFromMeter) return midFromMeter;

  // Fallback to meterId field
  if (typeof u?.meterId === "string") return u.meterId;
  return getEntityId(u?.meterId) || "";
}

function createdByLabel(u) {
  // If backend enriched createdBy
  const cb = u?.createdBy;
  if (cb?.name && cb?.email) return `${cb.name} (${cb.email})`;
  if (cb?.name) return cb.name;
  if (cb?.email) return cb.email;

  // Fallbacks
  if (typeof u?.createdByUserId === "string") return u.createdByUserId;
  const id = getEntityId(u?.createdByUserId);
  return id || "(unknown)";
}

export function ReviewUpdatesPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [status, setStatus] = useState("submitted");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const updates = useMemo(() => payload?.updates || [], [payload]);

  const [actionLoadingId, setActionLoadingId] = useState("");
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listReviewUpdatesApi({ status, page, limit });
      setPayload(data);
    } catch (e) {
      // ✅ handle the “No company scope selected...” wording reliably
      if (
        e?.status === 400 &&
        typeof e?.error === "string" &&
        e.error.startsWith("No company scope selected") &&
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, limit]);

  async function doReview(updateObj, nextStatus) {
    setActionError(null);
    setSuccess("");
    const id = getEntityId(updateObj);

    if (!id) {
      setActionError({
        error:
          "Cannot find update id field in this update object. No action taken.",
      });
      return;
    }

    setActionLoadingId(id);
    try {
      await reviewUpdateApi(id, { status: nextStatus });
      setSuccess(`Update marked ${nextStatus}.`);
      await load();
    } catch (e) {
      if (
        e?.status === 400 &&
        typeof e?.error === "string" &&
        e.error.startsWith("No company scope selected") &&
        role === "superadmin"
      ) {
        nav("/superadmin/context");
        return;
      }
      setActionError(e);
    } finally {
      setActionLoadingId("");
    }
  }

  async function doDelete(updateObj) {
    setActionError(null);
    setSuccess("");
    const id = getEntityId(updateObj);

    if (!id) {
      setActionError({
        error: "Cannot find update id field in this update object.",
      });
      return;
    }

    setActionLoadingId(id);
    try {
      await deleteUpdateApi(id);
      setSuccess("Update deleted.");
      await load();
    } catch (e) {
      setActionError(e);
    } finally {
      setActionLoadingId("");
    }
  }

  const canDelete = role === "admin" || role === "superadmin";

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">Review Queue</div>
        <div className="muted">
          Admin workflow: review submissions, approve/reject, drill into meters.
        </div>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Status</div>
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              disabled={loading}
            >
              <option value="submitted">submitted</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
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
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              disabled={loading}
            />
          </label>

          <div className="field">
            <div className="field-label">Actions</div>
            <button className="btn" onClick={() => load()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={success} onDismiss={() => setSuccess("")} />
      <ErrorBanner error={actionError} onDismiss={() => setActionError(null)} />

      {loading ? <LoadingBlock title="Loading review updates..." /> : null}

      {!loading && payload ? (
        <div className="card">
          <Pagination
            page={payload.page || page}
            limit={payload.limit || limit}
            count={payload.count || 0}
            onPageChange={setPage}
          />

          <div className="h2">Updates</div>
          <div className="stack" style={{ marginTop: 12 }}>
            {updates.map((u, idx) => {
              const updateId = getEntityId(u);
              const busy = updateId && actionLoadingId === updateId;

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

                      <div className="muted" style={{ marginTop: 8 }}>
                        Submitted by: <strong>{createdByLabel(u)}</strong>
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
                      <button
                        className="btn btn-primary"
                        disabled={!updateId || busy}
                        onClick={() => doReview(u, "approved")}
                      >
                        {busy ? "Working..." : "Approve"}
                      </button>

                      <button
                        className="btn"
                        disabled={!updateId || busy}
                        onClick={() => doReview(u, "rejected")}
                      >
                        {busy ? "Working..." : "Reject"}
                      </button>

                      <button
                        className="btn btn-danger"
                        disabled={!updateId || busy || !canDelete}
                        onClick={() => doDelete(u)}
                        title={canDelete ? "Delete update" : "Admins only"}
                      >
                        {busy ? "Working..." : "Delete"}
                      </button>

                      {updateId ? (
                        <Link
                          className="btn"
                          to={`/updates/${encodeURIComponent(updateId)}`}
                        >
                          Details
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {/* ✅ Debug info stays available but not in the user’s face */}
                  <details style={{ marginTop: 12 }}>
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
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
