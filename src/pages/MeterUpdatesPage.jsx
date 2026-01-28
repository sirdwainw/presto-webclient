import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createMeterUpdateApi, listMeterUpdatesApi } from "../api/meters.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { SuccessBanner } from "../components/SuccessBanner";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";

export function MeterUpdatesPage() {
  const { id: meterId } = useParams();
  const { user } = useAuth();
  const role = user?.role;
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

  async function loadUpdates() {
    setLoadingList(true);
    setListError(null);
    try {
      const data = await listMeterUpdatesApi(meterId); // { meterId, updates: [...] }
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
    setSubmitError(null);
    setSuccess("");
    setSubmitting(true);
    try {
      const body = {
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
      if (meterSize) body.meterSize = meterSize;
      if (locationNotes) body.locationNotes = locationNotes;
      if (photoUrl) body.photoUrl = photoUrl;

      const result = await createMeterUpdateApi(meterId, body); // { update }
      setSuccess("Update submitted.");
      // Clear form
      setLatitude("");
      setLongitude("");
      setMeterSize("");
      setLocationNotes("");
      setPhotoUrl("");
      // Refresh list
      await loadUpdates();
      // Optionally show returned update
      // result.update is not assumed; we show raw
      console.log("create update result", result);
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
        <ErrorBanner
          error={submitError}
          onDismiss={() => setSubmitError(null)}
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
            <div className="muted">
              Raw list returned by backend (no assumed fields).
            </div>
          </div>
          <button className="btn" onClick={loadUpdates} disabled={loadingList}>
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <ErrorBanner error={listError} onDismiss={() => setListError(null)} />
        {loadingList ? <LoadingBlock title="Loading updates..." /> : null}
        {!loadingList && updatesPayload ? (
          <JsonView data={updatesPayload} />
        ) : null}
      </div>

      {!loadingList && updates.length ? (
        <div className="card">
          <div className="h2">Updates (count)</div>
          <div className="muted">{updates.length} update(s) in payload.</div>
        </div>
      ) : null}
    </div>
  );
}
