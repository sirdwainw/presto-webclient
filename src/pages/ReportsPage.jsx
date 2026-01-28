import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  reportsActivityApi,
  reportsDashboardApi,
  reportsDataQualityApi,
  reportsRoutesApi,
  reportsTechsApi,
} from "../api/reports.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";

export function ReportsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [loadingKey, setLoadingKey] = useState("");
  const [error, setError] = useState(null);

  const [dashboard, setDashboard] = useState(null);
  const [dq, setDq] = useState(null);
  const [routes, setRoutes] = useState(null);
  const [techs, setTechs] = useState(null);
  const [activity, setActivity] = useState(null);

  const [days, setDays] = useState(30);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  async function run(key, fn, setter) {
    setError(null);
    setLoadingKey(key);
    try {
      const data = await fn();
      setter(data);
    } catch (e) {
      if (
        e?.status === 400 &&
        e?.error === "No company scope selected" &&
        role === "superadmin"
      ) {
        nav("/superadmin/context");
        return;
      }
      setError(e);
    } finally {
      setLoadingKey("");
    }
  }

  function techsParams() {
    // Contract: either days OR start/end (max 365). We do not guess; we only send what user chooses.
    if (start && end) return { start, end };
    return { days };
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">Reports</div>
        <div className="muted">
          Admin/Superadmin only. Calls report endpoints exactly as contracted.
        </div>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <button
            className="btn btn-primary"
            disabled={!!loadingKey}
            onClick={() => run("dashboard", reportsDashboardApi, setDashboard)}
          >
            {loadingKey === "dashboard" ? "Loading..." : "Load Dashboard"}
          </button>

          <button
            className="btn"
            disabled={!!loadingKey}
            onClick={() => run("dq", reportsDataQualityApi, setDq)}
          >
            {loadingKey === "dq" ? "Loading..." : "Load Data Quality"}
          </button>

          <button
            className="btn"
            disabled={!!loadingKey}
            onClick={() => run("routes", reportsRoutesApi, setRoutes)}
          >
            {loadingKey === "routes" ? "Loading..." : "Load Routes"}
          </button>
        </div>

        <div className="card card-subtle" style={{ marginTop: 12 }}>
          <div className="h2">Techs & Activity params</div>
          <p className="muted">
            Contract: either <code>days</code> OR <code>start</code>/
            <code>end</code>.
          </p>

          <div className="grid grid-3">
            <label className="field">
              <div className="field-label">Days</div>
              <input
                className="input"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                disabled={!!loadingKey}
              />
              <div className="field-hint">Used if start/end not both set.</div>
            </label>

            <label className="field">
              <div className="field-label">Start (YYYY-MM-DD)</div>
              <input
                className="input"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={!!loadingKey}
              />
            </label>

            <label className="field">
              <div className="field-label">End (YYYY-MM-DD)</div>
              <input
                className="input"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={!!loadingKey}
              />
              <div className="field-hint">
                End is endExclusive per contract.
              </div>
            </label>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn"
              disabled={!!loadingKey}
              onClick={() =>
                run("techs", () => reportsTechsApi(techsParams()), setTechs)
              }
            >
              {loadingKey === "techs" ? "Loading..." : "Load Techs"}
            </button>

            <button
              className="btn"
              disabled={!!loadingKey}
              onClick={() =>
                run(
                  "activity",
                  () => reportsActivityApi(techsParams()),
                  setActivity,
                )
              }
            >
              {loadingKey === "activity" ? "Loading..." : "Load Activity"}
            </button>
          </div>
        </div>

        {loadingKey ? (
          <LoadingBlock title={`Loading ${loadingKey}...`} />
        ) : null}
      </div>

      {dashboard ? (
        <div className="card">
          <div className="h2">Dashboard</div>
          <JsonView data={dashboard} />
        </div>
      ) : null}

      {dq ? (
        <div className="card">
          <div className="h2">Data Quality</div>
          <JsonView data={dq} />
        </div>
      ) : null}

      {routes ? (
        <div className="card">
          <div className="h2">Routes</div>
          <JsonView data={routes} />
        </div>
      ) : null}

      {techs ? (
        <div className="card">
          <div className="h2">Techs</div>
          <JsonView data={techs} />
        </div>
      ) : null}

      {activity ? (
        <div className="card">
          <div className="h2">Activity</div>
          <JsonView data={activity} />
        </div>
      ) : null}
    </div>
  );
}
