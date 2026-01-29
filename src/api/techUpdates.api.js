import { apiFetch } from "./apiClient";

export function listMyTechUpdatesApi({ status, page = 1, limit = 50 } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", String(status));
  if (page) qs.set("page", String(page));
  if (limit) qs.set("limit", String(limit));

  const s = qs.toString();
  return apiFetch(`/api/tech/updates${s ? `?${s}` : ""}`);
}
