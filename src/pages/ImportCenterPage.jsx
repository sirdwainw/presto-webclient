import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBanner } from "../components/ErrorBanner";
import { SuccessBanner } from "../components/SuccessBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import {
  previewMeterImportApi,
  commitMeterImportApi,
  listImportHistoryApi,
  listImportTemplatesApi,
  saveImportTemplateApi,
  deleteImportTemplateApi,
} from "../api/imports.api";
import { readCsvHeaders } from "../utils/csvHeaders";
import {
  downloadImportRowsAsCsv,
  openSampleCsvDownload,
} from "../utils/importCsvDownloads";
import "./ImportCenterPage.css";

const DB_FIELDS = [
  { key: "electronicId", label: "Electronic ID", required: true },
  { key: "accountNumber", label: "Account Number", required: true },
  { key: "meterSerialNumber", label: "Meter Serial Number" },
  { key: "customerName", label: "Customer Name" },
  { key: "address", label: "Address" },
  { key: "route", label: "Route" },
  { key: "meterSize", label: "Meter Size" },
  { key: "unitType", label: "Unit Type" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "locationNotes", label: "Location Notes" },
  { key: "numberOfPictures", label: "Number of Pictures" },
];

function buildFormData(file, mapping, options) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mapping", JSON.stringify(mapping));
  fd.append("options", JSON.stringify(options));
  return fd;
}

function autoMapHeaders(headers) {
  const next = {};
  const normalized = headers.map((h) => ({
    raw: h,
    key: String(h).trim().toLowerCase(),
  }));

  const aliases = {
    electronicId: [
      "electronicid",
      "electronic id",
      "eid",
      "meterid",
      "meter id",
    ],
    accountNumber: [
      "accountnumber",
      "account number",
      "acct",
      "acctnumber",
      "account #",
    ],
    meterSerialNumber: [
      "meterserialnumber",
      "meter serial number",
      "serial",
      "meter serial",
    ],
    customerName: ["customername", "customer name", "name"],
    address: ["address", "service address", "location address"],
    route: ["route", "route number", "route code"],
    meterSize: ["metersize", "meter size", "size"],
    unitType: ["unittype", "unit type"],
    latitude: ["latitude", "lat"],
    longitude: ["longitude", "lng", "lon", "long"],
    locationNotes: ["locationnotes", "location notes", "notes"],
    numberOfPictures: [
      "numberofpictures",
      "number of pictures",
      "picture count",
      "photo count",
    ],
  };

  for (const field of DB_FIELDS) {
    const match = normalized.find((h) =>
      aliases[field.key]?.includes(h.key.replace(/[_-]/g, " ")),
    );
    if (match) next[field.key] = match.raw;
  }

  return next;
}

function StatusTag({ value }) {
  const cls = String(value || "none").toLowerCase();
  return <span className={`import-tag ${cls}`}>{value || "—"}</span>;
}

function getFailedOrSkippedRows(rows = []) {
  return rows.filter(
    (row) =>
      row.status === "invalid" ||
      row.status === "failed" ||
      row.status === "skipped" ||
      row.action === "skip",
  );
}

