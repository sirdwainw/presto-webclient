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
import { StatusBadge } from "../components/StatusBadge";

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

function createdByLabel(u) {
  const cb = u?.createdBy;
  if (cb?.name && cb?.email) return `${cb.name} (${cb.email})`;
  if (cb?.name) return cb.name;
  if (cb?.email) return cb.email;

  if (typeof u?.createdByUserId === "string") return u.createdByUserId;
  const id = getEntityId(u?.createdByUserId);
  return id || "(unknown)";
}

function prettyFields(fieldsChanged) {
  const list = Array.isArray(fieldsChanged)
    ? fieldsChanged.filter(Boolean)
    : [];

  if (!list.length) return "";

  const map = {
    latlng: "GPS",
    locationNotes: "Notes",
    meterSize: "Meter Size",
    photoUrl: "Photo",
  };

  return list.map((x) => map[x] || x).join(", ");
}

function isGpsCaptured(u) {
  return (
    u?.gpsCaptured === true ||
    (typeof u?.latitude === "number" && typeof u?.longitude === "number")
  );
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
      if (
        e?.status === 400 &&
        typeof e?.error === "string" &&
        e.error.startsWith("No company scope selected") &&
        role === "superadmin"
      ) {
        nav("/settings");
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
        nav("/settings");
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
          Review submissions, approve or reject them, and drill into the related
          meter.
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
            <button className="btn" onClick={load} disabled={loading}>
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

              const currentStatus = String(u?.status || "update");
              const createdAt = fmt(u?.createdAt);
              const submittedBy = createdByLabel(u);
              const fields = prettyFields(u?.fieldsChanged);
              const gpsCaptured = isGpsCaptured(u);
              const meterSize = String(u?.meterSize || "").trim();
              const notes = String(u?.locationNotes || "").trim();
              const photoUrl = String(u?.photoUrl || "").trim();
              const reviewNotes = String(u?.reviewNotes || "").trim();

              return (
                <div className="card card-subtle" key={updateId || idx}>
                  <div
                    className="row space-between"
                    style={{ alignItems: "flex-start" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="row"
                        style={{
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <StatusBadge status={currentStatus} />

                        <span className="muted">{createdAt}</span>
                      </div>

                      <div style={{ marginTop: 10 }}>
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

                      <div className="muted" style={{ marginTop: 10 }}>
                        <strong>Submitted by:</strong> {submittedBy}
                      </div>

                      <div
                        className="grid grid-2"
                        style={{ marginTop: 12, gap: 12 }}
                      >
                        <div className="muted">
                          <strong>Changed:</strong> {fields || "—"}
                        </div>

                        <div className="muted">
                          <strong>GPS:</strong>{" "}
                          {gpsCaptured ? "Captured" : "No GPS"}
                        </div>

                        <div className="muted">
                          <strong>Meter Size:</strong> {meterSize || "—"}
                        </div>

                        <div className="muted">
                          <strong>Photo:</strong>{" "}
                          {photoUrl ? "Attached" : "None"}
                        </div>
                      </div>

                      {notes ? (
                        <div className="muted" style={{ marginTop: 10 }}>
                          <strong>Notes:</strong> {notes}
                        </div>
                      ) : null}

                      {reviewNotes ? (
                        <div className="muted" style={{ marginTop: 10 }}>
                          <strong>Reviewer note:</strong> {reviewNotes}
                        </div>
                      ) : null}
                    </div>

                    <div
                      className="row"
                      style={{ alignItems: "flex-start", gap: 8 }}
                    >
                      {currentStatus !== "approved" ? (
                        <button
                          className="btn btn-primary"
                          disabled={!updateId || busy}
                          onClick={() => doReview(u, "approved")}
                        >
                          {busy ? "Working..." : "Approve"}
                        </button>
                      ) : null}

                      {currentStatus !== "rejected" ? (
                        <button
                          className="btn"
                          disabled={!updateId || busy}
                          onClick={() => doReview(u, "rejected")}
                        >
                          {busy ? "Working..." : "Reject"}
                        </button>
                      ) : null}

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

                  <details style={{ marginTop: 12 }}>
                    <summary className="muted">Debug</summary>

                    <div
                      className="muted"
                      style={{ marginTop: 8, fontSize: 12 }}
                    >
                      {updateId ? (
                        <>
                          System Update ID: <code>{updateId}</code>
                        </>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <JsonView data={u} />
                    </div>
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
