import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { techUpdatesApi } from "../api/tech.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { getEntityId } from "../api/apiClient";

export function TechUpdatesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState("submitted");
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await techUpdatesApi({ status });
        setUpdates(res?.updates || []);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [status]);

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">My Updates</div>
            <div className="muted">
              Track the status of updates you have submitted.
            </div>
          </div>

          <div className="row">
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ maxWidth: 220 }}
            >
              <option value="submitted">Submitted</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <LoadingBlock title="Loading updates..." /> : null}

      {!loading && !updates.length ? (
        <div className="card">
          <div className="muted">No updates found for the selected filter.</div>
        </div>
      ) : null}

      {!loading && updates.length ? (
        <div className="stack">
          {updates.map((u) => {
            const updateId = getEntityId(u);
            const meterId = u.meterId || u?.meter?._id;
            const title =
              u?.meter?.electronicId ||
              u?.meter?.accountNumber ||
              meterId ||
              "Meter update";

            return (
              <div key={updateId || `${u.createdAt}-${u.status}`} className="card">
                <div className="row space-between">
                  <div>
                    <div className="h2">{title}</div>
                    <div className="muted">
                      Submitted {u.createdAt ? new Date(u.createdAt).toLocaleString() : "—"} •
                      Status {u.status || "submitted"}
                    </div>
                  </div>

                  <div className="row">
                    {updateId ? (
                      <Link
                        className="btn"
                        to={`/updates/${encodeURIComponent(updateId)}`}
                      >
                        Detail
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
                  </div>
                </div>

                <div className="grid grid-2" style={{ marginTop: 12 }}>
                  <div className="card card-subtle">
                    <div className="field-label">Coordinates</div>
                    <div style={{ marginTop: 8 }}>
                      {u.latitude != null && u.longitude != null
                        ? `${u.latitude}, ${u.longitude}`
                        : "—"}
                    </div>
                  </div>

                  <div className="card card-subtle">
                    <div className="field-label">Meter Size</div>
                    <div style={{ marginTop: 8 }}>{u.meterSize || "—"}</div>
                  </div>
                </div>

                <div className="card card-subtle" style={{ marginTop: 12 }}>
                  <div className="field-label">Location Notes</div>
                  <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                    {u.locationNotes || "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}