import React from "react";

export function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;

  const msg =
    typeof error === "string"
      ? error
      : error?.error
        ? error.error
        : error?.message
          ? error.message
          : "Something went wrong";

  return (
    <div className="alert alert-danger">
      <div>
        <strong>Error:</strong> {msg}
        {typeof error?.status === "number" ? (
          <span className="muted"> (HTTP {error.status})</span>
        ) : null}
      </div>
      {onDismiss ? (
        <button className="btn btn-ghost" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
