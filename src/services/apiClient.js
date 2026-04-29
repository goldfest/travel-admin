import { getAppSettings } from "./settingsService";

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function trimSlashes(value = "") {
  return value.replace(/\/+$/, "");
}

function buildQueryString(query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }

    params.append(key, value);
  });

  const result = params.toString();
  return result ? `?${result}` : "";
}

async function parseBody(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

function deriveMessage(payload, fallbackMessage) {
  if (!payload) {
    return fallbackMessage;
  }

  if (typeof payload === "string") {
    return payload;
  }

  return (
    payload.detail ||
    payload.message ||
    payload.error ||
    payload.title ||
    fallbackMessage
  );
}

export async function requestJson(baseUrl, path = "", options = {}) {
  const settings = getAppSettings();
  const queryString = buildQueryString(options.query);
  const url = `${trimSlashes(baseUrl)}${path}${queryString}`;
  const headers = new Headers(options.headers || {});

  headers.set("ngrok-skip-browser-warning", "true");

  if (
    !headers.has("Content-Type") &&
    options.body !== undefined &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && settings.token) {
    headers.set("Authorization", `Bearer ${settings.token}`);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body:
      options.body instanceof FormData || options.body === undefined
        ? options.body
        : JSON.stringify(options.body),
  });

  const payload = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(
      deriveMessage(payload, `HTTP ${response.status}`),
      response.status,
      payload,
    );
  }

  return payload;
}

export function parseSpringPage(payload) {
  const content = Array.isArray(payload?.content) ? payload.content : [];

  return {
    items: content,
    totalElements: payload?.totalElements ?? content.length,
    totalPages: payload?.totalPages ?? 1,
    size: payload?.size ?? content.length,
    number: payload?.number ?? 0,
    raw: payload,
  };
}

export function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function buildAbsoluteUrl(baseUrl, path) {
  if (!path) {
    return "";
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  try {
    const origin = new URL(baseUrl).origin;
    return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  } catch {
    return path;
  }
}