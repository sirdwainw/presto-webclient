import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listMetersApi } from "../api/meters.api";
import {
  listAssignableTechsApi,
  postAssignments,
} from "../api/assignments.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { Pagination } from "../components/Pagination";
import { SuccessBanner } from "../components/SuccessBanner";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

const MISSING_OPTIONS = ["latlng", "notes", "photo", "meterSize", "any"];

function windowMs(val) {
  switch (val) {
    case "1h":
      return 1 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

export function MetersPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const scopeKey = user?.activeCompanyId || user?.companyId || "noscope";
  const canAssign = role === "admin" || role === "superadmin";

  // ---- APPLY-BASED FILTERING (no fetch-on-type) ----
  const [form, setForm] = useState(() => ({
    q: "",
    limit: 50,
    missing: "",
    electronicId: "",
    accountNumber: "",
    address: "",
    route: "",
    sortBy: "accountNumber",
    sortDir: "asc",
  }));

  const [applied, setApplied] = useState(() => ({ ...form }));

  const [page, setPage] = useState(1);
  const [highlightWindow, setHighlightWindow] = useState("24h");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  // ---- B1: Selection persists across page + filter changes (in-memory only) ----
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Assign toolbar state
  const [techs, setTechs] = useState([]);
  const [techLoading, setTechLoading] = useState(false);
  const [techId, setTechId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const meters = useMemo(() => payload?.meters || [], [payload]);

  const pageMeterIds = useMemo(() => {
    return meters.map((m) => getEntityId(m)).filter(Boolean);
  }, [meters]);

  const selectedCount = selectedIds.size;

  const allOnPageSelected = useMemo(() => {
    if (pageMeterIds.length === 0) return false;
    for (const id of pageMeterIds) {
      if (!selectedIds.has(id)) return false;
    }
    return true;
  }, [pageMeterIds, selectedIds]);

  function isRecentApproved(meter) {
    const ms = windowMs(highlightWindow);
    if (!ms) return false;

    const t = meter?.lastApprovedUpdateAt
      ? new Date(meter.lastApprovedUpdateAt).getTime()
      : 0;

    if (!t || Number.isNaN(t)) return false;
    return Date.now() - t <= ms;
  }

  function applyNow(nextApplied) {
    setApplied(nextApplied);
    setPage(1);
    setSuccess("");
  }

  function onApplyClicked() {
    applyNow({ ...form });
  }

  function toggleSort(field) {
    const nextDir =
      applied.sortBy === field
        ? applied.sortDir === "asc"
          ? "desc"
          : "asc"
        : "asc";

    const next = { ...applied, sortBy: field, sortDir: nextDir };
    setForm((f) => ({ ...f, sortBy: field, sortDir: nextDir }));
    applyNow(next);
  }

  function sortGlyph(field) {
    if (applied.sortBy !== field) return "";
    return applied.sortDir === "asc" ? " ▲" : " ▼";
  }

  function toggleRowSelection(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelectAll = !allOnPageSelected;
      for (const id of pageMeterIds) {
        if (shouldSelectAll) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Clear selection when company context changes (prevents cross-company accidental assigns)
  useEffect(() => {
    setSelectedIds(new Set());
    setTechId("");
    setSuccess("");
    setError(null);
    setPage(1);
  }, [scopeKey]);

  // Load meters when applied filters or page changes
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listMetersApi({
          page,
          ...applied,
          q: applied.q || undefined,
          missing: applied.missing || undefined,
          electronicId: applied.electronicId || undefined,
          accountNumber: applied.accountNumber || undefined,
          address: applied.address || undefined,
          route: applied.route || undefined,
        });
        setPayload(data);
      } catch (e) {
        if (
          e?.status === 400 &&
          String(e?.error || "").startsWith("No company scope selected") &&
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
  }, [page, applied, role, nav]);

  // Load techs for assignment toolbar
  useEffect(() => {
    if (!canAssign) return;

    async function loadTechs() {
      setTechLoading(true);
      try {
        const data = await listAssignableTechsApi(); // { techs: [] }
        setTechs(data?.techs || []);
      } catch (e) {
        // non-fatal; show in banner
        setError(e);
      } finally {
        setTechLoading(false);
      }
    }

    loadTechs();
  }, [canAssign, scopeKey]);

  async function assignSelected() {
    setSuccess("");
    setError(null);

    if (!techId) {
      setError({ error: "Pick a tech first." });
      return;
    }
    if (selectedIds.size === 0) {
      setError({ error: "Select at least one meter." });
      return;
    }

    setAssignLoading(true);
    try {
      const meterIds = Array.from(selectedIds);
      const result = await postAssignments({ userId: techId, meterIds });

      setSuccess(
        `Assigned ${result?.assignedCount ?? meterIds.length} meter(s) to the selected tech.`,
      );
      clearSelection();
    } catch (e) {
      setError(e);
    } finally {
      setAssignLoading(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Meters</div>
            <div className="muted">
              Uses <code>GET /api/meters</code>. Highlight uses{" "}
              <code>meter.lastApprovedUpdateAt</code>.
            </div>
          </div>
        </div>

        {/* Filters (edit freely; ONLY fetch on Apply) */}
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Global search (q)</div>
            <input
              className="input"
              value={form.q}
              onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
              disabled={loading}
              placeholder="Search across EID, acct, serial, customer, address, route"
            />
          </label>

          <label className="field">
            <div className="field-label">Missing (optional)</div>
            <select
              className="input"
              value={form.missing}
              onChange={(e) =>
                setForm((f) => ({ ...f, missing: e.target.value }))
              }
              disabled={loading}
            >
              <option value="">(none)</option>
              {MISSING_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="field-hint">Filter “missing data”</div>
          </label>

          <label className="field">
            <div className="field-label">Limit</div>
            <input
              className="input"
              type="number"
              min={1}
              max={200}
              value={form.limit}
              onChange={(e) =>
                setForm((f) => ({ ...f, limit: Number(e.target.value) || 50 }))
              }
              disabled={loading}
            />
            <div className="field-hint">Max 200</div>
          </label>
        </div>

        <div className="grid grid-4" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Electronic ID (column filter)</div>
            <input
              className="input"
              value={form.electronicId}
              onChange={(e) =>
                setForm((f) => ({ ...f, electronicId: e.target.value }))
              }
              disabled={loading}
            />
          </label>

          <label className="field">
            <div className="field-label">Account # (column filter)</div>
            <input
              className="input"
              value={form.accountNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, accountNumber: e.target.value }))
              }
              disabled={loading}
            />
          </label>

          <label className="field">
            <div className="field-label">Address (column filter)</div>
            <input
              className="input"
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
              disabled={loading}
            />
          </label>

          <label className="field">
            <div className="field-label">Route (column filter)</div>
            <input
              className="input"
              value={form.route}
              onChange={(e) =>
                setForm((f) => ({ ...f, route: e.target.value }))
              }
              disabled={loading}
            />
          </label>
        </div>

        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field-label">Highlight recently approved</div>
            <select
              className="input"
              value={highlightWindow}
              onChange={(e) => setHighlightWindow(e.target.value)}
              disabled={loading}
            >
              <option value="off">off</option>
              <option value="1h">last 1 hour</option>
              <option value="24h">last 24 hours</option>
              <option value="7d">last 7 days</option>
              <option value="30d">last 30 days</option>
            </select>
          </label>

          <label className="field">
            <div className="field-label">Sort (fallback controls)</div>
            <div className="row">
              <select
                className="input"
                value={form.sortBy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortBy: e.target.value }))
                }
                disabled={loading}
              >
                <option value="accountNumber">accountNumber</option>
                <option value="electronicId">electronicId</option>
                <option value="address">address</option>
                <option value="route">route</option>
                <option value="customerName">customerName</option>
                <option value="lastApprovedUpdateAt">
                  lastApprovedUpdateAt
                </option>
                <option value="createdAt">createdAt</option>
                <option value="updatedAt">updatedAt</option>
              </select>
              <select
                className="input"
                value={form.sortDir}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortDir: e.target.value }))
                }
                disabled={loading}
              >
                <option value="asc">asc</option>
                <option value="desc">desc</option>
              </select>
            </div>
          </label>

          <div className="field">
            <div className="field-label">Actions</div>
            <button className="btn" onClick={onApplyClicked} disabled={loading}>
              Apply (reset to page 1)
            </button>
            <div className="field-hint">
              Applies filters/sort. (Selection persists across applies.)
            </div>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={success} onDismiss={() => setSuccess("")} />
      {loading ? <LoadingBlock title="Loading meters..." /> : null}

      {!loading && payload ? (
        <div className="card">
          {/* Assignment toolbar (admin/superadmin only) */}
          {canAssign ? (
            <div className="table-toolbar">
              <div className="toolbar-group">
                <strong>Assign</strong>
                <span className="muted">
                  Selected: <strong>{selectedCount}</strong> (persists across
                  pages/filters)
                </span>
              </div>

              <div className="toolbar-group" style={{ minWidth: 340 }}>
                <select
                  className="input"
                  value={techId}
                  onChange={(e) => setTechId(e.target.value)}
                  disabled={techLoading || assignLoading}
                  title="Choose a tech to assign meters to"
                >
                  <option value="">Pick a tech…</option>
                  {techs.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} • {t.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="toolbar-group">
                <button
                  className="btn"
                  onClick={clearSelection}
                  disabled={assignLoading || selectedCount === 0}
                >
                  Clear selection
                </button>
                <button
                  className="btn btn-primary"
                  onClick={assignSelected}
                  disabled={assignLoading || !techId || selectedCount === 0}
                >
                  {assignLoading ? "Assigning…" : "Assign selected"}
                </button>
              </div>
            </div>
          ) : null}

          <Pagination
            page={payload.page || page}
            limit={payload.limit || applied.limit}
            count={payload.count || 0}
            onPageChange={setPage}
          />

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {canAssign ? (
                    <th className="th-sort" style={{ width: 46 }}>
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                        title="Select all meters on this page"
                      />
                    </th>
                  ) : null}

                  <th>ID</th>

                  <th
                    className="th-sort"
                    onClick={() => toggleSort("electronicId")}
                  >
                    Electronic ID{sortGlyph("electronicId")}
                  </th>
                  <th
                    className="th-sort"
                    onClick={() => toggleSort("accountNumber")}
                  >
                    Account #{sortGlyph("accountNumber")}
                  </th>

                  <th
                    className="th-sort"
                    onClick={() => toggleSort("meterSerialNumber")}
                  >
                    Serial #{sortGlyph("meterSerialNumber")}
                  </th>

                  <th
                    className="th-sort"
                    onClick={() => toggleSort("customerName")}
                  >
                    Customer{sortGlyph("customerName")}
                  </th>

                  <th className="th-sort" onClick={() => toggleSort("address")}>
                    Address{sortGlyph("address")}
                  </th>

                  <th className="th-sort" onClick={() => toggleSort("route")}>
                    Route{sortGlyph("route")}
                  </th>

                  <th>Lat</th>
                  <th>Lng</th>
                  <th>Meter Size</th>
                  <th
                    className="th-sort"
                    onClick={() => toggleSort("numberOfPictures")}
                  >
                    # Pics{sortGlyph("numberOfPictures")}
                  </th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {meters.map((m, idx) => {
                  const mid = getEntityId(m);
                  const rowKey = mid || String(idx);
                  const selected = mid ? selectedIds.has(mid) : false;

                  return (
                    <tr
                      key={rowKey}
                      className={[
                        isRecentApproved(m) ? "row-recent" : "",
                        selected ? "row-selected" : "",
                      ].join(" ")}
                    >
                      {canAssign ? (
                        <td>
                          {mid ? (
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRowSelection(mid)}
                            />
                          ) : null}
                        </td>
                      ) : null}

                      <td>
                        {mid ? (
                          <Link to={`/meters/${encodeURIComponent(mid)}`}>
                            {mid}
                          </Link>
                        ) : (
                          <span className="muted">(no id)</span>
                        )}
                        {mid ? (
                          <div className="muted">
                            <Link
                              to={`/meters/${encodeURIComponent(mid)}/updates`}
                            >
                              updates
                            </Link>
                          </div>
                        ) : null}
                      </td>

                      <td>{m?.electronicId ?? ""}</td>
                      <td>{m?.accountNumber ?? ""}</td>
                      <td>{m?.meterSerialNumber ?? ""}</td>
                      <td>{m?.customerName ?? ""}</td>
                      <td>{m?.address ?? ""}</td>
                      <td>{m?.route ?? ""}</td>
                      <td>{m?.latitude ?? ""}</td>
                      <td>{m?.longitude ?? ""}</td>
                      <td>{m?.meterSize ?? ""}</td>
                      <td>{m?.numberOfPictures ?? ""}</td>
                      <td className="cell-wrap">{m?.locationNotes ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={payload.page || page}
            limit={payload.limit || applied.limit}
            count={payload.count || 0}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
