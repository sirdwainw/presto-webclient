import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { meApi } from "../api/auth.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";

export function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await meApi();
        setPayload(data);
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
  }, [role, nav]);

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Profile</div>
            <div className="muted">
              Uses <code>GET /api/auth/me</code>
            </div>
          </div>
          <button
            className="btn"
            disabled={loading}
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                await refreshMe();
                const data = await meApi();
                setPayload(data);
              } catch (e) {
                setError(e);
              } finally {
                setLoading(false);
              }
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <LoadingBlock title="Loading profile..." /> : null}
      {!loading && payload ? (
        <div className="card">
          <JsonView data={payload} />
        </div>
      ) : null}
    </div>
  );
}
