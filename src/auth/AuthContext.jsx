import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loginApi, meApi } from "../api/auth.api";
import { clearToken, getToken, setToken } from "../api/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true); // new name
  const [loading, setLoading] = useState(false); // action-level loading (login, etc.)
  const [error, setError] = useState(null);

  async function refreshMe({ silent = false } = {}) {
    const token = getToken();

    // No token => not signed in; don't call /me
    if (!token) {
      setUser(null);
      if (!silent) setError(null);
      return null;
    }

    try {
      const res = await meApi(); // { user: {...} }
      setUser(res?.user ?? null);
      if (!silent) setError(null);
      return res?.user ?? null;
    } catch (err) {
      // apiFetch throws plain object: { status, error, raw }
      if (err?.status === 401) {
        clearToken();
        setUser(null);
        if (!silent) setError(null);
        return null;
      }

      if (!silent) setError(err?.error || "Failed to load session");
      throw err;
    }
  }

  async function login(emailOrObj, maybePassword) {
    setLoading(true);
    setError(null);

    // Support BOTH call styles:
    // login({ email, password })  ✅ preferred
    // login(email, password)      ✅ backwards compatible
    const body =
      typeof emailOrObj === "object" && emailOrObj !== null
        ? emailOrObj
        : { email: emailOrObj, password: maybePassword };

    try {
      const res = await loginApi(body); // { token, user } (and loginApi sets token too if you implemented it)
      if (res?.token) setToken(res.token); // harmless if already set inside loginApi
      setUser(res?.user ?? null);
      return res;
    } catch (err) {
      setUser(null);
      setError(err?.error || "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    setError(null);
  }

  // Boot init: only call /me if token exists; silent to avoid console noise
  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        await refreshMe({ silent: true });
      } finally {
        if (alive) setBooting(false);
      }
    }

    init();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global 401 listener from apiFetch
  useEffect(() => {
    function onUnauthorized() {
      clearToken();
      setUser(null);
      setError(null);
    }

    window.addEventListener("presto:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("presto:unauthorized", onUnauthorized);
  }, []);

  const isAuthenticated = !!user;

  const value = useMemo(
    () => ({
      // canonical
      user,
      role: user?.role || null,
      isAuthenticated,
      booting,
      loading,
      error,

      // backwards-compatible aliases (so ProtectedRoute/RequireRole don’t break)
      isAuthed: isAuthenticated,
      isInitializing: booting,

      // actions
      login,
      logout,
      refreshMe,
      setUser,
    }),
    [user, isAuthenticated, booting, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
