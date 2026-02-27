import { apiFetch, setToken, clearToken } from "./apiClient";

export function registerApi(body) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function loginApi(body) {
  // 1) Login gets the JWT
  const login = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const token = login?.token || login?.accessToken;
  if (!token) {
    throw { status: 500, error: "Login succeeded but no token was returned." };
  }

  // ✅ Persist token BEFORE calling /me so Authorization header exists
  setToken(token);

  // 2) Now /me should succeed
  const me = await apiFetch("/api/auth/me", { method: "GET" });

  // Optional UX (only works if backend returns active in /me)
  if (me?.user?.active === false) {
    clearToken();
    throw {
      status: 403,
      error: "Your account is inactive. Please contact an administrator.",
    };
  }

  return { ...login, token, user: me.user };
}

export function meApi() {
  return apiFetch("/api/auth/me", { method: "GET" });
}

// Backwards-compatible alias for meApi
export const getMe = meApi;

// persist active company + receive refreshed JWT
export function setActiveCompanyApi(companyId) {
  return apiFetch("/api/auth/set-active-company", {
    method: "POST",
    body: JSON.stringify({ companyId }),
  });
}
