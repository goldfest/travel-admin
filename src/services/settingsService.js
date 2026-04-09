const SETTINGS_KEY = "travel-admin-settings";

export const defaultSettings = {
  mode: "api",
  token: "",
  refreshToken: "",
  currentUser: null,
  services: {
    auth: "http://localhost:8084/api",
    city: "http://localhost:8082/api/cities",
    poi: "http://localhost:8081/api/poi",
    review: "http://localhost:8083/api/reviews",
    route: "http://localhost:8087/api/routes",
    graphImport: "http://localhost:8088",
    ml: "http://localhost:8000",
  },
};

function mergeSettings(rawSettings = {}) {
  return {
    ...defaultSettings,
    ...rawSettings,
    mode: "api",
    services: {
      ...defaultSettings.services,
      ...(rawSettings.services || {}),
    },
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
    return mergeSettings(JSON.parse(rawValue));
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
