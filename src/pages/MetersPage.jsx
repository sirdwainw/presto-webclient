// src/pages/MetersPage.jsx
// Full replacement: sortable + header-filterable columns with ops:
// contains / not contains / blank / not blank
//
// Added (requested):
// ✅ Column sizing + resizing (drag header edge; double-click to reset)
// ✅ Show/hide columns (Columns panel)
// ✅ Reorder columns (drag headers)
// ✅ Column presets (Encore Compact / Audit / GPS Cleanup)
// ✅ Pinned columns (Actions + Electronic ID pinned left; Selection pinned too for admin)
//
// Notes:
// - Backend supports server-side "contains" filters for: electronicId, accountNumber, address, route
// - Everything else (and ops not supported by backend) is applied client-side on the current page of results.
// - Sorting: uses backend sort for allowed fields; falls back to client-side sort if needed.
// - Filters panel remains collapsible.
// - Missing chips still auto-apply.
// - Assignment toolbar stays above the table.

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./MetersPage.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { listMetersQuickApi } from "../api/meters.api";
import {
  listAssignableTechsApi,
  postAssignments,
  unassignMetersApi,
} from "../api/assignments.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { Pagination } from "../components/Pagination";
import { SuccessBanner } from "../components/SuccessBanner";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";
import { createPortal } from "react-dom";

/** Backend-known sortable fields (from your meters.routes.js) */
const SORT_FIELDS = [
  { key: "electronicId", label: "Electronic ID" },
  { key: "accountNumber", label: "Account #" },
  { key: "address", label: "Address" },
  { key: "route", label: "Route" },
  { key: "customerName", label: "Customer" },
  { key: "meterSerialNumber", label: "Serial #" },
  { key: "meterSize", label: "Meter Size" },
  { key: "numberOfPictures", label: "# Pics" },
  { key: "lastApprovedUpdateAt", label: "Last Approved" },
  { key: "createdAt", label: "Created" },
  { key: "updatedAt", label: "Updated" },
];

const SORTABLE_SET = new Set(SORT_FIELDS.map((x) => x.key));

/** Backend-supported per-column contains filters */
const SERVER_CONTAINS_FILTERS = new Set([
  "electronicId",
  "accountNumber",
  "address",
  "route",
]);

/** Missing chips (auto-apply) */
const MISSING_CHIPS = [
  { key: "any", label: "Any missing" },
  { key: "latlng", label: "Missing lat/lng" },
  { key: "notes", label: "Missing notes" },
  { key: "photo", label: "Missing photo" },
  { key: "meterSize", label: "Missing meter size" },
];

const MISSING_ORDER = ["any", "latlng", "notes", "photo", "meterSize"];

/** ---------- tiny utils ---------- */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function loadTablePrefs(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveTablePrefs(key, prefs) {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function moveItem(arr, fromId, toId) {
  const from = arr.indexOf(fromId);
  const to = arr.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

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

  if (key === "any") {
    return set.has("any") ? "" : "any";
  }

  if (set.has("any")) set.delete("any");

  if (set.has(key)) set.delete(key);
  else set.add(key);

  return serializeMissing(set);
}

/** ---------- Header filter helpers ---------- */

const FILTER_OPS = [
  { key: "contains", label: "contains" },
  { key: "not_contains", label: "not contains" },
  { key: "blank", label: "blank" },
  { key: "not_blank", label: "not blank" },
];

function normalizeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function isBlankValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "number") return Number.isNaN(v);
  const s = String(v).trim();
  return s.length === 0;
}

function containsCI(haystack, needle) {
  return normalizeStr(haystack)
    .toLowerCase()
    .includes(normalizeStr(needle).toLowerCase());
}

function getColumnValue(m, fieldKey) {
  switch (fieldKey) {
    case "actions":
      return "";
    case "electronicId":
      return m?.electronicId ?? "";
    case "accountNumber":
      return m?.accountNumber ?? "";
    case "meterSerialNumber":
      return m?.meterSerialNumber ?? "";
    case "customerName":
      return m?.customerName ?? "";
    case "address":
      return m?.address ?? "";
    case "route":
      return m?.route ?? "";
    case "latitude":
      return m?.latitude ?? "";
    case "longitude":
      return m?.longitude ?? "";
    case "meterSize":
      return m?.meterSize ?? "";
    case "numberOfPictures":
      return m?.numberOfPictures ?? "";
    case "locationNotes":
      return m?.locationNotes ?? "";
    case "assignedTo":
      return m?.assignedTo?.name
        ? `${m.assignedTo.name} ${m.assignedTo.email || ""}`.trim()
        : "";
    case "lastApprovedUpdateAt":
      return m?.lastApprovedUpdateAt ?? "";
    case "createdAt":
      return m?.createdAt ?? "";
    case "updatedAt":
      return m?.updatedAt ?? "";
    default:
      return m?.[fieldKey] ?? "";
  }
}

function applyOpToValue(op, value, q) {
  if (op === "blank") return isBlankValue(value);
  if (op === "not_blank") return !isBlankValue(value);

  const hit = containsCI(value, q);
  if (op === "contains") return hit;
  if (op === "not_contains") return !hit;

  return true;
}

