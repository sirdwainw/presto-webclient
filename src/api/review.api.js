import { apiFetch } from "./apiClient";

export function listReviewUpdatesApi(params) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", String(params.status));
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  return apiFetch(`/api/review/updates?${qs.toString()}`, { method: "GET" });
}

export function reviewUpdateApi(updateId, body) {
  return apiFetch(`/api/review/updates/${encodeURIComponent(updateId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
