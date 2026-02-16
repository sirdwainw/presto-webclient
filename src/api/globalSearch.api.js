// src/api/globalSearch.api.js
import { apiFetch } from "./apiClient";

// Global quick search for jump-to actions (dropdown)
export function globalMeterSearchApi(q, { limit = 8 } = {}) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", String(q));
  qs.set("limit", String(limit));

  return apiFetch(`/api/meters?${qs.toString()}`, { method: "GET" });
}
