import { apiFetch } from "./apiClient";

export function listTechAssignmentsApi(params) {
  const qs = new URLSearchParams();
  if (params?.active !== undefined) qs.set("active", String(params.active));
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  return apiFetch(`/api/tech/assignments?${qs.toString()}`, { method: "GET" });
}
