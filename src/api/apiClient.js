const TOKEN_KEY = "presto_token";

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || "http://localhost:4000";
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function normalizeErrorPayload(payload) {
  // backend contract examples: { error: "..." }, sometimes { message: "..." }
  if (!payload || typeof payload !== "object")
    return { error: "Request failed" };
  if (typeof payload.error === "string") return { error: payload.error };
  if (typeof payload.message === "string") return { error: payload.message };
  return { error: "Request failed" };
}

export function getEntityId(obj) {
  // IMPORTANT: We do not guess shapes. We only use ids if they exist at runtime.
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.id === "string" || typeof obj.id === "number")
    return String(obj.id);
  if (typeof obj._id === "string" || typeof obj._id === "number")
    return String(obj._id);

  // Some APIs return Mongo-ish objects; only use if present.
  if (
    obj._id &&
    typeof obj._id === "object" &&
    typeof obj._id.$oid === "string"
  )
    return obj._id.$oid;

  if (typeof obj.updateId === "string" || typeof obj.updateId === "number")
    return String(obj.updateId);
  if (typeof obj.meterId === "string" || typeof obj.meterId === "number")
    return String(obj.meterId);
  if (typeof obj.companyId === "string" || typeof obj.companyId === "number")
    return String(obj.companyId);

  return null;
}

export async function apiFetch(path, options = {}) {
  const url = `${getApiBaseUrl()}${path}`;
  const token = getToken();

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  // Only set JSON content-type when body is plain object/string (not FormData)
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const normalized = isJson
      ? normalizeErrorPayload(payload)
      : { error: "Request failed" };
    const err = {
      status: res.status,
      ...normalized,
      raw: payload,
    };

    // Contract requirement: on 401 trigger logout in AuthContext
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("presto:unauthorized"));
    }

    throw err;
  }

  return payload;
}
