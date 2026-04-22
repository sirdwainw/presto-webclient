import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUpdateApi } from "../api/updates.api";
import { ErrorBanner } from "../components/ErrorBanner";
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

function FieldRow({ label, value }) {
  return (
    <div className="card card-subtle">
      <div className="field-label">{label}</div>
      <div style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {value || "—"}
      </div>
    </div>
  );
}

export function UpdateDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const role = user?.role;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [updatePayload, setUpdatePayload] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getUpdateApi(id);
        setUpdatePayload(res);
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
    load();
  }, [id, role, nav]);

  const update = updatePayload?.update || updatePayload || null;
  const meterId = update?.meterId || update?.meter?._id || "";
  const meterLabel = useMemo(() => {
    return (
      update?.meter?.electronicId ||
      update?.meter?.accountNumber ||
      meterId ||
      "Meter"
    );
  }, [update, meterId]);

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Update Detail</div>
            <div className="muted">
              Review the submitted values and status for this update.
            </div>
          </div>

          <div className="row">
            {meterId ? (
              <Link className="btn" to={`/meters/${encodeURIComponent(meterId)}/updates`}>
                Back to Meter Updates
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <LoadingBlock title="Loading update detail..." /> : null}

      {!loading && update ? (
        <>
          <div className="card">
            <div className="h2">{meterLabel}</div>
            <div className="muted">
              Submitted {fmtDate(update.createdAt)} • Status {update.status || "submitted"}
            </div>
          </div>

          <div className="grid grid-2">
            <FieldRow label="Latitude" value={update.latitude != null ? String(update.latitude) : ""} />
            <FieldRow label="Longitude" value={update.longitude != null ? String(update.longitude) : ""} />
            <FieldRow label="Meter Size" value={update.meterSize || ""} />
            <FieldRow label="Photo URL" value={update.photoUrl || ""} />
            <FieldRow label="Submitted By" value={update.submittedByEmail || update.submittedBy || ""} />
            <FieldRow label="Reviewed At" value={fmtDate(update.reviewedAt)} />
          </div>

          <FieldRow label="Location Notes" value={update.locationNotes || ""} />

          {update.reviewNotes ? (
            <FieldRow label="Review Notes" value={update.reviewNotes} />
          ) : null}

          <div className="card">
            <div className="h2">Related Links</div>
            <div className="row" style={{ marginTop: 12 }}>
              {meterId ? (
                <>
                  <Link className="btn" to={`/meters/${encodeURIComponent(meterId)}`}>
                    Open Meter
                  </Link>
                  <Link
                    className="btn"
                    to={`/meters/${encodeURIComponent(meterId)}/updates`}
                  >
                    Open Meter Update Page
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}