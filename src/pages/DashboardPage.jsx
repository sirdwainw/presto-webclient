import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import {
  reportsDashboardApi,
  techWorkloadApi,
  techSummaryApi,
} from "../api/reports.api";

function KpiTile({ label, value, hint, to }) {
  const inner = (
    <div className="card card-subtle kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : <div className="kpi-hint" />}
    </div>
  );

  return to ? (
    <Link
      to={to}
      className="kpi-link"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [viewMode, setViewMode] = useState("admin");
  const isSuperadmin = role === "superadmin";

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [summary, setSummary] = useState(null);

  const [loadingWorkload, setLoadingWorkload] = useState(false);
  const [workloadError, setWorkloadError] = useState(null);
  const [workload, setWorkload] = useState(null);

  const techRows = useMemo(() => workload?.techs || [], [workload]);

  const [selectedTechId, setSelectedTechId] = useState("");
  const [loadingTech, setLoadingTech] = useState(false);
  const [techError, setTechError] = useState(null);
  const [techSummary, setTechSummary] = useState(null);

  useEffect(() => {
    if (role === "superadmin" && !user?.activeCompanyId) {
      nav("/settings", { replace: true });
    }
  }, [role, user?.activeCompanyId, nav]);

  useEffect(() => {
    async function load() {
      if (!(role === "admin" || role === "superadmin")) return;
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const data = await reportsDashboardApi();
        setSummary(data);
      } catch (e) {
        if (
          e?.status === 400 &&
          typeof e?.error === "string" &&
          e.error.startsWith("No company scope selected") &&
          role === "superadmin"
        ) {
          nav("/settings");
          return;
        }
        setSummaryError(e);
      } finally {
        setLoadingSummary(false);
      }
    }
    load();
  }, [role, nav]);

  useEffect(() => {
    async function load() {
      if (!(role === "admin" || role === "superadmin")) return;
      setLoadingWorkload(true);
      setWorkloadError(null);
      try {
        const data = await techWorkloadApi();
        setWorkload(data);
      } catch (e) {
        setWorkloadError(e);
      } finally {
        setLoadingWorkload(false);
      }
    }
    load();
  }, [role]);

  useEffect(() => {
    if (!isSuperadmin) return;
    if (selectedTechId) return;
    if (techRows.length > 0) setSelectedTechId(techRows[0].userId);
  }, [isSuperadmin, selectedTechId, techRows]);

  useEffect(() => {
    async function load() {
      if (role === "tech") {
        setLoadingTech(true);
        setTechError(null);
        try {
          const data = await techSummaryApi();
          setTechSummary(data);
        } catch (e) {
          setTechError(e);
        } finally {
          setLoadingTech(false);
        }
      }

      if (isSuperadmin && viewMode === "tech" && selectedTechId) {
        setLoadingTech(true);
        setTechError(null);
        try {
          const data = await techSummaryApi(selectedTechId);
          setTechSummary(data);
        } catch (e) {
          setTechError(e);
        } finally {
          setLoadingTech(false);
        }
      }
    }
    load();
  }, [role, isSuperadmin, viewMode, selectedTechId]);

  function renderTechDashboard() {
    return (
      <div className="stack">
        {isSuperadmin ? (
          <div className="card">
            <div className="stack">
              <div className="row space-between">
                <div>
                  <div className="h2">Viewing as Tech</div>
                  <div className="muted">
                    Read-only support mode for the selected tech.
                  </div>
                </div>
                <button className="btn" onClick={() => setViewMode("admin")}>
                  Back to Admin View
                </button>
              </div>

              <div className="grid grid-2">
                <label className="field">
                  <div className="field-label">Select Tech</div>
                  <select
                    className="input"
                    value={selectedTechId}
                    onChange={(e) => setSelectedTechId(e.target.value)}
                    disabled={loadingWorkload || techRows.length === 0}
                  >
                    {techRows.map((t) => (
                      <option key={t.userId} value={t.userId}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="field">
                  <div className="field-label">Quick note</div>
                  <div className="muted">
                    Tech pages remain tech-only. This view is for support and
                    troubleshooting.
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="h1">Dashboard</div>
            <div className="muted">Your field work summary and shortcuts.</div>
          </div>
        )}

        <ErrorBanner error={techError} onDismiss={() => setTechError(null)} />
        {loadingTech ? <LoadingBlock title="Loading tech dashboard..." /> : null}

        {!loadingTech && techSummary ? (
          <>
            <div className="grid grid-4 kpi-grid">
              <KpiTile
                label="My assigned meters"
                value={techSummary.assignedMetersCount}
                hint="Active assignments"
                to="/tech/assignments"
              />
              <KpiTile
                label="My submitted updates"
                value={techSummary.submittedCount}
                hint="Waiting for review"
                to="/tech/updates?status=submitted"
              />
              <KpiTile
                label="My rejected updates to fix"
                value={techSummary.rejectedCount}
                hint="Needs correction"
                to="/tech/updates?status=rejected"
              />
              <KpiTile
                label="Today's progress"
                value={techSummary.updatedTodayCount}
                hint="Unique meters updated today"
                to="/tech/updates?date=today"
              />
            </div>

            {!isSuperadmin ? (
              <div className="card card-subtle">
                <div className="muted">
                  Start with <Link to="/tech/assignments">My Assignments</Link>.
                  Use <Link to="/tech/updates"> My Updates</Link> to fix rejected
                  work or track review status.
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  function renderAdminDashboard() {
    const totalMeters = summary?.totals?.totalMeters ?? 0;
    const submitted = summary?.updates?.submitted ?? 0;
    const rejected = summary?.updates?.rejected ?? 0;
    const missingLatLng = summary?.missing?.latlng ?? 0;

    const gpsCompletePct =
      totalMeters > 0
        ? Math.round(((totalMeters - missingLatLng) / totalMeters) * 100)
        : 0;

    return (
      <div className="stack">
        <div className="card">
          <div className="stack">
            <div className="row space-between">
              <div>
                <div className="h1">Dashboard</div>
                <div className="muted">
                  {isSuperadmin ? "Superadmin" : "Admin"} view
                </div>
              </div>

              {isSuperadmin ? (
                <div className="row">
                  <button
                    className={`btn ${viewMode === "admin" ? "btn-primary" : ""}`}
                    onClick={() => setViewMode("admin")}
                  >
                    Admin View
                  </button>
                  <button
                    className={`btn ${viewMode === "tech" ? "btn-primary" : ""}`}
                    onClick={() => setViewMode("tech")}
                    disabled={techRows.length === 0}
                  >
                    View as Tech
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <ErrorBanner error={summaryError} onDismiss={() => setSummaryError(null)} />
        {loadingSummary ? <LoadingBlock title="Loading dashboard..." /> : null}

        {!loadingSummary && summary ? (
          <>
            <div className="grid grid-4 kpi-grid">
              <KpiTile
                label="Total meters"
                value={totalMeters}
                hint="All meters in scope"
                to="/meters"
              />
              <KpiTile
                label="Submitted pending review"
                value={submitted}
                hint="Queue size"
                to="/review/updates"
              />
              <KpiTile
                label="Rejected count"
                value={rejected}
                hint="Needs rework"
                to="/review/updates"
              />
              <KpiTile
                label="GPS completeness"
                value={`${gpsCompletePct}%`}
                hint="Meters with lat/lng"
                to="/meters?missing=latlng"
              />
            </div>

            <div className="card">
              <div className="row space-between">
                <div>
                  <div className="h2">Tech Workload</div>
                
                </div>
                
              </div>

              <ErrorBanner error={workloadError} onDismiss={() => setWorkloadError(null)} />
              {loadingWorkload ? <LoadingBlock title="Loading tech workload..." /> : null}

              {!loadingWorkload && workload ? (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tech</th>
                        <th>Assigned</th>
                        <th>Submitted</th>
                        <th>Rejected</th>
                        <th>Updated today</th>
                        {isSuperadmin ? <th>Support</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {techRows.map((t) => (
                        <tr key={t.userId}>
                          <td>
                            <div>
                              <strong>{t.name}</strong>
                            </div>
                            <div className="muted">{t.email}</div>
                          </td>
                          <td>{t.assignedMetersCount}</td>
                          <td>{t.submittedCount}</td>
                          <td>{t.rejectedCount}</td>
                          <td>{t.updatedTodayCount}</td>
                          {isSuperadmin ? (
                            <td>
                              <button
                                className="btn"
                                onClick={() => {
                                  setSelectedTechId(t.userId);
                                  setViewMode("tech");
                                }}
                              >
                                View as Tech
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  if (role === "tech") return renderTechDashboard();
  if (isSuperadmin && viewMode === "tech") return renderTechDashboard();
  if (role === "admin" || role === "superadmin") return renderAdminDashboard();

  return (
    <div className="card">
      <div className="h2">Dashboard</div>
      <div className="muted">Unknown role.</div>
    </div>
  );
}