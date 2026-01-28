import { fetchJson } from "./fetch.js";

export function postAssignments(body) {
  return fetchJson("/api/assignments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postAssignmentsByQuery(body) {
  return fetchJson("/api/assignments/by-query", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
