import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getMeterApi } from "../api/meters.api";
import { listCompaniesApi } from "../api/companies.api";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingBlock } from "../components/LoadingBlock";
import { useAuth } from "../auth/AuthContext";
import { getEntityId } from "../api/apiClient";

function isCompanyScopeError(e) {
  const msg = String(e?.error || e?.message || "");
  return e?.status === 400 && msg.startsWith("No company scope selected");
}

function fmtDate(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

function safe(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function FieldRow({ label, value, copyable = false, onCopy }) {
  const show = value !== "" && value !== null && value !== undefined;

  return (
    <div>
      <div
        className="muted"
        style={{ display: "flex", gap: 8, alignItems: "center" }}
      >
        <span>{label}</span>
        {copyable && show ? (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => onCopy?.(String(value))}
            title={`Copy ${label}`}
            style={{ padding: "4px 8px", fontSize: 12 }}
          >
            Copy
          </button>
        ) : null}
      </div>
      <div className={label === "System ID" ? "mono" : ""}>
        {show ? value : ""}
      </div>
    </div>
  );
}

export function MeterDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const role = user?.role;
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meterPayload, setMeterPayload] = useState(null);

  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");

  const [copiedMsg, setCopiedMsg] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMeterApi(id); // { meter }
        setMeterPayload(data);
      } catch (e) {
        if (isCompanyScopeError(e) && role === "superadmin") {
          nav("/settings");
          return;
        }
        setError(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, role, nav]);

  const meter = meterPayload?.meter;
  const meterId = getEntityId(meter) || id;

  const canUpdate =
    role === "tech" || role === "admin" || role === "superadmin";
  const isSuperadmin = role === "superadmin";

  // Resolve company name from meter.companyId via /api/companies
  useEffect(() => {
    async function resolveCompanyName() {
      try {
        const cid = meter?.companyId ? String(meter.companyId) : "";
        if (!cid) return;

        const data = await listCompaniesApi(); // { companies: [...] }
        const companies = data?.companies || [];

        const match = companies.find((c) => {
          const id = getEntityId(c);
          return id && String(id) === cid;
        });

        if (match) {
          setCompanyName(match?.name ?? "");
          setCompanyCode(match?.code ?? "");
        }
      } catch {
        // non-blocking: if it fails, we just won't show the name/code
      }
    }

    if (meter?.companyId) resolveCompanyName();
  }, [meter?.companyId]);

  async function copyToClipboard(label, text) {
    const value = String(text || "").trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedMsg(`${label} copied`);
      window.setTimeout(() => setCopiedMsg(""), 1600);
    } catch {
      // fallback for older browsers / permission cases
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopiedMsg(`${label} copied`);
        window.setTimeout(() => setCopiedMsg(""), 1600);
      } catch {
        setCopiedMsg("Copy failed");
        window.setTimeout(() => setCopiedMsg(""), 1600);
      }
    }
  }

  const companyDisplay = useMemo(() => {
    if (companyName && companyCode) return `${companyName} (${companyCode})`;
    if (companyName) return companyName;
    return ""; // hide if unknown
  }, [companyName, companyCode]);

  // Build visible fields (no raw JSON)
  const fields = useMemo(() => {
    if (!meter) return [];

    const arr = [];

    // Company name is the friendly display for everyone (not companyId)
    if (companyDisplay) {
      arr.push({ label: "Company", value: companyDisplay, copyable: false });
    }

    // ONLY superadmin sees internal IDs
    if (isSuperadmin) {
      arr.push({ label: "System ID", value: meterId, copyable: true });
      arr.push({
        label: "Company ID",
        value: safe(meter.companyId),
        copyable: true,
      });
    }

    // Core identifiers
    arr.push({
      label: "Electronic ID",
      value: safe(meter.electronicId),
      copyable: true,
    });
    arr.push({
      label: "Account Number",
      value: safe(meter.accountNumber),
      copyable: true,
    });
    arr.push({
      label: "Meter Serial Number",
      value: safe(meter.meterSerialNumber),
      copyable: false,
    });

    // Customer/location
    arr.push({
      label: "Customer Name",
      value: safe(meter.customerName),
      copyable: false,
    });
    arr.push({ label: "Address", value: safe(meter.address), copyable: true });
    arr.push({ label: "Route", value: safe(meter.route), copyable: false });
    arr.push({
      label: "Unit Type",
      value: safe(meter.unitType),
      copyable: false,
    });

    // Field capture / quality
    arr.push({
      label: "Latitude",
      value: safe(meter.latitude),
      copyable: true,
    });
    arr.push({
      label: "Longitude",
      value: safe(meter.longitude),
      copyable: true,
    });
    arr.push({
      label: "Location Notes",
      value: safe(meter.locationNotes),
      copyable: false,
    });
    arr.push({
      label: "Meter Size",
      value: safe(meter.meterSize),
      copyable: false,
    });
    arr.push({
      label: "Number of Pictures",
      value: safe(meter.numberOfPictures),
      copyable: false,
    });

    // System fields
    arr.push({ label: "Source", value: safe(meter.source), copyable: false });
    arr.push({
      label: "Last Synced At",
      value: fmtDate(meter.lastSyncedAt),
      copyable: false,
    });
    arr.push({
      label: "Created At",
      value: fmtDate(meter.createdAt),
      copyable: false,
    });
    arr.push({
      label: "Updated At",
      value: fmtDate(meter.updatedAt),
      copyable: false,
    });
    arr.push({
      label: "Last Approved Update At",
      value: fmtDate(meter.lastApprovedUpdateAt),
      copyable: false,
    });

    return arr.filter((f) => f.value !== "");
  }, [meter, meterId, isSuperadmin, companyDisplay]);

  return (
    <div className="stack">
      <div className="card">
        <div className="row space-between">
          <div>
            <div className="h1">Meter Card</div>
            <div className="muted">
              Detailed view for meter{" "}
              {meter ? (
                <strong>
                  {meter?.electronicId || meter?.accountNumber || "—"}
                </strong>
              ) : (
                <strong>{id}</strong>
              )}
            </div>
          </div>

          <div className="row">
            <Link className="btn" to="/meters">
              Back to meters
            </Link>

            {canUpdate ? (
              <Link
                className="btn btn-primary"
                to={`/meters/${encodeURIComponent(meterId)}/updates`}
                title="Create a meter location update"
              >
                Update
              </Link>
            ) : (
              <Link
                className="btn"
                to={`/meters/${encodeURIComponent(meterId)}/updates`}
                title="View meter updates"
              >
                Updates
              </Link>
            )}
          </div>
        </div>

        {copiedMsg ? (
          <div style={{ marginTop: 10 }}>
            <span className="pill">{copiedMsg}</span>
          </div>
        ) : null}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loading ? <LoadingBlock title="Loading meter..." /> : null}

      {!loading && meter ? (
        <div className="card">
          <div className="h2">All Details</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Customer-facing fields only. (Debug IDs available in dropdown for
            superadmin.)
          </div>

          {isSuperadmin ? (
            <details style={{ marginTop: 10 }}>
              <summary className="muted">Debug (internal IDs)</summary>
              <div className="grid grid-3" style={{ marginTop: 12 }}>
                <FieldRow
                  label="System ID"
                  value={meterId}
                  copyable={true}
                  onCopy={(val) => copyToClipboard("System ID", val)}
                />
                <FieldRow
                  label="Company ID"
                  value={safe(meter?.companyId)}
                  copyable={true}
                  onCopy={(val) => copyToClipboard("Company ID", val)}
                />
              </div>
            </details>
          ) : null}

          <div className="grid grid-3" style={{ marginTop: 12 }}>
            {fields.map((f) => (
              <FieldRow
                key={f.label}
                label={f.label}
                value={f.value}
                copyable={f.copyable}
                onCopy={(val) => copyToClipboard(f.label, val)}
              />
            ))}
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <Link
              className="btn"
              to={`/meters/${encodeURIComponent(meterId)}/updates`}
            >
              View updates / history
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
