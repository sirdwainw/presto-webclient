import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createMeterUpdateApi, listMeterUpdatesApi } from "../api/meters.api";
import { deleteUpdateApi } from "../api/updates.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { SuccessBanner } from "../components/SuccessBanner";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

function getCreatedById(update) {
  if (!update || typeof update !== "object") return "";
  if (typeof update.createdByUserId === "string") return update.createdByUserId;
  if (typeof update.createdBy === "string") return update.createdBy;
  return getEntityId(update.createdBy) || "";
}

export function MeterUpdatesPage() {
  const { id: meterId } = useParams();
  const { user } = useAuth();
  const role = user?.role;
  const myUserId = getEntityId(user) || "";
  const nav = useNavigate();

  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState(null);
  const [updatesPayload, setUpdatesPayload] = useState(null);

  const updates = useMemo(
    () => updatesPayload?.updates || [],
    [updatesPayload],
  );

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [meterSize, setMeterSize] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [deleteBusyId, setDeleteBusyId] = useState("");
  const [deleteError, setDeleteError] = useState(null);

  async function loadUpdates() {
    setLoadingList(true);
    setListError(null);
    try {
      const data = await listMeterUpdatesApi(meterId);
      setUpdatesPayload(data);
    } catch (e) {
      if (
        e?.status === 400 &&
        e?.error === "No company scope selected" &&
        role === "superadmin"
      ) {
        nav("/superadmin/context");
        return;
      }
      setListError(e);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meterId]);

  async function onSubmit(e) {
    e.preventDefault();
    setJustSubmitted(false);
    setSubmitError(null);
    setDeleteError(null);
    setSuccess("");
    setSubmitting(true);

    try {
      const body = { latitude: Number(latitude), longitude: Number(longitude) };
      if (meterSize) body.meterSize = meterSize;
      if (locationNotes) body.locationNotes = locationNotes;
      if (photoUrl) body.photoUrl = photoUrl;

      await createMeterUpdateApi(meterId, body);
      setSuccess("Update submitted.");
      setJustSubmitted(true);

      setLatitude("");
      setLongitude("");
      setMeterSize("");
      setLocationNotes("");
      setPhotoUrl("");

      await loadUpdates();
    } catch (e2) {
      if (
        e2?.status === 400 &&
        e2?.error === "No company scope selected" &&
        role === "superadmin"
      ) {
        nav("/superadmin/context");
        return;
      }
      setSubmitError(e2);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(updateObj) {
    const id = getEntityId(updateObj);
    if (!id) return;

    setDeleteError(null);
    setSuccess("");
    setDeleteBusyId(id);

    try {
      await deleteUpdateApi(id);
      setSuccess(`Update ${id} deleted.`);
      await loadUpdates();
    } catch (e) {
      setDeleteError(e);
    } finally {
      setDeleteBusyId("");
    }
  }

  function canDelete(updateObj) {
    const id = getEntityId(updateObj);
    if (!id) return false;

    const status =
      typeof updateObj?.status === "string" ? updateObj.status : "";
    if (role === "admin" || role === "superadmin") return true;

    if (role === "tech") {
      const createdBy = getCreatedById(updateObj);
      const isOwner = myUserId && createdBy && myUserId === createdBy;
      const isSubmitted = status === "submitted";
      return Boolean(isOwner && isSubmitted);
    }

    return false;
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Meter Updates</div>
            <div className="muted">
              Uses <code>GET /api/meters/:meterId/updates</code> and{" "}
              <code>POST /api/meters/:meterId/updates</code>
            </div>
          </div>
          <div className="row">
            <Link className="btn" to={`/meters/${encodeURIComponent(meterId)}`}>
              Meter
            </Link>
            <Link className="btn" to="/meters">
              Meters
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h2">Create Update</div>
        <p className="muted">
          Required: <code>latitude</code>, <code>longitude</code>. Optional:{" "}
          <code>meterSize</code>, <code>locationNotes</code>,{" "}
          <code>photoUrl</code>.
        </p>

        <SuccessBanner message={success} onDismiss={() => setSuccess("")} />

        {role === "tech" && justSubmitted ? (
          <div className="row" style={{ marginTop: 8 }}>
            <Link
              className="btn btn-primary"
              to="/tech/updates?status=submitted"
            >
              View my updates
            </Link>
          </div>
        ) : null}

        <ErrorBanner
          error={submitError}
          onDismiss={() => setSubmitError(null)}
        />
        <ErrorBanner
          error={deleteError}
          onDismiss={() => setDeleteError(null)}
        />

        <form onSubmit={onSubmit} className="grid grid-2">
          <label className="field">
            <div className="field-label">Latitude (number)</div>
            <input
              className="input"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <label className="field">
            <div className="field-label">Longitude (number)</div>
            <input
              className="input"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <label className="field">
            <div className="field-label">Meter Size (optional)</div>
            <input
              className="input"
              value={meterSize}
              onChange={(e) => setMeterSize(e.target.value)}
              disabled={submitting}
            />
          </label>

          <label className="field">
            <div className="field-label">Photo URL (optional)</div>
            <input
              className="input"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              disabled={submitting}
            />
          </label>

          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field-label">Location Notes (optional)</div>
            <textarea
              className="input"
              rows={3}
              value={locationNotes}
              onChange={(e) => setLocationNotes(e.target.value)}
              disabled={submitting}
            />
          </label>

          <div className="row" style={{ gridColumn: "1 / -1" }}>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Update"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h2">Updates List</div>
            <div className="muted">Click an update to view details.</div>
          </div>
          <button className="btn" onClick={loadUpdates} disabled={loadingList}>
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingList ? <LoadingBlock title="Loading updates..." /> : null}
        <ErrorBanner error={listError} onDismiss={() => setListError(null)} />

        {!loadingList && updates.length ? (
          <div className="stack" style={{ marginTop: 12 }}>
            {updates.map((u, idx) => {
              const id = getEntityId(u);
              const busy = id && deleteBusyId === id;
              const status =
                typeof u?.status === "string" ? u.status : "(unknown)";

              return (
                <div className="card card-subtle" key={id || idx}>
                  <div className="row space-between">
                    <div>
                      <div className="h3">
                        {id ? (
                          <Link to={`/updates/${encodeURIComponent(id)}`}>
                            Update <code>{id}</code>
                          </Link>
                        ) : (
                          <span>
                            Update <span className="muted">(no id field)</span>
                          </span>
                        )}
                      </div>
                      <div className="muted">Status: {status}</div>
                    </div>

                    <div className="row">
                      {id ? (
                        <Link
                          className="btn"
                          to={`/updates/${encodeURIComponent(id)}`}
                        >
                          Details
                        </Link>
                      ) : null}

                      <button
                        className="btn btn-danger"
                        disabled={!id || busy || !canDelete(u)}
                        onClick={() => onDelete(u)}
                        title={
                          canDelete(u)
                            ? "Delete update"
                            : "Delete allowed only for admin/superadmin, or tech-owned submitted updates"
                        }
                      >
                        {busy ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  <details style={{ marginTop: 10 }}>
                    <summary className="muted">Show raw JSON</summary>
                    <JsonView data={u} />
                  </details>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
