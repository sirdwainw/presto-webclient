// src/api/meters.api.js
import { apiFetch } from "./apiClient";

// Full meters list (paged)
export function listMetersApi(params = {}) {
  const qs = new URLSearchParams();

  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));

  if (params.q) qs.set("q", String(params.q));
  if (params.missing) qs.set("missing", String(params.missing));

  // column filters
  if (params.electronicId) qs.set("electronicId", String(params.electronicId));
  if (params.accountNumber)
    qs.set("accountNumber", String(params.accountNumber));
  if (params.address) qs.set("address", String(params.address));
  if (params.route) qs.set("route", String(params.route));

  // sorting
  if (params.sortBy) qs.set("sortBy", String(params.sortBy));
  if (params.sortDir) qs.set("sortDir", String(params.sortDir));

  if (params.includeAssignments) qs.set("includeAssignments", "1");
  
  const query = qs.toString();
  return apiFetch(`/api/meters${query ? `?${query}` : ""}`, { method: "GET" });
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
export function listMetersQuickApi(params) {
  return listMetersApi({ ...params, limit: 8 });
}
