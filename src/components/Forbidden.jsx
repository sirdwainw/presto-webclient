import React from "react";

export function Forbidden({ allowed, role }) {
  return (
    <div className="card">
      <div className="h2">Forbidden</div>
      <p className="muted">
        Your role <strong>{role || "unknown"}</strong> cannot access this page.
      </p>
      <p className="muted">
        Allowed roles:{" "}
        <strong>
          {Array.isArray(allowed) ? allowed.join(", ") : String(allowed)}
        </strong>
      </p>
    </div>
  );
}
