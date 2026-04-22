import { apiFetch } from "./apiClient";

export function techAssignmentsApi(params = {}) {
  const qs = new URLSearchParams();

  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));

  const query = qs.toString();

  return apiFetch(`/api/tech/assignments${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

export function techUpdatesApi(params = {}) {
  const qs = new URLSearchParams();

  if (params.status) qs.set("status", String(params.status));
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.date) qs.set("date", String(params.date));

  const query = qs.toString();

  return apiFetch(`/api/tech/updates${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

/* Backwards-compatible aliases */
export const getTechAssignmentsApi = techAssignmentsApi;
export const getTechUpdatesApi = techUpdatesApi;