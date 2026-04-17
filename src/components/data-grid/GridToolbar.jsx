import React from "react";
import { ColumnChooser } from "./ColumnChooser";

export function GridToolbar({
  title,
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filteredCount,
  totalCount,
  loading = false,

  columns,
  visibleMap,
  onToggleColumn,
  onResetColumns,

  presetId,
  presetOptions = [],
  onPresetChange,
  onApplyPreset,
  onResetLayout,

  onRefresh,
  rightSlot = null,
}) {
  return (
    <div className="card">
      {title ? <div className="h1">{title}</div> : null}

      <div className="grid grid-3" style={{ marginTop: 12 }}>
        <label className="field">
          <div className="field-label">Search</div>
          <input
            className="input"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={loading}
            placeholder={searchPlaceholder}
          />
        </label>

        <div className="field">
          <div className="field-label">Counts</div>
          <div className="muted">
            Showing {filteredCount} of {totalCount}
          </div>
        </div>

        <div className="field">
          <div className="field-label">Actions</div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {onRefresh ? (
              <button
                type="button"
                className="btn"
                onClick={onRefresh}
                disabled={loading}
              >
                Refresh
              </button>
            ) : null}

            <ColumnChooser
              columns={columns}
              visibleMap={visibleMap}
              onToggleColumn={onToggleColumn}
              onResetColumns={onResetColumns}
              presetId={presetId}
              presetOptions={presetOptions}
              onPresetChange={onPresetChange}
              onApplyPreset={onApplyPreset}
              onResetLayout={onResetLayout}
            />

            {rightSlot}
          </div>
        </div>
      </div>
    </div>
  );
}
