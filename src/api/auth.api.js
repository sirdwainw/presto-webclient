import { apiFetch } from "./apiClient";

export function registerApi(body) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function loginApi(body) {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function meApi() {
  return apiFetch("/api/auth/me", { method: "GET" });
}

// Backwards-compatible alias (your old Settings placeholder imported getMe)
export const getMe = meApi;

// NEW: persist active company + receive refreshed JWT
export function setActiveCompanyApi(companyId) {
  return apiFetch("/api/auth/set-active-company", {
    method: "POST",
    body: JSON.stringify({ companyId }),
  });
}
