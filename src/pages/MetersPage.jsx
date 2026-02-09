// src/pages/MetersPage.jsx
// Polish + fixes:
// - ✅ Fix "rows out of order" issue (you had <div> inside <tr>/<thead> which breaks table layout)
// - ✅ Remove DB id column from the table (no more Mongo _id shown as a column)
// - ✅ Keep row click navigation to meter details without showing DB id (uses a "View" link)
// - ✅ Put filter pills + "Showing X–Y of Z" ABOVE the table (valid HTML, consistent layout)
// - ✅ Missing chips auto-apply; other filters still Apply-based
// - ✅ Safer sort: don't toggle to fields not supported by backend (meterSerialNumber/numberOfPictures weren’t in your allowed list in backend)
// - ✅ Fix className typo ".meters-table" (dot should not be in className)
// - ✅ Add small UX: Esc clears error banner, success clears on filter/apply/page change

import React, { useEffect, useMemo, useState } from "react";
import "./MetersPage.css";
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

// Keep frontend options aligned with backend
const SORT_FIELDS = [
  { key: "electronicId", label: "electronicId" },
  { key: "accountNumber", label: "accountNumber" },
  { key: "address", label: "address" },
  { key: "route", label: "route" },
  { key: "customerName", label: "customerName" },
  { key: "meterSerialNumber", label: "meterSerialNumber" },
  { key: "meterSize", label: "meterSize" },
  { key: "numberOfPictures", label: "numberOfPictures" },
  { key: "lastApprovedUpdateAt", label: "lastApprovedUpdateAt" },
  { key: "createdAt", label: "createdAt" },
  { key: "updatedAt", label: "updatedAt" },
];

// Missing chips (auto-apply)
const MISSING_CHIPS = [
  { key: "any", label: "Any missing" },
  { key: "latlng", label: "Missing lat/lng" },
  { key: "notes", label: "Missing notes" },
  { key: "photo", label: "Missing photo" },
  { key: "meterSize", label: "Missing meter size" },
];

const MISSING_ORDER = ["any", "latlng", "notes", "photo", "meterSize"];

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