export function ImportCenterPage() {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [options, setOptions] = useState({
    skipBlankUpdates: true,
    maxStoredRowResults: 200,
  });

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");

  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const [busy, setBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [templatesBusy, setTemplatesBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const mappingSectionRef = useRef(null);

  const mappedHeaderSet = useMemo(() => {
    return new Set(Object.values(mapping).filter(Boolean));
  }, [mapping]);

  const previewProblemRows = useMemo(
    () => getFailedOrSkippedRows(preview?.rows || []),
    [preview],
  );

  const resultProblemRows = useMemo(
    () => getFailedOrSkippedRows(result?.rows || []),
    [result],
  );

  async function loadHistory() {
    setHistoryBusy(true);
    try {
      const res = await listImportHistoryApi({ page: 1, limit: 10 });
      setHistory(res?.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryBusy(false);
    }
  }

  async function loadTemplates() {
    setTemplatesBusy(true);
    try {
      const res = await listImportTemplatesApi();
      setTemplates(res?.templates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setTemplatesBusy(false);
    }
  }

  useEffect(() => {
    loadHistory();
    loadTemplates();
  }, []);

  async function onChooseFile(nextFile) {
    setError("");
    setSuccess("");
    setPreview(null);
    setResult(null);
    setFile(nextFile || null);

    if (!nextFile) {
      setHeaders([]);
      setMapping({});
      return;
    }

    try {
      const localHeaders = await readCsvHeaders(nextFile);
      setHeaders(localHeaders);
      setMapping(autoMapHeaders(localHeaders));
    } catch (e) {
      setHeaders([]);
      setMapping({});
      setError(e?.message || "Could not read CSV headers.");
    }
  }
function handleSkipSavedMappings() {
  setSelectedTemplateId("");
  setSuccess(
    "Skipped saved mappings. Continue with auto-map or manual mapping below.",
  );

  if (mappingSectionRef.current) {
    mappingSectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}
  function handleApplyTemplate() {
    const template = templates.find((t) => t._id === selectedTemplateId);
    if (!template) return;
    setMapping(template.mapping || {});
    setSuccess(`Loaded template "${template.name}".`);
  }

  async function handleSaveTemplate() {
    setError("");
    setSuccess("");

    const name = String(templateName || "").trim();
    if (!name) {
      setError("Enter a template name before saving.");
      return;
    }

    if (!mapping.electronicId && !mapping.accountNumber) {
      setError("Map at least one identifier before saving a template.");
      return;
    }

    setBusy(true);
    try {
      await saveImportTemplateApi({
        name,
        mapping,
      });
      setSuccess(`Template "${name}" saved.`);
      setTemplateName("");
      await loadTemplates();
    } catch (e) {
      setError(e?.error || "Failed to save template.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTemplate() {
    setError("");
    setSuccess("");

    if (!selectedTemplateId) {
      setError("Select a template to delete.");
      return;
    }

    const template = templates.find((t) => t._id === selectedTemplateId);
    if (!template) {
      setError("Selected template was not found.");
      return;
    }

    const confirmed = window.confirm(`Delete template "${template.name}"?`);
    if (!confirmed) return;

    setBusy(true);
    try {
      await deleteImportTemplateApi(selectedTemplateId);
      setSuccess(`Template "${template.name}" deleted.`);
      setSelectedTemplateId("");
      await loadTemplates();
    } catch (e) {
      setError(e?.error || "Failed to delete template.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview() {
    setError("");
    setSuccess("");
    setPreview(null);
    setResult(null);

    if (!file) {
      setError("Please choose a CSV file first.");
      return;
    }

    if (!mapping.electronicId && !mapping.accountNumber) {
      setError("Map at least one identifier: electronicId or accountNumber.");
      return;
    }

    setBusy(true);
    try {
      const res = await previewMeterImportApi(
        buildFormData(file, mapping, options),
      );
      setPreview(res);
      setSuccess("Preview generated.");
    } catch (e) {
      setError(e?.error || "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setError("");
    setSuccess("");
    setResult(null);

    if (!file) {
      setError("Please choose a CSV file first.");
      return;
    }

    setBusy(true);
    try {
      const res = await commitMeterImportApi(
        buildFormData(file, mapping, options),
      );
      setResult(res);
      setSuccess("Import completed.");
      await loadHistory();
    } catch (e) {
      setError(e?.error || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-center">
      <div className="import-card page-header">
        <h1>Import Center</h1>

        <div className="import-link-row">
          <button
            className="import-btn-ghost"
            type="button"
            onClick={openSampleCsvDownload}
          >
            Download Sample CSV
          </button>
        </div>

        <p className="import-muted">
          Download the sample CSV to see the expected headers and test the
          import flow before using real utility data.
        </p>
      </div>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {success ? <SuccessBanner>{success}</SuccessBanner> : null}
      {busy ? <LoadingBlock label="Working…" /> : null}

      <div className="import-grid">
        <div className="import-card">
          <h2>1. Upload CSV</h2>
          <p className="import-muted">
            Upload a CSV, map its columns to Presto meter fields, preview
            changes, and import only the rows that pass validation.
          </p>

          <div className="import-upload-box">
            <div className="import-file-row">
              <input
                className="import-file-input"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onChooseFile(e.target.files?.[0] || null)}
              />
            </div>

            <div style={{ marginTop: 12 }} className="import-muted">
              {file ? `Selected file: ${file.name}` : "No file selected"}
            </div>

            <label className="import-checkbox-row import-muted">
              <input
                type="checkbox"
                checked={options.skipBlankUpdates}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    skipBlankUpdates: e.target.checked,
                  }))
                }
              />
              Skip blank CSV values when updating existing records
            </label>
          </div>
        </div>

        <div className="import-card">
          <h2>Quick notes</h2>
          <div className="import-empty">
            New rows are safest when they include an Electronic ID. Existing
            rows match by Electronic ID first, then Account Number. Preview
            before import so conflicts and skipped rows are visible.
          </div>
        </div>
      </div>

      <div className="import-card">
        <h2>2. Mapping presets</h2>

        <p className="import-muted">
          Save reusable column mappings for common source files like Encore
          exports or legacy billing CSVs.
        </p>

        <div className="import-file-row" style={{ marginTop: 12 }}>
          <select
            className="import-select"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            disabled={templatesBusy}
          >
            <option value="">-- Select saved mapping --</option>
            {templates.map((template) => (
              <option key={template._id} value={template._id}>
                {template.name}
              </option>
            ))}
          </select>
          <button
            className="import-btn-ghost"
            type="button"
            onClick={handleSkipSavedMappings}
            disabled={busy}
          >
            Skip Saved Mappings
          </button>

          <button
            className="import-btn-secondary"
            type="button"
            onClick={handleApplyTemplate}
            disabled={!selectedTemplateId || busy}
          >
            Load Mapping
          </button>

          <button
            className="import-btn-ghost"
            type="button"
            onClick={handleDeleteTemplate}
            disabled={!selectedTemplateId || busy}
          >
            Delete Template
          </button>
        </div>

        <div className="import-file-row" style={{ marginTop: 12 }}>
          <input
            className="import-file-input"
            type="text"
            placeholder="Template name (example: Encore Export)"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />

          <button
            className="import-btn-primary"
            type="button"
            onClick={handleSaveTemplate}
            disabled={busy}
          >
            Save Current Mapping
          </button>
        </div>
      </div>

      <div className="import-card" ref={mappingSectionRef}>
        <h2>3. Map columns</h2>

        {!headers.length ? (
          <div className="import-empty">Choose a CSV file to load headers.</div>
        ) : (
          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th>Presto Field</th>
                  <th>CSV Column</th>
                </tr>
              </thead>
              <tbody>
                {DB_FIELDS.map((field) => (
                  <tr key={field.key}>
                    <td>
                      {field.label}
                      {field.required ? (
                        <span className="import-muted"> *</span>
                      ) : null}
                    </td>
                    <td>
                      <select
                        className="import-select"
                        value={mapping[field.key] || ""}
                        onChange={(e) =>
                          setMapping((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                      >
                        <option value="">-- Not mapped --</option>
                        {headers.map((header) => {
                          const alreadyUsed =
                            mappedHeaderSet.has(header) &&
                            mapping[field.key] !== header;
                          return (
                            <option
                              key={`${field.key}-${header}`}
                              value={header}
                              disabled={alreadyUsed}
                            >
                              {header}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="import-actions">
          <button
            className="import-btn-secondary"
            type="button"
            onClick={() => setMapping(autoMapHeaders(headers))}
            disabled={!headers.length || busy}
          >
            Auto-map headers
          </button>

          <button
            className="import-btn-primary"
            type="button"
            onClick={handlePreview}
            disabled={busy || !file}
          >
            Preview Import
          </button>

          <button
            className="import-btn-ghost"
            type="button"
            onClick={handleImport}
            disabled={busy || !file || !preview}
          >
            Run Import
          </button>
        </div>
      </div>

      {preview ? (
        <div className="import-card">
          <h2>4. Preview</h2>

          <div className="import-summary-grid">
            <div className="import-stat">
              <div className="import-stat-label">Total Rows</div>
              <div className="import-stat-value">
                {preview?.summary?.totalRows ?? 0}
              </div>
            </div>
            <div className="import-stat">
              <div className="import-stat-label">Valid Rows</div>
              <div className="import-stat-value">
                {preview?.summary?.validRows ?? 0}
              </div>
            </div>
            <div className="import-stat">
              <div className="import-stat-label">Invalid Rows</div>
              <div className="import-stat-value">
                {preview?.summary?.invalidRows ?? 0}
              </div>
            </div>
            <div className="import-stat">
              <div className="import-stat-label">Would Create</div>
              <div className="import-stat-value">
                {preview?.summary?.wouldCreate ?? 0}
              </div>
            </div>
            <div className="import-stat">
              <div className="import-stat-label">Would Update</div>
              <div className="import-stat-value">
                {preview?.summary?.wouldUpdate ?? 0}
              </div>
            </div>
            <div className="import-stat">
              <div className="import-stat-label">Would Skip</div>
              <div className="import-stat-value">
                {preview?.summary?.wouldSkip ?? 0}
              </div>
            </div>
          </div>

          <div className="import-link-row">
            <button
              className="import-btn-ghost"
              type="button"
              disabled={!previewProblemRows.length}
              onClick={() =>
                downloadImportRowsAsCsv(
                  "presto-preview-problem-rows.csv",
                  previewProblemRows,
                )
              }
            >
              Download Preview Failed/Skipped Rows
            </button>
          </div>

          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Action</th>
                  <th>Matched By</th>
                  <th>Electronic ID</th>
                  <th>Account Number</th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {(preview.rows || []).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <StatusTag value={row.status} />
                    </td>
                    <td>
                      <StatusTag value={row.action} />
                    </td>
                    <td>{row.matchedBy || "none"}</td>
                    <td>{row.electronicId || "—"}</td>
                    <td>{row.accountNumber || "—"}</td>
                    <td>
                      <div className="import-issues">
                        {row.errors?.map((msg, i) => (
                          <div
                            key={`e-${row.rowNumber}-${i}`}
                            className="import-error-text"
                          >
                            {msg}
                          </div>
                        ))}
                        {row.warnings?.map((msg, i) => (
                          <div
                            key={`w-${row.rowNumber}-${i}`}
                            className="import-warning-text"
                          >
                            {msg}
                          </div>
                        ))}
                        {!row.errors?.length && !row.warnings?.length
                          ? "—"
                          : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="import-card">
          <h2>5. Import Summary</h2>

          <div className="import-summary-grid">
            <div className="import-stat">
              <div className="import-stat-label">Total Rows</div>
              <div className="import-stat-value">
                {result?.summary?.totalRows ?? 0}
              </div>
            </div>
            <div className="import-stat">
              <div className="import-stat-label">Imported</div>
              <div className="import-stat-value">
                {result?.summary?.imported ?? 0}
              </div>
            </div>
            <div className="import-stat">
              <div className="import-stat-label">Updated</div>
              <div className="import-stat-value">
                {result?.summary?.updated ?? 0}
              </div>
            </div>
            <div className="import-stat">
              <div className="import-stat-label">Skipped</div>
              <div className="import-stat-value">
                {result?.summary?.skipped ?? 0}
              </div>
            </div>
            <div className="import-stat">
              <div className="import-stat-label">Failed</div>
              <div className="import-stat-value">
                {result?.summary?.failed ?? 0}
              </div>
            </div>
          </div>

          <div className="import-link-row">
            <button
              className="import-btn-ghost"
              type="button"
              disabled={!resultProblemRows.length}
              onClick={() =>
                downloadImportRowsAsCsv(
                  "presto-import-problem-rows.csv",
                  resultProblemRows,
                )
              }
            >
              Download Import Failed/Skipped Rows
            </button>

            {result?.importLogId ? (
              <Link
                className="import-detail-link"
                to={`/imports/history/${result.importLogId}`}
              >
                View saved import detail
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="import-card">
        <h2>Recent Import History</h2>

        {historyBusy ? (
          <LoadingBlock label="Loading history…" />
        ) : !history.length ? (
          <div className="import-empty">No imports yet.</div>
        ) : (
          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Imported</th>
                  <th>Updated</th>
                  <th>Skipped</th>
                  <th>Failed</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.originalFileName}</td>
                    <td>
                      <StatusTag value={log.status} />
                    </td>
                    <td>{log?.totals?.totalRows ?? 0}</td>
                    <td>{log?.totals?.imported ?? 0}</td>
                    <td>{log?.totals?.updated ?? 0}</td>
                    <td>{log?.totals?.skipped ?? 0}</td>
                    <td>{log?.totals?.failed ?? 0}</td>
                    <td>
                      <Link
                        className="import-detail-link"
                        to={`/imports/history/${log._id}`}
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {templatesBusy ? <LoadingBlock label="Loading mapping presets…" /> : null}
    </div>
  );
}
