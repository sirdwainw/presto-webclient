import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loginApi, meApi, registerApi } from "../api/auth.api";
import { clearToken, getToken, setToken } from "../api/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function refreshMe({ silent = false } = {}) {
    const token = getToken();

    if (!token) {
      setUser(null);
      if (!silent) setError(null);
      return null;
    }

    try {
      const res = await meApi();
      setUser(res?.user ?? null);
      if (!silent) setError(null);
      return res?.user ?? null;
    } catch (err) {
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

    const body =
      typeof emailOrObj === "object" && emailOrObj !== null
        ? emailOrObj
        : { email: emailOrObj, password: maybePassword };

    try {
      const res = await loginApi(body);
      if (res?.token) setToken(res.token);
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

  async function register(payload) {
    setLoading(true);
    setError(null);

    try {
      const res = await registerApi(payload);
      if (res?.token) setToken(res.token);
      setUser(res?.user ?? null);
      return res;
    } catch (err) {
      setUser(null);
      setError(err?.error || "Registration failed");
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
  }, []);

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
      user,
      role: user?.role || null,
      isAuthenticated,
      booting,
      loading,
      error,

      isAuthed: isAuthenticated,
      isInitializing: booting,

      login,
      register,
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
