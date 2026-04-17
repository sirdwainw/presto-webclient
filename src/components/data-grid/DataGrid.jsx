import React, { useMemo, useState } from "react";

const FILTER_OPS = [
  { key: "contains", label: "contains" },
  { key: "not_contains", label: "not contains" },
  { key: "blank", label: "blank" },
  { key: "not_blank", label: "not blank" },
];

function sortIndicator(sort, key) {
  if (sort?.key !== key) return "↕";
  return sort.direction === "asc" ? "↑" : "↓";
}

function mergeStyles(...styles) {
  return Object.assign({}, ...styles.filter(Boolean));
}

function DefaultHeaderContent({ col, sort, onToggleSort }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {col.sortable === false ? (
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
            onClick={() => onToggleSort?.(col.key)}
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
            <span className="muted">{sortIndicator(sort, col.key)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function DefaultFilterCell({
  col,
  columnFilters,
  onColumnFilterChange,
  onColumnFilterClear,
  filterDisabled = false,
}) {
  const filter = columnFilters?.[col.key] || { op: "contains", value: "" };
  const isBlankMode = filter.op === "blank" || filter.op === "not_blank";

  function handleOpChange(nextOp) {
    onColumnFilterChange?.(col.key, {
      ...filter,
      op: nextOp,
    });
  }

  function handleValueChange(nextValue) {
    onColumnFilterChange?.(col.key, {
      ...filter,
      value: nextValue,
    });
  }

  const showClear = Boolean(filter.value) || filter.op !== "contains";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        width: "100%",
        minWidth: 0,
      }}
    >
      <input
        className="input"
        disabled={filterDisabled || isBlankMode}
        value={filter.value || ""}
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder={isBlankMode ? "" : "Filter"}
        style={{
          minWidth: 0,
          flex: 1,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          opacity: filterDisabled || isBlankMode ? 0.7 : 1,
          paddingRight: 8,
        }}
      />

      <select
        className="input"
        disabled={filterDisabled}
        value={filter.op}
        onChange={(e) => handleOpChange(e.target.value)}
        title={`Filter operator for ${col.label}`}
        style={{
          width: 82,
          minWidth: 12,
          maxWidth: 82,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          borderLeft: "none",
          paddingLeft: 6,
          paddingRight: 20,
        }}
      >
        <option value="contains">contains</option>
        <option value="not_contains">not contains</option>
        <option value="blank">blank</option>
        <option value="not_blank">not blank</option>
      </select>

      {showClear ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={filterDisabled}
          onClick={() => onColumnFilterClear?.(col.key)}
          title={`Clear ${col.label} filter`}
          style={{
            marginLeft: 4,
            padding: "0 6px",
            minHeight: "auto",
            whiteSpace: "nowrap",
            alignSelf: "center",
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

export function DataGrid({
  columns,
  rows,
  sort,
  onToggleSort,
  columnFilters,
  onColumnFilterChange,
  onColumnFilterClear,
  getRowKey,
  emptyMessage = "No records found.",

  tableClassName = "table",
  tableStyle,
  wrapClassName = "table-wrap",
  wrapStyle,

  getHeaderCellProps,
  getFilterCellProps,
  getBodyCellProps,
  getRowProps,
  renderHeaderCell,
  renderFilterCell,

  onColumnDrop,
  onColumnDragStart,
  draggedColumnKey,

  showResizeHandles = false,
  onColumnResizeStart,
  onColumnResizeDoubleClick,

  filterDisabled = false,
  showFilterRow = true,
}) {
  const [dropTargetKey, setDropTargetKey] = useState("");

  const normalizedColumns = useMemo(() => {
    return columns.map((col) => ({
      minWidth: col.minWidth,
      maxWidth: col.maxWidth,
      width: col.width,
      ...col,
    }));
  }, [columns]);

  return (
    <div className={wrapClassName} style={wrapStyle}>
      <table className={tableClassName} style={tableStyle}>
        <thead>
          <tr>
            {normalizedColumns.map((col, colIndex) => {
              const headerProps = getHeaderCellProps
                ? getHeaderCellProps(col, colIndex)
                : {};

              const {
                key: headerKey,
                className: headerClassName,
                style: headerStyle,
                onDragOver,
                onDrop,
                onDragEnter,
                onDragLeave,
                ...restHeaderProps
              } = headerProps || {};

              const mergedHeaderStyle = mergeStyles(
                col.width != null ? { width: col.width } : null,
                col.minWidth != null ? { minWidth: col.minWidth } : null,
                col.maxWidth != null ? { maxWidth: col.maxWidth } : null,
                dropTargetKey === col.key && draggedColumnKey !== col.key
                  ? {
                      boxShadow: "inset 3px 0 0 rgba(78,161,255,0.95)",
                      background: "rgba(78,161,255,0.10)",
                    }
                  : null,
                headerStyle,
              );

              return (
                <th
                  key={headerKey || col.key}
                  className={headerClassName}
                  style={mergedHeaderStyle}
                  onDragEnter={
                    onDragEnter ||
                    (onColumnDrop
                      ? (e) => {
                          if (
                            draggedColumnKey &&
                            draggedColumnKey !== col.key
                          ) {
                            e.preventDefault();
                            setDropTargetKey(col.key);
                          }
                        }
                      : undefined)
                  }
                  onDragLeave={
                    onDragLeave ||
                    (onColumnDrop
                      ? () => {
                          if (dropTargetKey === col.key) {
                            setDropTargetKey("");
                          }
                        }
                      : undefined)
                  }
                  onDragOver={
                    onDragOver ||
                    (onColumnDrop
                      ? (e) => {
                          if (
                            draggedColumnKey &&
                            draggedColumnKey !== col.key
                          ) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dropTargetKey !== col.key) {
                              setDropTargetKey(col.key);
                            }
                          }
                        }
                      : undefined)
                  }
                  onDrop={
                    onDrop ||
                    (onColumnDrop
                      ? () => {
                          onColumnDrop(draggedColumnKey, col.key);
                          setDropTargetKey("");
                        }
                      : undefined)
                  }
                  {...restHeaderProps}
                >
                  {renderHeaderCell ? (
                    renderHeaderCell({
                      col,
                      colIndex,
                      sort,
                      onToggleSort,
                      columnFilters,
                      onColumnFilterChange,
                      onColumnFilterClear,
                      draggedColumnKey,
                      dropTargetKey,
                      onColumnDragStart,
                      onColumnDrop,
                      onColumnResizeStart,
                      onColumnResizeDoubleClick,
                      showResizeHandles,
                      filterDisabled,
                      defaultHeaderContent: () => (
                        <DefaultHeaderContent
                          col={col}
                          sort={sort}
                          onToggleSort={onToggleSort}
                        />
                      ),
                    })
                  ) : (
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
                          onDragEnd={() => setDropTargetKey("")}
                          style={{
                            cursor: onColumnDragStart ? "grab" : "default",
                            opacity: draggedColumnKey === col.key ? 0.35 : 0.75,
                            fontSize: 16,
                            lineHeight: 1,
                            flex: "0 0 auto",
                            padding: "2px 4px",
                            borderRadius: 6,
                          }}
                          title={
                            onColumnDragStart ? "Drag to reorder" : undefined
                          }
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⠿
                        </span>
                      ) : null}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <DefaultHeaderContent
                          col={col}
                          sort={sort}
                          onToggleSort={onToggleSort}
                        />
                      </div>

                      {showResizeHandles && !col.disableResize ? (
                        <div
                          className="col-resize-affordance"
                          onMouseDown={(e) => onColumnResizeStart?.(col.key, e)}
                          onDoubleClick={() =>
                            onColumnResizeDoubleClick?.(col.key)
                          }
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
                  )}
                </th>
              );
            })}
          </tr>

          {showFilterRow ? (
            <tr>
              {normalizedColumns.map((col, colIndex) => {
                const filterProps = getFilterCellProps
                  ? getFilterCellProps(col, colIndex)
                  : {};

                const {
                  key: filterKey,
                  className: filterClassName,
                  style: filterStyle,
                  ...restFilterProps
                } = filterProps || {};

                const mergedFilterStyle = mergeStyles(
                  col.width != null ? { width: col.width } : null,
                  col.minWidth != null ? { minWidth: col.minWidth } : null,
                  col.maxWidth != null ? { maxWidth: col.maxWidth } : null,
                  filterStyle,
                );

                return (
                  <th
                    key={filterKey || `${col.key}-filter`}
                    className={filterClassName}
                    style={mergedFilterStyle}
                    {...restFilterProps}
                  >
                    {col.filterable === false ? null : renderFilterCell ? (
                      renderFilterCell({
                        col,
                        colIndex,
                        columnFilters,
                        onColumnFilterChange,
                        onColumnFilterClear,
                        filterDisabled,
                        defaultFilterCell: () => (
                          <DefaultFilterCell
                            col={col}
                            columnFilters={columnFilters}
                            onColumnFilterChange={onColumnFilterChange}
                            onColumnFilterClear={onColumnFilterClear}
                            filterDisabled={filterDisabled}
                          />
                        ),
                      })
                    ) : (
                      <DefaultFilterCell
                        col={col}
                        columnFilters={columnFilters}
                        onColumnFilterChange={onColumnFilterChange}
                        onColumnFilterClear={onColumnFilterClear}
                        filterDisabled={filterDisabled}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          ) : null}
        </thead>

        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => {
              const rowProps = getRowProps ? getRowProps(row, rowIndex) : {};
              const {
                key: rowKeyOverride,
                className: rowClassName,
                style: rowStyle,
                ...restRowProps
              } = rowProps || {};

              return (
                <tr
                  key={rowKeyOverride || getRowKey(row, rowIndex)}
                  className={rowClassName}
                  style={rowStyle}
                  {...restRowProps}
                >
                  {normalizedColumns.map((col, colIndex) => {
                    const cellProps = getBodyCellProps
                      ? getBodyCellProps({ row, rowIndex, col, colIndex })
                      : {};

                    const {
                      key: cellKey,
                      className: cellClassName,
                      style: cellStyle,
                      ...restCellProps
                    } = cellProps || {};

                    const mergedCellStyle = mergeStyles(
                      col.width != null ? { width: col.width } : null,
                      col.minWidth != null ? { minWidth: col.minWidth } : null,
                      col.maxWidth != null ? { maxWidth: col.maxWidth } : null,
                      cellStyle,
                    );

                    return (
                      <td
                        key={cellKey || col.key}
                        className={cellClassName}
                        style={mergedCellStyle}
                        {...restCellProps}
                      >
                        {col.render
                          ? col.render(row, rowIndex)
                          : col.getValue
                            ? col.getValue(row)
                            : (row?.[col.key] ?? "")}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={normalizedColumns.length} className="muted">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
