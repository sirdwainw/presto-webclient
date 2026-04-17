import React from "react";

function normalizeStatus(status) {
  return String(status || "")
    .toLowerCase()
    .trim();
}

function getStatusStyles(status) {
  const s = normalizeStatus(status);

  if (s === "approved") {
    return {
      background: "rgba(46, 204, 113, 0.18)",
      border: "1px solid rgba(46, 204, 113, 0.45)",
      color: "rgba(220,255,235,0.95)",
    };
  }

  if (s === "rejected") {
    return {
      background: "rgba(231, 76, 60, 0.18)",
      border: "1px solid rgba(231, 76, 60, 0.45)",
      color: "rgba(255,230,226,0.95)",
    };
  }

  if (s === "submitted") {
    return {
      background: "rgba(241, 196, 15, 0.18)",
      border: "1px solid rgba(241, 196, 15, 0.45)",
      color: "rgba(255,247,204,0.95)",
    };
  }

  return {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.92)",
  };
}

export function StatusBadge({ status, style, className = "" }) {
  const styles = getStatusStyles(status);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 700,
        textTransform: "capitalize",
        lineHeight: 1.2,
        ...styles,
        ...style,
      }}
    >
      {normalizeStatus(status) || "unknown"}
    </span>
  );
}
