import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  createMeterUpdateApi,
  getMeterApi,
  listMeterUpdatesApi,
} from "../api/meters.api";
import { deleteUpdateApi } from "../api/updates.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { SuccessBanner } from "../components/SuccessBanner";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";
import { MapPickerModal } from "../components/MapPickerModal";

function getCreatedById(update) {
  if (!update || typeof update !== "object") return "";
  // If backend now returns createdByUserId as populated object, support it:
  if (update.createdByUserId && typeof update.createdByUserId === "object") {
    return getEntityId(update.createdByUserId) || "";
  }
  if (typeof update.createdByUserId === "string") return update.createdByUserId;
  if (typeof update.createdBy === "string") return update.createdBy;
  return getEntityId(update.createdBy) || "";
}

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
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

function fmtSubmittedBy(u) {
  const name = u?.createdBy?.name ? String(u.createdBy.name) : "";
  const email = u?.createdBy?.email ? String(u.createdBy.email) : "";
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return "—";
}
function buildMapUrl(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  // Google Maps works great everywhere
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function MeterUpdatesPage() {
  const { id: meterId } = useParams();
  const { user } = useAuth();
  const role = user?.role;
  const isSuperadmin = role === "superadmin";
  const myUserId = getEntityId(user) || "";
  const nav = useNavigate();

  const location = useLocation();
  const debug =
    isSuperadmin && new URLSearchParams(location.search).get("debug") === "1";

  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState(null);
  const [updatesPayload, setUpdatesPayload] = useState(null);

  const updates = useMemo(
    () => updatesPayload?.updates || [],
    [updatesPayload],
  );

  const [meter, setMeter] = useState(null);
  const [meterLoading, setMeterLoading] = useState(false);
  const [meterError, setMeterError] = useState(null);
  const [company, setCompany] = useState(null);

  async function loadMeter() {
    setMeterLoading(true);
    setMeterError(null);
    try {
      const data = await getMeterApi(meterId);
      setMeter(data?.meter || null);
      setCompany(data?.company || null);
    } catch (e) {
      if (
        e?.status === 400 &&
        e?.error === "No company scope selected" &&
        role === "superadmin"
      ) {
        nav("/superadmin/context");
        return;
      }
      setMeterError(e);
    } finally {
      setMeterLoading(false);
    }
  }

  useEffect(() => {
    loadMeter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meterId]);

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [meterSize, setMeterSize] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [gpsBusy, setGpsBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  async function captureGps() {
    setSubmitError(null);
    setSuccess("");

    if (!("geolocation" in navigator)) {
      setSubmitError({
        error: "Geolocation is not available in this browser.",
      });
      return;
    }

    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos?.coords?.latitude;
        const lng = pos?.coords?.longitude;
        if (typeof lat === "number" && typeof lng === "number") {
          setLatitude(String(lat));
          setLongitude(String(lng));
          setSuccess("GPS captured.");
        } else {
          setSubmitError({ error: "Could not read GPS coordinates." });
        }
        setGpsBusy(false);
      },
      (err) => {
        setSubmitError({ error: err?.message || "GPS permission denied." });
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

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
      const body = {};

      const lat = latitude.trim();
      const lng = longitude.trim();
      if (lat || lng) {
        if (!lat || !lng) {
          throw {
            status: 400,
            error: "Provide both latitude and longitude, or clear both.",
          };
        }
        body.latitude = Number(lat);
        body.longitude = Number(lng);
      }

      if (meterSize.trim()) body.meterSize = meterSize;
      if (locationNotes.trim()) body.locationNotes = locationNotes;
      if (photoUrl.trim()) body.photoUrl = photoUrl;

      if (Object.keys(body).length === 0) {
        throw {
          status: 400,
          error:
            "Enter at least one update (GPS, notes, meter size, or photo URL).",
        };
      }

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
      setSuccess("Update deleted.");
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
      <MapPickerModal
        isOpen={mapOpen}
        title="Pick on Map (OpenStreetMap)"
        addressQuery={meter?.address || ""}
        contextCity={company?.city || ""}
        contextState={company?.state || ""}
        contextZip={company?.zip || ""}
        onClose={() => setMapOpen(false)}
        onPick={({ lat, lng }) => {
          setLatitude(String(lat));
          setLongitude(String(lng));
          setSuccess("Coordinates set from map.");
        }}
      />

      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Meter Updates</div>

            <div className="muted" style={{ marginTop: 4 }}>
              {meterLoading ? (
                "Loading meter..."
              ) : meterError ? (
                <>
                  <span className="muted">Meter load failed:</span>{" "}
                  <strong>
                    {meterError?.error || meterError?.message || "Error"}
                  </strong>
                </>
              ) : meter ? (
                <>
                  EID: <strong>{meter.electronicId || "—"}</strong>{" "}
                  <span className="muted">•</span> Address:{" "}
                  <strong>{meter.address || "—"}</strong>
                </>
              ) : (
                <>
                  Meter: <strong>Not found</strong>
                </>
              )}
            </div>
          </div>

          <div className="row">
            <Link className="btn" to={`/meters/${encodeURIComponent(meterId)}`}>
              Meter Card
            </Link>
            <Link className="btn" to="/meters">
              Meter List
            </Link>
          </div>
        </div>

        <ErrorBanner error={meterError} onDismiss={() => setMeterError(null)} />
      </div>

      <div className="card">
        <div className="h2">Create Update</div>
        <p className="muted">
          Submit any combination of <code>latitude</code>/<code>longitude</code>
          , <code>meterSize</code>, <code>locationNotes</code>,{" "}
          <code>photoUrl</code>. GPS is optional.
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
            <div className="field-label">Latitude (optional)</div>
            <input
              className="input"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              disabled={submitting || gpsBusy}
            />
          </label>

          <label className="field">
            <div className="field-label">Longitude (optional)</div>
            <input
              className="input"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              disabled={submitting || gpsBusy}
            />
          </label>

          <div className="row" style={{ gridColumn: "1 / -1" }}>
            <button
              className="btn"
              type="button"
              onClick={captureGps}
              disabled={submitting || gpsBusy}
              title="Works best on mobile; requires HTTPS in production."
            >
              {gpsBusy ? "Capturing GPS..." : "Capture GPS"}
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => setMapOpen(true)}
              disabled={submitting || gpsBusy}
              title="Search address and click the map to set lat/lng"
            >
              Pick on Map
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => {
                setLatitude("");
                setLongitude("");
              }}
              disabled={submitting || gpsBusy}
              title="Clear latitude/longitude"
            >
              Clear GPS
            </button>
          </div>

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

              const gpsCaptured =
                u?.gpsCaptured === true ||
                (typeof u?.latitude === "number" &&
                  typeof u?.longitude === "number");
              const latNum =
                typeof u?.latitude === "number" ? u.latitude : null;
              const lngNum =
                typeof u?.longitude === "number" ? u.longitude : null;
              const mapUrl =
                latNum != null && lngNum != null
                  ? buildMapUrl(latNum, lngNum)
                  : "";

              const fields = prettyFields(u?.fieldsChanged);
              const createdAt = fmtDate(u?.createdAt);
              const submittedBy = fmtSubmittedBy(u);

              return (
                <div className="card card-subtle" key={id || idx}>
                  <div className="row space-between">
                    <div>
                      <div className="h3">
                        {id ? (
                          <Link to={`/updates/${encodeURIComponent(id)}`}>
                            Update
                          </Link>
                        ) : (
                          <span>Update</span>
                        )}
                      </div>

                      <div className="muted">Status: {status}</div>

                      <div className="muted">
                        GPS captured: {gpsCaptured ? "Yes" : "No"}
                        {fields ? <> • Fields: {fields}</> : null}
                        {mapUrl ? (
                          <>
                            {" "}
                            •{" "}
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="link"
                              title="Open coordinates in Google Maps"
                            >
                              Open map
                            </a>
                          </>
                        ) : null}
                      </div>

                      <div className="muted">Submitted by: {submittedBy}</div>

                      {createdAt ? (
                        <div className="muted">Submitted: {createdAt}</div>
                      ) : null}
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

                  {/* Debug only if superadmin AND ?debug=1 */}
                  {debug ? (
                    <details style={{ marginTop: 10 }}>
                      <summary className="muted">
                        Debug JSON (superadmin)
                      </summary>
                      <JsonView data={u} />
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