function isActiveHeaderFilter(f) {
  if (!f) return false;
  if (f.op === "blank" || f.op === "not_blank") return true;
  return Boolean(String(f.value || "").trim());
}
function measureTextPx(text, font = "600 14px system-ui") {
  const canvas =
    measureTextPx._c || (measureTextPx._c = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  return Math.ceil(ctx.measureText(String(text ?? "")).width);
}

// Double-click behavior: shrink to fit the SMALLEST text on the current page
function autoShrinkColumn(colId) {
  const c = colById[colId];
  if (!c || c.disableResize) return;

  // Pull values from current page (cap to avoid doing too much work)
  const vals = metersFinal
    .slice(0, 200)
    .map((m) => normalizeStr(getColumnValue(m, colId)));

  // Prefer non-empty values; if all empty, just collapse to minimum
  const nonEmpty = vals.filter((v) => v.trim().length > 0);

  // Smallest width text (by actual pixel width, not string length)
  const smallestText = nonEmpty.length ? nonEmpty : vals;
  let minPx = Infinity;

  for (const v of smallestText) {
    const px = measureTextPx(v, "600 14px system-ui");
    if (px > 0 && px < minPx) minPx = px;
  }

  // If everything was blank, default to 0 width text
  if (!Number.isFinite(minPx)) minPx = 0;

  // Extra space for padding + icons area in the header (drag icon + filter icon)
  const extra =
    18 + // cell padding
    16 + // breathing room
    34 + // header drag icon/spacing area
    (c.filterKey ? 26 : 0);

  const minW = c.minWidth ?? 40; // allow it to get small
  const maxW = c.maxWidth ?? 900;

  const nextW = clamp(minPx + extra, minW, maxW);
  setColWidths((prev) => ({ ...prev, [colId]: nextW }));
}
function HeaderFilterPopover({
  fieldKey,
  label,
  value,
  onChange,
  onClear,
  disabled,
}) {
  const wrapRef = useRef(null);
  const popRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const [draft, setDraft] = useState(() => ({
    op: value?.op || "contains",
    value: value?.value || "",
  }));

  const active = isActiveHeaderFilter(value);

  useEffect(() => {
    if (!open) return;
    setDraft({
      op: value?.op || "contains",
      value: value?.value || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onDoc(e) {
      const t = e.target;
      const inButtonWrap = wrapRef.current && wrapRef.current.contains(t);
      const inPopover = popRef.current && popRef.current.contains(t);
      if (inButtonWrap || inPopover) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function updatePos() {
      if (!wrapRef.current) return;
      const btn = wrapRef.current.querySelector("button");
      if (!btn) return;

      const r = btn.getBoundingClientRect();
      const width = 260;

      setPos({
        top: r.bottom + 8,
        left: Math.max(8, r.right - width),
      });
    }

    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  function commitAndClose() {
    const next = { op: draft.op, value: draft.value };

    if (next.op === "blank" || next.op === "not_blank") {
      onChange({ op: next.op, value: "" });
      setOpen(false);
      return;
    }

    onChange(next);
    setOpen(false);
  }

  function clearAndClose() {
    onClear();
    setOpen(false);
  }

  return (
    <span
      ref={wrapRef}
      style={{
        display: "inline-flex",
        alignItems: "center",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="th-filter-btn"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((s) => !s);
        }}
        title={active ? `Filter active on ${label}` : `Filter ${label}`}
        style={{
          border: "1px solid rgba(255,255,255,0.18)",
          background: active
            ? "rgba(78,161,255,0.18)"
            : "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.9)",
          borderRadius: 10,
          padding: "2px 6px",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        ⌕
      </button>

      {open
        ? createPortal(
            <div
              ref={popRef}
              className="card th-filter-pop"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                zIndex: 99999,
                width: 260,
                padding: 10,
                background: "rgba(10,18,35,0.98)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAndClose();
                if (e.key === "Escape") setOpen(false);
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                {label} filter
              </div>

              <label className="field" style={{ marginBottom: 8 }}>
                <div className="field-label">Operator</div>
                <select
                  className="input"
                  disabled={disabled}
                  value={draft.op}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, op: e.target.value }))
                  }
                >
                  {FILTER_OPS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              {draft.op === "blank" || draft.op === "not_blank" ? null : (
                <label className="field" style={{ marginBottom: 8 }}>
                  <div className="field-label">Value</div>
                  <input
                    className="input"
                    disabled={disabled}
                    value={draft.value}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, value: e.target.value }))
                    }
                    placeholder="type…"
                    autoFocus
                  />
                </label>
              )}

              <div
                className="row"
                style={{ gap: 8, justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={clearAndClose}
                  disabled={disabled}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpen(false)}
                  disabled={disabled}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={commitAndClose}
                  disabled={disabled}
                >
                  Done
                </button>
              </div>

              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                Tip: Press <strong>Enter</strong> to apply, <strong>Esc</strong>{" "}
                to close.
              </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

/** ---------- Columns panel (hide/show + presets) ---------- */
function ColumnsPopover({
  columns,
  visibility,
  setVisibility,
  onReset,
  presetId,
  setPresetId,
  onApplyPreset,
}) {
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const list = columns.filter((c) => !c.disableHide);

  useEffect(() => {
    if (!open) return;

    function onDoc(e) {
      const t = e.target;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;

    const width = 300;
    setPos({
      top: r.bottom + 8,
      left: Math.max(8, r.right - width),
    });
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen((s) => !s)}
        title="Show/hide columns, presets, pinned columns"
      >
        Columns ▾
      </button>

      {open
        ? createPortal(
            <div
              ref={popRef}
              className="card"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                zIndex: 99999,
                width: 300,
                padding: 12,
                background: "rgba(10,18,35,0.98)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14,
                boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Columns</div>

              <label className="field" style={{ marginBottom: 10 }}>
                <div className="field-label">Preset</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    className="input"
                    value={presetId}
                    onChange={(e) => setPresetId(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="audit">Audit (all)</option>
                    <option value="encore">Encore Compact</option>
                    <option value="gps">GPS Cleanup</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onApplyPreset(presetId)}
                    title="Apply preset layout"
                  >
                    Apply
                  </button>
                </div>
                <div className="field-hint">
                  Pinned columns: Selection (admin), Actions, Electronic ID
                </div>
              </label>

              <div
                className="stack"
                style={{
                  gap: 8,
                  maxHeight: 280,
                  overflow: "auto",
                  paddingRight: 4,
                }}
              >
                {list.map((c) => (
                  <label
                    key={c.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibility[c.id] !== false}
                      onChange={(e) =>
                        setVisibility((prev) => ({
                          ...prev,
                          [c.id]: e.target.checked,
                        }))
                      }
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>

              <div
                className="row"
                style={{ gap: 8, justifyContent: "flex-end", marginTop: 12 }}
              >
                <button type="button" className="btn" onClick={onReset}>
                  Reset layout
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>

              <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                Tips: drag headers to reorder • drag header edge to resize •
                double-click edge to reset width.
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function MetersPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();
  const { search } = useLocation();
  const [urlSynced, setUrlSynced] = useState(false);

  const scopeKey = user?.activeCompanyId || user?.companyId || "noscope";
  const canAssign = role === "admin" || role === "superadmin";

  // Collapsible filters state (remembered)
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const v = localStorage.getItem("metersFiltersOpen");
    return v ? v === "1" : false;
  });
  useEffect(() => {
    localStorage.setItem("metersFiltersOpen", filtersOpen ? "1" : "0");
  }, [filtersOpen]);

  // Panel form (Apply-based)
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

  // Header filters: fieldKey -> { op, value }
  const [headerFilters, setHeaderFilters] = useState(() => ({
    electronicId: { op: "contains", value: "" },
    accountNumber: { op: "contains", value: "" },
    meterSerialNumber: { op: "contains", value: "" },
    customerName: { op: "contains", value: "" },
    address: { op: "contains", value: "" },
    route: { op: "contains", value: "" },
    latitude: { op: "contains", value: "" },
    longitude: { op: "contains", value: "" },
    meterSize: { op: "contains", value: "" },
    numberOfPictures: { op: "contains", value: "" },
    locationNotes: { op: "contains", value: "" },
    assignedTo: { op: "contains", value: "" },
    lastApprovedUpdateAt: { op: "contains", value: "" },
    createdAt: { op: "contains", value: "" },
    updatedAt: { op: "contains", value: "" },
  }));

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

  const metersRaw = useMemo(() => payload?.meters || [], [payload]);

  const total = payload?.count ?? 0;
  const limit = payload?.limit ?? applied.limit ?? 50;
  const currentPage = payload?.page ?? page;

  const startIndex = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(currentPage * limit, total);

  const [reloadKey, setReloadKey] = useState(0);

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

  // Sync from URL (?missing=latlng, ?q=..., ?limit=...)
  useEffect(() => {
    const sp = new URLSearchParams(search);

    const missing = sp.get("missing") || "";
    const q = sp.get("q") || "";
    const limitParam = sp.get("limit");
    const limitNum = limitParam ? Number(limitParam) : undefined;

    if (!missing && !q && !limitParam) {
      setUrlSynced(true);
      return;
    }

    const next = {
      ...form,
      missing,
      q,
      limit: Number.isFinite(limitNum) ? limitNum : form.limit,
    };

    setForm(next);
    applyNow(next);
    setFiltersOpen(true);
    setUrlSynced(true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function onApplyClicked() {
    applyNow({ ...form });
  }

  function toggleRowSelection(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pageMeterIds = useMemo(() => {
    return metersRaw.map((m) => getEntityId(m)).filter(Boolean);
  }, [metersRaw]);

  const selectedCount = selectedIds.size;

  const allOnPageSelected = useMemo(() => {
    if (pageMeterIds.length === 0) return false;
    for (const id of pageMeterIds) {
      if (!selectedIds.has(id)) return false;
    }
    return true;
  }, [pageMeterIds, selectedIds]);

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

    setHeaderFilters((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = { op: "contains", value: "" };
      }
      return next;
    });
  }

  function stopSummaryToggle(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /** Sorting: click header toggles asc/desc */
  function toggleSort(field) {
    if (!field) return;

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

  /** Build pills for panel + header filters */
  const filterPills = useMemo(() => {
    const pills = [];

    if (applied.missing)
      pills.push({ key: "missing", label: `Missing: ${applied.missing}` });
    if (applied.q) pills.push({ key: "q", label: `q: ${applied.q}` });

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
    if (applied.route)
      pills.push({ key: "route", label: `Route: ${applied.route}` });

    for (const [field, f] of Object.entries(headerFilters)) {
      if (!isActiveHeaderFilter(f)) continue;

      const label =
        field === "meterSerialNumber"
          ? "Serial #"
          : field === "customerName"
            ? "Customer"
            : field === "locationNotes"
              ? "Notes"
              : field === "numberOfPictures"
                ? "# Pics"
                : field === "assignedTo"
                  ? "Assigned"
                  : field;

      const op = f.op === "not_contains" ? "not contains" : f.op;

      const pillText =
        f.op === "blank" || f.op === "not_blank"
          ? `${label}: ${op}`
          : `${label}: ${op} "${f.value}"`;

      pills.push({ key: `hf:${field}`, label: pillText, hfField: field });
    }

    return pills;
  }, [applied, headerFilters]);

  function clearOnePill(pill) {
    if (pill?.hfField) {
      const field = pill.hfField;
      setHeaderFilters((prev) => ({
        ...prev,
        [field]: { op: "contains", value: "" },
      }));
      return;
    }

    const next = { ...form };
    if (pill.key === "q") next.q = "";
    if (pill.key === "missing") next.missing = "";
    if (pill.key === "electronicId") next.electronicId = "";
    if (pill.key === "accountNumber") next.accountNumber = "";
    if (pill.key === "address") next.address = "";
    if (pill.key === "route") next.route = "";

    setForm(next);
    applyNow(next);
  }

  // Clear selection when company scope changes
  useEffect(() => {
    setSelectedIds(new Set());
    setTechId("");
    setSuccess("");
    setError(null);
    setPage(1);
  }, [scopeKey]);

  // Esc clears error banner
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setError(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Load meters when applied filters or page changes
  useEffect(() => {
    if (!urlSynced) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const tableLimit = Math.min(
          200,
          Math.max(1, Number(applied.limit) || 50),
        );

        const serverParams = {
          page,
          includeAssignments: canAssign ? 1 : 0,
          limit: tableLimit,

          q: applied.q || undefined,
          missing: applied.missing || undefined,
          electronicId: applied.electronicId || undefined,
          accountNumber: applied.accountNumber || undefined,
          address: applied.address || undefined,
          route: applied.route || undefined,

          sortBy: applied.sortBy,
          sortDir: applied.sortDir,
        };

        // Optional: merge header contains filters into server call for supported fields
               // for (const [field, f] of Object.entries(headerFilters)) {
        //   if (!f) continue;
        //   if (f.op !== "contains") continue;
        //   if (!SERVER_CONTAINS_FILTERS.has(field)) continue;
        //   const v = String(f.value || "").trim();
        //   if (!v) continue;
        //   serverParams[field] = v;
        // }

        const data = await listMetersQuickApi(serverParams);
        setPayload(data);
      } catch (e) {
        if (
          e?.status === 400 &&
          String(e?.error || "").startsWith("No company scope selected") &&
          role === "superadmin"
        ) {
          nav("/settings");
          return;
        }
        setError(e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [urlSynced, page, applied, role, nav, canAssign, reloadKey]);

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

      setReloadKey((k) => k + 1);
      clearSelection();
    } catch (e) {
      setError(e);
    } finally {
      setAssignLoading(false);
    }
  }

  async function unassignSelected() {
    setSuccess("");
    setError(null);

    if (selectedIds.size === 0) {
      setError({ error: "Select at least one meter." });
      return;
    }

    setAssignLoading(true);
    try {
      const meterIds = Array.from(selectedIds);
      await unassignMetersApi({ meterIds });

      setSuccess(`Unassigned ${meterIds.length} meter(s).`);
      clearSelection();
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e);
    } finally {
      setAssignLoading(false);
    }
  }

  /** Client-side filtering for header filters */
  const metersFiltered = useMemo(() => {
    let out = metersRaw;

    const active = Object.entries(headerFilters).filter(([, f]) =>
      isActiveHeaderFilter(f),
    );
    if (active.length === 0) return out;

    out = out.filter((m) => {
      for (const [field, f] of active) {
        const val = getColumnValue(m, field);
        const q = f.op === "blank" || f.op === "not_blank" ? "" : f.value || "";
        const ok = applyOpToValue(f.op, val, q);
        if (!ok) return false;
      }
      return true;
    });

    return out;
  }, [metersRaw, headerFilters]);

  /** Client-side sort fallback (only if someone clicks a non-backend sort) */
  const metersFinal = useMemo(() => {
    const sortBy = applied.sortBy;
    const sortDir = applied.sortDir;

    if (SORTABLE_SET.has(sortBy)) return metersFiltered;

    const copy = [...metersFiltered];
    copy.sort((a, b) => {
      const av = normalizeStr(getColumnValue(a, sortBy));
      const bv = normalizeStr(getColumnValue(b, sortBy));
      const cmp = av.localeCompare(bv, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDir === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [metersFiltered, applied.sortBy, applied.sortDir]);

  /** ---------- Columns: config + prefs + presets + resize + reorder + pin ---------- */

  const COLS = useMemo(() => {
    const cols = [];

    if (canAssign) {
      cols.push({
        id: "select",
        label: "",
        width: 46,
        minWidth: 46,
        maxWidth: 46,
        disableHide: true,
        disableResize: true,
        disableReorder: true,
        pin: "left",
      });
    }

    cols.push({
      id: "actions",
      label: "Actions",
      width: 92,
      minWidth: 86,
      maxWidth: 140,
      disableHide: true,
      pin: "left", // ✅ pinned
    });

    cols.push({
      id: "electronicId",
      label: "Electronic ID",
      sortKey: "electronicId",
      filterKey: "electronicId",
      width: 150,
      minWidth: 130,
      maxWidth: 320,
      pin: "left", // ✅ pinned
    });

    cols.push({
      id: "accountNumber",
      label: "Account #",
      sortKey: "accountNumber",
      filterKey: "accountNumber",
      width: 130,
      minWidth: 120,
      maxWidth: 260,
    });

    cols.push({
      id: "meterSerialNumber",
      label: "Serial #",
      sortKey: "meterSerialNumber",
      filterKey: "meterSerialNumber",
      width: 120,
      minWidth: 110,
      maxWidth: 260,
    });

    cols.push({
      id: "customerName",
      label: "Customer",
      sortKey: "customerName",
      filterKey: "customerName",
      width: 160,
      minWidth: 140,
      maxWidth: 320,
    });

    cols.push({
      id: "address",
      label: "Address",
      sortKey: "address",
      filterKey: "address",
      width: 240,
      minWidth: 180,
      maxWidth: 560,
    });

    cols.push({
      id: "route",
      label: "Route",
      sortKey: "route",
      filterKey: "route",
      width: 90,
      minWidth: 80,
      maxWidth: 160,
    });

    cols.push({
      id: "latitude",
      label: "Lat",
      filterKey: "latitude",
      width: 110,
      minWidth: 90,
      maxWidth: 180,
    });

    cols.push({
      id: "longitude",
      label: "Lng",
      filterKey: "longitude",
      width: 110,
      minWidth: 90,
      maxWidth: 180,
    });

    cols.push({
      id: "meterSize",
      label: "Meter Size",
      sortKey: "meterSize",
      filterKey: "meterSize",
      width: 110,
      minWidth: 90,
      maxWidth: 200,
    });

    cols.push({
      id: "numberOfPictures",
      label: "# Pics",
      sortKey: "numberOfPictures",
      filterKey: "numberOfPictures",
      width: 80,
      minWidth: 70,
      maxWidth: 140,
    });

    cols.push({
      id: "locationNotes",
      label: "Notes",
      filterKey: "locationNotes",
      width: 260,
      minWidth: 180,
      maxWidth: 700,
    });

    cols.push({
      id: "assignedTo",
      label: "Assigned To",
      filterKey: "assignedTo",
      width: 220,
      minWidth: 180,
      maxWidth: 460,
    });

    // Optional “audit” columns (you already support sorting server-side)
    cols.push({
      id: "lastApprovedUpdateAt",
      label: "Last Approved",
      sortKey: "lastApprovedUpdateAt",
      filterKey: "lastApprovedUpdateAt",
      width: 150,
      minWidth: 130,
      maxWidth: 260,
    });

    cols.push({
      id: "createdAt",
      label: "Created",
      sortKey: "createdAt",
      filterKey: "createdAt",
      width: 150,
      minWidth: 130,
      maxWidth: 260,
    });

    cols.push({
      id: "updatedAt",
      label: "Updated",
      sortKey: "updatedAt",
      filterKey: "updatedAt",
      width: 150,
      minWidth: 130,
      maxWidth: 260,
    });

    return cols;
  }, [canAssign]);

  const colById = useMemo(
    () => Object.fromEntries(COLS.map((c) => [c.id, c])),
    [COLS],
  );

  const tablePrefsKey = useMemo(
    () =>
      `metersTablePrefs:v2:${scopeKey}:${role || "unknown"}:${canAssign ? "admin" : "tech"}`,
    [scopeKey, role, canAssign],
  );

  const defaultOrder = useMemo(() => COLS.map((c) => c.id), [COLS]);

  // default visibility keeps your current UI (everything on)
  const defaultVisibility = useMemo(() => {
    const v = {};
    for (const c of COLS) v[c.id] = true;

    // Make audit columns hidden by default (you can show via preset)
    v.lastApprovedUpdateAt = false;
    v.createdAt = false;
    v.updatedAt = false;

    return v;
  }, [COLS]);

  const defaultWidths = useMemo(() => {
    const w = {};
    for (const c of COLS) w[c.id] = c.width ?? 160;
    return w;
  }, [COLS]);

  const [colOrder, setColOrder] = useState(defaultOrder);
  const [colVisibility, setColVisibility] = useState(defaultVisibility);
  const [colWidths, setColWidths] = useState(defaultWidths);

  // Preset selector state (UI)
  const [presetId, setPresetId] = useState("audit");

  // Load prefs per role/scope
  useEffect(() => {
    const saved = loadTablePrefs(tablePrefsKey);
    if (!saved) {
      setColOrder(defaultOrder);
      setColVisibility(defaultVisibility);
      setColWidths(defaultWidths);
      return;
    }

    const ids = new Set(defaultOrder);

    const order = Array.isArray(saved.order)
      ? saved.order.filter((id) => ids.has(id))
      : [];
    for (const id of defaultOrder) if (!order.includes(id)) order.push(id);

    const visibility = { ...defaultVisibility, ...(saved.visibility || {}) };
    for (const c of COLS) if (c.disableHide) visibility[c.id] = true;

    const widths = { ...defaultWidths, ...(saved.widths || {}) };
    for (const c of COLS) {
      const minW = c.minWidth ?? 60;
      const maxW = c.maxWidth ?? 900;
      widths[c.id] = clamp(
        Number(widths[c.id] || defaultWidths[c.id]),
        minW,
        maxW,
      );
    }

    setColOrder(order);
    setColVisibility(visibility);
    setColWidths(widths);
  }, [tablePrefsKey, COLS, defaultOrder, defaultVisibility, defaultWidths]);

  // Save prefs
  useEffect(() => {
    saveTablePrefs(tablePrefsKey, {
      order: colOrder,
      visibility: colVisibility,
      widths: colWidths,
    });
  }, [tablePrefsKey, colOrder, colVisibility, colWidths]);

  const visibleCols = useMemo(() => {
    return colOrder
      .map((id) => colById[id])
      .filter(Boolean)
      .filter((c) => (c.disableHide ? true : colVisibility[c.id] !== false));
  }, [colOrder, colById, colVisibility]);

  // Sticky/pinned left offsets (Actions + EID pinned; Selection pinned too for admin)
  const stickyLeftById = useMemo(() => {
    let left = 0;
    const map = {};
    for (const c of visibleCols) {
      if (c.pin === "left") {
        map[c.id] = left;
        left += Number(colWidths[c.id] ?? c.width ?? 160);
      }
    }
    return map;
  }, [visibleCols, colWidths]);

  function stickyStylesFor(colId, isHeader) {
    const left = stickyLeftById[colId];
    if (left === undefined) return null;

    return {
      position: "sticky",
      left,
      zIndex: isHeader ? 8 : 3,
      background: isHeader
        ? "rgba(10, 18, 35, 0.95)"
        : "rgba(10, 18, 35, 0.88)",
      backdropFilter: "blur(6px)",
      boxShadow: "1px 0 0 rgba(255,255,255,0.06)",
    };
  }

  // Column resize
  function startResize(colId, e) {
    e.preventDefault();
    e.stopPropagation();

    const c = colById[colId];
    if (!c || c.disableResize) return;

    const startX = e.clientX;
    const startW = Number(colWidths[colId] || c.width || 160);
    const minW = c.minWidth ?? 25;
    const maxW = c.maxWidth ?? 900;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const next = clamp(startW + dx, minW, maxW);
      setColWidths((prev) => ({ ...prev, [colId]: next }));
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function resetWidth(colId) {
    const c = colById[colId];
    if (!c) return;
    setColWidths((prev) => ({ ...prev, [colId]: c.width ?? prev[colId] }));
  }

  // Column reorder (drag headers)
  const [dragColId, setDragColId] = useState("");

  function onDragStartCol(colId, e) {
    const c = colById[colId];
    if (!c || c.disableReorder) return;
    setDragColId(colId);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDropCol(targetId) {
    if (!dragColId || dragColId === targetId) return;
    setColOrder((prev) => moveItem(prev, dragColId, targetId));
    setDragColId("");
  }

  // Presets: order + visibility + widths
  function applyPreset(nextPresetId) {
    const allIds = COLS.map((c) => c.id);

    // helpers
    const makeVisibility = (showIds) => {
      const v = {};
      for (const id of allIds) v[id] = showIds.includes(id);
      // force not hideable columns
      for (const c of COLS) if (c.disableHide) v[c.id] = true;
      return v;
    };

    // Default order (pinned cols first, then the rest)
    const baseOrder = (ids) => {
      // keep pinned at very front in their current presence
      const pinned = ids.filter((id) => colById[id]?.pin === "left");
      const rest = ids.filter((id) => colById[id]?.pin !== "left");
      return [...pinned, ...rest];
    };

    if (nextPresetId === "encore") {
      // compact ops table (like Encore: main identifiers + routing + gps + size + pics)
      const show = [
        ...(canAssign ? ["select"] : []),
        "actions",
        "electronicId",
        "accountNumber",
        "meterSerialNumber",
        "customerName",
        "address",
        "route",
        "latitude",
        "longitude",
        "meterSize",
        "numberOfPictures",
      ];

      setColVisibility(makeVisibility(show));
      setColOrder(baseOrder(show));
      setColWidths((prev) => ({
        ...prev,
        address: 280,
        customerName: 180,
        meterSerialNumber: 130,
      }));
      setPresetId("encore");
      return;
    }

    if (nextPresetId === "gps") {
      // GPS cleanup: focus on location fields + route
      const show = [
        ...(canAssign ? ["select"] : []),
        "actions",
        "electronicId",
        "accountNumber",
        "customerName",
        "address",
        "route",
        "latitude",
        "longitude",
        "locationNotes",
        "numberOfPictures",
        "lastApprovedUpdateAt",
      ];

      setColVisibility(makeVisibility(show));
      setColOrder(baseOrder(show));
      setColWidths((prev) => ({
        ...prev,
        address: 320,
        locationNotes: 320,
      }));
      setPresetId("gps");
      return;
    }

    // audit (all — but keep the “audit columns” visible)
    const show = [
      ...(canAssign ? ["select"] : []),
      "actions",
      "electronicId",
      "accountNumber",
      "meterSerialNumber",
      "customerName",
      "address",
      "route",
      "latitude",
      "longitude",
      "meterSize",
      "numberOfPictures",
      "locationNotes",
      "assignedTo",
      "lastApprovedUpdateAt",
      "createdAt",
      "updatedAt",
    ];

    setColVisibility(makeVisibility(show));
    setColOrder(baseOrder(show));
    setColWidths((prev) => ({
      ...prev,
      address: 320,
      locationNotes: 360,
      assignedTo: 240,
    }));
    setPresetId("audit");
  }

  function resetLayout() {
    setColOrder(defaultOrder);
    setColVisibility(defaultVisibility);
    setColWidths(defaultWidths);
    setPresetId("audit");
  }

  const hasFiltersApplied = filterPills.length > 0;

  return (
    <div className="stack">
      {/* ---------- COLLAPSIBLE FILTER PANEL ---------- */}
      <details
        className="card meters-filter-panel filters"
        open={filtersOpen}
        onToggle={(e) => setFiltersOpen(e.currentTarget.open)}
      >
        <summary className="filters-summary">
          <div className="filters-summary-left">
            <div className="filters-title">Meters</div>

            <div className="filters-chips">
              {filterPills.length ? (
                <>
                  {filterPills.slice(0, 3).map((p, i) => (
                    <span className="pill pill-static" key={`${p.key}-${i}`}>
                      {p.label}
                    </span>
                  ))}
                  {filterPills.length > 3 ? (
                    <span className="pill pill-static">
                      +{filterPills.length - 3} more
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="muted">No filters applied</span>
              )}
            </div>
          </div>

          <div className="filters-summary-right" onClick={stopSummaryToggle}>
            <button
              type="button"
              className="btn"
              onClick={onApplyClicked}
              disabled={false}
              title="Apply current filter form"
            >
              Apply
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={clearFilters}
              disabled={false}
              title="Reset filters"
            >
              Clear
            </button>

            <span className="filters-caret" aria-hidden="true">
              ▾
            </span>
          </div>
        </summary>

        <div className="filters-body">
          <div className="grid grid-3" style={{ marginTop: 12 }}>
            <label className="field">
              <div className="field-label">Meters page search (optional)</div>
              <input
                className="input"
                value={form.q}
                onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
                disabled={false}
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
                      disabled={false}
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
                    disabled={false}
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
                  setForm((f) => ({
                    ...f,
                    limit: Number(e.target.value) || 50,
                  }))
                }
                disabled={false}
              />
              <div className="field-hint">Max 200</div>
            </label>
          </div>

          <div className="grid grid-3" style={{ marginTop: 12 }}>
            <label className="field">
              <div className="field-label">Highlight recently approved</div>
              <select
                className="input"
                value={highlightWindow}
                onChange={(e) => setHighlightWindow(e.target.value)}
                disabled={false}
              >
                <option value="off">off</option>
                <option value="1h">last 1 hour</option>
                <option value="24h">last 24 hours</option>
                <option value="7d">last 7 days</option>
                <option value="30d">last 30 days</option>
              </select>
              <div className="field-hint" />
            </label>

            <div className="field">
              <div className="field-label">Header filters</div>
              <div className="muted" style={{ paddingTop: 10 }}>
                Use the <strong>⌕</strong> icon in column headers for contains /
                not contains / blank / not blank.
              </div>
              <div className="field-hint" />
            </div>

            <div className="field">
              <div className="field-label">Sort</div>
              <div className="muted" style={{ paddingTop: 10 }}>
                Click sortable column headers to sort (asc/desc).
              </div>
              <div className="field-hint" />
            </div>
          </div>
        </div>
      </details>

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
                  Selected: <strong>{selectedCount}</strong>
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
                  className="btn btn-ghost"
                  type="button"
                  onClick={unassignSelected}
                  disabled={assignLoading || selectedCount === 0}
                >
                  Unassign selected
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

          {/* Pills */}
          {filterPills.length ? (
            <div className="pill-row" style={{ marginBottom: 10 }}>
              {filterPills.map((p, idx) => (
                <button
                  key={`${p.key}-${idx}`}
                  type="button"
                  className="pill"
                  onClick={() => clearOnePill(p)}
                  title="Remove filter"
                  disabled={false}
                >
                  {p.label} <span className="pill-x">✕</span>
                </button>
              ))}
            </div>
          ) : null}

          <div
            className="meters-meta"
            style={{
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span className="muted">
              Showing <strong>{startIndex}</strong>–<strong>{endIndex}</strong>{" "}
              of <strong>{total}</strong>
            </span>
            {hasFiltersApplied ? (
              <span className="muted"> • Filters applied</span>
            ) : (
              <span className="muted"> • No filters</span>
            )}
            {metersFinal.length !== metersRaw.length ? (
              <span className="muted">
                {" "}
                • Header filters matched <strong>
                  {metersFinal.length}
                </strong>{" "}
                on this page
              </span>
            ) : null}

            <div style={{ marginLeft: "auto" }}>
              <ColumnsPopover
                columns={COLS}
                visibility={colVisibility}
                setVisibility={setColVisibility}
                onReset={resetLayout}
                presetId={presetId}
                setPresetId={setPresetId}
                onApplyPreset={applyPreset}
              />
            </div>
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

          {metersFinal.length === 0 ? (
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

          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table
              className="table meters-table"
              style={{
                tableLayout: "fixed",
                width: "max-content",
                minWidth: "100%",
              }}
            >
              <thead>
                <tr>
                  {visibleCols.map((c) => {
                    const w = Number(colWidths[c.id] ?? c.width ?? 160);

                    const thBaseStyle = {
                      width: w,
                      minWidth: c.minWidth,
                      maxWidth: c.maxWidth,
                      userSelect: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      ...(stickyStylesFor(c.id, true) || {}),
                    };

                    const isSortable =
                      Boolean(c.sortKey) && SORTABLE_SET.has(c.sortKey);

                    return (
                      <th
                        key={c.id}
                        style={thBaseStyle}
                        onDragOver={(e) => {
                          if (dragColId && dragColId !== c.id)
                            e.preventDefault();
                        }}
                        onDrop={() => onDropCol(c.id)}
                        title={
                          c.pin === "left"
                            ? "Pinned"
                            : "Drag to reorder • drag edge to resize"
                        }
                      >
                        <div
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            paddingRight: c.disableResize ? 0 : 10,
                          }}
                        >
                          {/* drag handle */}
                          {!c.disableReorder ? (
                            <span
                              draggable
                              onDragStart={(e) => onDragStartCol(c.id, e)}
                              style={{
                                cursor: "grab",
                                opacity: 0.7,
                                fontSize: 14,
                                lineHeight: 1,
                              }}
                              title="Drag to reorder"
                              onClick={(e) => e.stopPropagation()}
                            >
                              ⠿
                            </span>
                          ) : (
                            <span style={{ width: 14 }} />
                          )}

                          {/* header content */}
                          {c.id === "select" ? (
                            <input
                              type="checkbox"
                              checked={allOnPageSelected}
                              onChange={toggleSelectAllOnPage}
                              title="Select all meters on this page"
                            />
                          ) : c.id === "actions" ? (
                            <span style={{ fontWeight: 800 }}>Actions</span>
                          ) : isSortable ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(c.sortKey)}
                              className="th-sort-btn"
                              style={{
                                background: "transparent",
                                border: 0,
                                padding: 0,
                                color: "rgba(255,255,255,0.92)",
                                cursor: "pointer",
                                fontWeight: 800,
                                textAlign: "left",
                              }}
                              title="Click to sort"
                            >
                              {c.label}
                              {sortGlyph(c.sortKey)}
                            </button>
                          ) : (
                            <span style={{ fontWeight: 800 }}>{c.label}</span>
                          )}

                          {/* filter */}
                          {c.filterKey ? (
                            <HeaderFilterPopover
                              fieldKey={c.filterKey}
                              label={c.label}
                              value={headerFilters[c.filterKey]}
                              disabled={false}
                              onChange={(next) =>
                                setHeaderFilters((p) => ({
                                  ...p,
                                  [c.filterKey]: next,
                                }))
                              }
                              onClear={() =>
                                setHeaderFilters((p) => ({
                                  ...p,
                                  [c.filterKey]: { op: "contains", value: "" },
                                }))
                              }
                            />
                          ) : null}

                          {/* resize handle */}
                          {!c.disableResize ? (
                            <div
                              className="col-resize-affordance"
                              onMouseDown={(e) => startResize(c.id, e)}
                              onDoubleClick={() => autoShrinkColumn(c.id)}
                              title="Drag to resize • double-click to shrink to fit"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : null}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {metersFinal.map((m, idx) => {
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
                      {visibleCols.map((c) => {
                        const tdBaseStyle = {
                          width: Number(colWidths[c.id] ?? c.width ?? 160),
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          ...(stickyStylesFor(c.id, false) || {}),
                        };

                        // cell render
                        if (c.id === "select") {
                          return (
                            <td key={`${rowKey}:select`} style={tdBaseStyle}>
                              {mid ? (
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleRowSelection(mid)}
                                  title="Select meter"
                                />
                              ) : null}
                            </td>
                          );
                        }

                        if (c.id === "actions") {
                          return (
                            <td key={`${rowKey}:actions`} style={tdBaseStyle}>
                              {mid ? (
                                <Link
                                  to={`/meters/${encodeURIComponent(mid)}/updates`}
                                >
                                  Update
                                </Link>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                          );
                        }

                        if (c.id === "electronicId") {
                          return (
                            <td key={`${rowKey}:eid`} style={tdBaseStyle}>
                              {mid ? (
                                <Link to={`/meters/${encodeURIComponent(mid)}`}>
                                  {m?.electronicId ?? "—"}
                                </Link>
                              ) : (
                                (m?.electronicId ?? "—")
                              )}
                            </td>
                          );
                        }

                        if (c.id === "locationNotes") {
                          return (
                            <td
                              key={`${rowKey}:notes`}
                              style={{
                                ...tdBaseStyle,
                                whiteSpace: "normal",
                                lineHeight: 1.25,
                              }}
                            >
                              {m?.locationNotes ?? ""}
                            </td>
                          );
                        }

                        if (c.id === "assignedTo") {
                          return (
                            <td
                              key={`${rowKey}:assigned`}
                              style={{ ...tdBaseStyle, whiteSpace: "normal" }}
                            >
                              {m?.assignedTo?.name ? (
                                <>
                                  <div>{m.assignedTo.name}</div>
                                  <div
                                    className="muted"
                                    style={{ fontSize: 12 }}
                                  >
                                    {m.assignedTo.email}
                                  </div>
                                </>
                              ) : (
                                <span className="muted">Unassigned</span>
                              )}
                            </td>
                          );
                        }

                        const val = getColumnValue(m, c.id);
                        return (
                          <td key={`${rowKey}:${c.id}`} style={tdBaseStyle}>
                            {normalizeStr(val)}
                          </td>
                        );
                      })}
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
