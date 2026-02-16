// src/components/AppLayout.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { quickMetersSearchApi } from "../api/meters.api";
import { getEntityId } from "../api/apiClient";

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

function formatMeterLabel(m) {
  const eid = m?.electronicId ?? "";
  const acct = m?.accountNumber ?? "";
  const addr = m?.address ?? "";
  const cust = m?.customerName ?? "";
  const route = m?.route ?? "";
  const parts = [
    eid ? `EID ${eid}` : "",
    acct ? `Acct ${acct}` : "",
    addr,
    cust ? `(${cust})` : "",
    route ? `• Route ${route}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function GlobalMeterSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 250);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    async function run() {
      setErr("");
      if (!dq.trim()) {
        setItems([]);
        return;
      }
      setBusy(true);
      try {
        const res = await quickMetersSearchApi(dq.trim(), 8);
        setItems(res?.meters || []);
      } catch (e) {
        setErr(e?.error || "Search failed");
        setItems([]);
      } finally {
        setBusy(false);
      }
    }
    run();
  }, [dq]);

  const showDropdown = open && (busy || err || items.length > 0 || dq.trim());

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "min(520px, 48vw)" }}
    >
      <input
        className="input"
        value={q}
        placeholder="Global meter search (EID, acct, address, customer, route)…"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        style={{ height: 38 }}
      />

      {showDropdown ? (
        <div
          className="card"
          style={{
            position: "absolute",
            top: 44,
            left: 0,
            right: 0,
            zIndex: 50,
            padding: 8,
            maxHeight: 320,
            overflow: "auto",
            background: "rgba(10, 18, 35, 0.98)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {busy ? (
            <div className="muted" style={{ padding: 8 }}>
              Searching…
            </div>
          ) : null}
          {err ? (
            <div className="muted" style={{ padding: 8 }}>
              {err}
            </div>
          ) : null}

          {!busy && !err && items.length === 0 ? (
            <div className="muted" style={{ padding: 8 }}>
              No matches.
            </div>
          ) : null}

          {!busy && !err && items.length ? (
            <div className="stack" style={{ gap: 6 }}>
              {items.map((m, idx) => {
                const id = getEntityId(m);
                const key = id || idx;
                return (
                  <button
                    key={key}
                    type="button"
                    className="btn"
                    style={{ textAlign: "left" }}
                    onClick={() => {
                      if (!id) return;
                      setOpen(false);
                      setQ("");
                      // Choose where you want to land:
                      nav(`/meters/${encodeURIComponent(id)}`);
                      // or updates page:
                      // nav(`/meters/${encodeURIComponent(id)}/updates`);
                    }}
                    title="Go to meter"
                  >
                    {formatMeterLabel(m)}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
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

        {/* ✅ Global search lives here (NOT NavBar.jsx) */}
        <div
          style={{
            marginLeft: 16,
            marginRight: 16,
            flex: 1,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <GlobalMeterSearch />
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
