function escapeCsvValue(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function makeCsvText(headers, rows) {
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ];
  return lines.join("\n");
}

function triggerDownload(filename, text, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export function downloadImportRowsAsCsv(filename, rows = []) {
  const headers = [
    "rowNumber",
    "status",
    "action",
    "matchedBy",
    "electronicId",
    "accountNumber",
    "errors",
    "warnings",
  ];

  const normalizedRows = rows.map((row) => ({
    rowNumber: row.rowNumber ?? "",
    status: row.status ?? "",
    action: row.action ?? "",
    matchedBy: row.matchedBy ?? "",
    electronicId: row.electronicId ?? "",
    accountNumber: row.accountNumber ?? "",
    errors: Array.isArray(row.errors) ? row.errors.join(" | ") : "",
    warnings: Array.isArray(row.warnings) ? row.warnings.join(" | ") : "",
  }));

  const csvText = makeCsvText(headers, normalizedRows);
  triggerDownload(filename, csvText);
}

export function openSampleCsvDownload() {
  window.open("/presto-import-sample.csv", "_blank");
}
