import React from "react";

export default function Spinner({ label = "Loading..." }) {
  return (
    <div
      className="card"
      style={{ display: "flex", alignItems: "center", gap: 10 }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.25)",
          borderTopColor: "rgba(78,161,255,0.9)",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <div>{label}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
