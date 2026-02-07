import { apiFetch } from "./apiClient";

export function listTechAssignmentsApi() {
  return apiFetch(`/api/tech/assignments`, { method: "GET" });
}
