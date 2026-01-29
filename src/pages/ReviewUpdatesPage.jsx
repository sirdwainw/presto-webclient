import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listReviewUpdatesApi, reviewUpdateApi } from "../api/review.api";
import { deleteUpdateApi } from "../api/updates.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { Pagination } from "../components/Pagination";
import { SuccessBanner } from "../components/SuccessBanner";
import { JsonView } from "../components/JsonView";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

export function ReviewUpdatesPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [status, setStatus] = useState("submitted");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const updates = useMemo(() => payload?.updates || [], [payload]);

  const [actionLoadingId, setActionLoadingId] = useState("");
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listReviewUpdatesApi({ status, page, limit });
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, limit]);

  async function doReview(updateObj, nextStatus) {
    setActionError(null);
    setSuccess("");
    const id = getEntityId(updateObj);

    if (!id) {
      setActionError({
        error:
          "Cannot find update id field in this update object. No action taken.",
      });
      return;
    }

    setActionLoadingId(id);
    try {
      await reviewUpdateApi(id, { status: nextStatus });
      setSuccess(`Update ${id} marked ${nextStatus}.`);
      await load();
    } catch (e) {
      if (
        e?.status === 400 &&
        e?.error === "No company scope selected" &&
        role === "superadmin"
      ) {
        nav("/superadmin/context");
        return;
      }
      setActionError(e);
    } finally {
      setActionLoadingId("");
    }
  }

  async function doDelete(updateObj) {
    setActionError(null);
    setSuccess("");
    const id = getEntityId(updateObj);

    if (!id) {
      setActionError({
        error: "Cannot find update id field in this update object.",
      });
      return;
    }

    setActionLoadingId(id);
    try {
      await deleteUpdateApi(id);
      setSuccess(`Update ${id} deleted.`);
      await load();
    } catch (e) {
      setActionError(e);
    } finally {
      setActionLoadingId("");
    }
  }

  const canDelete = role === "admin" || role === "superadmin";

  return (
    <div className="stack">
      <div className="card">
        <div className="h1">Review Queue</div>
        <div className="muted">
          Uses <code>GET /api/review/updates</code> and{" "}
          <code>PATCH /api/review/updates/:updateId</code>
        </div>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Status</div>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={loading}
            >
              <option value="submitted">submitted</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </label>

          <label className="field">
            <div className="field-label">Limit</div>
            <input
              className="input"
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={loading}
            />
          </label>

          <div className="field">
            <div className="field-label">Actions</div>
            <button
              className="btn"
              onClick={() => setPage(1)}
              disabled={loading}
            >
              Apply (page 1)
            </button>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={success} onDismiss={() => setSuccess("")} />
      <ErrorBanner error={actionError} onDismiss={() => setActionError(null)} />

      {loading ? <LoadingBlock title="Loading review updates..." /> : null}

      {!loading && payload ? (
        <div className="card">
          <Pagination
            page={payload.page || page}
            limit={payload.limit || limit}
            count={payload.count || 0}
            onPageChange={setPage}
          />

          <div className="h2">Updates</div>
          <p className="muted">
            Buttons enabled only when an id field exists at runtime.
          </p>

          <div className="stack">
            {updates.map((u, idx) => {
              const id = getEntityId(u);
              const busy = id && actionLoadingId === id;

              return (
                <div className="card card-subtle" key={id || idx}>
                  <div className="row space-between">
                    <div>
                      <div className="h3">
                        Update{" "}
                        {id ? (
                          <Link to={`/updates/${encodeURIComponent(id)}`}>
                            <code>{id}</code>
                          </Link>
                        ) : (
                          <span className="muted">(no id field)</span>
                        )}
                      </div>
                    </div>

                    <div className="row">
                      <button
                        className="btn btn-primary"
                        disabled={!id || busy}
                        onClick={() => doReview(u, "approved")}
                      >
                        {busy ? "Working..." : "Approve"}
                      </button>
                      <button
                        className="btn"
                        disabled={!id || busy}
                        onClick={() => doReview(u, "rejected")}
                      >
                        {busy ? "Working..." : "Reject"}
                      </button>

                      <button
                        className="btn btn-danger"
                        disabled={!id || busy || !canDelete}
                        onClick={() => doDelete(u)}
                        title={canDelete ? "Delete update" : "Admins only"}
                      >
                        {busy ? "Working..." : "Delete"}
                      </button>

                      {id ? (
                        <Link
                          className="btn"
                          to={`/updates/${encodeURIComponent(id)}`}
                        >
                          Details
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <JsonView data={u} />
                </div>
              );
            })}
          </div>

          <Pagination
            page={payload.page || page}
            limit={payload.limit || limit}
            count={payload.count || 0}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
