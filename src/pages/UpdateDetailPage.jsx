import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUpdateApi, deleteUpdateApi } from "../api/updates.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { SuccessBanner } from "../components/SuccessBanner";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";
import { MeterLabel } from "../components/MeterLabel";

function fmt(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

function safe(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function createdByDisplay(update) {
  // If backend enriched createdBy
  const cb = update?.createdBy;
  if (cb?.name && cb?.email) return `${cb.name} (${cb.email})`;
  if (cb?.name) return cb.name;
  if (cb?.email) return cb.email;

  // Fallback
  if (typeof update?.createdByUserId === "string")
    return update.createdByUserId;
  return getEntityId(update?.createdByUserId) || "(unknown)";
}

function getMeterIdFromUpdate(update) {
  // Prefer populated meter object
  const midFromMeter = getEntityId(update?.meter);
  if (midFromMeter) return midFromMeter;

  // Fallback to meterId field
  if (typeof update?.meterId === "string") return update.meterId;
  return getEntityId(update?.meterId) || "";
}

export function UpdateDetailPage() {
  const { id } = useParams(); // update id
  const nav = useNavigate();
  const { user } = useAuth();
  const role = user?.role;

  const isSuperadmin = role === "superadmin";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [success, setSuccess] = useState("");

  const update = useMemo(() => payload?.update || null, [payload]);
  const updateId = useMemo(() => getEntityId(update) || id, [update, id]);

  const meterId = useMemo(() => getMeterIdFromUpdate(update), [update]);
  const meter = useMemo(() => update?.meter || null, [update]);

  const status = useMemo(() => {
    const s = update?.status;
    return typeof s === "string" ? s : "(unknown)";
  }, [update]);

  const canDelete = useMemo(() => {
    if (!update) return false;

    // Admin/superadmin can delete any update
    if (role === "admin" || role === "superadmin") return true;

    // Tech can delete only submitted updates (as before)
    if (role === "tech") return status === "submitted";
    return false;
  }, [role, status, update]);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess("");
    try {
      const data = await getUpdateApi(id);
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
  }, [id]);

  async function onDelete() {
    setDeleteError(null);
    setSuccess("");
    setDeleting(true);
    try {
      await deleteUpdateApi(updateId);
      setSuccess("Update deleted.");

      // Navigate somewhere sensible after delete
      if (role === "admin" || role === "superadmin") nav("/review/updates");
      else if (meterId) nav(`/meters/${encodeURIComponent(meterId)}/updates`);
      else nav("/dashboard");
    } catch (e) {
      setDeleteError(e);
    } finally {
      setDeleting(false);
    }
  }

  // Internal fields shown ONLY to superadmin
  const internalFields = useMemo(() => {
    if (!update) return [];

    return [
      { label: "System Update ID", value: safe(updateId) },
      { label: "Company ID", value: safe(update?.companyId) },
      {
        label: "Meter ID",
        value: safe(getEntityId(update?.meter) || update?.meterId),
      },
      { label: "Created By (raw)", value: safe(update?.createdByUserId) },
    ].filter((f) => f.value !== "");
  }, [update, updateId]);

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Update Details</div>
            <div className="muted">
              Clean summary. Internal fields only appear for superadmin.
            </div>
          </div>

          <div className="row">
            <button className="btn" onClick={() => nav(-1)}>
              Back
            </button>

            {meterId ? (
              <Link
                className="btn"
                to={`/meters/${encodeURIComponent(meterId)}`}
              >
                Meter
              </Link>
            ) : null}

            {meterId ? (
              <Link
                className="btn"
                to={`/meters/${encodeURIComponent(meterId)}/updates`}
              >
                Updates / History
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={success} onDismiss={() => setSuccess("")} />
      <ErrorBanner error={deleteError} onDismiss={() => setDeleteError(null)} />

      {loading ? <LoadingBlock title="Loading update..." /> : null}

      {!loading && update ? (
        <>
          <div className="card">
            <div className="h2">Summary</div>

            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <div>
                <div className="muted">Status</div>
                <div>{status}</div>
              </div>

              <div>
                <div className="muted">Created At</div>
                <div>{fmt(update?.createdAt)}</div>
              </div>

              <div>
                <div className="muted">Submitted By</div>
                <div>{createdByDisplay(update)}</div>
              </div>

              <div>
                <div className="muted">Meter</div>
                {meterId || meter ? (
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
                ) : (
                  <span className="muted">(none)</span>
                )}
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={load} disabled={loading}>
                Refresh
              </button>

              <button
                className="btn btn-danger"
                onClick={onDelete}
                disabled={!canDelete || deleting}
                title={canDelete ? "Delete this update" : "Not allowed"}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>

          {isSuperadmin && internalFields.length ? (
            <details className="card">
              <summary className="h2" style={{ cursor: "pointer" }}>
                Debug (internal IDs)
              </summary>
              <div className="muted" style={{ marginTop: 6 }}>
                Collapsed by default to keep the page customer-facing.
              </div>

              <div className="grid grid-3" style={{ marginTop: 12 }}>
                {internalFields.map((f) => (
                  <div key={f.label}>
                    <div className="muted">{f.label}</div>
                    <div className="mono">{f.value}</div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
