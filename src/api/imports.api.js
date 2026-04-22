import { apiFetch } from "./apiClient";

export function previewMeterImportApi(formData) {
  return apiFetch("/api/imports/meters/preview", {
    method: "POST",
    body: formData,
  });
}

export function commitMeterImportApi(formData) {
  return apiFetch("/api/imports/meters/commit", {
    method: "POST",
    body: formData,
  });
}

export function listImportHistoryApi(params = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status) qs.set("status", String(params.status));
  if (params.fileName) qs.set("fileName", String(params.fileName));

  const query = qs.toString();
  return apiFetch(`/api/imports/history${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

export function getImportHistoryDetailApi(id) {
  return apiFetch(`/api/imports/history/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export function listImportTemplatesApi() {
  return apiFetch("/api/imports/templates", {
    method: "GET",
  });
}

export function saveImportTemplateApi(payload) {
  return apiFetch("/api/imports/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function deleteImportTemplateApi(id) {
  return apiFetch(`/api/imports/templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}