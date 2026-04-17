import React, { useEffect, useMemo, useState } from "react";
import "./MetersPage.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { useDataGrid } from "../components/data-grid/useDataGrid";
import { useDataGridLayout } from "../components/data-grid/useDataGridLayout";
import { DataGrid } from "../components/data-grid/DataGrid";
import { ColumnChooser } from "../components/data-grid/ColumnChooser";

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

function normalizeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function getColumnValue(m, fieldKey) {
  switch (fieldKey) {
    case "actions":
      return "";
    case "select":
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

export function MetersPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();
  const { search } = useLocation();

  const [urlSynced, setUrlSynced] = useState(false);

  const scopeKey = user?.activeCompanyId || user?.companyId || "noscope";
  const canAssign = role === "admin" || role === "superadmin";

  const [filtersOpen, setFiltersOpen] = useState(() => {
    const v = localStorage.getItem("metersFiltersOpen");
    return v ? v === "1" : false;
  });

  useEffect(() => {
    localStorage.setItem("metersFiltersOpen", filtersOpen ? "1" : "0");
  }, [filtersOpen]);

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

  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [techs, setTechs] = useState([]);
  const [techLoading, setTechLoading] = useState(false);
  const [techId, setTechId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  const metersRaw = useMemo(() => payload?.meters || [], [payload]);

  const total = payload?.count ?? 0;
  const limit = payload?.limit ?? applied.limit ?? 50;
  const currentPage = payload?.page ?? page;

  const startIndex = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(currentPage * limit, total);

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

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function stopSummaryToggle(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function toggleServerSort(field) {
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

  function clearAllFilters() {
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
    grid.clearFilters();
  }

  useEffect(() => {
    setSelectedIds(new Set());
    setTechId("");
    setSuccess("");
    setError(null);
    setPage(1);
  }, [scopeKey]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setError(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const columns = useMemo(() => {
    const cols = [];

    if (canAssign) {
      cols.push({
        key: "select",
        label: "",
        width: 46,
        minWidth: 46,
        maxWidth: 46,
        disableHide: true,
        disableResize: true,
        disableReorder: true,
        filterable: false,
        sortable: false,
        pin: "left",
        render: (row) => {
          const mid = getEntityId(row);
          const selected = mid ? selectedIds.has(mid) : false;
          return mid ? (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => toggleRowSelection(mid)}
              title="Select meter"
            />
          ) : null;
        },
      });
    }

    cols.push({
      key: "actions",
      label: "Actions",
      width: 92,
      minWidth: 70,
      maxWidth: 140,
      disableHide: true,
      filterable: false,
      sortable: false,
      pin: "left",
      getAutoSizeValue: () => "Update",
      render: (row) => {
        const mid = getEntityId(row);
        return mid ? (
          <Link to={`/meters/${encodeURIComponent(mid)}/updates`}>Update</Link>
        ) : (
          <span className="muted">—</span>
        );
      },
    });

    cols.push({
      key: "electronicId",
      label: "Electronic ID",
      sortable: true,
      filterable: true,
      width: 150,
      minWidth: 56,
      maxWidth: 320,
      pin: "left",
      render: (row) => {
        const mid = getEntityId(row);
        return mid ? (
          <Link to={`/meters/${encodeURIComponent(mid)}`}>
            {row?.electronicId ?? "—"}
          </Link>
        ) : (
          (row?.electronicId ?? "—")
        );
      },
    });

    cols.push({
      key: "accountNumber",
      label: "Account #",
      sortable: true,
      filterable: true,
      width: 130,
      minWidth: 56,
      maxWidth: 260,
    });

    cols.push({
      key: "meterSerialNumber",
      label: "Serial #",
      sortable: true,
      filterable: true,
      width: 120,
      minWidth: 56,
      maxWidth: 260,
    });

    cols.push({
      key: "customerName",
      label: "Customer",
      sortable: true,
      filterable: true,
      width: 170,
      minWidth: 72,
      maxWidth: 320,
    });

    cols.push({
      key: "address",
      label: "Address",
      sortable: true,
      filterable: true,
      width: 240,
      minWidth: 80,
      maxWidth: 560,
    });

    cols.push({
      key: "route",
      label: "Route",
      sortable: true,
      filterable: true,
      width: 90,
      minWidth: 42,
      maxWidth: 160,
    });

    cols.push({
      key: "latitude",
      label: "Lat",
      sortable: false,
      filterable: true,
      width: 110,
      minWidth: 56,
      maxWidth: 180,
    });

    cols.push({
      key: "longitude",
      label: "Lng",
      sortable: false,
      filterable: true,
      width: 110,
      minWidth: 56,
      maxWidth: 180,
    });

    cols.push({
      key: "meterSize",
      label: "Meter Size",
      sortable: true,
      filterable: true,
      width: 110,
      minWidth: 56,
      maxWidth: 200,
    });

    cols.push({
      key: "numberOfPictures",
      label: "# Pics",
      sortable: true,
      filterable: true,
      width: 80,
      minWidth: 42,
      maxWidth: 140,
    });

    cols.push({
      key: "locationNotes",
      label: "Notes",
      sortable: false,
      filterable: true,
      width: 260,
      minWidth: 80,
      maxWidth: 700,
      render: (row) => row?.locationNotes ?? "",
    });

    cols.push({
      key: "assignedTo",
      label: "Assigned To",
      sortable: false,
      filterable: true,
      width: 220,
      minWidth: 80,
      maxWidth: 460,
      render: (row) =>
        row?.assignedTo?.name ? (
          <>
            <div>{row.assignedTo.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {row.assignedTo.email}
            </div>
          </>
        ) : (
          <span className="muted">Unassigned</span>
        ),
      getValue: (row) =>
        row?.assignedTo?.name
          ? `${row.assignedTo.name} ${row.assignedTo.email || ""}`.trim()
          : "",
    });

    cols.push({
      key: "lastApprovedUpdateAt",
      label: "Last Approved",
      sortable: true,
      filterable: true,
      defaultVisible: false,
      width: 150,
      minWidth: 72,
      maxWidth: 260,
    });

    cols.push({
      key: "createdAt",
      label: "Created",
      sortable: true,
      filterable: true,
      defaultVisible: false,
      width: 150,
      minWidth: 72,
      maxWidth: 260,
    });

    cols.push({
      key: "updatedAt",
      label: "Updated",
      sortable: true,
      filterable: true,
      defaultVisible: false,
      width: 150,
      minWidth: 72,
      maxWidth: 260,
    });

    return cols;
  }, [canAssign, selectedIds]);

  const grid = useDataGrid({
    rows: metersRaw,
    columns,
    storageKey: `meters-grid:${scopeKey}:${role || "unknown"}`,
    initialSearch: "",
    initialSort: null,
  });

  const presets = useMemo(() => {
    return {
      audit: {
        order: [
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
        ],
        visibility: {
          actions: true,
          electronicId: true,
          accountNumber: true,
          meterSerialNumber: true,
          customerName: true,
          address: true,
          route: true,
          latitude: true,
          longitude: true,
          meterSize: true,
          numberOfPictures: true,
          locationNotes: true,
          assignedTo: true,
          lastApprovedUpdateAt: true,
          createdAt: true,
          updatedAt: true,
          ...(canAssign ? { select: true } : {}),
        },
        widths: {
          address: 320,
          locationNotes: 360,
          assignedTo: 240,
        },
      },
      encore: {
        order: [
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
        ],
        visibility: {
          actions: true,
          electronicId: true,
          accountNumber: true,
          meterSerialNumber: true,
          customerName: true,
          address: true,
          route: true,
          latitude: true,
          longitude: true,
          meterSize: true,
          numberOfPictures: true,
          locationNotes: false,
          assignedTo: false,
          lastApprovedUpdateAt: false,
          createdAt: false,
          updatedAt: false,
          ...(canAssign ? { select: true } : {}),
        },
        widths: {
          address: 280,
          customerName: 180,
          meterSerialNumber: 130,
        },
      },
      gps: {
        order: [
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
        ],
        visibility: {
          actions: true,
          electronicId: true,
          accountNumber: true,
          meterSerialNumber: false,
          customerName: true,
          address: true,
          route: true,
          latitude: true,
          longitude: true,
          meterSize: false,
          numberOfPictures: true,
          locationNotes: true,
          assignedTo: false,
          lastApprovedUpdateAt: true,
          createdAt: false,
          updatedAt: false,
          ...(canAssign ? { select: true } : {}),
        },
        widths: {
          address: 320,
          locationNotes: 320,
        },
      },
    };
  }, [canAssign]);

  const presetOptions = useMemo(() => {
    return [
      { value: "audit", label: "Audit" },
      { value: "encore", label: "Encore Compact" },
      { value: "gps", label: "GPS Cleanup" },
    ];
  }, []);

  const layout = useDataGridLayout({
    columns,
    rows: grid.rows,
    storageKey: `meters-layout:${scopeKey}:${role || "unknown"}`,
    presets,
    initialPresetId: "audit",
    getAutoSizeValue: (row, col) => getColumnValue(row, col.key),
  });

  const pageMeterIds = useMemo(() => {
    return grid.rows.map((m) => getEntityId(m)).filter(Boolean);
  }, [grid.rows]);

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

  const filterPills = useMemo(() => {
    const pills = [];

    if (applied.missing) {
      pills.push({ key: "missing", label: `Missing: ${applied.missing}` });
    }
    if (applied.q) {
      pills.push({ key: "q", label: `q: ${applied.q}` });
    }
    if (applied.electronicId) {
      pills.push({
        key: "electronicId",
        label: `EID: ${applied.electronicId}`,
      });
    }
    if (applied.accountNumber) {
      pills.push({
        key: "accountNumber",
        label: `Acct: ${applied.accountNumber}`,
      });
    }
    if (applied.address) {
      pills.push({ key: "address", label: `Address: ${applied.address}` });
    }
    if (applied.route) {
      pills.push({ key: "route", label: `Route: ${applied.route}` });
    }

    for (const [field, f] of Object.entries(grid.columnFilters || {})) {
      if (!f) continue;
      if (f.op === "blank" || f.op === "not_blank") {
        pills.push({
          key: `hf:${field}`,
          label: `${field}: ${f.op}`,
          hfField: field,
        });
      } else if (String(f.value || "").trim()) {
        const op = f.op === "not_contains" ? "not contains" : "contains";
        pills.push({
          key: `hf:${field}`,
          label: `${field}: ${op} "${f.value}"`,
          hfField: field,
        });
      }
    }

    return pills;
  }, [applied, grid.columnFilters]);

  function clearOnePill(pill) {
    if (pill?.hfField) {
      grid.clearColumnFilter(pill.hfField);
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

  const hasFiltersApplied = filterPills.length > 0;

  return (
    <div className="stack">
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
              title="Apply current filter form"
            >
              Apply
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={clearAllFilters}
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
                placeholder="Search across EID, acct, serial, customer, address, route"
              />
            </label>

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
              >
                <option value="off">off</option>
                <option value="1h">last 1 hour</option>
                <option value="24h">last 24 hours</option>
                <option value="7d">last 7 days</option>
                <option value="30d">last 30 days</option>
              </select>
            </label>

            <div className="field">
              <div className="field-label">Header filters</div>
              <div className="muted" style={{ paddingTop: 10 }}>
                Use the filter row in the table to type fast and switch between
                contains, not contains, blank, and not blank.
              </div>
            </div>

            <div className="field">
              <div className="field-label">Sort</div>
              <div className="muted" style={{ paddingTop: 10 }}>
                Click sortable column headers to sort.
              </div>
            </div>
          </div>
        </div>
      </details>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={success} onDismiss={() => setSuccess("")} />
      {loading ? <LoadingBlock title="Loading meters..." /> : null}

      {!loading && payload ? (
        <div className="card">
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

          {filterPills.length ? (
            <div className="pill-row" style={{ marginBottom: 10 }}>
              {filterPills.map((p, idx) => (
                <button
                  key={`${p.key}-${idx}`}
                  type="button"
                  className="pill"
                  onClick={() => clearOnePill(p)}
                  title="Remove filter"
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

            {grid.rows.length !== metersRaw.length ? (
              <span className="muted">
                {" "}
                • Header filters matched <strong>{grid.rows.length}</strong> on
                this page
              </span>
            ) : null}

            <div style={{ marginLeft: "auto" }}>
              <ColumnChooser
                columns={columns}
                visibleMap={layout.visibleMap}
                onToggleColumn={layout.toggleColumn}
                onResetColumns={layout.resetColumns}
                presetId={layout.presetId}
                presetOptions={[
                  { value: "audit", label: "Audit" },
                  { value: "encore", label: "Encore Compact" },
                  { value: "gps", label: "GPS Cleanup" },
                ]}
                onPresetChange={layout.setPresetId}
                onApplyPreset={layout.applyPreset}
                onResetLayout={layout.resetLayout}
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

          {grid.rows.length === 0 ? (
            <div className="card card-subtle" style={{ marginTop: 12 }}>
              <div className="h2">No meters found</div>
              <div className="muted">
                Try clearing filters, changing “Missing”, or broadening your
                search.
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-ghost" onClick={clearAllFilters}>
                  Reset filters
                </button>
              </div>
            </div>
          ) : null}

          <DataGrid
            columns={layout.visibleColumns}
            rows={grid.rows}
            sort={{ key: applied.sortBy, direction: applied.sortDir }}
            onToggleSort={(key) => {
              if (SORTABLE_SET.has(key)) toggleServerSort(key);
            }}
            columnFilters={grid.columnFilters}
            onColumnFilterChange={grid.setColumnFilter}
            onColumnFilterClear={grid.clearColumnFilter}
            getRowKey={(row, idx) => getEntityId(row) || String(idx)}
            emptyMessage="No meters found."
            showResizeHandles
            draggedColumnKey={layout.draggedColumnKey}
            onColumnDragStart={layout.onColumnDragStart}
            onColumnDrop={layout.onColumnDrop}
            onColumnResizeStart={layout.startResize}
            onColumnResizeDoubleClick={layout.autoSizeColumn}
            tableClassName="table meters-table"
            wrapClassName="table-wrap"
            wrapStyle={{ overflowX: "auto" }}
            tableStyle={{
              tableLayout: "fixed",
              width: "max-content",
              minWidth: "100%",
            }}
            renderHeaderCell={({
              col,
              onToggleSort,
              sort,
              draggedColumnKey,
              onColumnDragStart,
              onColumnResizeStart,
              onColumnResizeDoubleClick,
              showResizeHandles,
            }) => {
              const isSorted = sort?.key === col.key;
              const sortGlyph = !col.sortable
                ? ""
                : !isSorted
                  ? "↕"
                  : sort.direction === "asc"
                    ? "↑"
                    : "↓";

              return (
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    paddingRight:
                      showResizeHandles && !col.disableResize ? 14 : 0,
                    minWidth: 0,
                  }}
                >
                  {!col.disableReorder ? (
                    <span
                      draggable={Boolean(onColumnDragStart)}
                      onDragStart={(e) => onColumnDragStart?.(col.key, e)}
                      style={{
                        cursor: onColumnDragStart ? "grab" : "default",
                        opacity: draggedColumnKey === col.key ? 0.35 : 0.75,
                        fontSize: 16,
                        lineHeight: 1,
                        flex: "0 0 auto",
                        padding: "2px 4px",
                        borderRadius: 6,
                      }}
                      title={onColumnDragStart ? "Drag to reorder" : undefined}
                      onClick={(e) => e.stopPropagation()}
                    >
                      ⠿
                    </span>
                  ) : (
                    <span style={{ width: 14, flex: "0 0 auto" }} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {col.key === "select" ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={toggleSelectAllOnPage}
                          title="Select all meters on this page"
                        />
                      </div>
                    ) : col.sortable === false ? (
                      <span
                        style={{
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "inline-block",
                          maxWidth: "100%",
                        }}
                      >
                        {col.label}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          if (SORTABLE_SET.has(col.key)) {
                            toggleServerSort(col.key);
                          }
                        }}
                        style={{
                          padding: 0,
                          border: 0,
                          background: "transparent",
                          fontWeight: 700,
                          display: "inline-flex",
                          gap: 6,
                          alignItems: "center",
                          minWidth: 0,
                        }}
                        title={`Sort by ${col.label}`}
                      >
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "inline-block",
                            maxWidth: "100%",
                          }}
                        >
                          {col.label}
                        </span>
                        <span className="muted">{sortGlyph}</span>
                      </button>
                    )}
                  </div>

                  {showResizeHandles && !col.disableResize ? (
                    <div
                      className="col-resize-affordance"
                      onMouseDown={(e) => onColumnResizeStart?.(col.key, e)}
                      onDoubleClick={() => onColumnResizeDoubleClick?.(col.key)}
                      title="Drag to resize • double-click to auto-size"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        top: 0,
                        right: -3,
                        width: 12,
                        height: "100%",
                        cursor: "col-resize",
                        zIndex: 20,
                        userSelect: "none",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 4,
                          bottom: 4,
                          left: "50%",
                          width: 2,
                          transform: "translateX(-50%)",
                          background: "rgba(255,255,255,0.12)",
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            }}
            getHeaderCellProps={(col) => ({
              style: {
                ...layout.getStickyCellStyle(col.key, true),
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                userSelect: "none",
              },
              title:
                col.pin === "left"
                  ? "Pinned"
                  : "Drag to reorder • drag edge to resize",
            })}
            getFilterCellProps={(col) => ({
              style: {
                ...layout.getStickyCellStyle(col.key, true),
              },
            })}
            getBodyCellProps={({ row, col }) => {
              const base = {
                ...layout.getStickyCellStyle(col.key, false),
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              };

              if (col.key === "locationNotes") {
                return {
                  style: {
                    ...base,
                    whiteSpace: "normal",
                    lineHeight: 1.25,
                  },
                };
              }

              if (col.key === "assignedTo") {
                return {
                  style: {
                    ...base,
                    whiteSpace: "normal",
                  },
                };
              }

              return { style: base };
            }}
            getRowProps={(row) => {
              const mid = getEntityId(row);
              const selected = mid ? selectedIds.has(mid) : false;

              return {
                className: [
                  isRecentApproved(row) ? "row-recent" : "",
                  selected ? "row-selected" : "",
                ]
                  .join(" ")
                  .trim(),
              };
            }}
          />

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
