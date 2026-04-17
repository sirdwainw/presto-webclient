import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listTechAssignmentsApi } from "../api/tech.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";
import { useDataGrid } from "../components/data-grid/useDataGrid";
import { useDataGridLayout } from "../components/data-grid/useDataGridLayout";
import { GridToolbar } from "../components/data-grid/GridToolbar";
import { DataGrid } from "../components/data-grid/DataGrid";

function isCompanyScopeError(e) {
  const msg = String(e?.error || e?.message || "");
  return e?.status === 400 && msg.startsWith("No company scope selected");
}

export function TechAssignmentsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const meters = useMemo(() => payload?.meters || [], [payload]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await listTechAssignmentsApi();
      setPayload(data);
    } catch (e) {
      if (isCompanyScopeError(e) && role === "superadmin") {
        nav("/settings");
        return;
      }
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [nav, role]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const columns = useMemo(() => {
    return [
      {
        key: "action",
        label: "Action",
        sortable: false,
        filterable: false,
        defaultVisible: true,
        width: 110,
        minWidth: 80,
        maxWidth: 140,
        disableReorder: true,
        getAutoSizeValue: () => "Update",
        render: (row) => {
          const mid = getEntityId(row);
          if (!mid) return "";
          return (
            <Link
              to={`/meters/${encodeURIComponent(mid)}/updates`}
              state={{ from: "tech-assignments" }}
            >
              Update
            </Link>
          );
        },
      },
      {
        key: "electronicId",
        label: "Electronic ID",
        sortable: true,
        filterable: true,
        defaultVisible: true,
        width: 160,
        minWidth: 64,
        maxWidth: 320,
        pin: "left",
      },
      {
        key: "accountNumber",
        label: "Account #",
        sortable: true,
        filterable: true,
        defaultVisible: true,
        width: 150,
        minWidth: 64,
        maxWidth: 260,
      },
      {
        key: "customerName",
        label: "Customer",
        sortable: true,
        filterable: true,
        defaultVisible: true,
        width: 220,
        minWidth: 72,
        maxWidth: 360,
      },
      {
        key: "address",
        label: "Address",
        sortable: true,
        filterable: true,
        defaultVisible: true,
        width: 280,
        minWidth: 72,
        maxWidth: 560,
      },
      {
        key: "route",
        label: "Route",
        sortable: true,
        filterable: true,
        defaultVisible: true,
        width: 100,
        minWidth: 56,
        maxWidth: 180,
      },
      {
        key: "meterSerialNumber",
        label: "Serial #",
        sortable: true,
        filterable: true,
        defaultVisible: false,
        width: 160,
        minWidth: 64,
        maxWidth: 280,
      },
      {
        key: "meterSize",
        label: "Meter Size",
        sortable: true,
        filterable: true,
        defaultVisible: false,
        width: 120,
        minWidth: 64,
        maxWidth: 200,
      },
    ];
  }, []);

  const grid = useDataGrid({
    rows: meters,
    columns,
    storageKey: "tech-assignments-grid",
    initialSearch: "",
    initialSort: { key: "route", direction: "asc" },
  });

  const presets = useMemo(() => {
    return {
      compact: {
        order: [
          "action",
          "electronicId",
          "accountNumber",
          "address",
          "route",
          "customerName",
          "meterSerialNumber",
          "meterSize",
        ],
        visibility: {
          action: true,
          electronicId: true,
          accountNumber: true,
          address: true,
          route: true,
          customerName: true,
          meterSerialNumber: false,
          meterSize: false,
        },
        widths: {
          action: 110,
          electronicId: 160,
          accountNumber: 150,
          address: 280,
          route: 100,
          customerName: 220,
        },
      },
      audit: {
        order: [
          "action",
          "electronicId",
          "accountNumber",
          "customerName",
          "address",
          "route",
          "meterSerialNumber",
          "meterSize",
        ],
        visibility: {
          action: true,
          electronicId: true,
          accountNumber: true,
          customerName: true,
          address: true,
          route: true,
          meterSerialNumber: true,
          meterSize: true,
        },
        widths: {
          action: 110,
          electronicId: 170,
          accountNumber: 150,
          customerName: 240,
          address: 320,
          route: 100,
          meterSerialNumber: 170,
          meterSize: 120,
        },
      },
      field: {
        order: [
          "action",
          "electronicId",
          "address",
          "route",
          "customerName",
          "accountNumber",
          "meterSize",
          "meterSerialNumber",
        ],
        visibility: {
          action: true,
          electronicId: true,
          address: true,
          route: true,
          customerName: true,
          accountNumber: true,
          meterSize: true,
          meterSerialNumber: false,
        },
        widths: {
          action: 110,
          electronicId: 160,
          address: 340,
          route: 100,
          customerName: 220,
          accountNumber: 150,
          meterSize: 120,
        },
      },
    };
  }, []);

  const presetOptions = useMemo(() => {
    return [
      { value: "compact", label: "Compact" },
      { value: "audit", label: "Audit" },
      { value: "field", label: "Field Update" },
    ];
  }, []);

  const layout = useDataGridLayout({
    columns,
    rows: grid.rows,
    storageKey: "tech-assignments-layout",
    presets,
    initialPresetId: "compact",
  });

  return (
    <div className="stack">
      <GridToolbar
        title="My Assignments"
        search={grid.search}
        onSearchChange={grid.setSearch}
        searchPlaceholder="eid / account / customer / address / route"
        filteredCount={grid.filteredCount}
        totalCount={grid.totalRows}
        loading={loading}
        columns={columns}
        visibleMap={layout.visibleMap}
        onToggleColumn={layout.toggleColumn}
        onResetColumns={layout.resetColumns}
        presetId={layout.presetId}
        presetOptions={presetOptions}
        onPresetChange={layout.setPresetId}
        onApplyPreset={layout.applyPreset}
        onResetLayout={layout.resetLayout}
        onRefresh={loadAssignments}
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <LoadingBlock title="Loading assignments..." /> : null}

      {!loading && payload ? (
        <div className="card">
          <DataGrid
            columns={layout.visibleColumns}
            rows={grid.rows}
            sort={grid.sort}
            onToggleSort={grid.toggleSort}
            columnFilters={grid.columnFilters}
            onColumnFilterChange={grid.setColumnFilter}
            onColumnFilterClear={grid.clearColumnFilter}
            getRowKey={(row, idx) => getEntityId(row) || String(idx)}
            emptyMessage="No assigned meters found."
            showResizeHandles
            draggedColumnKey={layout.draggedColumnKey}
            onColumnDragStart={layout.onColumnDragStart}
            onColumnDrop={layout.onColumnDrop}
            onColumnResizeStart={layout.startResize}
            onColumnResizeDoubleClick={layout.autoSizeColumn}
            tableClassName="table"
            wrapClassName="table-wrap"
            wrapStyle={{ overflowX: "auto" }}
            tableStyle={{
              tableLayout: "fixed",
              width: "max-content",
              minWidth: "100%",
            }}
            getHeaderCellProps={(col) => ({
              style: {
                ...layout.getStickyCellStyle(col.key, true),
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            })}
            getFilterCellProps={(col) => ({
              style: {
                ...layout.getStickyCellStyle(col.key, true),
              },
            })}
            getBodyCellProps={({ col }) => ({
              style: {
                ...layout.getStickyCellStyle(col.key, false),
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            })}
          />

          <div className="muted" style={{ marginTop: 10 }}>
            {payload?.count ?? meters.length} meter(s) returned.
          </div>
        </div>
      ) : null}
    </div>
  );
}