function parseMissing(value) {
  if (!value) return new Set();
  return new Set(
    String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function serializeMissing(set) {
  return MISSING_ORDER.filter((k) => set.has(k)).join(",");
}

function toggleMissingChip(currentMissing, key) {
  const set = parseMissing(currentMissing);

  // "any" behaves like a single-select toggle
  if (key === "any") {
    return set.has("any") ? "" : "any";
  }

  // Selecting a specific one removes "any"
  if (set.has("any")) set.delete("any");

  // Toggle specific key
  if (set.has(key)) set.delete(key);
  else set.add(key);

  return serializeMissing(set);
}

export function MetersPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const scopeKey = user?.activeCompanyId || user?.companyId || "noscope";
  const canAssign = role === "admin" || role === "superadmin";

  // Apply-based filtering (no fetch-on-type) EXCEPT Missing chips which auto-apply
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

  // Selection persists across page + filter changes (in-memory only)
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Assign toolbar state
  const [techs, setTechs] = useState([]);
  const [techLoading, setTechLoading] = useState(false);
  const [techId, setTechId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const meters = useMemo(() => payload?.meters || [], [payload]);

  const total = payload?.count ?? 0;
  const limit = payload?.limit ?? applied.limit ?? 50;
  const currentPage = payload?.page ?? page;

  const startIndex = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(currentPage * limit, total);

  const hasFiltersApplied = Boolean(
    applied.q ||
    applied.missing ||
    applied.electronicId ||
    applied.accountNumber ||
    applied.address ||
    applied.route,
  );

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
    setError(null);
  }

  function onApplyClicked() {
    applyNow({ ...form });
  }

  function toggleSort(field) {
    // Guard: ensure we only sort by backend-supported fields
    const allowed = SORT_FIELDS.some((f) => f.key === field);
    if (!allowed) return;

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

  function clearFilters() {
    const reset = {
      q: "",
      limit: 50,
      missing: "",
      electronicId: "",
      accountNumber: "",
      address: "",
      route: "",
      sortBy: "accountNumber",
      sortDir: "asc",
    };
    setForm(reset);
    applyNow(reset);
  }

  function clearOneFilter(key) {
    const next = { ...form };
    if (key === "q") next.q = "";
    if (key === "missing") next.missing = "";
    if (key === "electronicId") next.electronicId = "";
    if (key === "accountNumber") next.accountNumber = "";
    if (key === "address") next.address = "";
    if (key === "route") next.route = "";

    setForm(next);
    applyNow(next);
  }

  const filterPills = useMemo(() => {
    const pills = [];
    if (applied.missing)
      pills.push({ key: "missing", label: `Missing: ${applied.missing}` });
    if (applied.route)
      pills.push({ key: "route", label: `Route: ${applied.route}` });
    if (applied.electronicId)
      pills.push({
        key: "electronicId",
        label: `EID: ${applied.electronicId}`,
      });
    if (applied.accountNumber)
      pills.push({
        key: "accountNumber",
        label: `Acct: ${applied.accountNumber}`,
      });
    if (applied.address)
      pills.push({ key: "address", label: `Address: ${applied.address}` });
    if (applied.q) pills.push({ key: "q", label: `q: ${applied.q}` });
    return pills;
  }, [applied]);

  // Clear selection when company scope changes
  useEffect(() => {
    setSelectedIds(new Set());
    setTechId("");
    setSuccess("");
    setError(null);
    setPage(1);
  }, [scopeKey]);

  // Esc clears error banner (small UX polish)
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setError(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        const data = await listAssignableTechsApi();
        setTechs(data?.techs || []);
      } catch (e) {
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
      {/* ---------- FILTER CARD ---------- */}
      <div className="card meters-filter-panel">
        <div className="row space-between">
          <div>
            <div className="h1">Meters</div>
            <div className="muted">
              Uses <code>GET /api/meters</code>. Highlight uses{" "}
              <code>meter.lastApprovedUpdateAt</code>.
            </div>
          </div>
        </div>

        {/* Filters */}
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

          {/* Missing chips (AUTO APPLY) */}
          <div className="field">
            <div className="field-label">Missing</div>

            <div className="chips">
              {MISSING_CHIPS.map((c) => {
                const set = parseMissing(form.missing);
                const active = set.has(c.key);

                return (
                  <button
                    key={c.key}
                    type="button"
                    className={`chip chip-${c.key} ${active ? "chip-active" : ""}`}
                    disabled={loading}
                    onClick={() => {
                      const nextMissing = toggleMissingChip(
                        form.missing,
                        c.key,
                      );
                      const next = { ...form, missing: nextMissing };
                      setForm(next);
                      applyNow(next);
                    }}
                    title="Click to apply immediately"
                  >
                    {c.label}
                  </button>
                );
              })}

              {form.missing ? (
                <button
                  type="button"
                  className="chip chip-clear"
                  disabled={loading}
                  onClick={() => {
                    const next = { ...form, missing: "" };
                    setForm(next);
                    applyNow(next);
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="field-hint missing-hint">
              Tip: “Any missing” is OR across fields. Specific chips combine
              with AND.
            </div>
          </div>

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
            <div className="field-label">Electronic ID</div>
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
            <div className="field-label">Account #</div>
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
            <div className="field-label">Address</div>
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
            <div className="field-label">Route</div>
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
            <div className="field-label">Sort</div>
            <div className="row">
              <select
                className="input"
                value={form.sortBy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortBy: e.target.value }))
                }
                disabled={loading}
              >
                {SORT_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
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
            <div className="meters-actions-row">
              <button
                className="btn"
                onClick={onApplyClicked}
                disabled={loading}
              >
                Apply
              </button>

              <button
                className="btn btn-ghost"
                disabled={loading}
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>

            <div className="field-hint">
              Most filters apply on click Apply. Missing chips apply instantly.
            </div>
          </div>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={success} onDismiss={() => setSuccess("")} />
      {loading ? <LoadingBlock title="Loading meters..." /> : null}

      {/* ---------- RESULTS CARD ---------- */}
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

          {/* ✅ Pills + meta go ABOVE table/pagination (valid HTML) */}
          {filterPills.length ? (
            <div className="pill-row" style={{ marginBottom: 10 }}>
              {filterPills.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="pill"
                  onClick={() => clearOneFilter(p.key)}
                  title="Remove filter"
                  disabled={loading}
                >
                  {p.label} <span className="pill-x">✕</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="meters-meta" style={{ marginBottom: 10 }}>
            <span className="muted">
              Showing <strong>{startIndex}</strong>–<strong>{endIndex}</strong>{" "}
              of <strong>{total}</strong>
            </span>
            {hasFiltersApplied ? (
              <span className="muted"> • Filters applied</span>
            ) : (
              <span className="muted"> • No filters</span>
            )}
          </div>

          <Pagination
            page={payload.page || page}
            limit={payload.limit || applied.limit}
            count={payload.count || 0}
            onPageChange={(p) => {
              setPage(p);
              setSuccess("");
              setError(null);
            }}
          />

          {meters.length === 0 ? (
            <div className="card card-subtle" style={{ marginTop: 12 }}>
              <div className="h2">No meters found</div>
              <div className="muted">
                Try clearing filters, changing “Missing”, or broadening your
                search.
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-ghost" onClick={clearFilters}>
                  Reset filters
                </button>
              </div>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="table meters-table">
              <thead>
                <tr>
                  {canAssign ? (
                    <th style={{ width: 46 }}>
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                        title="Select all meters on this page"
                      />
                    </th>
                  ) : null}

                  <th>Actions</th>

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

                  <th
                    className="th-sort"
                    onClick={() => toggleSort("meterSize")}
                  >
                    Meter Size{sortGlyph("meterSize")}
                  </th>

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
                              title="Select meter"
                            />
                          ) : null}
                        </td>
                      ) : null}

                      {/* ✅ User-facing Actions (no raw id shown) */}
                      <td>
                        {mid ? (
                          <div className="row" style={{ gap: 10 }}>
                            <Link to={`/meters/${encodeURIComponent(mid)}`}>
                              View
                            </Link>
                            <Link
                              to={`/meters/${encodeURIComponent(mid)}/updates`}
                            >
                              Updates
                            </Link>
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
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
            onPageChange={(p) => {
              setPage(p);
              setSuccess("");
              setError(null);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
