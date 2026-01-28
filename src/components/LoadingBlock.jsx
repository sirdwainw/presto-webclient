import React from "react";

export function LoadingBlock({ title = "Loading..." }) {
  return (
    <div className="card">
      <div className="row">
        <div className="spinner" />
        <div>
          <div className="h2">{title}</div>
          <div className="muted">Please wait.</div>
        </div>
      </div>
    </div>
  );
}
