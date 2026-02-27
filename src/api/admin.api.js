import { apiFetch } from "./apiClient";

export function setAdminContextApi(body) {
  return apiFetch("/api/admin/context", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
export function deactivateUserApi(userId) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/deactivate`, {
    method: "PATCH",
  });
}