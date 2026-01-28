import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { JsonView } from "../components/JsonView";
import { reportsDashboardApi } from "../api/reports.api";

export function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    // If superadmin and no activeCompanyId in /me payload, route to context selection
    if (role === "superadmin" && !user?.activeCompanyId) {
      nav("/superadmin/context", { replace: true });
    }
  }, [role, user?.activeCompanyId, nav]);

  useEffect(() => {
    async function load() {
      if (!(role === "admin" || role === "superadmin")) return;
      setLoading(true);
      setError(null);
      try {
        const data = await reportsDashboardApi();
        setDashboard(data);
      } catch (e) {
        // Required behavior: if scoped endpoint returns 400 No company scope selected => superadmin context screen
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
        setLoading(false);
      }
    }
    load();
  }, [role, nav]);

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">Dashboard</div>
        <div className="muted">Role-aware landing page.</div>
      </div>

      {(role === "admin" || role === "superadmin") && (
        <div className="card">
          <div className="h2">Reports: Dashboard Snapshot</div>
          <p className="muted">
            Data from <code>GET /api/reports/dashboard</code>
          </p>

          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          {loading ? (
            <LoadingBlock title="Loading dashboard report..." />
          ) : null}
          {!loading && dashboard ? <JsonView data={dashboard} /> : null}
        </div>
      )}

      {role === "tech" && (
        <div className="card">
          <div className="h2">Tech quick links</div>
          <ul className="list">
            <li>
              Use <strong>Meters</strong> to view your assigned meters (per
              backend behavior).
            </li>
            <li>
              Use <strong>My Assignments</strong> to view assignment objects.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
