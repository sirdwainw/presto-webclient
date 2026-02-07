import React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function NavItem({ to, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
    >
      {children}
    </NavLink>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role = user?.role;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Link to="/dashboard" className="brand-link">
            Presto
          </Link>
          <span className="pill">{role || "unknown"}</span>
        </div>

        <div className="topbar-right">
          <span className="muted">
            {user?.name || "User"} • {user?.email || ""}
          </span>
          <button
            className="btn"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          <nav className="nav">
            <NavItem to="/dashboard" end>
              Dashboard
            </NavItem>
            <NavItem to="/meters">Meters</NavItem>
            <NavItem to="/profile">Profile</NavItem>
            <NavItem to="/settings">Settings</NavItem>

            {role === "tech" && (
              <>
                <NavItem to="/tech/assignments">My Assignments</NavItem>
                <NavItem to="/tech/updates">My Updates</NavItem>
              </>
            )}

            {(role === "admin" || role === "superadmin") && (
              <>
                <NavItem to="/assignments">Assignments</NavItem>
                <NavItem to="/review/updates">Review Queue</NavItem>
                <NavItem to="/reports">Reports</NavItem>
              </>
            )}

            {role === "superadmin" && (
              <NavItem to="/superadmin/context">Company Context</NavItem>
            )}
          </nav>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
