import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { getImportHistoryDetailApi } from "../api/imports.api";
import "./ImportCenterPage.css";

function StatusTag({ value }) {
  const cls = String(value || "none").toLowerCase();
  return <span className={`import-tag ${cls}`}>{value || "—"}</span>;
}

export function ImportHistoryDetailPage() {
  const { id } = useParams();
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      setBusy(true);
      setError("");
      try {
        const res = await getImportHistoryDetailApi(id);
        setLog(res);
      } catch (e) {
        setError(e?.error || "Failed to load import detail.");
      } finally {
        setBusy(false);
      }
    }
    run();
  }, [id]);

  if (busy) return <LoadingBlock label="Loading import detail…" />;
  if (error) return <ErrorBanner>{error}</ErrorBanner>;
  if (!log) return <ErrorBanner>Import detail not found.</ErrorBanner>;

  return (
    <div className="import-center">
      <div className="import-card">
        <div className="import-link-row" style={{ marginTop: 0, marginBottom: 12 }}>
          <Link className="import-detail-link" to="/imports">
            ← Back to Import Center
          </Link>
        </div>

        <h1 style={{ marginTop: 0 }}>Import Detail</h1>

        <div className="import-summary-grid">
          <div className="import-stat">
            <div className="import-stat-label">File</div>
            <div className="import-stat-value import-small-stat">
              {log.originalFileName}
            </div>
          </div>
          <div className="import-stat">
            <div className="import-stat-label">Status</div>
            <div style={{ marginTop: 10 }}>
              <StatusTag value={log.status} />
            </div>
          </div>
          <div className="import-stat">
            <div className="import-stat-label">Created</div>
            <div className="import-stat-value import-small-stat">
              {new Date(log.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="import-stat">
            <div className="import-stat-label">Uploaded By</div>
            <div className="import-stat-value import-small-stat">
              {log.uploadedBy?.name || "Unknown"}
              {log.uploadedBy?.email ? (
                <div className="import-muted import-subtle-line">{log.uploadedBy.email}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="import-card">
        <h2>Summary</h2>
        <div className="import-summary-grid">
          <div className="import-stat">
            <div className="import-stat-label">Total Rows</div>
            <div className="import-stat-value">{log?.totals?.totalRows ?? 0}</div>
          </div>
          <div className="import-stat">
            <div className="import-stat-label">Valid Rows</div>
            <div className="import-stat-value">{log?.totals?.validRows ?? 0}</div>
          </div>
          <div className="import-stat">
            <div className="import-stat-label">Invalid Rows</div>
            <div className="import-stat-value">{log?.totals?.invalidRows ?? 0}</div>
          </div>
          <div className="import-stat">
            <div className="import-stat-label">Imported</div>
            <div className="import-stat-value">{log?.totals?.imported ?? 0}</div>
          </div>
          <div className="import-stat">
            <div className="import-stat-label">Updated</div>
            <div className="import-stat-value">{log?.totals?.updated ?? 0}</div>
          </div>
          <div className="import-stat">
            <div className="import-stat-label">Skipped</div>
            <div className="import-stat-value">{log?.totals?.skipped ?? 0}</div>
          </div>
          <div className="import-stat">
            <div className="import-stat-label">Failed</div>
            <div className="import-stat-value">{log?.totals?.failed ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="import-card">
        <h2>Stored Row Results</h2>

        {!log?.rowResults?.length ? (
          <div className="import-empty">No row results were stored for this import.</div>
        ) : (
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
                {log.rowResults.map((row) => (
                  <tr key={`${row.rowNumber}-${row.electronicId}-${row.accountNumber}`}>
                    <td>{row.rowNumber}</td>
                    <td><StatusTag value={row.status} /></td>
                    <td><StatusTag value={row.action} /></td>
                    <td>{row.matchedBy || "none"}</td>
                    <td>{row.electronicId || "—"}</td>
                    <td>{row.accountNumber || "—"}</td>
                    <td>
                      <div className="import-issues">
                        {row.errors?.map((msg, i) => (
                          <div key={`e-${row.rowNumber}-${i}`} className="import-error-text">
                            {msg}
                          </div>
                        ))}
                        {row.warnings?.map((msg, i) => (
                          <div key={`w-${row.rowNumber}-${i}`} className="import-warning-text">
                            {msg}
                          </div>
                        ))}
                        {!row.errors?.length && !row.warnings?.length ? "—" : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}