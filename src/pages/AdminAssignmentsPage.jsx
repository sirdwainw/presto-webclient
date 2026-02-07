import React, { useEffect, useMemo, useState } from "react";
import {
  listAssignableTechsApi,
  postAssignments,
  postAssignmentsByQuery,
} from "../api/assignments.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { SuccessBanner } from "../components/SuccessBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

function isCompanyScopeError(e) {
  const msg = String(e?.error || e?.message || "");
  return e?.status === 400 && msg.startsWith("No company scope selected");
}

function parseIds(text) {
  const raw = String(text || "");
  return raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AdminAssignmentsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [loadingTechs, setLoadingTechs] = useState(false);
  const [techError, setTechError] = useState(null);
  const [techsPayload, setTechsPayload] = useState(null);

  const techs = useMemo(() => techsPayload?.techs || [], [techsPayload]);
  const [selectedTechId, setSelectedTechId] = useState("");

  // assign by query
  const [missing, setMissing] = useState({
    latlng: true,
    photo: false,
    notes: false,
    meterSize: false,
  });
  const [route, setRoute] = useState("");
  const [limit, setLimit] = useState(50);

  const [assigningQuery, setAssigningQuery] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [querySuccess, setQuerySuccess] = useState("");

  // assign by explicit ids
  const [meterIdsText, setMeterIdsText] = useState("");
  const [assigningIds, setAssigningIds] = useState(false);
  const [idsError, setIdsError] = useState(null);
  const [idsSuccess, setIdsSuccess] = useState("");

  useEffect(() => {
    async function loadTechs() {
      setLoadingTechs(true);
      setTechError(null);
      try {
        const data = await listAssignableTechsApi();
        setTechsPayload(data);

        const firstId = data?.techs?.[0]?.id || "";
        setSelectedTechId((prev) => prev || firstId);
      } catch (e) {
        if (isCompanyScopeError(e) && role === "superadmin") {
          nav("/superadmin/context");
          return;
        }
        setTechError(e);
      } finally {
        setLoadingTechs(false);
      }
    }
    loadTechs();
  }, [role, nav]);

  const missingCsv = useMemo(() => {
    return Object.entries(missing)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(",");
  }, [missing]);

  async function onAssignByQuery() {
    setQueryError(null);
    setQuerySuccess("");

    if (!selectedTechId) {
      setQueryError({ error: "Pick a tech first." });
      return;
    }
    if (!missingCsv) {
      setQueryError({ error: "Select at least one 'missing' type." });
      return;
    }

    setAssigningQuery(true);
    try {
      const body = {
        userId: selectedTechId,
        missing: missingCsv,
        limit,
        ...(route ? { route } : {}),
      };
      const res = await postAssignmentsByQuery(body);
      setQuerySuccess(`Assigned ${res?.assignedCount ?? 0} meter(s) by query.`);
    } catch (e) {
      setQueryError(e);
    } finally {
      setAssigningQuery(false);
    }
  }

  async function onAssignByIds() {
    setIdsError(null);
    setIdsSuccess("");

    if (!selectedTechId) {
      setIdsError({ error: "Pick a tech first." });
      return;
    }

    const meterIds = parseIds(meterIdsText);
    if (meterIds.length === 0) {
      setIdsError({ error: "Paste at least one meter id." });
      return;
    }

    setAssigningIds(true);
    try {
      const res = await postAssignments({ userId: selectedTechId, meterIds });
      setIdsSuccess(`Assigned ${res?.assignedCount ?? 0} meter(s) by id.`);
      setMeterIdsText("");
    } catch (e) {
      setIdsError(e);
    } finally {
      setAssigningIds(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">Assignments</div>
        <div className="muted">Admin/Superadmin assigns meters to techs.</div>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Tech</div>
            <select
              className="input"
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              disabled={loadingTechs}
            >
              <option value="">(select)</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} • {t.email}
                </option>
              ))}
            </select>
            <div className="field-hint">
              Uses <code>GET /api/assignments/techs</code>
            </div>
          </label>

          <div className="field">
            <div className="field-label">Scoped Company</div>
            <div className="muted">
              If you’re superadmin, set Company Context first.
            </div>
          </div>

          <div className="field">
            <div className="field-label">Actions</div>
            <button
              className="btn"
              onClick={() => window.location.reload()}
              disabled={loadingTechs}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <ErrorBanner error={techError} onDismiss={() => setTechError(null)} />
      {loadingTechs ? <LoadingBlock title="Loading tech list..." /> : null}

      {/* Assign by query */}
      <div className="card">
        <div className="h2">Assign by missing-data query</div>
        <div className="muted">
          Uses <code>POST /api/assignments/by-query</code>
        </div>

        <ErrorBanner error={queryError} onDismiss={() => setQueryError(null)} />
        <SuccessBanner
          message={querySuccess}
          onDismiss={() => setQuerySuccess("")}
        />

        <div className="grid grid-4" style={{ marginTop: 12 }}>
          <div className="field">
            <div className="field-label">Missing filters</div>

            <label className="row" style={{ gap: 8, marginTop: 6 }}>
              <input
                type="checkbox"
                checked={missing.latlng}
                onChange={(e) =>
                  setMissing((m) => ({ ...m, latlng: e.target.checked }))
                }
              />
              <span>latlng</span>
            </label>

            <label className="row" style={{ gap: 8, marginTop: 6 }}>
              <input
                type="checkbox"
                checked={missing.photo}
                onChange={(e) =>
                  setMissing((m) => ({ ...m, photo: e.target.checked }))
                }
              />
              <span>photo</span>
            </label>

            <label className="row" style={{ gap: 8, marginTop: 6 }}>
              <input
                type="checkbox"
                checked={missing.notes}
                onChange={(e) =>
                  setMissing((m) => ({ ...m, notes: e.target.checked }))
                }
              />
              <span>notes</span>
            </label>

            <label className="row" style={{ gap: 8, marginTop: 6 }}>
              <input
                type="checkbox"
                checked={missing.meterSize}
                onChange={(e) =>
                  setMissing((m) => ({ ...m, meterSize: e.target.checked }))
                }
              />
              <span>meterSize</span>
            </label>

            <div className="field-hint">Selected: {missingCsv || "(none)"}</div>
          </div>

          <label className="field">
            <div className="field-label">Route (optional)</div>
            <input
              className="input"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              disabled={assigningQuery}
            />
          </label>

          <label className="field">
            <div className="field-label">Limit</div>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={assigningQuery}
            />
            <div className="field-hint">Max 500</div>
          </label>

          <div className="field">
            <div className="field-label">Assign</div>
            <button
              className="btn btn-primary"
              onClick={onAssignByQuery}
              disabled={assigningQuery || !selectedTechId}
            >
              {assigningQuery ? "Assigning..." : "Assign by query"}
            </button>
          </div>
        </div>
      </div>

      {/* Assign by IDs */}
      <div className="card">
        <div className="h2">Assign by meter IDs</div>
        <div className="muted">
          Paste meter ids (one per line or comma-separated). Uses{" "}
          <code>POST /api/assignments</code>
        </div>

        <ErrorBanner error={idsError} onDismiss={() => setIdsError(null)} />
        <SuccessBanner
          message={idsSuccess}
          onDismiss={() => setIdsSuccess("")}
        />

        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Meter IDs</div>
            <textarea
              className="input"
              rows={6}
              value={meterIdsText}
              onChange={(e) => setMeterIdsText(e.target.value)}
              disabled={assigningIds}
              placeholder="6965c9494899d2fb68646d8c
6965c9494899d2fb68646d8d"
            />
          </label>

          <div className="field">
            <div className="field-label">Assign</div>
            <button
              className="btn btn-primary"
              onClick={onAssignByIds}
              disabled={assigningIds || !selectedTechId}
            >
              {assigningIds ? "Assigning..." : "Assign these IDs"}
            </button>

            <div className="field-hint" style={{ marginTop: 10 }}>
              Tip: Use the Meters page to find IDs, then paste here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
