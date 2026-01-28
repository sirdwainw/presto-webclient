import { apiFetch } from "./apiClient";

export function setAdminContextApi(body) {
  return apiFetch("/api/admin/context", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
