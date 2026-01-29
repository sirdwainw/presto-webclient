// src/api/updates.api.js
import { apiFetch } from "./apiClient";

export function getUpdateApi(updateId) {
  return apiFetch(`/api/updates/${encodeURIComponent(updateId)}`, {
    method: "GET",
  });
}

export function deleteUpdateApi(updateId) {
  return apiFetch(`/api/updates/${encodeURIComponent(updateId)}`, {
    method: "DELETE",
  });
}
