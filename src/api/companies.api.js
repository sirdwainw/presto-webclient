import { apiFetch } from "./apiClient";

export function listCompaniesApi() {
  return apiFetch("/api/companies", { method: "GET" });
}
