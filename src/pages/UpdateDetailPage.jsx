import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUpdateApi, deleteUpdateApi } from "../api/updates.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { SuccessBanner } from "../components/SuccessBanner";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

function getCreatedById(update) {
  if (!update || typeof update !== "object") return "";
  if (typeof update.createdByUserId === "string") return update.createdByUserId;
  if (typeof update.createdByUserId === "number")
    return String(update.createdByUserId);

  if (typeof update.createdBy === "string") return update.createdBy;
  const createdByObjId = getEntityId(update.createdBy);
  if (createdByObjId) return createdByObjId;

  if (typeof update.userId === "string") return update.userId;
  const userObjId = getEntityId(update.user);
  if (userObjId) return userObjId;

  return "";
}

export function UpdateDetailPage() {
  const { id } = useParams(); // updateId
  const nav = useNavigate();
  const { user } = useAuth();

  const role = user?.role;
  const myUserId = getEntityId(user) || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [success, setSuccess] = useState("");

  const update = useMemo(() => payload?.update || null, [payload]);
  const updateId = useMemo(() => getEntityId(update) || id, [update, id]);

  const meterId = useMemo(() => {
    if (!update) return "";
    if (typeof update.meterId === "string") return update.meterId;
    return getEntityId(update.meterId) || "";
  }, [update]);

  const status = useMemo(() => {
    const s = update?.status;
    return typeof s === "string" ? s : "";
  }, [update]);

  const createdById = useMemo(() => getCreatedById(update), [update]);

  const canDelete = useMemo(() => {
    if (!update) return false;

    if (role === "admin" || role === "superadmin") return true;

    if (role === "tech") {
      const isOwner = myUserId && createdById && myUserId === createdById;
      const isSubmitted = status === "submitted";
      return Boolean(isOwner && isSubmitted);
    }

    return false;
  }, [role, myUserId, createdById, status, update]);

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
      // Go somewhere sensible
      if (role === "admin" || role === "superadmin") nav("/review/updates");
      else if (meterId) nav(`/meters/${encodeURIComponent(meterId)}/updates`);
      else nav("/dashboard");
    } catch (e) {
      setDeleteError(e);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Update Details</div>
            <div className="muted">
              Uses <code>GET /api/updates/:id</code> and{" "}
              <code>DELETE /api/updates/:id</code>
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => nav(-1)}>
              Back
            </button>
            {meterId ? (
              <Link
                className="btn"
                to={`/meters/${encodeURIComponent(meterId)}/updates`}
              >
                Meter Updates
              </Link>
            ) : null}
            <Link className="btn" to="/dashboard">
              Dashboard
            </Link>
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
            <div className="grid grid-2">
              <div>
                <div className="muted">Update ID</div>
                <code>{updateId}</code>
              </div>
              <div>
                <div className="muted">Status</div>
                <div>{status || "(unknown)"}</div>
              </div>
              <div>
                <div className="muted">Meter</div>
                {meterId ? (
                  <code>{meterId}</code>
                ) : (
                  <span className="muted">(none)</span>
                )}
              </div>
              <div>
                <div className="muted">Created By</div>
                <div>{createdById || "(unknown)"}</div>
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
                title={
                  canDelete
                    ? "Delete this update"
                    : "Delete allowed only for admin/superadmin, or tech-owned submitted updates"
                }
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>

              {!canDelete ? (
                <span className="muted" style={{ alignSelf: "center" }}>
                  Delete rule: tech can delete only their own{" "}
                  <code>submitted</code> updates.
                </span>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="h2">Raw Update Object</div>
            <JsonView data={update} />
          </div>
        </>
      ) : null}
    </div>
  );
}
