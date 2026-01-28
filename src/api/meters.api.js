import { apiFetch } from "./apiClient";

export function listMetersApi(params) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.q) qs.set("q", String(params.q));
  if (params?.missing) qs.set("missing", String(params.missing)); // comma list
  return apiFetch(`/api/meters?${qs.toString()}`, { method: "GET" });
}

export function getMeterApi(id) {
  return apiFetch(`/api/meters/${encodeURIComponent(id)}`, { method: "GET" });
}

export function listMeterUpdatesApi(meterId) {
  return apiFetch(`/api/meters/${encodeURIComponent(meterId)}/updates`, {
    method: "GET",
  });
}

export function createMeterUpdateApi(meterId, body) {
  return apiFetch(`/api/meters/${encodeURIComponent(meterId)}/updates`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
