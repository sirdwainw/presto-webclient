import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

function NavLink({ to, children }) {
  const loc = useLocation();
  const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: active ? "rgba(78,161,255,0.18)" : "rgba(255,255,255,0.04)",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

export default function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "rgba(0,0,0,0.15)",
      }}
    >
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
        <div style={{ fontWeight: 800, letterSpacing: 0.4 }}>Presto</div>

        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: 10 }}
        >
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/meters">Meters</NavLink>

          {user?.role === "tech" && (
            <NavLink to="/tech/assignments">My Assignments</NavLink>
          )}

          {(user?.role === "admin" || user?.role === "superadmin") && (
            <>
              <NavLink to="/review/updates">Review</NavLink>
              <NavLink to="/reports">Reports</NavLink>
            </>
          )}

          {user?.role === "superadmin" && (
            <NavLink to="/superadmin/context">Company Context</NavLink>
          )}

          <NavLink to="/profile">Profile</NavLink>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          {user?.email && (
            <span className="small">
              {user.email} ({user.role})
            </span>
          )}
          <button className="btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
