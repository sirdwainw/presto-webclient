import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { techAssignmentsApi } from "../api/tech.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { getEntityId } from "../api/apiClient";

export function TechAssignmentsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Contract: backend currently returns { meters: [...] }
  // Fallback kept for safety in case an older shape returns { assignments: [...] }.
  const [meters, setMeters] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await techAssignmentsApi();
        setMeters(res?.meters || res?.assignments || []);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">My Assignments</div>
        <div className="muted">
          View the meters currently assigned to you and jump into update work.
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <LoadingBlock title="Loading assignments..." /> : null}

      {!loading && !meters.length ? (
        <div className="card">
          <div className="muted">No active assignments found.</div>
        </div>
      ) : null}

      {!loading && meters.length ? (
        <div className="stack">
          {meters.map((meter) => {
            const meterId = getEntityId(meter);
            const title =
              meter?.electronicId ||
              meter?.accountNumber ||
              meterId ||
              "Assigned meter";

            return (
              <div key={meterId || `${meter?.electronicId}-${meter?.accountNumber}`} className="card">
                <div className="row space-between">
                  <div>
                    <div className="h2">{title}</div>
                    <div className="muted">
                      Assigned meter ready for update work
                    </div>
                  </div>

                  <div className="row">
                    {meterId ? (
                      <>
                        <Link
                          className="btn"
                          to={`/meters/${encodeURIComponent(meterId)}`}
                        >
                          Meter
                        </Link>
                        <Link
                          className="btn btn-primary"
                          to={`/meters/${encodeURIComponent(meterId)}/updates`}
                        >
                          Update
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-2" style={{ marginTop: 12 }}>
                  <div className="card card-subtle">
                    <div className="field-label">Address</div>
                    <div style={{ marginTop: 8 }}>{meter?.address || "—"}</div>
                  </div>

                  <div className="card card-subtle">
                    <div className="field-label">Route</div>
                    <div style={{ marginTop: 8 }}>{meter?.route || "—"}</div>
                  </div>

                  <div className="card card-subtle">
                    <div className="field-label">Customer</div>
                    <div style={{ marginTop: 8 }}>{meter?.customerName || "—"}</div>
                  </div>

                  <div className="card card-subtle">
                    <div className="field-label">Meter Serial</div>
                    <div style={{ marginTop: 8 }}>
                      {meter?.meterSerialNumber || "—"}
                    </div>
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