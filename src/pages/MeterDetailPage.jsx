import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getMeterApi } from "../api/meters.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

export function MeterDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meterPayload, setMeterPayload] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMeterApi(id); // { meter }
        setMeterPayload(data);
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
        setLoading(false);
      }
    }
    load();
  }, [id, role, nav]);

  const meter = meterPayload?.meter;

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Meter Detail</div>
            <div className="muted">
              Uses <code>GET /api/meters/:id</code>
            </div>
          </div>
          <div className="row">
            <Link className="btn" to="/meters">
              Back to meters
            </Link>
            <Link
              className="btn btn-primary"
              to={`/meters/${encodeURIComponent(id)}/updates`}
            >
              Updates
            </Link>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <LoadingBlock title="Loading meter..." /> : null}

      {!loading && meter ? (
        <div className="card">
          <div className="h2">Key fields (when present)</div>
          <div className="grid grid-3">
            <div>
              <div className="muted">ID</div>
              <div>{getEntityId(meter) || id}</div>
            </div>
            <div>
              <div className="muted">Electronic ID</div>
              <div>{meter?.electronicId ?? ""}</div>
            </div>
            <div>
              <div className="muted">Account #</div>
              <div>{meter?.accountNumber ?? ""}</div>
            </div>
            <div>
              <div className="muted">Customer</div>
              <div>{meter?.customerName ?? ""}</div>
            </div>
            <div>
              <div className="muted">Address</div>
              <div>{meter?.address ?? ""}</div>
            </div>
            <div>
              <div className="muted">Route</div>
              <div>{meter?.route ?? ""}</div>
            </div>
          </div>

          <div className="h2" style={{ marginTop: 16 }}>
            Raw payload
          </div>
          <JsonView data={meterPayload} />
        </div>
      ) : null}
    </div>
  );
}
