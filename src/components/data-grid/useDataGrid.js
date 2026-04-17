import { useEffect, useMemo, useState } from "react";

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

function defaultVisibleMap(columns) {
  return columns.reduce((acc, col) => {
    acc[col.key] = col.defaultVisible !== false;
    return acc;
  }, {});
}

function compareValues(a, b) {
  const av = a ?? "";
  const bv = b ?? "";

  const aNum = Number(av);
  const bNum = Number(bv);

  const aIsNum = !Number.isNaN(aNum) && String(av).trim() !== "";
  const bIsNum = !Number.isNaN(bNum) && String(bv).trim() !== "";

  if (aIsNum && bIsNum) return aNum - bNum;

  return String(av).localeCompare(String(bv), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function isBlankValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "number") return Number.isNaN(v);
  return String(v).trim().length === 0;
}

function applyFilterOp(op, value, q) {
  const hay = normalize(value);
  const needle = normalize(q);

  if (op === "blank") return isBlankValue(value);
  if (op === "not_blank") return !isBlankValue(value);

  const hit = hay.includes(needle);

  if (op === "contains") return hit;
  if (op === "not_contains") return !hit;

  return true;
}

function defaultColumnFilters(columns) {
  return columns.reduce((acc, col) => {
    if (col.filterable === false) return acc;
    acc[col.key] = { op: "contains", value: "" };
    return acc;
  }, {});
}

function isActiveColumnFilter(filter) {
  if (!filter) return false;
  if (filter.op === "blank" || filter.op === "not_blank") return true;
  return String(filter.value ?? "").trim().length > 0;
}

export function useDataGrid({
  rows,
  columns,
  storageKey,
  initialSearch = "",
  initialSort = null,
}) {
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState(
    initialSort || { key: null, direction: "asc" },
  );
  const [columnFilters, setColumnFilters] = useState(() =>
    defaultColumnFilters(columns),
  );
  const [visibleMap, setVisibleMap] = useState(() => {
    if (!storageKey) return defaultVisibleMap(columns);

    try {
      const raw = window.localStorage.getItem(`${storageKey}:visibleColumns`);
      if (!raw) return defaultVisibleMap(columns);
      const parsed = JSON.parse(raw);
      return { ...defaultVisibleMap(columns), ...parsed };
    } catch {
      return defaultVisibleMap(columns);
    }
  });

  useEffect(() => {
    setColumnFilters((prev) => {
      const next = defaultColumnFilters(columns);
      for (const col of columns) {
        if (prev[col.key]) next[col.key] = prev[col.key];
      }
      return next;
    });
  }, [columns]);

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(
      `${storageKey}:visibleColumns`,
      JSON.stringify(visibleMap),
    );
  }, [storageKey, visibleMap]);

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(`${storageKey}:sort`, JSON.stringify(sort));
  }, [storageKey, sort]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(`${storageKey}:sort`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.key) setSort(parsed);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const visibleColumns = useMemo(() => {
    return columns.filter((col) => visibleMap[col.key] !== false);
  }, [columns, visibleMap]);

  const searchedRows = useMemo(() => {
    const term = normalize(search);
    if (!term) return rows;

    return rows.filter((row) => {
      return columns.some((col) => {
        const rawValue = col.getValue ? col.getValue(row) : row?.[col.key];
        return normalize(rawValue).includes(term);
      });
    });
  }, [rows, columns, search]);

  const filteredRows = useMemo(() => {
    return searchedRows.filter((row) => {
      return columns.every((col) => {
        if (col.filterable === false) return true;

        const filter = columnFilters[col.key];
        if (!isActiveColumnFilter(filter)) return true;

        const rawValue = col.getValue ? col.getValue(row) : row?.[col.key];
        return applyFilterOp(filter.op, rawValue, filter.value);
      });
    });
  }, [searchedRows, columns, columnFilters]);

  const sortedRows = useMemo(() => {
    if (!sort?.key) return filteredRows;

    const column = columns.find((c) => c.key === sort.key);
    if (!column) return filteredRows;

    const next = [...filteredRows].sort((a, b) => {
      const av = column.getValue ? column.getValue(a) : a?.[column.key];
      const bv = column.getValue ? column.getValue(b) : b?.[column.key];
      const cmp = compareValues(av, bv);
      return sort.direction === "asc" ? cmp : -cmp;
    });

    return next;
  }, [filteredRows, columns, sort]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: "asc" };
    });
  }

  function setColumnFilter(key, valueOrFilter) {
    setColumnFilters((prev) => ({
      ...prev,
      [key]:
        typeof valueOrFilter === "string"
          ? {
              ...(prev[key] || { op: "contains", value: "" }),
              value: valueOrFilter,
            }
          : {
              op: "contains",
              value: "",
              ...(prev[key] || {}),
              ...valueOrFilter,
            },
    }));
  }

  function clearColumnFilter(key) {
    setColumnFilters((prev) => ({
      ...prev,
      [key]: { op: "contains", value: "" },
    }));
  }

  function toggleColumn(key) {
    setVisibleMap((prev) => ({ ...prev, [key]: prev[key] === false }));
  }

  function resetColumns() {
    setVisibleMap(defaultVisibleMap(columns));
  }

  function clearFilters() {
    setSearch("");
    setColumnFilters(defaultColumnFilters(columns));
    setSort({ key: null, direction: "asc" });
  }

  return {
    search,
    setSearch,
    sort,
    toggleSort,
    columnFilters,
    setColumnFilter,
    clearColumnFilter,
    visibleMap,
    toggleColumn,
    resetColumns,
    clearFilters,
    visibleColumns,
    rows: sortedRows,
    totalRows: rows.length,
    filteredCount: sortedRows.length,
  };
}
