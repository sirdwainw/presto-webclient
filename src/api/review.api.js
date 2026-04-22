import { apiFetch } from "./apiClient";

export function reviewQueueApi(params = {}) {
  const qs = new URLSearchParams();

  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status) qs.set("status", String(params.status));

  const query = qs.toString();

  return apiFetch(`/api/review/updates${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

export function reviewUpdateApi(id, status) {
  return apiFetch(`/api/review/updates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/* Backwards-compatible aliases */
export const getReviewQueueApi = reviewQueueApi;
export const patchReviewUpdateApi = reviewUpdateApi;