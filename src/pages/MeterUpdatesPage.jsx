import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getMeterApi } from "../api/meters.api";
import { createUpdateApi } from "../api/updates.api";
import { techUpdatesApi } from "../api/tech.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { SuccessBanner } from "../components/SuccessBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

function isCompanyScopeError(e) {
  const msg = String(e?.error || e?.message || "");
  return e?.status === 400 && msg.startsWith("No company scope selected");
}

function fmtDate(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

export function MeterUpdatesPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const role = user?.role;

  const [loadingMeter, setLoadingMeter] = useState(false);
  const [meterError, setMeterError] = useState(null);
  const [meter, setMeter] = useState(null);

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [history, setHistory] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [success, setSuccess] = useState("");

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [meterSize, setMeterSize] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const meterId = getEntityId(meter) || id;

  useEffect(() => {
    async function loadMeter() {
      setLoadingMeter(true);
      setMeterError(null);
      try {
        const res = await getMeterApi(id);
        setMeter(res?.meter || null);
      } catch (e) {
        if (isCompanyScopeError(e) && role === "superadmin") {
          nav("/settings");
          return;
        }
        setMeterError(e);
      } finally {
        setLoadingMeter(false);
      }
    }
    loadMeter();
  }, [id, role, nav]);

  async function loadHistory() {
    setLoadingHistory(true);
    setHistoryError(null);

    try {
      if (role === "tech") {
        const res = await techUpdatesApi({ status: "all", limit: 200 });
        const updates = res?.updates || [];
        const filtered = updates.filter((u) => {
          const updateMeterId = String(u?.meterId || u?.meter?._id || "");
          return updateMeterId === String(meterId);
        });
        setHistory(filtered);
        return;
      }

      setHistory([]);
    } catch (e) {
      if (
        e?.status === 400 &&
        e?.error === "No company scope selected" &&
        role === "superadmin"
      ) {
        nav("/settings");
        return;
      }

      // Keep history quiet for Phase 1 instead of showing a scary error.
      setHistory([]);
      setHistoryError(null);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (!meterId) return;
    loadHistory();
  }, [meterId, role]);

  const canSubmit =
    role === "tech" || role === "admin" || role === "superadmin";

  const summaryLabel = useMemo(() => {
    if (!meter) return id;
    return meter.electronicId || meter.accountNumber || id;
  }, [meter, id]);

  async function handleUseCurrentGps() {
    setSaveError(null);
    setSuccess("");

    if (!navigator.geolocation) {
      setSaveError({ error: "Geolocation is not supported on this device." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
      },
      (err) => {
        setSaveError({
          error: err?.message || "Failed to get current location.",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError(null);
    setSuccess("");

    const body = {};
    if (String(latitude).trim()) body.latitude = Number(latitude);
    if (String(longitude).trim()) body.longitude = Number(longitude);
    if (String(meterSize).trim()) body.meterSize = meterSize.trim();
    if (String(locationNotes).trim()) body.locationNotes = locationNotes.trim();
    if (String(photoUrl).trim()) body.photoUrl = photoUrl.trim();

    if (Object.keys(body).length === 0) {
      setSaveError({ error: "Enter at least one update before submitting." });
      return;
    }

    setSaving(true);
    try {
      await createUpdateApi(meterId, body);
      setSuccess("Update submitted.");
      setLatitude("");
      setLongitude("");
      setMeterSize("");
      setLocationNotes("");
      setPhotoUrl("");
      await loadHistory();
    } catch (e2) {
      setSaveError(e2);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Meter Updates</div>
            <div className="muted">
              Submit a location update or review update history for{" "}
              <strong>{summaryLabel}</strong>.
            </div>
          </div>

          <div className="row">
            <Link className="btn" to={`/meters/${encodeURIComponent(meterId)}`}>
              Back to Meter
            </Link>
          </div>
        </div>
      </div>

      <ErrorBanner error={meterError} onDismiss={() => setMeterError(null)} />
      {loadingMeter ? <LoadingBlock title="Loading meter..." /> : null}

      {!loadingMeter && meter ? (
        <div className="grid grid-2">
          <div className="card">
            <div className="h2">Meter Snapshot</div>
            <div className="stack" style={{ marginTop: 12 }}>
              <div>
                <div className="field-label">Electronic ID</div>
                <div>{meter.electronicId || "—"}</div>
              </div>
              <div>
                <div className="field-label">Account Number</div>
                <div>{meter.accountNumber || "—"}</div>
              </div>
              <div>
                <div className="field-label">Address</div>
                <div>{meter.address || "—"}</div>
              </div>
              <div>
                <div className="field-label">Current Coordinates</div>
                <div>
                  {meter.latitude != null && meter.longitude != null
                    ? `${meter.latitude}, ${meter.longitude}`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="field-label">Current Notes</div>
                <div>{meter.locationNotes || "—"}</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="card">
            <div className="h2">Submit Update</div>
            <p className="muted" style={{ marginTop: 8 }}>
              Send only the fields that need to change. Blank fields are left
              untouched.
            </p>

            <ErrorBanner error={saveError} onDismiss={() => setSaveError(null)} />
            {success ? <SuccessBanner>{success}</SuccessBanner> : null}

            <div className="stack" style={{ marginTop: 12 }}>
              <div className="grid grid-2">
                <label className="field">
                  <div className="field-label">Latitude</div>
                  <input
                    className="input"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    disabled={!canSubmit || saving}
                  />
                </label>

                <label className="field">
                  <div className="field-label">Longitude</div>
                  <input
                    className="input"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    disabled={!canSubmit || saving}
                  />
                </label>
              </div>

              <div className="row">
                <button
                  className="btn"
                  type="button"
                  onClick={handleUseCurrentGps}
                  disabled={!canSubmit || saving}
                >
                  Use Current GPS
                </button>
              </div>

              <label className="field">
                <div className="field-label">Meter Size</div>
                <input
                  className="input"
                  value={meterSize}
                  onChange={(e) => setMeterSize(e.target.value)}
                  disabled={!canSubmit || saving}
                />
              </label>

              <label className="field">
                <div className="field-label">Location Notes</div>
                <textarea
                  className="input"
                  rows={4}
                  value={locationNotes}
                  onChange={(e) => setLocationNotes(e.target.value)}
                  disabled={!canSubmit || saving}
                />
              </label>

              <label className="field">
                <div className="field-label">Photo URL</div>
                <input
                  className="input"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  disabled={!canSubmit || saving}
                />
              </label>

              {canSubmit ? (
                <div className="row">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "Submitting..." : "Submit Update"}
                  </button>
                </div>
              ) : (
                <div className="muted">
                  You can view history but cannot submit updates.
                </div>
              )}
            </div>
          </form>
        </div>
      ) : null}

      <div className="card">
        <div className="h2">Update History</div>

        {loadingHistory ? <LoadingBlock title="Loading update history..." /> : null}

        {!loadingHistory && !history.length ? (
          <div className="muted">No updates found for this meter yet.</div>
        ) : null}

        {!loadingHistory && history.length ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Meter Size</th>
                  <th>Notes</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {history.map((u) => {
                  const updateId = getEntityId(u);
                  return (
                    <tr key={updateId || `${u.createdAt}-${u.status}`}>
                      <td>{fmtDate(u.createdAt)}</td>
                      <td>{u.status || "submitted"}</td>
                      <td>{u.latitude ?? "—"}</td>
                      <td>{u.longitude ?? "—"}</td>
                      <td>{u.meterSize || "—"}</td>
                      <td className="cell-wrap">{u.locationNotes || "—"}</td>
                      <td>
                        {updateId ? (
                          <Link
                            className="btn"
                            to={`/updates/${encodeURIComponent(updateId)}`}
                          >
                            Detail
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}