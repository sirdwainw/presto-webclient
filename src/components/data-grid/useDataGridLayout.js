import { useCallback, useEffect, useMemo, useState } from "react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function moveItem(arr, fromKey, toKey) {
  const fromIndex = arr.indexOf(fromKey);
  const toIndex = arr.indexOf(toKey);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return arr;
  }

  const next = [...arr];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function loadPrefs(storageKey) {
  if (!storageKey) return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePrefs(storageKey, prefs) {
  if (!storageKey) return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // ignore storage failures
  }
}

function measureTextPx(text, font = "600 14px system-ui") {
  const canvas =
    measureTextPx._canvas ||
    (measureTextPx._canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  return Math.ceil(ctx.measureText(String(text ?? "")).width);
}

function defaultOrder(columns) {
  return columns.map((col) => col.key);
}

function defaultVisibleMap(columns) {
  return columns.reduce((acc, col) => {
    acc[col.key] = col.defaultVisible !== false;
    if (col.disableHide) acc[col.key] = true;
    return acc;
  }, {});
}

function defaultWidths(columns) {
  return columns.reduce((acc, col) => {
    acc[col.key] = col.width ?? 160;
    return acc;
  }, {});
}

function normalizeOrder(savedOrder, columns) {
  const valid = new Set(columns.map((c) => c.key));
  const next = Array.isArray(savedOrder)
    ? savedOrder.filter((key) => valid.has(key))
    : [];

  for (const col of columns) {
    if (!next.includes(col.key)) next.push(col.key);
  }

  return next;
}

function normalizeVisibleMap(savedVisibleMap, columns) {
  const next = {
    ...defaultVisibleMap(columns),
    ...(savedVisibleMap || {}),
  };

  for (const col of columns) {
    if (col.disableHide) next[col.key] = true;
  }

  return next;
}

function normalizeWidths(savedWidths, columns) {
  const next = {
    ...defaultWidths(columns),
    ...(savedWidths || {}),
  };

  for (const col of columns) {
    const minW = col.minWidth ?? 64;
    const maxW = col.maxWidth ?? 900;
    next[col.key] = clamp(
      Number(next[col.key] ?? col.width ?? 160),
      minW,
      maxW,
    );
  }

  return next;
}

function defaultGetAutoSizeValue(row, col) {
  if (typeof col.getAutoSizeValue === "function") {
    return col.getAutoSizeValue(row);
  }
  if (typeof col.getValue === "function") {
    return col.getValue(row);
  }
  return row?.[col.key] ?? "";
}

export function useDataGridLayout({
  columns,
  rows,
  storageKey,
  presets = {},
  initialPresetId = "",
  getAutoSizeValue = defaultGetAutoSizeValue,
}) {
  const columnMap = useMemo(() => {
    return Object.fromEntries(columns.map((col) => [col.key, col]));
  }, [columns]);

  const [presetId, setPresetId] = useState(initialPresetId || "");
  const [draggedColumnKey, setDraggedColumnKey] = useState("");

  const [colOrder, setColOrder] = useState(() => defaultOrder(columns));
  const [visibleMap, setVisibleMap] = useState(() =>
    defaultVisibleMap(columns),
  );
  const [colWidths, setColWidths] = useState(() => defaultWidths(columns));

  useEffect(() => {
    const saved = loadPrefs(storageKey);

    if (!saved) {
      setColOrder(defaultOrder(columns));
      setVisibleMap(defaultVisibleMap(columns));
      setColWidths(defaultWidths(columns));
      setPresetId(initialPresetId || "");
      return;
    }

    setColOrder(normalizeOrder(saved.order, columns));
    setVisibleMap(normalizeVisibleMap(saved.visibleMap, columns));
    setColWidths(normalizeWidths(saved.colWidths, columns));
    setPresetId(saved.presetId || initialPresetId || "");
  }, [storageKey, columns, initialPresetId]);

  useEffect(() => {
    savePrefs(storageKey, {
      presetId,
      order: colOrder,
      visibleMap,
      colWidths,
    });
  }, [storageKey, presetId, colOrder, visibleMap, colWidths]);

  const visibleColumns = useMemo(() => {
    return colOrder
      .map((key) => columnMap[key])
      .filter(Boolean)
      .filter((col) => (col.disableHide ? true : visibleMap[col.key] !== false))
      .map((col) => ({
        ...col,
        width: colWidths[col.key] ?? col.width,
      }));
  }, [colOrder, columnMap, visibleMap, colWidths]);

  const stickyLeftMap = useMemo(() => {
    let left = 0;
    const map = {};

    for (const col of visibleColumns) {
      if (col.pin === "left") {
        map[col.key] = left;
        left += Number(col.width ?? 160);
      }
    }

    return map;
  }, [visibleColumns]);

  const getStickyCellStyle = useCallback(
    (colKey, isHeader = false) => {
      const left = stickyLeftMap[colKey];
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
    },
    [stickyLeftMap],
  );

  const toggleColumn = useCallback(
    (key) => {
      const col = columnMap[key];
      if (!col || col.disableHide) return;

      setVisibleMap((prev) => ({
        ...prev,
        [key]: prev[key] === false,
      }));
    },
    [columnMap],
  );

  const resetColumns = useCallback(() => {
    setVisibleMap(defaultVisibleMap(columns));
  }, [columns]);

  const resetLayout = useCallback(() => {
    setPresetId(initialPresetId || "");
    setColOrder(defaultOrder(columns));
    setVisibleMap(defaultVisibleMap(columns));
    setColWidths(defaultWidths(columns));
    setDraggedColumnKey("");
  }, [columns, initialPresetId]);

  const onColumnDragStart = useCallback((colKey, e) => {
    setDraggedColumnKey(colKey);
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  }, []);

  const onColumnDrop = useCallback(
    (fromKey, toKey) => {
      if (!fromKey || !toKey || fromKey === toKey) {
        setDraggedColumnKey("");
        return;
      }

      const fromCol = columnMap[fromKey];
      const toCol = columnMap[toKey];

      if (
        !fromCol ||
        !toCol ||
        fromCol.disableReorder ||
        toCol.disableReorder
      ) {
        setDraggedColumnKey("");
        return;
      }

      setColOrder((prev) => moveItem(prev, fromKey, toKey));
      setDraggedColumnKey("");
    },
    [columnMap],
  );

  const startResize = useCallback(
    (colKey, e) => {
      e.preventDefault();
      e.stopPropagation();

      const col = columnMap[colKey];
      if (!col || col.disableResize) return;

      const startX = e.clientX;
      const startWidth = Number(colWidths[colKey] || col.width || 160);
      const minW = col.minWidth ?? 64;
      const maxW = col.maxWidth ?? 900;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const nextWidth = clamp(startWidth + dx, minW, maxW);

        setColWidths((prev) => ({
          ...prev,
          [colKey]: nextWidth,
        }));
      }

      function onUp() {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [columnMap, colWidths],
  );

  const autoSizeColumn = useCallback(
    (colKey) => {
      const col = columnMap[colKey];
      if (!col || col.disableResize) return;

      const sample = rows.slice(0, 500);

      // Measure header label
      let widest = measureTextPx(col.label ?? "", "700 14px system-ui");

      // Measure actual cell values
      for (const row of sample) {
        const value = String(getAutoSizeValue(row, col) ?? "");
        const px = measureTextPx(value, "500 14px system-ui");
        if (px > widest) widest = px;
      }

      const minW = col.minWidth ?? 1;
      const maxW = col.maxWidth ?? 900;

      // Keep chrome much tighter
      const chrome =
        16 + // left/right padding
        (col.disableReorder ? 0 : 14) +
        (col.disableResize ? 0 : 8);

      const nextWidth = clamp(widest + chrome, minW, maxW);

      setColWidths((prev) => ({
        ...prev,
        [colKey]: nextWidth,
      }));
    },
    [columnMap, rows, getAutoSizeValue],
  );

  const applyPreset = useCallback(
    (nextPresetId) => {
      const preset = presets[nextPresetId];
      if (!preset) return;

      const nextOrder = normalizeOrder(preset.order, columns);
      const nextVisibleMap = normalizeVisibleMap(preset.visibility, columns);
      const nextWidths = normalizeWidths(preset.widths, columns);

      setPresetId(nextPresetId);
      setColOrder(nextOrder);
      setVisibleMap(nextVisibleMap);
      setColWidths(nextWidths);
      setDraggedColumnKey("");
    },
    [presets, columns],
  );

  return {
    presetId,
    setPresetId,
    applyPreset,

    colOrder,
    setColOrder,

    visibleMap,
    toggleColumn,
    resetColumns,

    colWidths,
    setColWidths,

    visibleColumns,

    draggedColumnKey,
    setDraggedColumnKey,
    onColumnDragStart,
    onColumnDrop,

    startResize,
    autoSizeColumn,

    stickyLeftMap,
    getStickyCellStyle,

    resetLayout,
  };
}
