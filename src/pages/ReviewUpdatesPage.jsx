import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { reviewQueueApi, reviewUpdateApi } from "../api/review.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { SuccessBanner } from "../components/SuccessBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { getEntityId } from "../api/apiClient";
import { useAuth } from "../auth/AuthContext";

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

export function ReviewUpdatesPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [workingId, setWorkingId] = useState("");
  const [success, setSuccess] = useState("");

  const [updates, setUpdates] = useState([]);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const res = await reviewQueueApi();
      setUpdates(res?.updates || []);
    } catch (e) {
      if (isCompanyScopeError(e) && role === "superadmin") {
        nav("/settings");
        return;
      }
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  const pendingCount = useMemo(
    () => updates.filter((u) => (u.status || "submitted") === "submitted").length,
    [updates]
  );

  async function handleDecision(updateId, status) {
    setSuccess("");
    setError(null);
    setWorkingId(updateId);

    try {
      await reviewUpdateApi(updateId, status);
      setSuccess(
        status === "approved" ? "Update approved." : "Update rejected."
      );
      await loadQueue();
    } catch (e) {
      setError(e);
    } finally {
      setWorkingId("");
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Review Queue</div>
            <div className="muted">
              Review submitted updates and approve or reject them.
            </div>
          </div>

          <div className="card card-subtle" style={{ padding: 12 }}>
            <div className="field-label">Pending</div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{pendingCount}</div>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {success ? <SuccessBanner>{success}</SuccessBanner> : null}
      {loading ? <LoadingBlock title="Loading review queue..." /> : null}

      {!loading && !updates.length ? (
        <div className="card">
          <div className="muted">No updates are waiting for review right now.</div>
        </div>
      ) : null}

      {!loading && updates.length ? (
        <div className="stack">
          {updates.map((u) => {
            const updateId = getEntityId(u);
            const meterId = u.meterId || u?.meter?._id;
            const label =
              u?.meter?.electronicId ||
              u?.meter?.accountNumber ||
              meterId ||
              "Meter";

            return (
              <div key={updateId} className="card">
                <div className="row space-between">
                  <div>
                    <div className="h2">{label}</div>
                    <div className="muted">
                      Submitted {fmtDate(u.createdAt)} • Status {u.status || "submitted"}
                    </div>
                  </div>

                  <div className="row">
                    {meterId ? (
                      <Link className="btn" to={`/meters/${encodeURIComponent(meterId)}`}>
                        Meter
                      </Link>
                    ) : null}
                    {updateId ? (
                      <Link className="btn" to={`/updates/${encodeURIComponent(updateId)}`}>
                        Detail
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

                <div className="row" style={{ marginTop: 12 }}>
                  <button
                    className="btn btn-primary"
                    disabled={!updateId || workingId === updateId}
                    onClick={() => handleDecision(updateId, "approved")}
                  >
                    {workingId === updateId ? "Working..." : "Approve"}
                  </button>

                  <button
                    className="btn btn-danger"
                    disabled={!updateId || workingId === updateId}
                    onClick={() => handleDecision(updateId, "rejected")}
                  >
                    {workingId === updateId ? "Working..." : "Reject"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}