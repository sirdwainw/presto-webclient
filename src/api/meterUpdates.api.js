import { fetchJson } from "./fetch.js";

export function getMeterUpdates(meterId) {
  return fetchJson(`/api/meters/${encodeURIComponent(meterId)}/updates`, {
    method: "GET",
  });
}

export function postMeterUpdate(meterId, body) {
  return fetchJson(`/api/meters/${encodeURIComponent(meterId)}/updates`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
