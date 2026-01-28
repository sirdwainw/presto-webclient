import { apiFetch } from "./apiClient";

export function reportsDashboardApi() {
  return apiFetch("/api/reports/dashboard", { method: "GET" });
}

export function reportsDataQualityApi() {
  return apiFetch("/api/reports/data-quality", { method: "GET" });
}

export function reportsRoutesApi() {
  return apiFetch("/api/reports/routes", { method: "GET" });
}

export function reportsTechsApi(params) {
  const qs = new URLSearchParams();
  if (params?.days) qs.set("days", String(params.days));
  if (params?.start) qs.set("start", String(params.start));
  if (params?.end) qs.set("end", String(params.end));
  return apiFetch(`/api/reports/techs?${qs.toString()}`, { method: "GET" });
}

export function reportsActivityApi(params) {
  const qs = new URLSearchParams();
  if (params?.days) qs.set("days", String(params.days));
  if (params?.start) qs.set("start", String(params.start));
  if (params?.end) qs.set("end", String(params.end));
  return apiFetch(`/api/reports/activity?${qs.toString()}`, { method: "GET" });
}
