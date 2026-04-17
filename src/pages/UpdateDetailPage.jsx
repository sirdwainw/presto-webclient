import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUpdateApi, deleteUpdateApi } from "../api/updates.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { SuccessBanner } from "../components/SuccessBanner";
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
  const cb = update?.createdBy;
  if (cb?.name && cb?.email) return `${cb.name} (${cb.email})`;
  if (cb?.name) return cb.name;
  if (cb?.email) return cb.email;

  if (typeof update?.createdByUserId === "string") {
    return update.createdByUserId;
  }

  return getEntityId(update?.createdByUserId) || "(unknown)";
}

function getMeterIdFromUpdate(update) {
  const midFromMeter = getEntityId(update?.meter);
  if (midFromMeter) return midFromMeter;

  if (typeof update?.meterId === "string") return update.meterId;
  return getEntityId(update?.meterId) || "";
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

function isGpsCaptured(update) {
  return (
    update?.gpsCaptured === true ||
    (typeof update?.latitude === "number" &&
      typeof update?.longitude === "number")
  );
}



export function UpdateDetailPage() {
  const { id } = useParams();
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

  const fieldsChanged = useMemo(
    () => prettyFields(update?.fieldsChanged),
    [update],
  );

  const gpsCaptured = useMemo(() => isGpsCaptured(update), [update]);

  const meterSize = useMemo(
    () => String(update?.meterSize || "").trim(),
    [update],
  );

  const notes = useMemo(
    () => String(update?.locationNotes || "").trim(),
    [update],
  );

  const photoUrl = useMemo(
    () => String(update?.photoUrl || "").trim(),
    [update],
  );

  const reviewNotes = useMemo(
    () => String(update?.reviewNotes || "").trim(),
    [update],
  );

  const canDelete = useMemo(() => {
    if (!update) return false;

    if (role === "admin" || role === "superadmin") return true;
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

      if (role === "admin" || role === "superadmin") {
        nav("/review/updates");
      } else if (meterId) {
        nav(`/meters/${encodeURIComponent(meterId)}/updates`);
      } else {
        nav("/dashboard");
      }
    } catch (e) {
      setDeleteError(e);
    } finally {
      setDeleting(false);
    }
  }

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
      { label: "Reviewed By (raw)", value: safe(update?.reviewedByUserId) },
    ].filter((f) => f.value !== "");
  }, [update, updateId]);

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="h1">Update Details</div>
            <div className="muted">
              Review the submitted update and its current status.
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
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
            <div
              className="row"
              style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}
            >
              <StatusBadge status={status} />

              <span className="muted">{fmt(update?.createdAt)}</span>
            </div>

            <div style={{ marginTop: 14 }}>
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

            <div className="grid grid-2" style={{ marginTop: 16, gap: 12 }}>
              <div className="muted">
                <strong>Submitted By:</strong> {createdByDisplay(update)}
              </div>

              <div className="muted">
                <strong>Changed:</strong> {fieldsChanged || "—"}
              </div>

              <div className="muted">
                <strong>GPS:</strong> {gpsCaptured ? "Captured" : "No GPS"}
              </div>

              <div className="muted">
                <strong>Meter Size:</strong> {meterSize || "—"}
              </div>

              <div className="muted">
                <strong>Photo:</strong> {photoUrl ? "Attached" : "None"}
              </div>

              <div className="muted">
                <strong>Reviewed:</strong> {fmt(update?.reviewedAt) || "—"}
              </div>
            </div>

            {notes ? (
              <div style={{ marginTop: 14 }}>
                <div className="muted">
                  <strong>Notes</strong>
                </div>
                <div style={{ marginTop: 4 }}>{notes}</div>
              </div>
            ) : null}

            {reviewNotes ? (
              <div style={{ marginTop: 14 }}>
                <div className="muted">
                  <strong>Reviewer Note</strong>
                </div>
                <div style={{ marginTop: 4 }}>{reviewNotes}</div>
              </div>
            ) : null}

            {photoUrl ? (
              <div style={{ marginTop: 14 }}>
                <div className="muted">
                  <strong>Photo URL</strong>
                </div>
                <div style={{ marginTop: 4, wordBreak: "break-all" }}>
                  <a
                    href={photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="link"
                  >
                    {photoUrl}
                  </a>
                </div>
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 16, gap: 8 }}>
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
                Collapsed by default to keep the page cleaner.
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
