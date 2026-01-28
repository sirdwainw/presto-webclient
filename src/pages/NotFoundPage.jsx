import React from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="card">
      <div className="h1">Not Found</div>
      <p className="muted">That route doesn’t exist.</p>
      <Link className="btn" to="/dashboard">
        Go to dashboard
      </Link>
    </div>
  );
}
