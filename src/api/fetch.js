const TOKEN_KEY = "presto_token";

let onUnauthorized = null;

/**
 * AuthContext registers a callback here so fetchJson can trigger logout on 401.
 */
export function setOnUnauthorized(cb) {
  onUnauthorized = cb;
}

function getBaseUrl() {
  return import.meta.env.VITE_API_URL || "http://localhost:4000";
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * fetchJson - shared API helper:
 * - Adds Authorization header if token exists
 * - Parses JSON if available
 * - Throws { status, error, data } on non-2xx
 */
export async function fetchJson(path, options = {}) {
  const url = `${getBaseUrl()}${path}`;
  const token = getToken();

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  const contentType = res.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    // If backend returns non-JSON, we keep it null (contract is JSON, so this is defensive only)
    data = null;
  }

  if (!res.ok) {
    const errorMsg =
      (data && (data.error || data.message)) ||
      `Request failed with status ${res.status}`;

    if (res.status === 401 && typeof onUnauthorized === "function") {
      onUnauthorized();
    }

    throw { status: res.status, error: errorMsg, data };
  }

  return data;
}
