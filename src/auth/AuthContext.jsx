import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loginApi, meApi, registerApi } from "../api/auth.api";
import { clearToken, setToken } from "../api/apiClient";

const USER_KEY = "presto_user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [isInitializing, setIsInitializing] = useState(true);
  const [authError, setAuthError] = useState(null);

  function storeUser(u) {
    setUser(u);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  }

  async function refreshMe() {
    const payload = await meApi(); // { user: {...} }
    storeUser(payload?.user ?? null);
    return payload?.user ?? null;
  }

  async function login(email, password) {
    setAuthError(null);
    const payload = await loginApi({ email, password }); // { token, user }
    setToken(payload.token);
    storeUser(payload.user ?? null);
    return payload;
  }

  async function register(body) {
    setAuthError(null);
    const payload = await registerApi(body); // { token, user }
    setToken(payload.token);
    storeUser(payload.user ?? null);
    return payload;
  }

  function logout() {
    clearToken();
    storeUser(null);
  }

  useEffect(() => {
    function onUnauthorized() {
      logout();
    }
    window.addEventListener("presto:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("presto:unauthorized", onUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // On app load: if token exists, call /api/auth/me and set user
    async function init() {
      setIsInitializing(true);
      setAuthError(null);
      try {
        await refreshMe();
      } catch (e) {
        // if token invalid / user not found etc, clear
        logout();
        setAuthError(e);
      } finally {
        setIsInitializing(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthed: Boolean(user),
      isInitializing,
      authError,
      login,
      register,
      logout,
      refreshMe,
      setAuthError,
    }),
    [user, isInitializing, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
