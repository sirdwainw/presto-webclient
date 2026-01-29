import { apiFetch } from "./apiClient";

export function getMeterUpdates(meterId) {
  return apiFetch(`/api/meters/${encodeURIComponent(meterId)}/updates`, {
    method: "GET",
  });
}

export function postMeterUpdate(meterId, body) {
  return apiFetch(`/api/meters/${encodeURIComponent(meterId)}/updates`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
