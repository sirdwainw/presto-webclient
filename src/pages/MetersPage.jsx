// src/pages/MetersPage.jsx
// Full replacement: sortable + header-filterable columns with ops:
// contains / not contains / blank / not blank
//
// Notes:
// - Backend supports server-side "contains" filters for: electronicId, accountNumber, address, route
// - Everything else (and ops not supported by backend) is applied client-side on the current page of results.
// - Sorting: uses backend sort for allowed fields; falls back to client-side sort if needed.
// - Filters panel remains collapsible; sort dropdown removed to save space.
// - Missing chips still auto-apply.
// - Assignment toolbar stays above the table.

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./MetersPage.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { listMetersQuickApi } from "../api/meters.api";
import {
  listAssignableTechsApi,
  postAssignments,
  unassignMetersApi
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
  if (typeof v === "number") return Number.isNaN(v); // rare
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

  // contains / not_contains
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

  // Local draft so typing doesn't "apply" instantly
  const [draft, setDraft] = useState(() => ({
    op: value?.op || "contains",
    value: value?.value || "",
  }));

  const active = isActiveHeaderFilter(value);

  // When opening (or when upstream value changes), sync draft from value
  useEffect(() => {
    if (!open) return;
    setDraft({
      op: value?.op || "contains",
      value: value?.value || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click (must include portal)
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

  // Position (relative to the filter button)
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
    // Commit draft to parent
    const next = { op: draft.op, value: draft.value };

    // For blank/not_blank, ignore value
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
      className="th-wrap"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
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

  // Panel form (Apply-based) — keep minimal (global q is optional since you moved global search to AppLayout)
  const [form, setForm] = useState(() => ({
    q: "",
    limit: 50,
    missing: "",
    // keep these for server-side contains filters if you want to still use panel fields
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
const reloadMeters = () => setReloadKey((k) => k + 1);
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
useEffect(() => {
  const sp = new URLSearchParams(search);

  const missing = sp.get("missing") || "";
  const q = sp.get("q") || "";
  const limitParam = sp.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  // If URL has no relevant params, still allow initial load
  if (!missing && !q && !limitParam) {
    setUrlSynced(true);
    return;
  }

  const next = {
    ...form,
    missing,
    q,
    limit: Number.isFinite(limit) ? limit : form.limit,
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

    // Clear header filters too
    setHeaderFilters((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = { ...next[k], value: "", op: next[k]?.op || "contains" };
      }
      return next;
    });
  }

  function stopSummaryToggle(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /** Sorting: click column header toggles asc/desc */
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

    // Panel column filters (server)
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

    // Header filters
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
    // Header filter pill?
    if (pill?.hfField) {
      const field = pill.hfField;
      setHeaderFilters((prev) => ({
        ...prev,
        [field]: {
          ...(prev[field] || { op: "contains", value: "" }),
          value: "",
          op: "contains",
        },
      }));
      return;
    }

    // Panel pills
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
        // Merge server-side column filters:
        // - We always send panel filters as-is (contains).
        // - We ALSO send header filters only when:
        //   - op === "contains"
        //   - and field is one of the backend-supported contains params
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
        // for (const [field, f] of Object.entries(headerFilters)) {
        // if (!f) continue;
        //if (f.op !== "contains") continue;
        //if (!SERVER_CONTAINS_FILTERS.has(field)) continue;
        // const v = String(f.value || "").trim();
        //if (!v) continue;
        //serverParams[field] = v;
        //}

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

    // if you added reloadKey earlier:
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

    // If backend can sort it, it already did; return as-is.
    if (SORTABLE_SET.has(sortBy)) return metersFiltered;

    // Fallback: sort locally
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
                Click column headers to sort (asc/desc).
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
            {metersFinal.length !== metersRaw.length ? (
              <span className="muted">
                {" "}
                • Header filters matched <strong>
                  {metersFinal.length}
                </strong>{" "}
                on this page
              </span>
            ) : null}
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

                  {/* Electronic ID */}
                  <th
                    className={`sortable ${isActiveHeaderFilter(headerFilters.electronicId) ? "is-filtered" : ""}`}
                    onClick={() => toggleSort("electronicId")}
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Electronic ID{sortGlyph("electronicId")}
                      <HeaderFilterPopover
                        fieldKey="electronicId"
                        label="Electronic ID"
                        value={headerFilters.electronicId}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({
                            ...p,
                            electronicId: next,
                          }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            electronicId: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* Account # */}
                  <th
                    className="sortable"
                    onClick={() => toggleSort("accountNumber")}
                    title="Click to sort"
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Account #{sortGlyph("accountNumber")}
                      <HeaderFilterPopover
                        fieldKey="accountNumber"
                        label="Account #"
                        value={headerFilters.accountNumber}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({
                            ...p,
                            accountNumber: next,
                          }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            accountNumber: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* Serial # */}
                  <th
                    className="sortable"
                    onClick={() => toggleSort("meterSerialNumber")}
                    title="Click to sort"
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Serial #{sortGlyph("meterSerialNumber")}
                      <HeaderFilterPopover
                        fieldKey="meterSerialNumber"
                        label="Serial #"
                        value={headerFilters.meterSerialNumber}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({
                            ...p,
                            meterSerialNumber: next,
                          }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            meterSerialNumber: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* Customer */}
                  <th
                    className="sortable"
                    onClick={() => toggleSort("customerName")}
                    title="Click to sort"
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Customer{sortGlyph("customerName")}
                      <HeaderFilterPopover
                        fieldKey="customerName"
                        label="Customer"
                        value={headerFilters.customerName}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({
                            ...p,
                            customerName: next,
                          }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            customerName: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* Address */}
                  <th
                    className="sortable"
                    onClick={() => toggleSort("address")}
                    title="Click to sort"
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Address{sortGlyph("address")}
                      <HeaderFilterPopover
                        fieldKey="address"
                        label="Address"
                        value={headerFilters.address}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({ ...p, address: next }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            address: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* Route */}
                  <th
                    className="sortable"
                    onClick={() => toggleSort("route")}
                    title="Click to sort"
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Route{sortGlyph("route")}
                      <HeaderFilterPopover
                        fieldKey="route"
                        label="Route"
                        value={headerFilters.route}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({ ...p, route: next }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            route: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* Lat / Lng */}
                  <th
                    title="Click to sort"
                    className="sortable"
                    onClick={() => toggleSort("latitude")}
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Lat{sortGlyph("latitude")}
                      <HeaderFilterPopover
                        fieldKey="latitude"
                        label="Lat"
                        value={headerFilters.latitude}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({ ...p, latitude: next }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            latitude: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  <th
                    title="Click to sort"
                    className="sortable"
                    onClick={() => toggleSort("longitude")}
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Lng{sortGlyph("longitude")}
                      <HeaderFilterPopover
                        fieldKey="longitude"
                        label="Lng"
                        value={headerFilters.longitude}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({ ...p, longitude: next }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            longitude: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* Meter Size */}
                  <th
                    className="sortable"
                    onClick={() => toggleSort("meterSize")}
                    title="Click to sort"
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Meter Size{sortGlyph("meterSize")}
                      <HeaderFilterPopover
                        fieldKey="meterSize"
                        label="Meter Size"
                        value={headerFilters.meterSize}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({ ...p, meterSize: next }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            meterSize: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* # Pics */}
                  <th
                    className="sortable"
                    onClick={() => toggleSort("numberOfPictures")}
                    title="Click to sort"
                  >
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      # Pics{sortGlyph("numberOfPictures")}
                      <HeaderFilterPopover
                        fieldKey="numberOfPictures"
                        label="# Pics"
                        value={headerFilters.numberOfPictures}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({
                            ...p,
                            numberOfPictures: next,
                          }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            numberOfPictures: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* Notes */}
                  <th title="Notes">
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Notes
                      <HeaderFilterPopover
                        fieldKey="locationNotes"
                        label="Notes"
                        value={headerFilters.locationNotes}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({
                            ...p,
                            locationNotes: next,
                          }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            locationNotes: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>

                  {/* Assigned To */}
                  <th title="Assigned">
                    <span
                      className="th-head"
                      style={{
                        onClick: (e) => e.stopPropagation(),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      Assigned To
                      <HeaderFilterPopover
                        fieldKey="assignedTo"
                        label="Assigned"
                        value={headerFilters.assignedTo}
                        disabled={false}
                        onChange={(next) =>
                          setHeaderFilters((p) => ({ ...p, assignedTo: next }))
                        }
                        onClear={() =>
                          setHeaderFilters((p) => ({
                            ...p,
                            assignedTo: { op: "contains", value: "" },
                          }))
                        }
                      />
                    </span>
                  </th>
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

                      <td>
                        {mid ? (
                          <div className="row" style={{ gap: 10 }}>
                            <Link
                              to={`/meters/${encodeURIComponent(mid)}/updates`}
                            >
                              Update
                            </Link>
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>

                      <td>
                        {mid ? (
                          <Link to={`/meters/${encodeURIComponent(mid)}`}>
                            {m?.electronicId ?? "—"}
                          </Link>
                        ) : (
                          (m?.electronicId ?? "—")
                        )}
                      </td>

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

                      <td className="assigned-wrap">
                        {m?.assignedTo?.name ? (
                          <>
                            <div>{m.assignedTo.name}</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {m.assignedTo.email}
                            </div>
                          </>
                        ) : (
                          <span className="muted">Unassigned</span>
                        )}
                      </td>
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
