import React, { useEffect, useMemo, useRef, useState } from "react";

export function ColumnChooser({
  columns,
  visibleMap,
  onToggleColumn,
  onResetColumns,

  presetId = "",
  presetOptions = [],
  onPresetChange,
  onApplyPreset,
  onResetLayout,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const hideableColumns = useMemo(() => {
    return columns.filter((col) => !col.disableHide);
  }, [columns]);

  const hasPresets = presetOptions.length > 0;
  const selectedPreset =
    presetOptions.find((opt) => opt.value === presetId)?.value || "";

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
        Columns
      </button>

      {open ? (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            minWidth: 280,
            maxWidth: 340,
            zIndex: 20,
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
              gap: 8,
            }}
          >
            <strong>Columns</strong>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {onResetColumns ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onResetColumns}
                >
                  Reset columns
                </button>
              ) : null}

              {onResetLayout ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onResetLayout}
                >
                  Reset layout
                </button>
              ) : null}
            </div>
          </div>

          {hasPresets ? (
            <div style={{ marginBottom: 12 }}>
              <label className="field">
                <div className="field-label">Preset</div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <select
                    className="input"
                    value={selectedPreset}
                    onChange={(e) => onPresetChange?.(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    {presetOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onApplyPreset?.(selectedPreset)}
                    disabled={!selectedPreset}
                    title="Apply selected preset"
                  >
                    Apply
                  </button>
                </div>
              </label>
            </div>
          ) : null}

          <div
            className="stack"
            style={{ gap: 8, maxHeight: 280, overflow: "auto" }}
          >
            {hideableColumns.map((col) => (
              <label
                key={col.key}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={visibleMap[col.key] !== false}
                  onChange={() => onToggleColumn?.(col.key)}
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>

          <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
            Drag headers to reorder. Drag edges to resize. Double-click edge to
            auto-size.
          </div>
        </div>
      ) : null}
    </div>
  );
}
