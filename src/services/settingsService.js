const SETTINGS_KEY = "travel-admin-settings";

const DEFAULT_BACKEND_PREFIX = "/api";

export const defaultSettings = {
  mode: "api",
  token: "",
  refreshToken: "",
  currentUser: null,
  services: {
    auth: DEFAULT_BACKEND_PREFIX,
    city: `${DEFAULT_BACKEND_PREFIX}/cities`,
    poi: `${DEFAULT_BACKEND_PREFIX}/poi`,
    review: `${DEFAULT_BACKEND_PREFIX}/reviews`,
    route: `${DEFAULT_BACKEND_PREFIX}/routes`,
    graphImport: "",
    ml: "",
  },
};

function trimTrailingSlash(value = "") {
  return value.replace(/\/+$/, "");
}

function normalizePath(pathname = "") {
  if (!pathname || pathname === "/") {
    return "";
  }

  return trimTrailingSlash(pathname.startsWith("/") ? pathname : `/${pathname}`);
}

function normalizeServiceUrl(key, value) {
  const fallback = defaultSettings.services[key] || "";

  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const rawValue = value.trim();

  try {
    const parsed = new URL(rawValue);
    const pathname = normalizePath(parsed.pathname);

    if (key === "auth") {
      return pathname.startsWith(DEFAULT_BACKEND_PREFIX)
        ? pathname
        : DEFAULT_BACKEND_PREFIX;
    }

    if ((key === "graphImport" || key === "ml") && !pathname) {
      return "";
    }

    return pathname || fallback;
  } catch {
    const path = normalizePath(rawValue);

    if (key === "auth") {
      if (!path || path === "/auth") {
        return DEFAULT_BACKEND_PREFIX;
      }

      return path.startsWith(DEFAULT_BACKEND_PREFIX)
        ? path
        : DEFAULT_BACKEND_PREFIX;
    }

    return path || fallback;
  }
}

function normalizeServices(rawServices = {}) {
  const mergedServices = {
    ...defaultSettings.services,
    ...(rawServices || {}),
  };

  return Object.fromEntries(
    Object.entries(mergedServices).map(([key, value]) => [
      key,
      normalizeServiceUrl(key, value),
    ]),
  );
}

function mergeSettings(rawSettings = {}) {
  return {
    ...defaultSettings,
    ...rawSettings,
    mode: "api",
    services: normalizeServices(rawSettings.services),
  };
}

export function getAppSettings() {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  const rawValue = window.localStorage.getItem(SETTINGS_KEY);

  if (!rawValue) {
    return defaultSettings;
  }

  try {
    const normalized = mergeSettings(JSON.parse(rawValue));
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return defaultSettings;
  }
}

export function saveAppSettings(settings) {
  const merged = mergeSettings(settings);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  }

  return merged;
}