import React from "react";
import { Link } from "react-router-dom";
import { getEntityId } from "../api/apiClient";

function buildPrimary(meter, meterId) {
  if (meter?.electronicId) return `Electronic ID: ${meter.electronicId}`;
  if (meter?.accountNumber) return `Account: ${meter.accountNumber}`;
  if (meter?.meterSerialNumber) return `Serial: ${meter.meterSerialNumber}`;
  if (meterId) return `Meter`;
  return "Meter";
}

function buildSecondary(meter, meterId) {
  const parts = [];

  if (
    meter?.accountNumber &&
    !String(buildPrimary(meter, meterId)).includes("Account:")
  ) {
    parts.push(`Acct ${meter.accountNumber}`);
  }

  if (meter?.address) parts.push(meter.address);
  if (meter?.route) parts.push(`Route ${meter.route}`);

  return parts.join(" • ");
}

export function MeterLabel({
  meter,
  meterId,
  to,
  showSystemId = false,
  systemIdPrefix = "System ID",
}) {
  const id = meterId || getEntityId(meter) || "";
  const primary = buildPrimary(meter, id);
  const secondary = buildSecondary(meter, id);

  const content = (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontWeight: 800 }}>{primary}</div>
      {secondary ? <div className="muted">{secondary}</div> : null}
      {showSystemId && id ? (
        <div className="muted" style={{ fontSize: 12 }}>
          {systemIdPrefix}: <code>{id}</code>
        </div>
      ) : null}
    </div>
  );

  if (to && id) return <Link to={to}>{content}</Link>;
  return content;
}
