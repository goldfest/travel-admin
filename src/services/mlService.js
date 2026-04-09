import { getAppSettings } from "./settingsService";

function normalizeMlRootUrl(url) {
  return (url || "http://localhost:8000").replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
}

async function parseResponse(response) {
  if (response.ok) {
    return response.json();
  }

  let errorMessage = `HTTP ${response.status}`;

  try {
    const errorBody = await response.json();
    errorMessage = errorBody.detail || errorBody.message || errorMessage;
  } catch {
    errorMessage = response.statusText || errorMessage;
  }

  throw new Error(errorMessage);
}

async function request(path, options = {}) {
  const settings = getAppSettings();
  const rootUrl = normalizeMlRootUrl(settings.services.ml);
  const url = `${rootUrl}${path}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  return parseResponse(response);
}

export function getMlHealth() {
  return request("/health");
}

export function getMlModelInfo() {
  return request("/api/v1/model/info");
}

export function importFromSource(payload) {
  return request("/api/v1/poi/import-from-source", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function enrichRawPoi(payload) {
  return request("/api/v1/poi/enrich-raw", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
