import React from "react";

export function SuccessBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="alert alert-success">
      <div>
        <strong>Success:</strong> {message}
      </div>
      {onDismiss ? (
        <button className="btn btn-ghost" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
