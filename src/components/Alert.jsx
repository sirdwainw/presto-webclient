import React from "react";

const map = {
  danger: { border: "rgba(255,78,78,0.45)", bg: "rgba(255,78,78,0.12)" },
  warn: { border: "rgba(245,197,66,0.45)", bg: "rgba(245,197,66,0.10)" },
  success: { border: "rgba(38,208,124,0.45)", bg: "rgba(38,208,124,0.10)" },
  info: { border: "rgba(78,161,255,0.45)", bg: "rgba(78,161,255,0.10)" },
};

export default function Alert({ type = "info", title, message }) {
  const s = map[type] || map.info;
  return (
    <div className="card" style={{ borderColor: s.border, background: s.bg }}>
      {title && <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>}
      <div style={{ color: "var(--text)" }}>{message}</div>
    </div>
  );
}
