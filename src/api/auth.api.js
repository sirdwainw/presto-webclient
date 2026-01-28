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
