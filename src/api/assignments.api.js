import { apiFetch } from "./apiClient";

export function listAssignableTechsApi() {
  return apiFetch("/api/assignments/techs", { method: "GET" });
}

export function postAssignments(body) {
  return apiFetch("/api/assignments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postAssignmentsByQuery(body) {
  return apiFetch("/api/assignments/by-query", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function unassignMetersApi({ meterIds }) {
  return apiFetch("/api/assignments/unassign", {
    method: "POST",
    body: JSON.stringify({ meterIds }),
  });
}