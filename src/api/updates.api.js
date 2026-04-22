import { apiFetch } from "./apiClient";

export function createUpdateApi(meterId, payload) {
  return apiFetch("/api/updates", {
    method: "POST",
    body: JSON.stringify({
      meterId,
      ...payload,
    }),
  });
}

export function listUpdatesApi(params = {}) {
  const qs = new URLSearchParams();

  if (params.meterId) qs.set("meterId", String(params.meterId));
  if (params.status) qs.set("status", String(params.status));
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.date) qs.set("date", String(params.date));

  const query = qs.toString();

  return apiFetch(`/api/updates${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

export function getUpdateApi(id) {
  return apiFetch(`/api/updates/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export const postUpdateApi = createUpdateApi;
export const getUpdatesApi = listUpdatesApi;
export const fetchUpdateApi = getUpdateApi;